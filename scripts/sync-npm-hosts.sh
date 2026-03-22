#!/bin/bash
set -euo pipefail

# Sync NPM Proxy Hosts from config/npm-hosts.yml
#
# This script reads npm-hosts.yml and creates/updates NPM hosts via API.
# Currently prints what would be done (dry-run mode).
# Full implementation requires NPM API integration.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/config/npm-hosts.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "NPM Proxy Host Sync Script"
echo "================================================"
echo ""

# Check if config file exists
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo -e "${RED}Error: Config file not found: $CONFIG_FILE${NC}"
  echo ""
  echo "Please create it from the example:"
  echo "  cp config/npm-hosts.example.yml config/npm-hosts.yml"
  echo "  vim config/npm-hosts.yml"
  exit 1
fi

# Load .env for variable substitution
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  echo -e "${GREEN}Loading environment variables from .env${NC}"
  # shellcheck disable=SC1091
  source <(grep -v '^#' "$PROJECT_ROOT/.env" | sed 's/^/export /')
else
  echo -e "${YELLOW}Warning: .env file not found${NC}"
fi

echo ""
echo "================================================"
echo "DRY RUN MODE - No changes will be made"
echo "================================================"
echo ""

# Check if yq is installed (for YAML parsing)
if ! command -v yq &>/dev/null; then
  echo -e "${YELLOW}Warning: yq not installed. Install with: sudo snap install yq${NC}"
  echo ""
  echo "For now, showing raw config file:"
  echo ""
  cat "$CONFIG_FILE"
  exit 0
fi

# Parse and display hosts
echo "Configured NPM Hosts:"
echo "---------------------"

HOST_COUNT=$(yq eval '.hosts | length' "$CONFIG_FILE")

for ((i=0; i<HOST_COUNT; i++)); do
  NAME=$(yq eval ".hosts[$i].name" "$CONFIG_FILE")
  DOMAINS=$(yq eval ".hosts[$i].domain_names[]" "$CONFIG_FILE" | tr '\n' ',' | sed 's/,$//')
  FORWARD=$(yq eval ".hosts[$i].forward_host" "$CONFIG_FILE")
  PORT=$(yq eval ".hosts[$i].forward_port" "$CONFIG_FILE")
  SSL=$(yq eval ".hosts[$i].ssl_forced" "$CONFIG_FILE")

  # Substitute environment variables in domain
  DOMAINS=$(eval echo "$DOMAINS")

  echo ""
  echo "  [$((i+1))] $NAME"
  echo "      Domains: $DOMAINS"
  echo "      Forward: $FORWARD:$PORT"
  echo "      SSL: $SSL"
done

echo ""
echo "================================================"
echo "Next Steps:"
echo "================================================"
echo ""
echo "1. Manual setup (current method):"
echo "   - Open NPM Admin: http://127.0.0.1:81"
echo "   - Create each proxy host using the config above"
echo ""
echo "2. Automated setup (future enhancement):"
echo "   - Implement NPM API integration"
echo "   - Run: ./scripts/sync-npm-hosts.sh --apply"
echo ""
echo "3. Documentation:"
echo "   - See: config/README.md"
echo ""
