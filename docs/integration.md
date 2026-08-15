# STRK20 Integration — High-level write-up

This document explains how a generic application (integrator) should interact with a STRK20-compliant token for sending, receiving, and querying balances. This is intentionally high-level and omits proprietary implementation details.

Design goals
- Compatibility with the STRK20 standard (functions described in strk20.json)
- Minimal trust: avoid exposing sensitive keys; use deterministic, auditable operations
- Testability: demo uses testnet and local mocks

Integration steps (summary)
1. Discover token metadata
   - Review strk20.json for expected ABI signatures and decimals.
2. Connect to a JSON-RPC provider
   - Prefer an Infura/Alchemy-like provider or a self-hosted node for mainnet; for demo use testnet endpoint (see demo/README.md).
3. Build wrappers around the standard functions
   - Implement small, well-tested wrappers: balanceOf, transfer, approve, transferFrom.
   - Use the token's decimals value when formatting amounts.
4. Handle approvals and allowance flows when delegating transfers
   - Avoid on-chain approvals for every operation: recommend allowance batching.
5. Logging and monitoring
   - Emit structured events (off-chain logs) for every state-changing transaction to aid auditability.

Sample (pseudocode)

- getBalance(address):
  - call balanceOf(address)
  - return value / (10 ** decimals)

- sendToken(fromSigner, toAddress, humanAmount):
  - amount = humanAmount * (10 ** decimals)
  - tx = tokenContract.connect(fromSigner).transfer(toAddress, amount)
  - await tx.wait()
  - return tx.hash

Security notes
- Never commit private keys or mnemonic phrases to this repository.
- For production deployments, use hardware keys or multisig guards for deploy and large transfers.

Compatibility checklist
- STRK20 method signatures match strk20.json
- Decimal handling is consistent across UI and backend
- Re-entrancy and other contract-level risks are considered by the token implementer (not included here)
