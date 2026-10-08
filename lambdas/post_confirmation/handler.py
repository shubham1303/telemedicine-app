import boto3
import os

cognito = boto3.client("cognito-idp")

def lambda_handler(event, context):
    user_pool_id = os.environ["USER_POOL_ID"]
    username = event["userName"]

    # Auto-assign every new confirmed user to the Patients group
    cognito.admin_add_user_to_group(
        UserPoolId=user_pool_id,
        Username=username,
        GroupName="Patients"
    )

    # Must return the event back to Cognito
    return event