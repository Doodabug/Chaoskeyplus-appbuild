# STRK20 Privacy Plan — public-safe

Purpose

This document summarizes the privacy strategy for STRK20 interactions performed by the ChaosKey+ submission. It is intentionally high‑level and omits any proprietary implementation details or secrets.

Privacy objectives
- Protect private keys and key‑derivation secrets (never stored or committed). 
- Reduce on‑chain and off‑chain linkability between users and addresses. 
- Prevent accidental disclosure of PII in on‑chain calldata, logs, or public artifacts. 
- Maintain necessary auditability for reviewers using non‑sensitive proofs (hashes, tx hashes).

Threat model (high level)
- Passive chain observers correlating addresses, timing, and amounts.
- Compromise or misuse of signing material (operators, CI, backups).
- Insider leaks linking internal identifiers to on‑chain addresses.
- RPC/relayer providers logging request metadata that enables correlation.

Recommended controls

Key custody
- Use multisig (time‑delayed where possible) or an HSM/KMS for all production signing operations.
- Never commit private keys, mnemonics, or raw seed material. Demo/test flows must use ephemeral keys only.

Address hygiene
- Minimize reuse of operator addresses for multiple unrelated users.
- Consider deterministic ephemeral addresses for per‑user receipts when privacy is required (tradeoffs noted below).

Mempool privacy
- For high‑sensitivity transactions, use private-relay/flashbots-style submission or a trusted relayer to avoid public mempool exposure.
- For routine transfers, document that public mempool will be used and ensure amounts/metadata do not contain PII.

Transaction patterns to improve privacy
- Batching: aggregate many small transfers into a single batched transaction when appropriate.
- Off‑chain channels / Layer‑2: move repeated micro‑payments off the base chain where possible.
- Minimal calldata: avoid storing any user identifiers or free‑form text in calldata or events.

Off‑chain logging and data handling
- Store only the minimum off‑chain metadata required for operations.
- Use hashed commitments (H(userID || salt)) when an auditor needs provable mapping, and release mappings under NDA only.
- Encrypt mappings and logs at rest; use strict RBAC for decryption keys.
- Retain ephemeral mappings only as long as needed and rotate/delete per retention policy.

RPC / Provider considerations
- Prefer self‑hosted nodes for the most sensitive ops to remove third‑party correlation.
- If using third‑party providers, rotate endpoints and avoid making all sensitive traffic go through one provider.
- Use private RPC features (if available) or run a relayer to submit transactions privately.

Operational policies
- Pre‑deployment checklist: audit, multisig readiness, gas estimate, small sanity transfer.
- Approvals: require multi‑party signoff for large transfers and deployments; record approvals off‑chain as commitments (hashes) rather than plaintext plans.
- Emergency plan: documented steps for key compromise (revoke/rotate keys, pause contract if supported, alert auditors).

Auditability vs privacy
- Publish commitments and tx hashes publicly for auditor verification while preserving secrets.
- Provide mappings only to authorized auditors under NDAs; publish proofs (hashes) for public transparency.

Demo and testnet guidance (public repo)
- Demo must use ephemeral/test keys with explicit warnings (see demo/README.md).
- Demo scripts should simulate privacy controls (simulate batch, simulate private relay) without broadcasting to mainnet.
- Include a privacy checklist that can be run locally/CI to detect accidental secrets.

Monitoring and detection
- Monitor for unusual clustering of addresses interacting with the token.
- Monitor RPC and relayer usage patterns for spikes indicating correlation attempts.
- Maintain an incident response playbook for deanonymization events.

Appendix — tradeoffs and notes
- Stealth/ephemeral addresses increase privacy but add bookkeeping complexity and UX friction.
- Private-relay submissions reduce mempool visibility but mean less immediate public transparency; record and publish tx hashes post‑execution.

This document is intentionally non‑sensitive and suitable for public consumption. For operational runbooks, sensitive key procedures, or private audit artifacts, keep a separate private ops repository or encrypted storage.
