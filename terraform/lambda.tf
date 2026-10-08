#IAM Role for all Lambda functions

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # DynamoDB access
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.appointments.arn,
          "${aws_dynamodb_table.appointments.arn}/index/*",
          aws_dynamodb_table.providers.arn,
          "${aws_dynamodb_table.providers.arn}/index/*"
        ]
      },
      {
        # SES access
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        # Cognito access (for manage_providers to move users between groups)
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminGetUser",
          "cognito-idp:ListUsersInGroup"
        ]
        Resource = aws_cognito_user_pool.main.arn
      },
      {
        # CloudWatch Logs
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Lambda functions

resource "aws_lambda_function" "book_appointment" {
  function_name    = "${var.project_name}-book-appointment"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  filename         = "../lambdas/book_appointment/function.zip"
  source_code_hash = filebase64sha256("../lambdas/book_appointment/function.zip")

  environment {
    variables = {
      APPOINTMENTS_TABLE = aws_dynamodb_table.appointments.name
      PROVIDERS_TABLE    = aws_dynamodb_table.providers.name
      SES_EMAIL          = var.ses_email
    }
  }

  tags = { Project = var.project_name }
}

resource "aws_lambda_function" "list_appointments" {
  function_name    = "${var.project_name}-list-appointments"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  filename         = "../lambdas/list_appointments/function.zip"
  source_code_hash = filebase64sha256("../lambdas/list_appointments/function.zip")

  environment {
    variables = {
      APPOINTMENTS_TABLE = aws_dynamodb_table.appointments.name
    }
  }

  tags = { Project = var.project_name }
}

resource "aws_lambda_function" "update_appointment" {
  function_name    = "${var.project_name}-update-appointment"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  filename         = "../lambdas/update_appointment/function.zip"
  source_code_hash = filebase64sha256("../lambdas/update_appointment/function.zip")

  environment {
    variables = {
      APPOINTMENTS_TABLE = aws_dynamodb_table.appointments.name
      SES_EMAIL          = var.ses_email
    }
  }

  tags = { Project = var.project_name }
}

resource "aws_lambda_function" "manage_providers" {
  function_name    = "${var.project_name}-manage-providers"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  filename         = "../lambdas/manage_providers/function.zip"
  source_code_hash = filebase64sha256("../lambdas/manage_providers/function.zip")

  environment {
    variables = {
      PROVIDERS_TABLE = aws_dynamodb_table.providers.name
      USER_POOL_ID    = aws_cognito_user_pool.main.id
    }
  }

  tags = { Project = var.project_name }
}

resource "aws_lambda_function" "reminder" {
  function_name    = "${var.project_name}-reminder"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  filename         = "../lambdas/reminder/function.zip"
  source_code_hash = filebase64sha256("../lambdas/reminder/function.zip")

  environment {
    variables = {
      APPOINTMENTS_TABLE = aws_dynamodb_table.appointments.name
      SES_EMAIL          = var.ses_email
    }
  }

  tags = { Project = var.project_name }
}

# Post-confirmation Lambda (auto-assigns new users to Patients group)

resource "aws_lambda_function" "post_confirmation" {
  function_name    = "${var.project_name}-post-confirmation"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  filename         = "../lambdas/post_confirmation/function.zip"
  source_code_hash = filebase64sha256("../lambdas/post_confirmation/function.zip")

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
    }
  }

  tags = { Project = var.project_name }
}