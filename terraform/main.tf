terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

provider "google" {
  project               = var.gcp_project_id
  region                = var.gcp_region
  zone                  = var.gcp_zone
  access_token          = var.access_token != "" ? var.access_token : null
  credentials           = var.credentials_file != "" && fileexists(var.credentials_file) ? file(var.credentials_file) : null
  user_project_override = true
  billing_project       = var.gcp_project_id
}

# 1. Custom VPC Network - Always Free
resource "google_compute_network" "varta_vpc" {
  name                    = "varta-free-vpc"
  auto_create_subnetworks = false
  description             = "Varta Google Cloud Always Free VPC Network"
}

# 2. Subnetwork in the selected Free Tier Region
resource "google_compute_subnetwork" "varta_subnet" {
  name          = "varta-free-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.gcp_region
  network       = google_compute_network.varta_vpc.id
}

# 3. Firewall: Allow SSH (Port 22)
resource "google_compute_firewall" "allow_ssh" {
  name    = "varta-allow-ssh"
  network = google_compute_network.varta_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["varta-server"]
}

# 4. Firewall: Allow HTTP & HTTPS (Ports 80 & 443)
resource "google_compute_firewall" "allow_web" {
  name    = "varta-allow-web"
  network = google_compute_network.varta_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["varta-server"]
}

# 5. Firewall: Allow Internal ICMP / Ping
resource "google_compute_firewall" "allow_icmp" {
  name    = "varta-allow-icmp"
  network = google_compute_network.varta_vpc.name

  allow {
    protocol = "icmp"
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["varta-server"]
}

# 6. Compute Instance - Strict GCP Always Free Tier (e2-micro, 30 GB pd-standard)
resource "google_compute_instance" "varta_vm" {
  name         = "varta-gcp-vm"
  machine_type = var.machine_type
  zone         = var.gcp_zone
  tags         = ["varta-server", "http-server", "https-server"]

  boot_disk {
    auto_delete = true
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.boot_disk_size_gb
      type  = var.boot_disk_type
      labels = {
        project = "varta"
        tier    = "always-free"
      }
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.varta_subnet.id

    # Ephemeral external IP (Included in Always Free with running e2-micro instance)
    access_config {
      network_tier = "STANDARD"
    }
  }

  metadata = {
    ssh-keys       = "${var.ssh_user}:${var.ssh_public_key}"
    startup-script = file("${path.module}/user_data.sh")
  }

  service_account {
    scopes = [
      "https://www.googleapis.com/auth/compute",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write",
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }

  labels = {
    project = "varta"
    tier    = "always-free"
  }

  # Ensure instant clean teardown if kill switch is invoked
  deletion_protection = false

  lifecycle {
    ignore_changes = [metadata["startup-script"]]
  }
}
