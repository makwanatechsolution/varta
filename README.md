# 💬 Varta — Enterprise Realtime Communication Platform

> **100% Lifetime Free Infrastructure ($0.00 / 0 INR)**  
> High-performance real-time messaging, WebRTC audio/video calls, and ephemeral status stories deployed on **Google Cloud Platform (GCP) Always Free Tier**. Engineered with an automated zero-cost budget kill-switch that takes a complete safe-harbor backup before terminating resources if any charges are ever detected.

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Always_Free_Lifetime-4285F4?style=flat&logo=googlecloud&logoColor=white)](https://cloud.google.com/free)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?style=flat&logo=terraform&logoColor=white)](https://www.terraform.io/)
[![Zero Cost](https://img.shields.io/badge/Cost-$0.00%20Lifetime%20(0%20INR)-brightgreen?style=flat)](#-zero-rupee-guarantee--kill-switch)

---

## 📋 Table of Contents

- [Zero-Rupee Guarantee & Kill Switch](#-zero-rupee-guarantee--kill-switch)
- [Enterprise Architecture](#-enterprise-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Google Cloud Deployment (Terraform)](#-google-cloud-deployment-terraform)
- [Docker Compose Self-Hosted Backend](#-docker-compose-self-hosted-backend)
- [Backup & Disaster Recovery](#-backup--disaster-recovery)
- [CI/CD Automation Pipelines](#-cicd-automation-pipelines)
- [Local Development Setup](#-local-development-setup)
- [Documentation & Guides](#-documentation--guides)

---

## 🛡️ Zero-Rupee Guarantee & Kill Switch

Varta is strictly configured to run within Google Cloud Platform's **Always Free Tier limits**:
- **Compute**: 1 non-preemptible `e2-micro` VM instance (2 vCPUs, 1 GB RAM + 2 GB Swap) in `us-central1`, `us-east1`, or `us-west1`
- **Storage**: 30 GB Standard Persistent Disk (`pd-standard`) with auto-delete on termination
- **Bandwidth**: 1 GB/month free outbound transfer worldwide
- **Network**: 1 Included Ephemeral Public IPv4 Address, Custom VPC, Firewall Rules (22, 80, 443)

### Multi-Layered Protection System:
1. **GCP Cloud Billing Budget Alert ($0.01 Threshold)**:
   - Terraform configures a Google Cloud Billing Budget set to alert at **1% spend ($0.01 / ~1 Rupee)**.
2. **Cost Watchdog Daemon (`scripts/cost_watchdog.sh`)**:
   - A background systemd timer runs every **15 minutes** on the VM.
   - It verifies that storage remains within the 30 GB free threshold and queries GCP billing budgets.
   - If any accrued charge > `0.0001` is detected, it automatically executes the emergency protocol.
3. **Continuous CI/CD Cost Monitor (`.github/workflows/cost-monitor.yml`)**:
   - Runs every 6 hours in GitHub Actions to cross-check project billing via Google Cloud API.
4. **Mandatory Safe-Harbor Backup Before Teardown**:
   - The kill switch **never deletes blindly**.
   - `scripts/backup.sh` first takes a complete `pg_dumpall` database dump, packages all uploaded media/storage files, verifies the SHA-256 integrity hash, and pushes the snapshot off-site (to GitHub Releases / Artifacts or offsite storage).
5. **Immediate Infrastructure Termination**:
   - Once backup integrity is confirmed, the script calls the Google Cloud API or `gcloud` CLI to terminate the VM and force-delete all attached persistent disks:
     ```bash
     gcloud compute instances delete varta-gcp-vm --zone=us-central1-a --delete-disks=all --quiet
     ```
   - All compute, disk, and IP charges cease instantly, guaranteeing 0 rupees spent.

---

## 🏗️ Enterprise Architecture

```
                                  [Internet Clients]
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │          Nginx Reverse Proxy          │ (Ports 80 & 443)
                      │    - SSL Let's Encrypt / Certbot      │
                      │    - SPA PushState Static Hosting     │
                      │    - Rate Limiting & Gzip Compression │
                      └───────────────────┬───────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
 ┌───────────────┐                ┌───────────────┐                ┌───────────────┐
 │ Varta Express │ (Port 4000)    │  Kong Gateway │ (Port 8000)    │  PostgreSQL   │ (Port 5432)
 │ Node.js Server│                │  (Supabase)   │                │  Database 15  │
 │  - FCM Push   │                └───────┬───────┘                │  - Migrations │
 │  - Resend Mail│                        │                        │  - RLS Security
 │  - Health API │        ┌───────────────┼───────────────┐        └───────▲───────┘
 └───────────────┘        ▼               ▼               ▼                │
                    ┌───────────┐   ┌───────────┐   ┌───────────┐          │
                    │  GoTrue   │   │ PostgREST │   │ Realtime  │──────────┘
                    │   Auth    │   │  REST API │   │ WebSockets│
                    └───────────┘   └───────────┘   └───────────┘
```

---

## ✨ Features

- 💬 **Zero-Flicker Realtime Chat**: Instant messaging with typing indicators, reactions, reply threads, and emoji picker.
- 📞 **HD WebRTC Voice & Video Calling**: Peer-to-peer audio & video calls with Metered STUN/TURN fallback.
- 📸 **Status Stories**: Disappearing 24-hour media & text status updates with view receipts.
- 👥 **Group Channels & Administration**: Public & private channels with role-based member management.
- 🎙️ **Voice Notes**: In-browser audio recording, playback waveform, and voice memo sharing.
- 🛡️ **Admin Approval Pipeline**: Gate new user signups with admin dashboard review and email alerts.
- 🔐 **Hardened Account Security**: Password changes, 2FA TOTP enrollment, App Lock PIN, and session revocation.
- 📱 **QR Code Device Pairing**: Multi-session linking for mobile and desktop browsers.
- 🔔 **Multi-Channel Notifications**: Firebase Cloud Messaging (Web Push) + rich HTML transaction emails via Resend.

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Cloud Infrastructure** | Google Cloud Platform Always Free (`e2-micro`, 30 GB Disk) | 100% Free Lifetime Hosting |
| **Infrastructure as Code** | Terraform (`terraform/`) | Automated reproducible GCP provisioning |
| **Reverse Proxy** | Nginx Alpine (`deploy/nginx/`) | SSL termination, reverse proxy, static caching |
| **API Layer** | Node.js, Express, TypeScript (`server/`) | FCM push, Resend email, health monitoring |
| **Database & Realtime** | Supabase Open-Source Stack (`deploy/`) | PostgreSQL 15, GoTrue Auth, PostgREST, Realtime WS |
| **Frontend SPA** | React 19, Vite 8, TypeScript, Tailwind CSS v4 | Ultra-responsive client web application |
| **Disaster Recovery** | Bash, OpenSSL, gcloud CLI (`scripts/`) | Automated safe-harbor backup & zero-cost kill switch |

---

## 🚀 Google Cloud Deployment (Terraform)

For detailed step-by-step instructions, see the [GCP Setup Guide](GCP_SETUP.md).

### Quick Deployment Steps:
1. Create a GCP Project and enable Compute Engine and Cloud Billing APIs.
2. Configure Terraform:
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your gcp_project_id, billing_account_id, and ssh_public_key
   ```
3. Initialize and provision:
   ```bash
   terraform init
   terraform apply -auto-approve
   ```
4. Terraform outputs the public IP and SSH command:
   ```
   instance_public_ip  = "34.xx.xx.xx"
   ssh_command         = "ssh ubuntu@34.xx.xx.xx"
   ```

---

## 🐳 Docker Compose Self-Hosted Backend

The entire backend runs as an integrated Docker stack located in `deploy/`:

```bash
# Connect to your GCP VM
ssh ubuntu@<GCP_VM_IP>

# Navigate to deploy directory
cd /opt/varta/deploy

# Configure production environment
cp .env.production.example .env
nano .env

# Launch the entire stack
docker compose up -d --build

# Check status
docker compose ps
curl http://localhost/health
```

---

## 💾 Backup & Disaster Recovery

### Manual Backup (Safe Harbor):
```bash
# On the GCP VM
sudo /opt/varta/scripts/backup.sh
```
- Creates an encrypted archive in `/opt/varta/backups/varta_backup_YYYYMMDD_HHMMSS.tar.gz`.
- Dumps PostgreSQL schemas and data.
- Archives media attachments and storage volumes.
- Automatically pushes the snapshot offsite to GitHub Releases if `GITHUB_BACKUP_TOKEN` is configured.

### Restoring from Backup:
```bash
sudo /opt/varta/scripts/restore.sh /opt/varta/backups/varta_backup_YYYYMMDD_HHMMSS.tar.gz
```

### Emergency Manual Kill Switch:
```bash
# On the GCP VM
sudo /opt/varta/scripts/kill_switch.sh "MANUAL_TRIGGER"
```
Or trigger it remotely in GitHub via the **Emergency Zero-Cost Kill Switch (GCP)** workflow with confirmation phrase `DESTROY-VARTA-INFRA`.

---

## 🔄 CI/CD Automation Pipelines

Configured in `.github/workflows/`:

| Pipeline | Trigger | Description |
| :--- | :--- | :--- |
| **`deploy-gcp.yml`** | Push to `main` | Tests, builds Vite frontend and Node backend, syncs code to GCP VM, performs zero-downtime rolling restart. |
| **`backup.yml`** | Daily at 02:00 UTC | Dumps DB + media, downloads `.tar.gz` and persists as GitHub Action Artifact (90-day retention). |
| **`cost-monitor.yml`** | Every 6 hours | Queries GCP Billing API. If cost > 0, auto-triggers the emergency kill-switch. |
| **`kill-switch.yml`** | Manual Dispatch | Emergency kill-switch requiring typed confirmation: backs up everything first, then terminates the VM and disks. |

---

## 💻 Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/makwanatechsolution/varta.git
cd varta

# 2. Install dependencies
npm install
cd server && npm install && cd ..

# 3. Setup local environment
cp .env.example .env

# 4. Start frontend development server
npm run dev

# 5. Start backend development server (optional for local API endpoints)
cd server && npm run dev
```

---

## 📚 Documentation & Guides

- [Google Cloud Platform Always Free Complete Setup Guide](GCP_SETUP.md)
- [Enterprise Architecture Document](ARCHITECTURE.md)
- [Security & Compliance Matrix](SECURITY.md)
- [Changelog & Releases](CHANGELOG.md)

---

## 📄 License

MIT © 2026 Makwana Tech Solution. All rights reserved.
