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

## Implementation Log
- **2026-01-08** — MVP shipped end-to-end. Backend ported from uploaded script; replaced `cv2.VideoCapture` with browser-camera + system-entropy dual source. MongoDB-backed ledger. All 4 screens built. **Testing agent: 12/12 backend pytest passed, 100% frontend pass, no critical issues.**

## Backlog / Future Enhancements
- **P1** External offline verifier (web tool that takes a block + pubkey and verifies signature locally)
- **P1** Replay-protection across devices (multi-device federated chain)
- **P2** Export ledger as JSONL (round-trip with the original script)
- **P2** Real-time entropy bit visualization stream during harvest
- **P2** PWA `manifest.json` + service worker for installable home-screen app
- **P3** WebSocket-streamed universe sim (per-step animation)
- **P3** Sound-based entropy source (microphone)

## Personas
- **Crypto-curious tinkerer** — wants to feel "I'm generating randomness from the real world right now"
- **Security researcher** — wants verifiable, signed, chained entropy attestation
- **Hobbyist simulator** — runs universe sims with physically-rooted seeds
