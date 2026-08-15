#!/usr/bin/env bash
set -euo pipefail

# Transaction preparation template (no private keys here)
# Usage: ./scripts/prepare_strk20_tx.sh <TO_ADDRESS> <AMOUNT_HUMAN>

TO_ADDRESS=${1:-}
AMOUNT=${2:-}

if [ -z "$TO_ADDRESS" ] || [ -z "$AMOUNT" ]; then
  echo "Usage: $0 <TO_ADDRESS> <AMOUNT_HUMAN>"
  exit 2
fi

# The script demonstrates the safe steps to prepare a transaction.
# Implementors should replace the echo commands with actual tooling (ethers, web3, cli) and never commit keys.

echo "Preparing STRK20 transfer"
echo "Recipient: $TO_ADDRESS"
echo "Amount (human): $AMOUNT"

echo "Step 1: Convert amount to token base units using decimals from strk20.json"
# Example: amount_base = AMOUNT * (10 ** DECIMALS)

echo "Step 2: Build unsigned transaction payload (to, data, value=0, gasLimit estimate)"

echo "Step 3: Send unsigned tx to signing guard or export to wallet for signing"

echo "Step 4: Broadcast signed tx and record tx hash"

echo "NOTE: This script is a template and performs no on-chain actions by default."
