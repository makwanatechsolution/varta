# Varta — Google Cloud Platform (GCP) Always Free Lifetime Infrastructure Guide

> **100% Free Lifetime Guarantee ($0.00 / 0 INR)**  
> Engineered with automated zero-cost budget guardrails, safe-harbor disaster recovery backups, continuous billing watchdogs, and an emergency self-destruction kill-switch if any charge > 0 is ever detected.

---

## 1. Google Cloud Always Free Tier Specifications

Google Cloud Platform (GCP) offers an official **Always Free** tier that never expires:

| Resource | Always Free Allowance | Varta Configuration | Cost |
| :--- | :--- | :--- | :--- |
| **Compute Instance** | 1 non-preemptible `e2-micro` VM per month | 1 `e2-micro` (2 vCPUs, 1 GB RAM + 2 GB Swap) | **$0.00 / 0 INR** |
| **Regions** | `us-central1`, `us-east1`, `us-west1` | `us-central1` (Iowa) | **$0.00 / 0 INR** |
| **Persistent Storage** | 30 GB Standard Persistent Disk (`pd-standard`) | 30 GB Boot Disk with auto-delete | **$0.00 / 0 INR** |
| **External IPv4** | Ephemeral external IP attached to active VM | 1 Ephemeral IPv4 included with instance | **$0.00 / 0 INR** |
| **Network Egress** | 1 GB outbound egress per month worldwide | Uncapped ingress, optimized media payloads | **$0.00 / 0 INR** |
| **VPC & Firewall** | Unlimited custom VPCs, subnets, firewall rules | 1 Custom VPC + Subnet + Firewall (22, 80, 443) | **$0.00 / 0 INR** |

---

## 2. Prerequisites & GCP Project Setup

### Step 1: Create a Google Cloud Account & Project
1. Visit [Google Cloud Console](https://console.cloud.google.com/) and sign in.
2. Create a new project (e.g., `varta-prod-2026`). Note down your **Project ID**.
3. Ensure a Billing Account is linked (GCP requires a billing card for identity verification, but Always Free resources are **$0.00 / 0 INR**).

### Step 2: Enable Required GCP APIs
In Cloud Shell or your local terminal with `gcloud` installed:
```bash
gcloud services enable \
  compute.googleapis.com \
  cloudbilling.googleapis.com \
  billingbudgets.googleapis.com \
  --project="YOUR_PROJECT_ID"
```

### Step 3: Create a Deployment Service Account
1. In Cloud Console, go to **IAM & Admin** → **Service Accounts** → **Create Service Account**.
2. Name: `varta-deployer`.
3. Assign the following roles:
   - `Compute Instance Admin (v1)`
   - `Compute Network Admin`
   - `Billing Viewer` (optional, for budget checks)
4. Click **Keys** → **Add Key** → **Create new key** (JSON).
5. Save the downloaded JSON key file securely (e.g., `~/.gcp/credentials.json`).

---

## 3. Automated Infrastructure Deployment with Terraform

All infrastructure is defined as code in `terraform/`.

### Step 1: Install Terraform
- **Windows**: `winget install HashiCorp.Terraform`
- **Linux / macOS**: `brew install terraform` or `sudo apt install terraform`

### Step 2: Configure Terraform Variables
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Open `terraform/terraform.tfvars` and set your values:
```hcl
gcp_project_id     = "chatapp-varta"
gcp_region         = "us-central1"
gcp_zone           = "us-central1-a"
credentials_file   = "gcp-credentials.json"
billing_account_id = "011C08-621B3E-FE2A16"

# Your public SSH key (content of ~/.ssh/id_ed25519.pub or ~/.ssh/id_rsa.pub)
ssh_user           = "ubuntu"
ssh_public_key     = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... you@email.com"

# Always Free specs
machine_type       = "e2-micro"
boot_disk_size_gb  = 30
boot_disk_type     = "pd-standard"

alert_email        = "yash.makwana.b@gmail.com"
```

### Step 3: Deploy
```bash
terraform init
terraform plan
terraform apply -auto-approve
```

Terraform will provision your VPC Network, Subnet, Firewall rules (Ports 22, 80, 443), Zero-Cost Budget Alert ($0.01 limit), and the Always Free `e2-micro` VM with automated 2GB swap and Docker Engine bootstrap.

Outputs will display:
```
instance_name       = "varta-gcp-vm"
instance_zone       = "us-central1-a"
instance_public_ip  = "34.xx.xx.xx"
ssh_command         = "ssh ubuntu@34.xx.xx.xx"
web_application_url = "http://34.xx.xx.xx"
healthcheck_url     = "http://34.xx.xx.xx/health"
```

---

## 4. Application Stack Architecture (Docker Compose)

The self-hosted stack runs inside Docker on the GCP VM:

```
                           [Internet Clients]
                                   │
                                   ▼
                     ┌───────────────────────────┐
                     │    Nginx Reverse Proxy    │ (Ports 80 & 443)
                     │    - Static SPA Hosting   │
                     │    - SSL Termination      │
                     └─────────────┬─────────────┘
                                   │
         ┌─────────────────────────┼────────────────────────┐
         │                         │                        │
         ▼                         ▼                        ▼
 ┌───────────────┐         ┌───────────────┐        ┌───────────────┐
 │ Varta Express │         │  Kong Gateway │        │  PostgreSQL   │
 │ Node.js API   │         │  (Supabase)   │        │  Database 15  │
 │  (Port 4000)  │         │  (Port 8000)  │        │  (Port 5432)  │
 └───────────────┘         └───────┬───────┘        └───────▲───────┘
                                   │                        │
                   ┌───────────────┼────────────────┐       │
                   ▼               ▼                ▼       │
             ┌───────────┐   ┌───────────┐   ┌───────────┐  │
             │  GoTrue   │   │ PostgREST │   │ Realtime  │──┘
             │   Auth    │   │  REST API │   │ WebSockets│
             └───────────┘   └───────────┘   └───────────┘
```

### Starting the Stack Manually on VM:
```bash
ssh ubuntu@<GCP_VM_IP>
cd /opt/varta/deploy
cp .env.production.example .env
# Edit .env with your secrets
docker compose up -d --build
```

---

## 5. The Zero-Cost Kill Switch & Safe Harbor Protocol

### How the Guardrails Work:
1. **GCP Cloud Billing Budget Guardrail**:
   - Terraform configures `google_billing_budget` set to alert at **1% spend ($0.01 / ~1 Rupee)**.
2. **Cost Watchdog Daemon (`scripts/cost_watchdog.sh`)**:
   - A systemd timer (`varta-watchdog.timer`) runs every **15 minutes** on the VM.
   - It validates that the boot disk never exceeds the **30 GB Always Free limit**.
   - It queries GCP Billing / Budgets via `gcloud` CLI.
   - If non-zero charges are detected, it immediately triggers `kill_switch.sh`.
3. **Safe Harbor Backup Before Purge**:
   - The kill switch **NEVER** deletes without taking a full backup first!
   - `scripts/backup.sh` dumps the PostgreSQL database (`pg_dumpall`), packages all media/storage volumes, calculates SHA-256 checksums, and pushes the snapshot off-site (to GitHub Releases / Artifacts or secure storage).
4. **Instant Self-Destruction**:
   - After the backup is secured, the script queries GCP Instance Metadata (`http://metadata.google.internal/computeMetadata/v1/`) and executes:
     ```bash
     gcloud compute instances delete varta-gcp-vm --zone=us-central1-a --delete-disks=all --quiet
     ```
   - Both the VM and the boot disk are deleted immediately to guarantee zero recurring charges.

### Manual Emergency Kill Switch:
- **Via GitHub Actions**:
  1. Go to repository **Actions** tab.
  2. Select **Emergency Zero-Cost Kill Switch (GCP)**.
  3. Enter confirmation phrase: `DESTROY-VARTA-INFRA`.
  4. GitHub Actions will take a remote backup, download the archive to GitHub Artifacts, and terminate the GCP VM and attached disks.
- **Via SSH**:
  ```bash
  sudo /opt/varta/scripts/kill_switch.sh "MANUAL_CLI_TRIGGER"
  ```

---

## 6. Continuous Deployment (CI/CD)

The repository includes ready-to-use GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Description |
| :--- | :--- | :--- |
| `deploy-gcp.yml` | Push to `main` | Builds SPA, synchronizes code to GCP VM, launches Docker stack, and checks health endpoint. |
| `backup.yml` | Daily at 02:00 UTC | Dumps DB + media, downloads `.tar.gz` and stores as GitHub Action Artifact (90 days retention). |
| `cost-monitor.yml` | Every 6 hours | Queries GCP Billing API. If cost > 0, auto-triggers the emergency kill-switch. |
| `kill-switch.yml` | Manual Dispatch | Emergency destruction with guaranteed pre-deletion backup and GCP API instance termination. |

### Required GitHub Repository Secrets:
Go to **Settings** → **Secrets and variables** → **Actions** and add:

- `GCP_VM_IP`: Public IP of the GCP VM.
- `GCP_SSH_PRIVATE_KEY`: Private SSH key used to log in as `ubuntu`.
- `GCP_PROJECT_ID`: Your GCP Project ID (e.g. `varta-prod-2026`).
- `GCP_SA_KEY`: Service Account JSON key content for GCP API operations.
- `GCP_ZONE`: Zone of the instance (default: `us-central1-a`).
- `GCP_INSTANCE_NAME`: Name of the instance (`varta-gcp-vm`).
- `POSTGRES_PASSWORD`: Strong password for PostgreSQL.
- `JWT_SECRET`: 32+ character JWT secret.
- `VITE_SUPABASE_URL`: `http://<GCP_VM_IP>` or `https://varta.yourdomain.com`.
- `VITE_SUPABASE_ANON_KEY`: Anon JWT token for client queries.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role JWT token for backend operations.
- `RESEND_API_KEY`: API key from [Resend.com](https://resend.com) for invite & approval emails.
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Service account JSON for FCM push notifications.
- `ALERT_WEBHOOK_URL`: (Optional) Discord/Slack/Telegram webhook for emergency notifications.
