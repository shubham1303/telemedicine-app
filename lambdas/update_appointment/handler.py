import boto3
import os
import json
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
ses = boto3.client("ses")

APPOINTMENTS_TABLE = os.environ["APPOINTMENTS_TABLE"]
SES_EMAIL          = os.environ["SES_EMAIL"]

def lambda_handler(event, context):
    # Extract user info from Cognito JWT
    claims  = event["requestContext"]["authorizer"]["claims"]
    user_id = claims["sub"]
    groups  = claims.get("cognito:groups", [])

    # Get appointment ID from URL path
    appointment_id = event["pathParameters"]["appointmentId"]

    # Fetch the existing appointment
    appointments_table = dynamodb.Table(APPOINTMENTS_TABLE)
    result = appointments_table.get_item(Key={"appointmentId": appointment_id})
    appointment = result.get("Item")

    if not appointment:
        return response(404, {"message": "Appointment not found"})

    # RBAC: check who is allowed to do what
    body   = json.loads(event.get("body", "{}"))
    action = body.get("action")  # "cancel" or "update"

    if "Patients" in groups:
        # Patients can only cancel their own appointments
        if appointment["patientId"] != user_id:
            return response(403, {"message": "You can only modify your own appointments"})
        if action != "cancel":
            return response(403, {"message": "Patients can only cancel appointments"})

    elif "Providers" in groups:
        # Providers can only update status of their own appointments
        if appointment["providerId"] != user_id:
            return response(403, {"message": "You can only modify your own appointments"})
        if action not in ["update"]:
            return response(403, {"message": "Providers can only update appointment status"})

    elif "Admins" in groups:
        # Admins can do anything
        pass

    else:
        return response(403, {"message": "Forbidden"})

    # Apply the change
    if action == "cancel":
        new_status = "cancelled"
    elif action == "update":
        new_status = body.get("status", appointment["status"])
    else:
        return response(400, {"message": "Invalid action. Use 'cancel' or 'update'"})

    appointments_table.update_item(
        Key={"appointmentId": appointment_id},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": new_status}
    )

    # Send notification email
    try:
        ses.send_email(
            Source=SES_EMAIL,
            Destination={"ToAddresses": [appointment["patientEmail"]]},
            Message={
                "Subject": {"Data": f"Appointment {new_status.capitalize()}"},
                "Body": {"Text": {"Data": (
                    f"Your appointment with {appointment['providerName']} "
                    f"on {appointment['dateTime']} has been {new_status}.\n\n"
                    f"Appointment ID: {appointment_id}"
                )}}
            }
        )
    except Exception as e:
        print(f"SES error: {e}")

    return response(200, {"message": f"Appointment {new_status}", "appointmentId": appointment_id})


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }