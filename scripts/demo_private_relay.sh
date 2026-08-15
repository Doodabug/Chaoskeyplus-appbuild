#!/usr/bin/env bash
set -euo pipefail

# demo_private_relay.sh
# Safe simulation of preparing a STRK20 transaction payload and "sending" it to a private relay.
# This script performs no on-chain actions by default and never requires a private key.

# Usage: ./scripts/demo_private_relay.sh <TO_ADDRESS> <AMOUNT_HUMAN>

TO_ADDRESS=${1:-}
AMOUNT_HUMAN=${2:-}

if [ -z "$TO_ADDRESS" ] || [ -z "$AMOUNT_HUMAN" ]; then
  echo "Usage: $0 <TO_ADDRESS> <AMOUNT_HUMAN>"
  exit 2
fi

# Read decimals from strk20.json if available, default to 18
DECIMALS=18
if [ -f "strk20.json" ]; then
  if command -v jq >/dev/null 2>&1; then
    DECIMALS=$(jq -r '.decimals // 18' strk20.json)
  else
    echo "jq not found — using default decimals=$DECIMALS"
  fi
fi

# Simulate conversion to base units (uses Python for arbitrary precision)
AMOUNT_BASE=$(python3 - <<PY
from decimal import Decimal, getcontext
getcontext().prec = 50
human = Decimal("$AMOUNT_HUMAN")
dec = Decimal(10) ** int($DECIMALS)
print(int(human * dec))
PY
)

echo "Preparing simulated STRK20 transfer"
echo "  To:      $TO_ADDRESS"
echo "  Amount:  $AMOUNT_HUMAN (human)"
echo "  Base:    $AMOUNT_BASE (base units, decimals=$DECIMALS)"

echo "Building unsigned tx payload (no private key required)"
cat <<PAYLOAD
{
  "to": "<STRK20_CONTRACT_ADDRESS>",
  "data": "<encoded_transfer_function_call>",
  "value": "0",
  "gas": "<estimated_gas>",
  "nonce": "<simulated_nonce>"
}
PAYLOAD

echo "Simulating private relay submission..."

# This is a simulation. Replace RELAY_URL with your private relay endpoint in private ops.
RELAY_URL="https://private-relay.example/simulate"

echo "Simulation payload would be POSTed to: $RELAY_URL"
echo "(demo) POST body: { txPayload: <above>, meta: { purpose: 'demo', demo: true } }"

echo "Outcome: simulated relay accepted. No network calls were made by this script."

echo "Demo complete — this script is safe to run in the public repository."
