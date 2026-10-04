# ==============================================================================
# GCP CLOUD BILLING BUDGET & ZERO-COST SPEND ALERT
# Triggers email alerts if any billing charge exceeds $0.00 / 0 INR
# ==============================================================================

resource "google_billing_budget" "zero_cost_budget" {
  count           = var.billing_account_id != "" ? 1 : 0
  billing_account = var.billing_account_id
  display_name    = "varta-zero-cost-guardrail"

  budget_filter {
    projects = ["projects/${var.gcp_project_id}"]
    credit_types_treatment = "INCLUDE_ALL_CREDITS"
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency
      units         = tostring(var.budget_amount)
    }
  }

  threshold_rules {
    threshold_percent = 0.01
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.50
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }
}
