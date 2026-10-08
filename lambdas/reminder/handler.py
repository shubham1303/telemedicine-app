import boto3
import os
import json
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
ses      = boto3.client("ses")

APPOINTMENTS_TABLE = os.environ["APPOINTMENTS_TABLE"]
SES_EMAIL          = os.environ["SES_EMAIL"]

def lambda_handler(event, context):
    """
    Triggered by EventBridge every hour.
    Scans for appointments happening in the next 24 hours and sends reminder emails.
    """
    appointments_table = dynamodb.Table(APPOINTMENTS_TABLE)

    now       = datetime.now(timezone.utc)
    window_start = (now + timedelta(hours=23, minutes=30)).isoformat()
    window_end   = (now + timedelta(hours=24, minutes=30)).isoformat()

    # Scan for confirmed appointments in the 24hr window
    result = appointments_table.scan(
        FilterExpression=(
            Attr("status").eq("confirmed") &
            Attr("dateTime").between(window_start, window_end)
        )
    )

    appointments = result.get("Items", [])
    sent = 0

    for appt in appointments:
        patient_email  = appt.get("patientEmail", "")
        provider_email = appt.get("providerEmail", "")
        provider_name  = appt.get("providerName", "your provider")
        date_time      = appt.get("dateTime", "")
        appointment_id = appt.get("appointmentId", "")

        # Send reminder to patient
        if patient_email:
            try:
                ses.send_email(
                    Source=SES_EMAIL,
                    Destination={"ToAddresses": [patient_email]},
                    Message={
                        "Subject": {"Data": "Appointment Reminder — Tomorrow"},
                        "Body": {"Text": {"Data": (
                            f"This is a reminder that you have an appointment "
                            f"with {provider_name} tomorrow at {date_time}.\n\n"
                            f"Appointment ID: {appointment_id}"
                        )}}
                    }
                )
                sent += 1
            except Exception as e:
                print(f"Failed to send reminder to {patient_email}: {e}")

        # Send reminder to provider
        if provider_email:
            try:
                ses.send_email(
                    Source=SES_EMAIL,
                    Destination={"ToAddresses": [provider_email]},
                    Message={
                        "Subject": {"Data": "Appointment Reminder — Tomorrow"},
                        "Body": {"Text": {"Data": (
                            f"Reminder: you have an appointment tomorrow at {date_time}.\n\n"
                            f"Appointment ID: {appointment_id}"
                        )}}
                    }
                )
                sent += 1
            except Exception as e:
                print(f"Failed to send reminder to {provider_email}: {e}")

    print(f"Reminder run complete. Sent {sent} emails for {len(appointments)} appointments.")
    return {"statusCode": 200, "body": f"Sent {sent} reminders"}