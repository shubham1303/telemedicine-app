resource "aws_ses_email_identity" "sender" {
  email = var.ses_email
}

output "ses_email" {
  value = aws_ses_email_identity.sender.email
}