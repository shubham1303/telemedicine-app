# Run the reminder Lambda every hour
resource "aws_cloudwatch_event_rule" "reminder_schedule" {
  name                = "${var.project_name}-reminder-schedule"
  description         = "Triggers reminder Lambda every hour"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "reminder_target" {
  rule      = aws_cloudwatch_event_rule.reminder_schedule.name
  target_id = "reminderLambda"
  arn       = aws_lambda_function.reminder.arn
}

resource "aws_lambda_permission" "eventbridge_reminder" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reminder.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.reminder_schedule.arn
}