resource "aws_dynamodb_table" "appointments" {
  name         = "${var.project_name}-appointments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "appointmentId"

  attribute {
    name = "appointmentId"
    type = "S"
  }

  attribute {
    name = "patientId"
    type = "S"
  }

  attribute {
    name = "providerId"
    type = "S"
  }

  global_secondary_index {
    name            = "patientId-index"
    hash_key        = "patientId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "providerId-index"
    hash_key        = "providerId"
    projection_type = "ALL"
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_dynamodb_table" "providers" {
  name         = "${var.project_name}-providers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "providerId"

  attribute {
    name = "providerId"
    type = "S"
  }

  tags = {
    Project = var.project_name
  }
}

output "appointments_table_name" {
  value = aws_dynamodb_table.appointments.name
}

output "providers_table_name" {
  value = aws_dynamodb_table.providers.name
}