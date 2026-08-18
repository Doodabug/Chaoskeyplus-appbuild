#!/usr/bin/env bash
set -euo pipefail

# Retired. This used to echo a public ERC-20 transfer template and was
# easy to mistake for a STRK20 pool action. Pool shield / transfer / unshield
# run in the Ready wallet via frontend/src/lib/starknetWallet.js.
# See STRK20_INTEGRATION_PLAN.md.

echo "retired: prepare_strk20_tx.sh is not a STRK20 pool tool."
echo "Use the Pool tab (Ready wallet) or see STRK20_INTEGRATION_PLAN.md."
exit 2
