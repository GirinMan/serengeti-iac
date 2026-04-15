#!/usr/bin/env bash
# GitHub Actions self-hosted runner installer for homelab host.
#
# Rationale: Cloudflare free-tier caps request bodies at 100MB, which
# breaks `docker push` for images containing layers above that size
# (notably gis-worker's postgis/postgis:16-3.4-alpine base at ~269MB).
# A self-hosted runner on this host pushes to Harbor via loopback,
# bypassing Cloudflare entirely.
#
# Usage (operator):
#   export GHA_REPO="GirinMan/GIS-underground-facilities"
#   export GHA_REG_TOKEN="<short-lived token from repo Settings → Actions → Runners → New self-hosted runner>"
#   bash system/gha_runner_install.sh
#
# The registration token is valid for ~1 hour; generate it right
# before running this script.

set -euo pipefail

: "${GHA_REPO:?GHA_REPO must be set, e.g. GirinMan/GIS-underground-facilities}"
: "${GHA_REG_TOKEN:?GHA_REG_TOKEN must be set (get from repo Actions settings)}"

RUNNER_VERSION="${RUNNER_VERSION:-2.321.0}"
RUNNER_USER="${RUNNER_USER:-gha-runner}"
RUNNER_HOME="${RUNNER_HOME:-/opt/gha-runner}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,homelab}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname)-gha}"

sudo useradd -r -m -d "$RUNNER_HOME" -s /bin/bash "$RUNNER_USER" 2>/dev/null || true
sudo usermod -aG docker "$RUNNER_USER"

sudo -u "$RUNNER_USER" bash -s <<RUNNER_EOF
set -euo pipefail
cd "$RUNNER_HOME"
if [ ! -f config.sh ]; then
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
  rm actions-runner.tar.gz
fi
./config.sh \
  --unattended \
  --url "https://github.com/${GHA_REPO}" \
  --token "${GHA_REG_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_LABELS}" \
  --work _work \
  --replace
RUNNER_EOF

pushd "$RUNNER_HOME" >/dev/null
sudo ./svc.sh install "$RUNNER_USER"
sudo ./svc.sh start
sudo ./svc.sh status
popd >/dev/null

echo ""
echo "Runner '${RUNNER_NAME}' registered on ${GHA_REPO} with labels: ${RUNNER_LABELS}"
echo "Next: in build-gis.yml set \`runs-on: [self-hosted, linux, x64, homelab]\` for gis-worker."
