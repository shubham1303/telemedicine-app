variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "telemedicine"
}

variable "post_confirmation_lambda_arn" {
  # passed in as a plain string to avoid a cycle between the user pool and the lambda
  description = "ARN of the post confirmation Lambda"
  type        = string
}

variable "ses_email" {
  description = "Verified email address for SES to send notifications"
  type        = string
}
variable "alert_email" {
  description = "Where CloudWatch alarms get emailed. Leave empty to skip the subscription"
  type        = string
  default     = ""
}
