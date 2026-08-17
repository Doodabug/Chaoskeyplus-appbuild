# Architecture Summary (public-safe)

This summary describes the public architecture and data flow for STRK20 interactions. Proprietary internal components and key material are intentionally omitted.

Components
- Token Contract (STRK20)
  - Exposes the standard token methods (transfer, approve, transferFrom, balanceOf)
- Integrator Service (public-facing)
  - Responsible for preparing transactions, formatting amounts, and interacting with RPC
  - Should be deployed behind standard operational controls (CI, monitoring)
- Signing Guard (recommended)
  - A multisig or HSM that holds the deployer/operator keys for critical transactions
- Monitoring & Alerts
  - Off-chain monitors watch for failed transactions, large transfers, and unexpected approvals

Data flow (high level)
1. User action triggers a requested transfer in the Integrator Service
2. Service validates request and formats amounts using token decimals
3. Service requests a signature from the Signing Guard (for sensitive ops) or uses a local ephemeral test signer in demo
4. Signed transaction is broadcast via RPC provider
5. Off-chain monitors read receipts and update application state

Design constraints
- Keep the attack surface minimal by isolating signing capabilities
- Prefer read-only operations on non-sensitive services

Privacy and IP
- This repo documents the public-facing integration only. Internal key handling, proprietary algorithms, and firmware are not included.
