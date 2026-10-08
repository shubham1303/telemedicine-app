import boto3
import os
import json
import uuid
from datetime import datetime

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

    # GET is allowed for all authenticated users (patients need to browse providers)
    if method == "GET":
        return list_providers()

    # All other methods are admin only
    if "Admins" not in groups:
        return response(403, {"message": "Only admins can manage providers"})

    method = event["httpMethod"]
    body   = json.loads(event.get("body", "{}"))

    # Route by HTTP method
    if method == "POST":
        return create_provider(body)
    elif method == "PUT":
        provider_id = event["pathParameters"]["providerId"]
        return update_provider(provider_id, body)
    elif method == "DELETE":
        provider_id = event["pathParameters"]["providerId"]
        return deactivate_provider(provider_id)
    elif method == "GET":
        return list_providers()
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

    provider_id = str(uuid.uuid4())
    providers_table = dynamodb.Table(PROVIDERS_TABLE)

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

    # Move user from Patients group to Providers group in Cognito
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

    return response(201, {"message": "Provider created", "providerId": provider_id})


def update_provider(provider_id, body):
    """Update provider name, specialty, or active status"""
    providers_table = dynamodb.Table(PROVIDERS_TABLE)

    providers_table.update_item(
        Key={"providerId": provider_id},
        UpdateExpression="SET #n = :n, specialty = :s, active = :a",
        ExpressionAttributeNames={"#n": "name"},
        ExpressionAttributeValues={
            ":n": body.get("name"),
            ":s": body.get("specialty"),
            ":a": body.get("active", True)
        }
    )
    return response(200, {"message": "Provider updated"})


def deactivate_provider(provider_id):
    """Deactivate a provider so they can't receive new bookings"""
    providers_table = dynamodb.Table(PROVIDERS_TABLE)

    providers_table.update_item(
        Key={"providerId": provider_id},
        UpdateExpression="SET active = :a",
        ExpressionAttributeValues={":a": False}
    )
    return response(200, {"message": "Provider deactivated"})


def list_providers():
    """Return all active providers (used by patients when booking)"""
    providers_table = dynamodb.Table(PROVIDERS_TABLE)
    result = providers_table.scan(
        FilterExpression=boto3.dynamodb.conditions.Attr("active").eq(True)
    )
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