output "instance_name" {
  description = "The name of your GCP Compute Engine VM instance"
  value       = google_compute_instance.varta_vm.name
}

output "instance_zone" {
  description = "The GCP zone where the VM is deployed"
  value       = google_compute_instance.varta_vm.zone
}

output "instance_public_ip" {
  description = "The Public IPv4 Address of your Varta GCP VM"
  value       = google_compute_instance.varta_vm.network_interface[0].access_config[0].nat_ip
}

output "instance_id" {
  description = "The Compute Engine Instance ID"
  value       = google_compute_instance.varta_vm.instance_id
}

output "ssh_command" {
  description = "SSH Command to connect to the instance"
  value       = "ssh ${var.ssh_user}@${google_compute_instance.varta_vm.network_interface[0].access_config[0].nat_ip}"
}

output "web_application_url" {
  description = "Public URL for Varta App"
  value       = "http://${google_compute_instance.varta_vm.network_interface[0].access_config[0].nat_ip}"
}

output "healthcheck_url" {
  description = "Backend Health Endpoint"
  value       = "http://${google_compute_instance.varta_vm.network_interface[0].access_config[0].nat_ip}/health"
}

output "budget_id" {
  description = "GCP Zero-Cost Guardrail Budget Resource Name"
  value       = length(google_billing_budget.zero_cost_budget) > 0 ? google_billing_budget.zero_cost_budget[0].name : "Not configured"
}
