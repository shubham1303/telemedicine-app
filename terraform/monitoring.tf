# Ops dashboard + a few alarms. Nothing here changes how the app behaves.

locals {
  functions = {
    "book"         = aws_lambda_function.book_appointment.function_name
    "list"         = aws_lambda_function.list_appointments.function_name
    "update"       = aws_lambda_function.update_appointment.function_name
    "providers"    = aws_lambda_function.manage_providers.function_name
    "reminder"     = aws_lambda_function.reminder.function_name
    "post-confirm" = aws_lambda_function.post_confirmation.function_name
  }

  api_dims = ["ApiName", aws_api_gateway_rest_api.main.name, "Stage", aws_api_gateway_stage.main.stage_name]

  # pull ERROR lines and python tracebacks out of every lambda's logs
  error_log_query = join(" | ", concat(
    [for name in values(local.functions) : "SOURCE '/aws/lambda/${name}'"],
    [
      "fields @timestamp, @log, @message",
      "filter @message like /(?i)(error|traceback|exception)/",
      "sort @timestamp desc",
      "limit 50",
    ]
  ))
}

resource "aws_cloudwatch_dashboard" "ops" {
  dashboard_name = "${var.project_name}-ops"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "text", x = 0, y = 0, width = 24, height = 2
        properties = {
          markdown = "## ${var.project_name}\nAPI on API Gateway (stage `${aws_api_gateway_stage.main.stage_name}`), six Lambdas, DynamoDB, SES for email and an hourly reminder job. Alarms go to the `${aws_sns_topic.alerts.name}` SNS topic."
        }
      },

      # API
      {
        type = "metric", x = 0, y = 2, width = 12, height = 6
        properties = {
          title  = "API requests and errors"
          region = var.aws_region
          stat   = "Sum"
          period = 300
          metrics = [
            concat(["AWS/ApiGateway", "Count"], local.api_dims, [{ label = "Requests" }]),
            concat(["AWS/ApiGateway", "4XXError"], local.api_dims, [{ label = "4xx" }]),
            concat(["AWS/ApiGateway", "5XXError"], local.api_dims, [{ label = "5xx", color = "#d62728" }]),
          ]
        }
      },
      {
        type = "metric", x = 12, y = 2, width = 12, height = 6
        properties = {
          title  = "API latency (ms)"
          region = var.aws_region
          period = 300
          metrics = [
            concat(["AWS/ApiGateway", "Latency"], local.api_dims, [{ stat = "p50", label = "p50" }]),
            concat(["AWS/ApiGateway", "Latency"], local.api_dims, [{ stat = "p90", label = "p90" }]),
            concat(["AWS/ApiGateway", "IntegrationLatency"], local.api_dims, [{ stat = "p90", label = "p90 inside lambda" }]),
          ]
        }
      },

      # Lambda
      {
        type = "metric", x = 0, y = 8, width = 12, height = 6
        properties = {
          title   = "Lambda errors"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [for label, name in local.functions : ["AWS/Lambda", "Errors", "FunctionName", name, { label = label }]]
        }
      },
      {
        type = "metric", x = 12, y = 8, width = 12, height = 6
        properties = {
          title   = "Lambda duration p90 (ms)"
          region  = var.aws_region
          stat    = "p90"
          period  = 300
          metrics = [for label, name in local.functions : ["AWS/Lambda", "Duration", "FunctionName", name, { label = label }]]
        }
      },

      # reminder job, emails, sign-ups
      {
        type = "metric", x = 0, y = 14, width = 8, height = 6
        properties = {
          title  = "Reminder job (should run once an hour)"
          region = var.aws_region
          stat   = "Sum"
          period = 3600
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", local.functions["reminder"], { label = "Runs" }],
            ["AWS/Lambda", "Errors", "FunctionName", local.functions["reminder"], { label = "Failed runs", color = "#d62728" }],
          ]
        }
      },
      {
        type = "metric", x = 8, y = 14, width = 8, height = 6
        properties = {
          title  = "Email (SES, whole account)"
          region = var.aws_region
          stat   = "Sum"
          period = 3600
          metrics = [
            ["AWS/SES", "Send", { label = "Sent" }],
            ["AWS/SES", "Delivery", { label = "Delivered" }],
            ["AWS/SES", "Bounce", { label = "Bounced", color = "#d62728" }],
            ["AWS/SES", "Complaint", { label = "Complaints" }],
          ]
        }
      },
      {
        type = "metric", x = 16, y = 14, width = 8, height = 6
        properties = {
          title  = "Sign-ups and sign-ins"
          region = var.aws_region
          stat   = "Sum"
          period = 3600
          metrics = [
            ["AWS/Cognito", "SignUpSuccesses", "UserPool", aws_cognito_user_pool.main.id, "UserPoolClient", aws_cognito_user_pool_client.main.id, { label = "Sign-ups" }],
            ["AWS/Cognito", "SignInSuccesses", "UserPool", aws_cognito_user_pool.main.id, "UserPoolClient", aws_cognito_user_pool_client.main.id, { label = "Sign-ins" }],
          ]
        }
      },

      # DynamoDB
      {
        type = "metric", x = 0, y = 20, width = 12, height = 6
        properties = {
          title  = "DynamoDB capacity used"
          region = var.aws_region
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.appointments.name, { label = "appointments reads" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.appointments.name, { label = "appointments writes" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.providers.name, { label = "providers reads" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.providers.name, { label = "providers writes" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 20, width = 12, height = 6
        properties = {
          title  = "DynamoDB throttling (should stay at 0)"
          region = var.aws_region
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/DynamoDB", "ReadThrottleEvents", "TableName", aws_dynamodb_table.appointments.name, { label = "appointments reads" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", aws_dynamodb_table.appointments.name, { label = "appointments writes" }],
            ["AWS/DynamoDB", "ReadThrottleEvents", "TableName", aws_dynamodb_table.providers.name, { label = "providers reads" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", aws_dynamodb_table.providers.name, { label = "providers writes" }],
          ]
        }
      },

      # recent errors from the logs
      {
        type = "log", x = 0, y = 26, width = 24, height = 7
        properties = {
          title  = "Recent Lambda errors"
          region = var.aws_region
          query  = local.error_log_query
          view   = "table"
        }
      },
    ]
  })
}

# Alarms

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = var.alert_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email # AWS sends a confirmation email first
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.project_name}-api-5xx"
  alarm_description   = "The API returned server errors in the last 5 minutes"
  namespace           = "AWS/ApiGateway"
  metric_name         = "5XXError"
  dimensions          = { ApiName = aws_api_gateway_rest_api.main.name, Stage = aws_api_gateway_stage.main.stage_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-lambda-errors"
  alarm_description   = "At least one Lambda failed in the last 5 minutes (see the Recent Lambda errors panel)"
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  # one alarm for all six functions instead of six alarms
  metric_query {
    id          = "total"
    expression  = "SUM(METRICS())"
    label       = "Errors across all functions"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.functions
    content {
      id = "e_${replace(metric_query.key, "-", "_")}"
      metric {
        namespace   = "AWS/Lambda"
        metric_name = "Errors"
        dimensions  = { FunctionName = metric_query.value }
        stat        = "Sum"
        period      = 300
      }
    }
  }
}

# the reminder runs every hour, so two hours with no run means the schedule is broken.
# missing data counts as breaching on purpose: no data is exactly the failure we care about
resource "aws_cloudwatch_metric_alarm" "reminder_not_running" {
  alarm_name          = "${var.project_name}-reminder-not-running"
  alarm_description   = "The hourly reminder Lambda hasn't run for 2 hours"
  namespace           = "AWS/Lambda"
  metric_name         = "Invocations"
  dimensions          = { FunctionName = aws_lambda_function.reminder.function_name }
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

output "ops_dashboard_url" {
  value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards/dashboard/${aws_cloudwatch_dashboard.ops.dashboard_name}"
}
