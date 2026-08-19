# ChaosKey+ M3 — Mobile PWA · PRD

## Original Problem Statement
> Build a mobile app:
> *(User uploaded `ChaosKey+ v3` Python script — a hardware-style cryptographic device that captures camera entropy, runs NIST-style health tests, mixes via HKDF-SHA512, signs with Ed25519, maintains a chained ledger, and runs a 'Digital Universe' simulation seeded by real physical chaos.)*
>
> User direction: *"Assume Default and Proceed"* → mobile-first React PWA wrapping all functionality.

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`) — all routes prefixed `/api`. MongoDB stores the signed ledger. Ed25519 device keypair stored at `/app/backend/keys/`. HKDF-SHA512 mixing. NIST-style health tests (variance, repetition count, adaptive proportion).
- **Frontend**: React 18 PWA, mobile-first (max-w-md), 4 bottom-tab screens. JetBrains Mono + Unbounded fonts. Phosphor Icons. Cyberpunk Control-Room aesthetic.
- **Entropy sources**: (1) browser camera via `getUserMedia` → pixel-diff buffers POSTed as base64; (2) system entropy (`os.urandom`) fallback.

## Core Requirements (static)
1. **Camera Harvest** — live preview, capture N frames, send pixel-diffs to backend, get signed random block back.
2. **Signed Ledger Chain** — every block links to previous via `mixed_hash → prev_block_hash`. Chain integrity sampled in `/api/status`.
3. **Device Identity** — Ed25519 public key viewable as PEM + QR.
4. **Universe Simulation** — entities with physical-origin IDs (each origin is a fresh entropy block), boom-bust population dynamics, trajectory chart.

## API Surface
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/` | GET | service identity |
| `/api/status` | GET | last block, total, chain integrity |
| `/api/pubkey` | GET | Ed25519 public key PEM |
| `/api/get_random` | POST | generate signed entropy block (source=camera\|system) |
| `/api/ledger` | GET | paginated block history |
| `/api/simulate_universe` | POST | run universe sim seeded by real chaos |
| `/api/generate_token` | POST | signed token (bearer/password/uuid/totp/otp/session) + optional expires_in_seconds — expires_at is cryptographically bound in the token_signature |
| `/api/verify_token` | POST | public verifier — checks block sig + token_hash + token_signature + expiry |

## Implementation Log
- **2026-01-08** — MVP shipped end-to-end. Backend ported from uploaded script; replaced `cv2.VideoCapture` with browser-camera + system-entropy dual source. MongoDB-backed ledger. All 4 screens built. **Testing agent: 12/12 backend pytest passed, 100% frontend pass, no critical issues.**
- **2026-08-16** — Deployed to production at `https://mobile-app-build-778.emergent.host`.
- **2026-08-17** — **Feature: Token Generator** (6 types) + fix TOTP URL encoding. Iter_3: 25/25 backend.
- **2026-08-17** — **Feature x4: Verify /verify page, Camera-source tokens, Bulk Generate, Encrypted Vault.** Iter_4: 23/23.
- **2026-08-17** — **Curation pass**: user selected KEEP (Verify Page, Camera Tokens) + ADD (Verify QR, Token Expiry). **REMOVED** bulk endpoint & encrypted vault. New expiry chip selector (Never/15m/1h/24h/7d/30d) with **cryptographic binding** — `expires_at_int` is part of the signed token message. Verify page surfaces `expired` reason. Green **Verify QR** below every token encodes `/verify?block_id=X&token=Y` so anyone can scan-to-verify. **Iter_5: 23/23 backend, 100% frontend, no issues.**
- **2026-08-17** — **STRK20 Pool tab imported from doodabug/Chaoskeyplus-appbuild GitHub (Grok build)**. Added 6th tab "Pool" for privacy-preserving STRK operations on Starknet Sepolia. Deps: `starknet@10.7.0`, `@starknet-io/get-starknet-discovery`, `@starknet-io/get-starknet-wallet-standard`, `@starknet-io/types-js`. New files: `providers/StarknetProvider.jsx`, `lib/starknetWallet.js`, `lib/starknetWalletUtils.js`, `screens/PrivacyScreen.jsx`. Env: `REACT_APP_STRK20_POOL=0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`, `REACT_APP_STRK20_TOKEN` (STRK ERC-20), `REACT_APP_STARKNET_RPC`, `REACT_APP_STARKNET_EXPLORER`. Also imported STRK20 submission docs: `STRK20_INTEGRATION_PLAN.md`, `strk20.json`, `demo/`, `docs/`.
- **2026-08-17** — **Wallet detection relaxed**: `starknetWallet.js` now falls back to legacy `window.ready`/`window.starknet`/`window.starknet_argentX`/`window.starknet_braavos` when modern Wallet Standard discovery finds nothing. Capability gate softened — non-STRK20 wallets (Argent X, Braavos) can connect and see all actions; STRK20 methods surface a friendly `unsupported_wallet` error via `friendlyMissingApi()` if the wallet doesn't implement them. "UNSUPPORTED WALLET" panel renamed to "LEGACY WALLET" advisory.
- **2026-08-17** — **Wallet chainId + Switch to Sepolia fix (Iter_6)**. Ready wallet's `WalletAccountV6.getChainId()` returned empty → NETWORK field showed `—` and switch button silently failed. Added `readChainId()` with 3-level fallback (`account.getChainId` → `walletV6.requestChainId(wallet)` → `wallet.chainId`), added exported `switchToSepolia()` that surfaces errors as `kind: "refused"` / `"switch_failed"` into the `pool-error` banner. Iter_6: 100% backend, 100% frontend, no regressions.
- **2026-08-17** — **STRK20 action polish (Iter_7)**. `PrivacyScreen.runAction()` now clears input fields after successful shield/transfer/unshield and silently refreshes the shielded balance (if user opted in). Iter_7: 100% backend, 100% frontend.
- **2026-08-17** — **STRK20 Hackathon registry submission**. Debugged JSON-formatting errors in user's PR to `starkience/strk20-hackathon`; final entry: name=ChaosKey+, category=Tooling, telegram=[TheDoodlebug], team=[doodabug]. PR now passes `validate-registry.mjs` schema.

## STRK20 Pool Tab — Feature Details
- **Wallet connect**: Wallet Standard v6 discovery + legacy `window.*` fallback
- **Shield / Transfer / Unshield**: `strk20InvokeTransaction` actions `{type: deposit|transfer|withdraw, token, amount, recipient?}` per Starknet Wallet API ≥ 0.10
- **Consent-gated balance read**: `strk20Balances([token])` only called when user clicks "Show shielded balance"
- **Sepolia gate**: chainId compared as BigInt against `SEPOLIA_CHAIN_ID = 0x534e5f5345504f4c4941`
- **Note maturity gate**: freshly shielded notes locked for ~10 blocks before transfer/unshield allowed
- **Error classification**: `USER_REFUSED (113)`, `NOT_REGISTERED (118)`, `INSUFFICIENT_PRIVATE_BALANCE (119)`, protocol screening
- **Fee display**: reads `get_fee_amount()` off the pool contract when `REACT_APP_STRK20_POOL` is set

## Backlog / Future Enhancements
- **P1** External offline verifier (web tool that takes a block + pubkey and verifies signature locally)
- **P1** Replay-protection across devices (multi-device federated chain)
- **P2** Export ledger as JSONL (round-trip with the original script)
- **P2** Real-time entropy bit visualization stream during harvest
- **P2** PWA `manifest.json` + service worker for installable home-screen app
- **P2** Block short-code aliases (e.g. #160 → KESTRAL) for crisper Verify QRs
- **P3** WebSocket-streamed universe sim (per-step animation)
- **P3** Sound-based entropy source (microphone)
- **P3** Auto-retry on `NOT_REGISTERED` error (Ready registers on first use — a second click currently succeeds; automate the retry)

## Personas
- **Crypto-curious tinkerer** — wants to feel "I'm generating randomness from the real world right now"
- **Security researcher** — wants verifiable, signed, chained entropy attestation
- **Hobbyist simulator** — runs universe sims with physically-rooted seeds

## Deployment Readiness Check — June 2026
- Ran deployment_agent full readiness scan: PASS, no blockers.
- Verified: env vars externalized, /api prefixes, ports (8001/3000), no hardcoded secrets, Ed25519 keys intact.
- App (Tokens tab + /verify page) is ready for user to deploy to production via the Deploy button.
