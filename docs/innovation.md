# Innovation Write-up (non-sensitive)

This document explains the novel aspects of the ChaosKey+ submission at a conceptual level suitable for reviewers. It avoids revealing internal algorithms, secret parameters, or the private codebase.

Conceptual innovation
- Improved UX for deterministic token transfers powered by a hardware-derived entropy source (concept only)
- Novel UX guardrails to reduce user errors during on-chain transfers (e.g., contextual gas estimations, transfer limits, deterministic nonce suggestions)
- Audit-first design: all operations are designed to emit clear off-chain audit logs and make on-chain intent explicit

Why it matters
- Reduces accidental high-value transfers
- Makes audits and forensic analysis simpler by providing structured off-chain logs tied to on-chain tx hashes

Non-sensitive diagrams
- Sequence: User -> Integrator (validate) -> Signing Guard -> RPC -> Chain

Limitations
- Implementation specifics (proprietary firmware, key derivation) are intentionally excluded from this public submission.
