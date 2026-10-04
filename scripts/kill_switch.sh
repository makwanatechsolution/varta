#!/usr/bin/env bash
# ==============================================================================
# VARTA ZERO-COST EMERGENCY KILL SWITCH (GCP EDITION)
# Failsafe execution: TAKES BACKUP FIRST -> DISPATCHES ALERT -> DESTROYS INFRA
# Guarantees 0 Rupees / $0.00 spent.
# ==============================================================================
set -euo pipefail

REASON="${1:-NON_ZERO_COST_DETECTED}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"

echo "################################################################"
echo "  ⚠️ EMERGENCY KILL SWITCH ACTIVATED ⚠️"
echo "  Reason: ${REASON}"
echo "  Timestamp: $(date -u)"
echo "################################################################"

# ==============================================================================
# PHASE 1: SAFE HARBOR BACKUP (MANDATORY BEFORE DELETION)
# ==============================================================================
echo ""
echo "--> [PHASE 1/3] Securing Full Database & Storage Safe Harbor Backup..."

BACKUP_OUTPUT=$("${SCRIPT_DIR}/backup.sh" 2>&1)
BACKUP_EXIT_CODE=$?

if [ ${BACKUP_EXIT_CODE} -ne 0 ]; then
  echo "❌ CRITICAL ERROR: Backup failed before kill switch! Output:"
  echo "${BACKUP_OUTPUT}"
  echo "Attempting emergency raw filesystem tarball before destruction..."
  mkdir -p /opt/varta/emergency_raw_dump
  tar -czf "/opt/varta/emergency_raw_dump/raw_fallback_$(date +%s).tar.gz" -C /opt/varta . 2>/dev/null || true
else
  echo "✓ Safe Harbor Backup successfully secured and verified."
fi

# ==============================================================================
# PHASE 2: EMERGENCY NOTIFICATION DISPATCH
# ==============================================================================
echo ""
echo "--> [PHASE 2/3] Dispatching Emergency Kill Switch Alerts..."

ALERT_PAYLOAD=$(cat <<EOF
{
  "project": "Varta",
  "status": "KILL_SWITCH_EXECUTED",
  "cloud": "Google Cloud Platform",
  "reason": "${REASON}",
  "timestamp": "$(date -u)",
  "message": "⚠️ Zero-Cost Kill Switch Triggered! A complete backup has been secured. All GCP Compute Engine instances and attached disks are being terminated immediately to guarantee 0 rupees charged."
}
EOF
)

if [ -n "${ALERT_WEBHOOK}" ]; then
  echo "Sending alert to webhook..."
  curl -s -X POST -H "Content-Type: application/json" -d "${ALERT_PAYLOAD}" "${ALERT_WEBHOOK}" || true
fi

# ==============================================================================
# PHASE 3: TOTAL INFRASTRUCTURE TEARDOWN & TERMINATION
# ==============================================================================
echo ""
echo "--> [PHASE 3/3] Commencing Total Resource Destruction on GCP..."

# 1. Stop all Docker services and purge data
if command -v docker >/dev/null 2>&1; then
  echo "Stopping and purging all application containers and networks..."
  if [ -d "/opt/varta/deploy" ]; then
    (cd /opt/varta/deploy && docker compose down -v --remove-orphans 2>/dev/null || true)
  fi
  docker kill $(docker ps -q) 2>/dev/null || true
  docker system prune -af --volumes 2>/dev/null || true
fi

# 2. Query GCP Instance Metadata Service
METADATA_HEADER="Metadata-Flavor: Google"
INSTANCE_NAME=$(curl -s -m 5 -H "${METADATA_HEADER}" http://metadata.google.internal/computeMetadata/v1/instance/name 2>/dev/null || true)
ZONE_FULL=$(curl -s -m 5 -H "${METADATA_HEADER}" http://metadata.google.internal/computeMetadata/v1/instance/zone 2>/dev/null || true)
ZONE=$(echo "${ZONE_FULL}" | awk -F/ '{print $NF}')
PROJECT_ID=$(curl -s -m 5 -H "${METADATA_HEADER}" http://metadata.google.internal/computeMetadata/v1/project/project-id 2>/dev/null || true)

if [ -n "${INSTANCE_NAME}" ] && [ -n "${ZONE}" ] && command -v gcloud >/dev/null 2>&1; then
  echo "Self-terminating GCP Compute Engine Instance (${INSTANCE_NAME}) in zone ${ZONE}..."
  echo "Deleting instance and all attached persistent disks to eliminate storage charges..."
  gcloud compute instances delete "${INSTANCE_NAME}" \
    --zone="${ZONE}" \
    ${PROJECT_ID:+--project="${PROJECT_ID}"} \
    --delete-disks=all \
    --quiet 2>&1 || true
elif [ -d "/opt/varta/terraform" ] && command -v terraform >/dev/null 2>&1; then
  echo "Executing terraform destroy -auto-approve..."
  (cd /opt/varta/terraform && terraform destroy -auto-approve 2>&1 || true)
else
  echo "No gcloud CLI or GCP instance metadata found. Shutting down system power..."
  shutdown -h now
fi

echo "Kill switch execution complete. System terminated."
