import boto3
import os
import json
import uuid
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
ses = boto3.client("ses")

APPOINTMENTS_TABLE = os.environ["APPOINTMENTS_TABLE"]
PROVIDERS_TABLE    = os.environ["PROVIDERS_TABLE"]
SES_EMAIL          = os.environ["SES_EMAIL"]

def lambda_handler(event, context):
    # Extract user info from Cognito JWT
    claims    = event["requestContext"]["authorizer"]["claims"]
    user_id   = claims["sub"]
    groups    = claims.get("cognito:groups", [])
    email     = claims.get("email", "")

    # Only patients can book appointments
    if "Patients" not in groups:
        return response(403, {"message": "Only patients can book appointments"})

    # Parse request body
    body = json.loads(event.get("body", "{}"))
    provider_id   = body.get("providerId")
    date_time_str = body.get("dateTime")  # expected: "2026-04-15T10:00:00"

    if not provider_id or not date_time_str:
        return response(400, {"message": "providerId and dateTime are required"})

    # Check provider exists
    providers_table = dynamodb.Table(PROVIDERS_TABLE)
    provider = providers_table.get_item(Key={"providerId": provider_id}).get("Item")

    if not provider:
        return response(404, {"message": "Provider not found"})

    if not provider.get("active", True):
        return response(400, {"message": "Provider is not accepting appointments"})

    # Check for conflicting appointment (same provider, same time)
    appointments_table = dynamodb.Table(APPOINTMENTS_TABLE)
    conflicts = appointments_table.query(
        IndexName="providerId-index",
        KeyConditionExpression=boto3.dynamodb.conditions.Key("providerId").eq(provider_id),
    )
    for appt in conflicts.get("Items", []):
        if appt["dateTime"] == date_time_str and appt["status"] != "cancelled":
            return response(409, {"message": "This time slot is already booked"})

    # Create appointment record
    appointment_id = str(uuid.uuid4())
    appointment = {
        "appointmentId": appointment_id,
        "patientId":     user_id,
        "providerId":    provider_id,
        "patientEmail":  email,
        "providerEmail": provider.get("email", ""),
        "providerName":  provider.get("name", ""),
        "dateTime":      date_time_str,
        "status":        "confirmed",
        "createdAt":     datetime.utcnow().isoformat()
    }
    appointments_table.put_item(Item=appointment)

    # Send confirmation email via SES
    try:
        ses.send_email(
            Source=SES_EMAIL,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": "Appointment Confirmed"},
                "Body": {"Text": {"Data": (
                    f"Your appointment with {provider.get('name')} "
                    f"is confirmed for {date_time_str}.\n\n"
                    f"Appointment ID: {appointment_id}"
                )}}
            }
        )
    except Exception as e:
        print(f"SES error: {e}")

    return response(201, {"message": "Appointment booked", "appointmentId": appointment_id})


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }