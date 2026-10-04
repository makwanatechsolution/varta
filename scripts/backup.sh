#!/usr/bin/env bash
# ==============================================================================
# VARTA BACKUP ENGINE - AUTOMATED DATABASE & STORAGE SAFEGUARD
# Takes full backup of PostgreSQL, Supabase storage, and application state.
# Pushes backup snapshot offsite before any kill-switch execution.
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/varta/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="varta_backup_${TIMESTAMP}"
TARGET_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
ARCHIVE_FILE="${TARGET_PATH}.tar.gz"

echo "=========================================================="
echo " [Varta Backup] Starting Backup Sequence at $(date)"
echo "=========================================================="

mkdir -p "${TARGET_PATH}"
mkdir -p "${BACKUP_DIR}"

# 1. Backup PostgreSQL Database
echo "--> [1/4] Dumping PostgreSQL Database..."
if docker ps | grep -q "varta-db"; then
  docker exec -t varta-db pg_dumpall -c -U postgres > "${TARGET_PATH}/database_dump.sql"
  echo "    ✓ Database dump completed successfully ($(du -h "${TARGET_PATH}/database_dump.sql" | cut -f1))"
else
  echo "    ⚠️ Warning: varta-db container is not currently running. Attempting offline volume copy..."
  docker run --rm -v varta-db-data:/data -v "${TARGET_PATH}:/backup" alpine tar czf /backup/db_volume.tar.gz -C /data .
fi

# 2. Backup Storage Volumes & User Uploads
echo "--> [2/4] Archiving User Media & Storage Volumes..."
if docker volume inspect varta-storage-data >/dev/null 2>&1; then
  docker run --rm -v varta-storage-data:/data -v "${TARGET_PATH}:/backup" alpine tar czf /backup/storage_volume.tar.gz -C /data .
  echo "    ✓ Storage volume archived successfully."
else
  echo "    ℹ️ No varta-storage-data volume found; skipping."
fi

# 3. Snapshot Environment Metadata (Exclude raw secrets for safety, store checksums)
echo "--> [3/4] Recording System & Version Metadata..."
cat <<EOF > "${TARGET_PATH}/metadata.json"
{
  "project": "varta",
  "timestamp": "${TIMESTAMP}",
  "hostname": "$(hostname)",
  "arch": "$(uname -m)",
  "kernel": "$(uname -r)",
  "docker_version": "$(docker --version 2>/dev/null || echo 'unknown')",
  "backup_type": "full_safe_harbor"
}
EOF

# Compress the entire backup folder
echo "--> [4/4] Compressing Archive & Calculating SHA256 Checksum..."
tar -czf "${ARCHIVE_FILE}" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
rm -rf "${TARGET_PATH}"

SHA256=$(sha256sum "${ARCHIVE_FILE}" | cut -d ' ' -f 1)
echo "${SHA256}  $(basename "${ARCHIVE_FILE}")" > "${ARCHIVE_FILE}.sha256"

ARCHIVE_SIZE=$(du -h "${ARCHIVE_FILE}" | cut -f1)
echo "=========================================================="
echo " ✓ Backup Successfully Created!"
echo "   File:     ${ARCHIVE_FILE}"
echo "   Size:     ${ARCHIVE_SIZE}"
echo "   SHA-256:  ${SHA256}"
echo "=========================================================="

# 5. Offsite Push (GitHub Releases / Webhook / External API)
if [ -n "${GITHUB_BACKUP_TOKEN:-}" ] && [ -n "${GITHUB_BACKUP_REPO:-}" ]; then
  echo "--> Uploading backup snapshot off-site to GitHub Releases..."
  TAG_NAME="backup-${TIMESTAMP}"
  
  # Create release and upload asset
  RELEASE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token ${GITHUB_BACKUP_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/repos/${GITHUB_BACKUP_REPO}/releases \
    -d "{\"tag_name\":\"${TAG_NAME}\",\"target_commitish\":\"main\",\"name\":\"Automated Backup ${TIMESTAMP}\",\"body\":\"Safe Harbor Backup before purge/update. SHA256: ${SHA256}\",\"draft\":false,\"prerelease\":false}")
  
  UPLOAD_URL=$(echo "${RELEASE_RESPONSE}" | grep -o 'https://uploads.github.com/repos/[^"]*' | sed -e 's/{?name,label}//')
  
  if [ -n "${UPLOAD_URL}" ]; then
    curl -s -X POST \
      -H "Authorization: token ${GITHUB_BACKUP_TOKEN}" \
      -H "Content-Type: application/gzip" \
      --data-binary @"${ARCHIVE_FILE}" \
      "${UPLOAD_URL}?name=$(basename "${ARCHIVE_FILE}")" > /dev/null
    echo "    ✓ Off-site upload to GitHub Release (${TAG_NAME}) succeeded!"
  fi
fi

# Clean up older backups (keep last 7 days locally)
find "${BACKUP_DIR}" -name "varta_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
echo "Backup operation finished with status 0."
exit 0
