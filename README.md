ChaosKey+ M3 — STRK20 Hackathon Sprint

ChaosKey+ is a physical-chaos entropy device (Harvest / Tokens / Ledger) paired with a Pool tab that communicates with the Starknet STRK20 privacy pool through the user’s Ready wallet.
ChaosKey+ method is patent pending.

ChaosKey+ is a personal sovereignty device that generates unpredictable entropy from a chaotic phenomenon and anchors a user’s identity across chains, clouds, agents, and applications. It provides hardware‑rooted identity, offline randomness, and secure authentication that cannot be predicted, replicated, or reverse‑engineered. ChaosKey+ operates outside any blockchain or platform, acting as a universal trust primitive that apps, agents, and protocols can depend on for secure actions, privacy, and identity continuity.

ChaosKey+ is fundamentally a hardware‑rooted chaotic entropy and identity primitive.  
The physical device is the true security boundary — producing non‑replicable, sensor‑driven chaotic entropy that cannot be forged or cloned.

For the sprint demo, a mobile wrapper is used only to expose ChaosKey+ identity and entropy to STRK20 in a way compatible with the sprint format.  
The app is not the primary trust anchor; it is a temporary interface layer.

After the sprint, ChaosKey+ will be exposed directly as a hardware‑first primitive for STRK20 private identity, shielded execution, and quantum‑safe randomness.

**Authoritative privacy plan:** [`STRK20_INTEGRATION_PLAN.md`](./STRK20_INTEGRATION_PLAN.md)  
**Reviewer manifest:** [`strk20.json`](./strk20.json)  
**Wallet API recipe:** [`docs/integration.md`](./docs/integration.md)

STRK20 is a note-based pool for any ERC-20 — not a mixer and not a token ABI. This dapp never holds a viewing key. 
ChaosKey-generated tokens (bearer / TOTP / etc.) are **not** ERC-20s and are not sent to the pool.
## STRK20 Integration Stack

- Starknet mainnet (CHAIN_ID SN_MAIN)
- STRK20 pool at 0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
- Alchemy Starknet mainnet RPC
- CRA React frontend with Starknet wallet integration
- ChaosKey+ hardware-attested entropy foundation
- 
Recent Developments (August 2026)

ChaosKey+ entropy has now been successfully used to sign and broadcast a Bitcoin Testnet4 transaction.
This demonstrates that ChaosKey+ is not limited to Starknet or STRK20 — it can also strengthen Bitcoin’s entropy layer without requiring QSB, Slipstream, or GPU‑heavy proofs.
The transaction was fully standard, propagated normally, and required zero GPU grinding, unlike StarkWare’s QSB demo.
This confirms ChaosKey+ as a scalable, cross‑chain entropy primitive.
<img width="900" height="450" alt="image" src="https://github.com/user-attachments/assets/54c1ee87-53d3-44ab-936b-175bc4932cfb" />

## Demo path

1. Backend: `cd backend` → `uvicorn server:app --host 127.0.0.1 --port 8000` (needs Mongo, `MONGO_URL` / `DB_NAME`).
2. Frontend: `cd frontend` → set `REACT_APP_BACKEND_URL=http://127.0.0.1:8000` → `npm start`.
3. Bottom nav: **Harvest · Tokens · Pool · More** (Ledger / Universe / Device).
4. Pool: install [Ready X](https://chromewebstore.google.com/detail/ready-x/dlcobpjiigpikoobohmabehhmhfoodbb), Sepolia, Connect →  shield / private transfer / unshield.
5. Cross-check wallet: https://starknet-wallet-account.vercel.app
   
Sprint checklist (code vs human) lives in the plan §7b. Phase 3 (shadow accounts) is blocked on a stable Wallet API.

## STRK20 Stack

This project implements the **Starknet Wallet API v0.10** (STRK20) using:

- **Starknet SDK**: `starknet` (v10.4.0) — Core communication and account abstraction.

- **Wallet Standard Discovery**: `@starknet-io/get-starknet-discovery` (v6.0.3) — Modern wallet detection.

- **Wallet Standard Adapter**: `@starknet-io/get-starknet-wallet-standard` (v6.0.3) — Wallet compatibility layer.

- **Wallet API Types**: `@starknet-io/types-js` (v0.10.3) — Type-safe STRK20 actions (deposit, transfer, withdraw).
- The ChaosKey+ Core: Minimal Integration, Maximum Reliability
- 
ChaosKey+ stands as a foundational attested‑entropy device. The physical entropy pipeline requires minimal compute and will continue improving with future development.
 STRK20 is only a top‑layer integration used for visibility.

## Pins

`starknet@10.4.0` · `@starknet-io/get-starknet-discovery@6.0.3` · `@starknet-io/get-starknet-wallet-standard@6.0.3` · `@starknet-io/types-js@0.10.3`
