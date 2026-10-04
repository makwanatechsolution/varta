#!/usr/bin/env bash
# ==============================================================================
# GCP ALWAYS FREE VM - CLOUD-INIT BOOTSTRAP SCRIPT
# Prepares Docker, Google Cloud SDK, Swap, Security, Cost Watchdog, and Backup Schedules
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo " Starting Varta Production Host Bootstrap at $(date)"
echo "=========================================================="

export DEBIAN_FRONTEND=noninteractive

# 1. Update OS and install essential packages
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  ufw \
  fail2ban \
  bc \
  jq \
  unzip

# 2. Configure 2GB Swap Memory (Essential for e2-micro 1GB RAM)
if [ ! -f /swapfile ]; then
  echo "Setting up 2GB swap space..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# 3. Install Docker Engine and Docker Compose Plugin
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker Engine..."
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  usermod -aG docker ubuntu || true
fi

# 4. Install / Verify Google Cloud SDK (gcloud CLI)
if ! command -v gcloud >/dev/null 2>&1; then
  echo "Installing Google Cloud SDK..."
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
  curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
  apt-get update -y && apt-get install -y google-cloud-cli
fi

# 5. Configure UFW Firewall (Open only 22, 80, 443)
echo "Configuring UFW Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# 6. Create project directories
mkdir -p /opt/varta/backups
mkdir -p /opt/varta/scripts
mkdir -p /opt/varta/deploy

# 7. Setup Daily Backup Cron (Runs daily at 02:00 UTC)
cat << 'EOF' > /etc/cron.d/varta_backup
0 2 * * * root /opt/varta/scripts/backup.sh >> /var/log/varta_backup.log 2>&1
EOF
chmod 0644 /etc/cron.d/varta_backup

echo "=========================================================="
echo " Varta GCP Host Bootstrap Completed Successfully!"
echo "=========================================================="
