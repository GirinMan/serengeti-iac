#!/usr/bin/env bash
set -euo pipefail

# Minio initialization script — idempotent
# Creates users, policies, and buckets from .env
#
# Usage: bash scripts/init_minio.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/system/lib_env.sh"
load_env_file "${ROOT_DIR}/.env"

MINIO_ENDPOINT="http://localhost:${MINIO_API_PORT:-9000}"
MC="docker exec minio mc"

echo "=== Minio Initialization ==="
echo "  Endpoint: ${MINIO_ENDPOINT}"

# Set up admin alias inside the container (ephemeral — must re-run after container recreate)
$MC alias set local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" --quiet

# ---------------------------------------------------------------------------
# Buckets
# ---------------------------------------------------------------------------
BUCKETS=(
    "plane-uploads"
)

for bucket in "${BUCKETS[@]}"; do
    if $MC ls "local/${bucket}" &>/dev/null; then
        echo "  [SKIP] Bucket '${bucket}' exists"
    else
        $MC mb "local/${bucket}" --quiet
        echo "  [OK] Created bucket '${bucket}'"
    fi
done

# ---------------------------------------------------------------------------
# Users — format: "username secret_env_var policy"
# ---------------------------------------------------------------------------
USERS=(
    "girinman MINIO_CLI_SECRET_KEY readwrite"
)

for entry in "${USERS[@]}"; do
    read -r username secret_var policy <<< "$entry"
    secret="${!secret_var:-}"

    if [ -z "$secret" ]; then
        echo "  [SKIP] User '${username}' — ${secret_var} not set in .env"
        continue
    fi

    if $MC admin user info local "${username}" &>/dev/null; then
        echo "  [SKIP] User '${username}' exists"
    else
        $MC admin user add local "${username}" "${secret}"
        echo "  [OK] Created user '${username}'"
    fi

    # Attach policy (idempotent)
    $MC admin policy attach local "${policy}" --user "${username}" 2>/dev/null || true
    echo "  [OK] Policy '${policy}' attached to '${username}'"
done

echo "=== Done ==="
