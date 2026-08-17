# ChaosKey+ M3 — STRK20 hackathon sprint

Physical-chaos entropy device (Harvest / Tokens / Ledger) plus a **Pool** tab that talks to the Starknet STRK20 privacy pool through the user's Ready wallet.

**Authoritative privacy plan:** [`STRK20_INTEGRATION_PLAN.md`](./STRK20_INTEGRATION_PLAN.md)  
**Reviewer manifest:** [`strk20.json`](./strk20.json)  
**Wallet API recipe:** [`docs/integration.md`](./docs/integration.md)

STRK20 is a note-based pool for any ERC-20 — not a mixer and not a token ABI. This dapp never holds a viewing key. ChaosKey-generated tokens (bearer / TOTP / etc.) are **not** ERC-20s and are not sent to the pool.

## Demo path

1. Backend: `cd backend` → `uvicorn server:app --host 127.0.0.1 --port 8000` (needs Mongo, `MONGO_URL` / `DB_NAME`).
2. Frontend: `cd frontend` → set `REACT_APP_BACKEND_URL=http://127.0.0.1:8000` → `npm start`.
3. Bottom nav: **Harvest · Tokens · Pool · More** (Ledger / Universe / Device).
4. Pool: install [Ready X](https://chromewebstore.google.com/detail/ready-x/dlcobpjiigpikoobohmabehhmhfoodbb), Sepolia, Connect → shield / private transfer / unshield.
5. Cross-check wallet: https://starknet-wallet-account.vercel.app/

Sprint checklist (code vs human) lives in the plan §7b. Phase 3 (shadow accounts) is blocked on a stable Wallet API.

## Pins

`starknet@10.4.0` · `@starknet-io/get-starknet-discovery@6.0.3` · `@starknet-io/get-starknet-wallet-standard@6.0.3` · `@starknet-io/types-js@0.10.3`
