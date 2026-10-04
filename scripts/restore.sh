#!/usr/bin/env bash
# ==============================================================================
# VARTA RESTORE ENGINE - RECOVER DATABASE & STORAGE FROM ARCHIVE
# Usage: ./restore.sh /path/to/varta_backup_YYYYMMDD_HHMMSS.tar.gz
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_archive.tar.gz>"
  exit 1
fi

ARCHIVE="$1"

if [ ! -f "${ARCHIVE}" ]; then
  echo "Error: Archive file not found: ${ARCHIVE}"
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "--> Extracting backup archive..."
tar -xzf "${ARCHIVE}" -C "${TMP_DIR}"

BACKUP_FOLDER=$(find "${TMP_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if [ -z "${BACKUP_FOLDER}" ]; then
  echo "Error: Invalid archive structure."
  exit 1
fi

echo "--> Restoring Database..."
if [ -f "${BACKUP_FOLDER}/database_dump.sql" ]; then
  docker exec -i varta-db psql -U postgres < "${BACKUP_FOLDER}/database_dump.sql"
  echo "    ✓ Database restored successfully."
fi

echo "--> Restoring Storage Volumes..."
if [ -f "${BACKUP_FOLDER}/storage_volume.tar.gz" ]; then
  docker run --rm -v varta-storage-data:/data -v "${BACKUP_FOLDER}:/backup" alpine tar xzf /backup/storage_volume.tar.gz -C /data
  echo "    ✓ Storage volume restored."
fi

echo "--> Restarting services to apply state..."
cd /opt/varta/deploy && docker compose restart

echo "=========================================================="
echo " ✓ Restore completed successfully!"
echo "=========================================================="
