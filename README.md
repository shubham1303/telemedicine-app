# telemedicine-app

Appointment booking for a small clinic: patients book with a provider, providers
manage their schedule, and an admin manages who counts as a provider. It runs
serverless on AWS and the infrastructure is all Terraform.

## Roles

Everyone who signs up starts as a **patient** (a Cognito post-confirmation trigger
adds them to the `Patients` group). The frontend reads the group from the ID token
and shows one of three dashboards:

- **Patient** - pick a provider and a time, book, see your appointments, cancel
- **Provider** - see your appointments with some quick stats, mark them completed or cancelled
- **Admin** - promote a user to provider, deactivate providers, see every appointment

Patients get an email when they book and when an appointment's status changes.
An hourly job also emails both sides about 24h before the appointment.

## Architecture

```
React (S3 + CloudFront)
   |
   |  Cognito JWT
   v
API Gateway (REST, Cognito authorizer)
   |
   +-- GET/POST /appointments          -> list_appointments / book_appointment
   +-- PUT /appointments/{id}          -> update_appointment
   +-- GET/POST/PUT/DELETE /providers  -> manage_providers
   |
   v
DynamoDB (appointments, providers)      SES for emails

EventBridge (every hour) -> reminder lambda
Cognito post-confirmation -> post_confirmation lambda
```

The Lambdas are Python 3.11. Access rules are enforced in the Lambdas based on
`cognito:groups`. For example, a provider can only update their own appointments
and a patient can only cancel.

## Deploying

You'll need an AWS account, Terraform, Node, and an S3 bucket + DynamoDB table for
Terraform state.

1. Zip each lambda (Terraform expects `lambdas/<name>/function.zip`):
   ```sh
   cd lambdas/book_appointment && zip function.zip handler.py && cd ../..
   # same for the other five
   ```
2. Copy `terraform/backend.hcl.example` to `backend.hcl` and
   `terraform/terraform.tfvars.example` to `terraform.tfvars`, and fill them in.
3. Apply:
   ```sh
   cd terraform
   terraform init -backend-config=backend.hcl
   terraform apply
   ```
4. Copy `frontend/.env.example` to `frontend/.env.local` and fill it in from
   `terraform output` (user pool id, client id, api url).
5. Build and upload the frontend:
   ```sh
   cd frontend
   npm install && npm run build
   aws s3 sync build/ s3://<frontend_bucket output>
   ```
6. Verify your sender address in SES. While the account is in the SES sandbox the
   recipients need to be verified too, otherwise emails silently don't arrive.
7. Sign up, then add yourself to the `Admins` group in the Cognito console.

## Monitoring

`terraform/monitoring.tf` sets up a CloudWatch dashboard (`telemedicine-ops`) and
three alarms that email you through SNS:

- the API returned any 5xx errors in the last 5 minutes
- any of the six Lambdas threw an error
- the reminder job hasn't run for 2 hours

The last one is the one I actually care about. If the EventBridge schedule breaks,
nothing errors, reminders just quietly stop going out. So that alarm treats
*missing* data as a failure instead of ignoring it.

The dashboard has API traffic, errors and latency, Lambda errors and p90 duration,
the reminder job's hourly runs, SES sends/bounces, Cognito sign-ups and sign-ins,
DynamoDB throttling, and a panel that pulls recent ERROR lines and tracebacks out of
all the Lambda log groups.

Set `alert_email` in `terraform.tfvars` and AWS will send a confirmation email to
that address before alarms start arriving. Cost-wise it should fit in the free tier
(3 dashboards and 10 alarm metrics are free).

## Known issues

Still rough in a few places:

- Providers created from the admin screen get a random UUID as `providerId`, but the
  appointment lambdas match providers by their Cognito `sub`. So a provider added
  through the UI can't see their appointments yet. I've been working around it by
  inserting provider rows by hand. This is the next thing to fix.
- Deactivating a provider fails because `DELETE` has no body and the handler tries
  to `json.loads` it.
- Appointment times are stored as the browser's local time without a timezone, while
  the reminder job compares in UTC. So reminders are off by your UTC offset.
- Double-booking is only caught if the times match exactly.
- The post-confirmation lambda ARN is passed as a variable to get around a circular
  dependency between the user pool and the lambda, which makes a first deploy into a
  fresh account a two-step thing.
