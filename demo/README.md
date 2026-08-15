# Demo — Instructions

This demo shows a safe, local/testnet workflow for validating STRK20 integration without revealing any private code or keys.

Overview
- The demo uses a local mock STRK20 contract or a testnet deployment.
- All signing in this demo uses ephemeral test keys (never real keys).

Quick steps
1. Install dependencies
   - On systems with bash: run scripts/setup_demo.sh
2. Start a local RPC or point to a testnet provider. The demo uses environment variables for RPC and an ephemeral key.
   - export RPC_URL="https://rpc.testnet.example"
   - export DEMO_PRIVATE_KEY="0xaaaaaaaa..."  # ONLY use ephemeral test key
3. Run the demo flow
   - The demo will:
     - Query a test address balance
     - Prepare and simulate a transfer
     - Broadcast a testnet transaction (if configured)

What to expect
- The demo prints structured logs and transaction hashes for audit.
- No proprietary code or secrets are used.

Notes for reviewers
- Replace RPC_URL and DEMO_PRIVATE_KEY with your testnet values if you want to run the demo.
- Do not run with mainnet values in this repo.
