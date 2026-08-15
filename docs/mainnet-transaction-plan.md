# Mainnet Transaction Plan

This plan outlines the high-level steps, safety checks, and contingency measures for publishing the STRK20 contract and performing critical token operations on mainnet. It is a guideline for operators and reviewers.

Pre-deployment checklist
- Formal code audit of the token contract (if not already completed)
- Gas and cost estimate for deployment and initial distribution
- Prepare multisig for deployer and large transfers
- Prepare an emergency pause/kill switch if supported by token

Deployment steps
1. Deploy contract from multisig or a hardware-protected deployment account
2. Verify contract source on block explorer
3. Perform a small-value sanity transfer to a known test address and confirm balances
4. Gradually enable larger distributions using multi-stage multisig approvals

Mainnet transaction safety
- Use time-delayed multisig release for large transfers (e.g., 48–72 hours)
- For each large transfer:
  - Create a signed plan with: purpose, beneficiary, amount, expected gas
  - Post plan to a private audit channel and collect approvals
  - Execute via multisig

Rollback / emergency
- If unexpected behavior occurs, follow the emergency procedure defined by the multisig (revoke approvals, pause contract if supported)

Transparency
- Publish deployment transaction hashes and audit references in a public progress log (without revealing private operational details)
