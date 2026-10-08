import boto3
import os
import json
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")

APPOINTMENTS_TABLE = os.environ["APPOINTMENTS_TABLE"]

def lambda_handler(event, context):
    # Extract user info from Cognito JWT
    claims  = event["requestContext"]["authorizer"]["claims"]
    user_id = claims["sub"]
    groups  = claims.get("cognito:groups", [])

    appointments_table = dynamodb.Table(APPOINTMENTS_TABLE)

    # RBAC: what you can see depends on who you are
    if "Admins" in groups:
        # Admins see everything
        result = appointments_table.scan()
        items  = result.get("Items", [])

    elif "Providers" in groups:
        # Providers only see appointments assigned to them
        result = appointments_table.query(
            IndexName="providerId-index",
            KeyConditionExpression=Key("providerId").eq(user_id)
        )
        items = result.get("Items", [])

    elif "Patients" in groups:
        # Patients only see their own appointments
        result = appointments_table.query(
            IndexName="patientId-index",
            KeyConditionExpression=Key("patientId").eq(user_id)
        )
        items = result.get("Items", [])

    else:
        return response(403, {"message": "Forbidden"})

    return response(200, {"appointments": items})


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }