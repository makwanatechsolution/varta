# ==============================================================================
# GOOGLE CLOUD PLATFORM (GCP) TERRAFORM VARIABLES
# Designed strictly for GCP Always Free Lifetime Tier ($0.00 / 0 INR)
# ==============================================================================

variable "gcp_project_id" {
  description = "The Google Cloud Project ID (e.g. varta-prod-2026)"
  type        = string
}

variable "gcp_region" {
  description = "GCP Region for Always Free Tier (us-central1, us-east1, or us-west1)"
  type        = string
  default     = "us-central1"
}

variable "gcp_zone" {
  description = "GCP Zone for Compute Engine instance"
  type        = string
  default     = "us-central1-a"
}

variable "credentials_file" {
  description = "Optional path to your GCP Service Account JSON key file (leave empty if authenticated via gcloud auth application-default login)"
  type        = string
  default     = ""
}

variable "access_token" {
  description = "OAuth2 access token for authenticating to Google Cloud API"
  type        = string
  default     = ""
  sensitive   = true
}

variable "billing_account_id" {
  description = "GCP Billing Account ID for Zero-Cost budget alerts (Format: 012345-6789AB-CDEF01)"
  type        = string
  default     = ""
}

variable "budget_amount" {
  description = "Budget guardrail cap amount"
  type        = number
  default     = 1
}

variable "budget_currency" {
  description = "Currency for billing budget (USD, INR, EUR, etc.)"
  type        = string
  default     = "USD"
}

variable "ssh_user" {
  description = "SSH username on Ubuntu VM"
  type        = string
  default     = "ubuntu"
}

variable "ssh_public_key" {
  description = "Public SSH key for logging into the Ubuntu VM (e.g. ssh-ed25519 ... or content of ~/.ssh/id_rsa.pub)"
  type        = string
}

variable "machine_type" {
  description = "Always Free Compute Instance Shape. e2-micro is 100% free lifetime in us-central1, us-east1, us-west1"
  type        = string
  default     = "e2-micro"
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB (GCP Always Free allows up to 30 GB Standard Persistent Disk per month)"
  type        = number
  default     = 30
}

variable "boot_disk_type" {
  description = "Persistent disk type (pd-standard is Always Free eligible up to 30GB)"
  type        = string
  default     = "pd-standard"
}

variable "alert_email" {
  description = "Email address for 0-Cost Budget Alerts"
  type        = string
  default     = "yash.makwana.b@gmail.com"
}
