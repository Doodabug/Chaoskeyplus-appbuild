# ChaosKey+ M3

**A camera-entropy cryptographic device with STRK20 privacy on Starknet.**

ChaosKey+ turns your phone into a physical randomness generator. Every second, it hashes visual noise from your camera into a signed, chained ledger of cryptographic entropy — and mints Ed25519-signed tokens, TOTP secrets, and privacy-preserving STRK transfers bound to that entropy.

Live preview: **https://mobile-app-build-778.preview.emergentagent.com**
STRK20 hackathon entry: `starkience/strk20-hackathon` → `ChaosKey+`

---

## What it does

| Tab | Purpose |
|---|---|
| **Harvest** | Capture pixel diffs from your camera → mix through HKDF-SHA512 → sign the block with an Ed25519 device key → append to a hash-chained ledger. NIST-style health tests (chi-squared, Shannon entropy) gate every block. |
| **Tokens** | Generate Bearer, Password, UUID, TOTP, OTP, or Session tokens **cryptographically bound** to an entropy block. Optional expiry (15 min / 1 h / 24 h / 7 d / 30 d) is signed as part of the token message so it can't be tampered with. Each token gets a scannable QR that deep-links to a public `/verify` page. |
| **Ledger** | Browse the signed chain — filter by source (`camera` vs `os`), inspect the frame diffs, verify each block's prev-hash / mixed-hash / signature. |
| **Universe** | 500-step digital-universe simulation driven by the block's random hash. Because the sim is deterministic in the block hash, anyone can replay it to verify the block was actually used. |
| **Device** | Show the public Ed25519 identity key. Nothing here changes unless you rotate the device key on the backend. |
| **Pool** | STRK20 privacy pool tab. Connect a Starknet wallet (Ready / Argent X / Braavos via Wallet Standard v6 + legacy `window.starknet` fallback), see shield / transfer / unshield actions bound to your wallet's shielded balance. **Currently in preview mode on Sepolia** — see the *STRK20 Pool* section below. |

---

## Architecture

- **Frontend**: React 18 + CRA + Tailwind + Phosphor Icons. Mobile-first PWA. Camera access via `navigator.mediaDevices.getUserMedia`.
- **Backend**: FastAPI + Motor/PyMongo, single-file at `backend/server.py`. Ed25519 keypair on disk at `backend/keys/`. HKDF-SHA512 mixing, chi-squared + Shannon health tests.
- **Storage**: MongoDB. Every block has `id`, `timestamp`, `source`, `random_hex`, `frame_diffs_b64`, `prev_hash_hex`, `mixed_hash_hex`, `signature_hex` (+ optional `is_token`, `token_type`, `token_hash_hex`, `token_signature_hex`, `expires_at`).
- **Starknet layer** (Pool tab only): `starknet@10.7.0` + `@starknet-io/get-starknet-discovery@6.0.3` + `@starknet-io/get-starknet-wallet-standard@6.0.3` + `@starknet-io/types-js@0.10.3`. Uses `WalletAccountV6.connect` + `walletV6.supportedWalletApi` + `strk20InvokeTransaction`. **Nothing touches the backend.**

```
/app
├── backend/
│   ├── server.py               # single-file FastAPI + Mongo
│   ├── requirements.txt
│   ├── keys/
│   │   ├── device_ed25519_private.pem
│   │   └── device_ed25519_public.pem
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.js              # 6-tab shell + top-bar wallet chip
│   │   ├── index.js            # wraps App in <StarknetProvider>
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   ├── chaosCamera.js
│   │   │   ├── starknetWallet.js       # WalletAccountV6 + STRK20 actions
│   │   │   └── starknetWalletUtils.js  # amount/felt helpers, error classifier
│   │   ├── providers/
│   │   │   └── StarknetProvider.jsx
│   │   └── screens/
│   │       ├── HarvestScreen.jsx
│   │       ├── LedgerScreen.jsx
│   │       ├── UniverseScreen.jsx
│   │       ├── DeviceScreen.jsx
│   │       ├── TokensScreen.jsx
│   │       ├── PrivacyScreen.jsx       # Pool tab
│   │       └── VerifyPage.jsx          # public /verify?block_id=X&token=Y
│   ├── package.json
│   └── .env                    # REACT_APP_BACKEND_URL, REACT_APP_STARKNET_*
├── docs/                       # architecture, privacy plan, mainnet cutover, integration
├── demo/                       # demo walkthrough
├── STRK20_INTEGRATION_PLAN.md  # phase plan with 2026-08-17 mainnet-only findings
├── strk20.json                 # submission manifest
└── memory/PRD.md               # product requirements + implementation log
```

---

## STRK20 Pool tab

**Purpose**: give ChaosKey+ users a one-tap path to shield STRK, transfer it privately, and unshield it — using Ready wallet's STRK20 Wallet API (spec ≥ 0.10).

### Preview vs Live

STRK20 privacy is deployed on **Starknet mainnet only**. There is no publicly available Sepolia deployment. This app is currently running against Sepolia in **preview mode**:

- The Pool tab renders with a yellow *"PREVIEW MODE :: SEPOLIA"* banner
- Wallet connect, chain check, capability probe, and UX all work
- Shield / Transfer / Unshield buttons soft-fail with an explanatory red banner instead of triggering wallet rejections

To flip to live mainnet: follow `docs/mainnet-transaction-plan.md` — 5 env changes and 4 code renames.

### Wallet compatibility

| Wallet | Connect | Actions |
|---|---|---|
| **Ready** (STRK20-capable, Wallet API ≥ 0.10) | ✅ | ✅ full support |
| **Argent X / Braavos** (legacy Starknet wallets) | ✅ | ⚠️ Fall back to a friendly *"wallet doesn't implement STRK20 Wallet API"* error banner |
| No wallet extension | — | *"NO WALLETS DETECTED"* empty state |

Wallet detection uses Wallet Standard v6 discovery first, then falls back to legacy `window.ready` / `window.starknet` / `window.starknet_argentX` / `window.starknet_braavos`.

### What stays hidden vs visible

**Hidden inside the pool:**
- Sender + receiver of a private transfer
- Transfer amounts and token type
- Which shielded notes were spent
- Shielded balances (only revealed with explicit user consent via `strk20Balances`)

**Visible on-chain:**
- Shield and unshield amounts (the public ERC-20 legs)
- The fact that the connected address interacted with the pool, and when
- Device Ed25519 identity, entropy ledger, universe activity — unchanged, off-pool
- Relayer address on the tx envelope (same for every user)

Shadow-account (fully unlinkable) support is on the roadmap once the Wallet API spec stabilizes.

---

## Getting started (local development)

### Prerequisites

- Node 20+ and Yarn
- Python 3.11+
- MongoDB running locally

### Backend

```bash
cd backend
pip install -r requirements.txt
# .env contains MONGO_URL and DB_NAME
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install --ignore-engines
# .env contains REACT_APP_BACKEND_URL and REACT_APP_STARKNET_*
yarn start
```

Open http://localhost:3000. Grant camera permission when the Harvest tab prompts.

### Environment variables

| Variable | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | Base URL for the FastAPI backend (must end without a trailing slash) |
| `REACT_APP_STARKNET_RPC` | Starknet JSON-RPC endpoint. Sepolia in preview mode, mainnet in live mode. |
| `REACT_APP_STRK20_TOKEN` | STRK ERC-20 token address (`0x04718f5a...` — same on Sepolia and mainnet) |
| `REACT_APP_STRK20_POOL` | STRK20 privacy pool address. Empty in preview mode; `0x040337...812a` on mainnet. |
| `REACT_APP_STARKNET_EXPLORER` | Base URL for tx explorer links. `https://sepolia.voyager.online/tx` in preview; `https://voyager.online/tx` in live. |
| `MONGO_URL`, `DB_NAME` | Mongo connection for the backend |

Never commit real secrets. Use `.env.example` as the template.

---

## API endpoints (backend)

- `POST /api/get_random` — mix new entropy, sign a block, append to the ledger
- `GET  /api/status` — chain-integrity check + block count
- `GET  /api/pubkey` — device Ed25519 public key
- `GET  /api/ledger` — paginated ledger
- `POST /api/simulate_universe` — deterministic universe sim seeded by a block hash
- `POST /api/generate_token` — mint a token (Bearer/Password/UUID/TOTP/OTP/Session) bound to an entropy block, with optional expiry
- `GET  /api/verify_token` — public token verification (used by the QR / `/verify` page)

---

## Verify page

Every generated token gets a green **Verify QR** that encodes `/verify?block_id={id}&token={hex}`. Anyone can scan the QR to open the public verify page, which:

1. Fetches the block and re-computes the mixed hash
2. Verifies the Ed25519 signature against the device pubkey
3. Checks token expiry (if set) — surfaces `expired` reason if past
4. Displays PASS / FAIL with the verifying pubkey shown for auditability

No auth required — the verify page is intentionally public.

---

## STRK20 Hackathon

This project is submitted to the **starkience/strk20-hackathon** sprint (`ChaosKey+`, category `Tooling`). See `strk20.json` for the submission manifest and `STRK20_INTEGRATION_PLAN.md` for the phase-by-phase integration plan (Phases 1–2b done; Phase 2c "preview-mode honesty" landed 2026-08-17; Phase 4 "mainnet cutover" documented in `docs/mainnet-transaction-plan.md`).

---

## Contributing

See `CONTRIBUTING.md`. TL;DR:
- Read `STRK20_INTEGRATION_PLAN.md` before touching the Pool tab — the constraints (Sepolia preview, mainnet cutover, no `register` UI, decimal amounts, soft capability gate) are documented and locked.
- Never write to `backend/server.py` from the Pool tab code path — the backend has no viewing keys, no notes, no relayer credentials.
- Add a `data-testid` to every interactive element and user-facing critical panel.

---

## License

MIT. See `LICENSE`.

---

## Credits

- **Original concept & entropy engine**: doodabug (`@TheDoodlebug`)
- **STRK20 Pool tab integration**: built collaboratively via Grok + Emergent E1, guided by the `starkience/strk20-agent-skills` skill pack
- **Camera-entropy math**: HKDF-SHA512, NIST SP 800-90 test suite
- **Cryptographic signing**: PyNaCl (Ed25519), tweetnacl (browser side)
