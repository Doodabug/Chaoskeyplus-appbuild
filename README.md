# ChaosKey+ — STRK20 Submission

This repository is a clean, public STRK20 submission containing only the materials required for review and integration testing. It intentionally excludes any proprietary or private ChaosKey+ source code.

Included:
- README.md — this file
- strk20.json — token metadata and manifest for reviewers
- docs/
  - integration.md — high-level STRK20 integration write-up
  - architecture.md — architecture summary (public-safe)
  - innovation.md — innovation write-up (non-sensitive)
  - mainnet-transaction-plan.md — planned mainnet steps and safety checks
- demo/
  - README.md — demo instructions using testnet/mocks
- scripts/
  - setup_demo.sh — demo setup script (no secrets)
  - prepare_strk20_tx.sh — transaction preparation template (no private keys)

Purpose

This repo is intended to be shared publicly as the STRK20 submission for evaluation, auditing, and integration. It demonstrates how the STRK20 integration works and describes the planned mainnet rollout without revealing any proprietary implementation.
