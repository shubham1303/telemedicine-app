import boto3
import os
import json
from datetime import datetime
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
cognito  = boto3.client("cognito-idp")

PROVIDERS_TABLE = os.environ["PROVIDERS_TABLE"]
USER_POOL_ID    = os.environ["USER_POOL_ID"]

def lambda_handler(event, context):
    # Extract user info from Cognito JWT
    claims  = event["requestContext"]["authorizer"]["claims"]
    groups  = claims.get("cognito:groups", [])

    method = event["httpMethod"]
    body   = json.loads(event.get("body", "{}") or "{}")

    # GET is allowed for all authenticated users (patients need to browse providers).
    # Admins also get the inactive ones so the admin screen can show them
    if method == "GET":
        return list_providers(include_inactive="Admins" in groups)

    # All other methods are admin only
    if "Admins" not in groups:
        return response(403, {"message": "Only admins can manage providers"})

    # Route by HTTP method
    if method == "POST":
        return create_provider(body)
    elif method == "PUT":
        provider_id = event["pathParameters"]["providerId"]
        return update_provider(provider_id, body)
    elif method == "DELETE":
        provider_id = event["pathParameters"]["providerId"]
        return deactivate_provider(provider_id)
    else:
        return response(405, {"message": "Method not allowed"})


def create_provider(body):
    """Create a provider profile in DynamoDB and move user to Providers group in Cognito"""
    username  = body.get("username")   # Cognito username of the user to promote
    name      = body.get("name")
    specialty = body.get("specialty")
    email     = body.get("email")

    if not all([username, name, specialty, email]):
        return response(400, {"message": "username, name, specialty and email are required"})

    # The appointment lambdas match providers on their Cognito sub, so the
    # provider record has to use the sub as its id (it used to be a random uuid,
    # which meant providers added here never saw their appointments)
    try:
        user = cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=username)
    except cognito.exceptions.UserNotFoundException:
        return response(404, {"message": f"No user called {username}"})
    provider_id = next(a["Value"] for a in user["UserAttributes"] if a["Name"] == "sub")

    providers_table = dynamodb.Table(PROVIDERS_TABLE)
    if providers_table.get_item(Key={"providerId": provider_id}).get("Item"):
        return response(409, {"message": f"{username} is already a provider"})

    # Move user from Patients group to Providers group in Cognito first, so a
    # failure here doesn't leave a provider record behind for a non-provider
    try:
        cognito.admin_remove_user_from_group(
            UserPoolId=USER_POOL_ID,
            Username=username,
            GroupName="Patients"
        )
        cognito.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID,
            Username=username,
            GroupName="Providers"
        )
    except Exception as e:
        return response(500, {"message": f"Cognito group update failed: {str(e)}"})

    # Save provider profile to DynamoDB
    providers_table.put_item(Item={
        "providerId": provider_id,
        "username":   username,
        "name":       name,
        "specialty":  specialty,
        "email":      email,
        "active":     True,
        "createdAt":  datetime.utcnow().isoformat()
    })

    return response(201, {"message": "Provider created", "providerId": provider_id})


def update_provider(provider_id, body):
    """Update provider name, specialty, or active status"""
    providers_table = dynamodb.Table(PROVIDERS_TABLE)

    # only touch the fields that were sent, so leaving one out doesn't blank it
    fields = {k: body[k] for k in ("name", "specialty", "active") if k in body}
    if not fields:
        return response(400, {"message": "Send at least one of name, specialty, active"})

    try:
        providers_table.update_item(
            Key={"providerId": provider_id},
            UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
            ExpressionAttributeNames={f"#{k}": k for k in fields},
            ExpressionAttributeValues={f":{k}": v for k, v in fields.items()},
            ConditionExpression=Attr("providerId").exists()  # don't create a stray record
        )
    except providers_table.meta.client.exceptions.ConditionalCheckFailedException:
        return response(404, {"message": "Provider not found"})
    return response(200, {"message": "Provider updated"})


def deactivate_provider(provider_id):
    """Deactivate a provider so they can't receive new bookings"""
    providers_table = dynamodb.Table(PROVIDERS_TABLE)

    try:
        providers_table.update_item(
            Key={"providerId": provider_id},
            UpdateExpression="SET active = :a",
            ExpressionAttributeValues={":a": False},
            ConditionExpression=Attr("providerId").exists()  # don't create a stray record
        )
    except providers_table.meta.client.exceptions.ConditionalCheckFailedException:
        return response(404, {"message": "Provider not found"})
    return response(200, {"message": "Provider deactivated"})


def list_providers(include_inactive=False):
    """Active providers for patients booking; everyone for admins"""
    providers_table = dynamodb.Table(PROVIDERS_TABLE)
    if include_inactive:
        result = providers_table.scan()
    else:
        result = providers_table.scan(FilterExpression=Attr("active").eq(True))
    return response(200, {"providers": result.get("Items", [])})


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }