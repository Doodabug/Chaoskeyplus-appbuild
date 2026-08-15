# STRK20 Privacy Integration Plan — ChaosKey+ M3 (`Chaoskeyplus-appbuild`)

Generated 2026-08-15 by the strk20-privacy-integration skill. Statuses below were current at generation time — re-verify the "coming soon" items and the Open items section before building.

This file supersedes `docs/privacy-plan.md` for on-chain privacy. That document is generic mempool/HSM advice. The existing `strk20.json` + `docs/integration.md` treat STRK20 as a public token ABI (`transfer` / `approve` / `balanceOf`); that is not the STRK20 privacy pool. Leave those files in place until Phase 2 rewrites them so reviewers are not following the wrong interface.

## 1. Project snapshot

- Stack: React 18 CRA (`react-scripts@5.0.1`) mobile-first PWA in `frontend/`; FastAPI + MongoDB entropy/identity backend in `backend/server.py`; Ed25519 device keys at `backend/keys/`. No `starknet`, get-starknet, Cairo, Scarb, or wallet-connect code exists today.
- Relevant code:
  - Wallet connection: **does not exist**. Closest identity surface is `frontend/src/screens/DeviceScreen.jsx` (Ed25519 PEM + QR via `getPubKey()` in `frontend/src/lib/api.js:13`).
  - Transaction layer: **does not exist**. All frontend I/O is axios to FastAPI (`frontend/src/lib/api.js`). `scripts/prepare_strk20_tx.sh` is a public-transfer echo template and must not be used for pool actions.
  - Navigation: `frontend/src/App.js:14-19` — four tabs (Harvest, Ledger, Universe, Device). No privacy surface.
  - Entropy ledger (not chain activity): `frontend/src/screens/LedgerScreen.jsx` ← `GET /api/ledger` (`backend/server.py:419`).
  - Device signing: `backend/server.py:60-78` (`load_or_create_device_keys`). These keys are **not** Starknet keys and must never be treated as a viewing key.
- Privacy goal (from interview): hide who pays whom and transfer amounts; show the user their own shielded balances; later hide the public user↔account link (shadow accounts).
- Environment: Starknet **testnet (Sepolia) first**, Ready extension. Users do not have a Starknet wallet wired into this app today.

## 2. Chosen route: Privacy Wallet API via starknet.js

Normal dapp: the user connects Ready; the app asks the wallet to shield, privately transfer, unshield, and (when we choose to show it) read shielded balances. The wallet holds the viewing key, notes, and proofs. ChaosKey+'s FastAPI backend stays an entropy/identity service and never sees pool secrets.

**The rule this follows:** this app never touches viewing keys — the user's wallet acts on its behalf via starknet.js `WalletAccountV6`.

Shadow accounts (unlinkable on-chain identity) are **not** in Phase 1–2. Official by-example still lists the Wallet API route as pending; the starknet.js *next* WalletAccount guide already documents a `shadow_account_invoke` action, and the SDK monorepo renamed sub-accounts → shadow accounts in `0.14.3-RC.5` (`packages/shadow_account_anonymizer`). Phase 3 tracks that split and only builds after the Open-items re-check.

React convenience: [useStrk20 hooks](https://strk20-by-example.org/starknet-wallet-api/starknet-start-hook) exist, but this repo is CRA without a Starknet provider. Phase 1 wires `WalletAccountV6` directly in a new `frontend/src/lib/starknetWallet.js` so capability detection stays explicit. Do not add starknet-react / starknetkit unless their current npm release is confirmed to hand the app a `WalletAccountV6`.

## 3. What this delivers — hidden vs visible

| Private (inside the pool) | Public (visible onchain) |
|---|---|
| Sender and receiver of a private transfer from the new Privacy tab | Shield (deposit) and unshield (withdraw) amounts — the public ERC-20 legs |
| Transfer amounts and token type | The fact that the connected address interacted with the pool, and when |
| Which notes were spent | Device Ed25519 identity, entropy ledger, harvest/universe activity (unchanged, off-pool) |
| Shielded balances, once the wallet consents to `strk20Balances` | Relayer address on the transaction envelope (same for every user) |

This plan hides **who pays whom** and **how much** on private transfers. It does **not** hide that a user talked to the pool, or the size of a shield/unshield. Shadow accounts (Phase 3) hide the **wallet↔acting-account link**; amounts and dapp activity on that account may still be public.

Do not bundle a shield with the private transfer it funds. The deposit ERC-20 leg names the depositor; composing it with the transfer publishes "this address put in X" next to the payment. Shield first, wait for note maturity (~10 blocks) or accept the composition leak in writing.

Any future "what did this user do" UI (history, rewards, analytics) must read the pool's `Deposit` event and filter on the **first indexed key (topic1)** — the depositing account. Never query `transactions where sender == the user's wallet` (always empty) and never group by `sender` (every shield attributed to the relayer).

## 4. Prerequisites & versions

Pin explicitly. `latest` on these packages is the wrong major.

- `starknet@10.4.0` (minimum for `WalletAccountV6`; npm `next` was `10.7.0` on 2026-08-15 — later 10.x is fine if it still exports the same STRK20 actions; do not install unpinned `starknet`)
- `@starknet-io/get-starknet-discovery@6.0.3`, `@starknet-io/get-starknet-wallet-standard@6.0.3` (skill-verified pair; npm `next` drifted to **6.0.4** on 2026-08-15 — confirm 6.0.3 still resolves, otherwise pin 6.0.4 and re-check the WalletAccount guide)
- `@starknet-io/types-js@0.10.3` (Wallet API spec v0.10.3; v0.10.4-rc.1 is in flight — do not pin an RC for Phase 1)
- Test wallet: Ready extension
- RPC: a Sepolia `nodeUrl` via env (`REACT_APP_STARKNET_RPC`), never hardcoded secrets
- No Cairo toolchain in this repo. None required for Phase 1–2.

Install from `frontend/`:

```sh
npm install starknet@10.4.0 \
  @starknet-io/get-starknet-discovery@6.0.3 \
  @starknet-io/get-starknet-wallet-standard@6.0.3 \
  @starknet-io/types-js@0.10.3
```

API to implement against (fetch again at execute time, do not guess): [WalletAccount + get-starknet v6](https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6).

Verified connect shape (2026-08-15 guide):

```js
import { createStore } from "@starknet-io/get-starknet-discovery";
import { WalletAccountV6, walletV6 } from "starknet";

const store = createStore();
const selected = /* wallet the user picked from store.getWallets() */;
const account = await WalletAccountV6.connect({ nodeUrl }, selected);
```

Import the wallet type from `@starknet-io/get-starknet-wallet-standard/features` (package root does not re-export it).

## 5. Phase 1 — first shielded flow ✅ done 2026-08-15

Status: done 2026-08-15 (manual Ready wallet check still on the developer)

1. Add the pinned packages to `frontend/package.json` (CRA JS; no TypeScript migration).
2. New `frontend/src/lib/starknetWallet.js`:
   - `createStore()` + custom picker UI (match existing `Panel` / `Btn` in `frontend/src/components/ui.jsx`).
   - `WalletAccountV6.connect({ nodeUrl: process.env.REACT_APP_STARKNET_RPC }, selectedWallet)`.
   - Capability detect with `walletV6.supportedWalletApi(wallet)` (or `supportedSpecs`); treat Wallet API `>= 0.10` as STRK20-capable.
   - **Never** call `strk20Balances` to feature-detect (that is a consent-gated balance read).
   - Subscribe to account/network change and reconstruct `WalletAccountV6` on change (guide recommendation).
   - `waitForTransaction` raced against a timeout; timeout = "submitted" + explorer link, not a hang.
3. New `frontend/src/screens/PrivacyScreen.jsx` + fifth tab in `frontend/src/App.js:14-19` (label e.g. "Pool"). Device tab stays Ed25519 hardware identity; do not overload it.
4. First flow: **shield only** — `strk20InvokeTransaction([{ type: "deposit", token, amount }])`.
   - UI names both wallet prompts: public ERC-20 `approve`, then the private deposit. A deposit is two transactions.
   - Amounts in the token's smallest unit. Compare addresses with `BigInt(a) === BigInt(b)`.
   - Read pool fee via `get_fee_amount`; subtract it from any MAX prefills. Do not invent a fee-sponsorship UX.
   - Surface screening decline as a declined deposit, not a generic tx error.
5. Graceful degradation: if the connected wallet is not Ready (or Wallet API `< 0.10`), hide shield/transfer/unshield and show "needs a STRK20-capable wallet (Ready)". Braavos / Privy / other embedded wallets are unsupported.
6. Verify on Sepolia against the Ready extension and [wallet test dapp](https://starknet-wallet-account.vercel.app/). Pure local devnet does not exercise wallet proving.

Manual check at phase end: connect Ready → unsupported wallet hidden → shield STRK (or the chosen Sepolia ERC-20) → approve then deposit both shown → explorer shows a pool interaction; amount of the deposit is public.

## 6. Phase 2 — feature integration ✅ done 2026-08-15

Status: done 2026-08-15 (manual Ready wallet check still on the developer)

- **Private transfer** on `PrivacyScreen.jsx`: `{ type: "transfer", token, amount, recipient }`. Recipient must already be registered (Ready does this on first use). Do not compose with a same-tx deposit.
- **Unshield**: `{ type: "withdraw", token, amount, recipient }`. Label the amount as public.
- **Shielded balances** (requested): call `account.strk20Balances([token])` only from the Privacy tab, after the user is connected and STRK20-capable. Copy must say the wallet will ask to share shielded balances. Skip this call on Harvest / Ledger / Universe / Device.
- **Note maturity**: after a shield, disable spend until ~10 blocks (or show the wait). Do not immediately offer transfer of the just-shielded amount.
- **Honest labels** on `PrivacyScreen.jsx`: "private transfer (sender, receiver, amount hidden)" vs "shield / unshield (amount public)".
- **Do not** hang private-tx history off `LedgerScreen.jsx`. That screen is the entropy hash chain (`GET /api/ledger`). A later activity list, if wanted, is a new panel that indexes pool `Deposit` events by topic1.
- **Backend stays out.** `backend/server.py` does not gain viewing keys, notes, proofs, or relayer credentials. Device PEM at `backend/keys/` remains entropy-signing only.
- **Doc repair** (same phase, so the public submission stops contradicting the pool):
  - Rewrite `strk20.json` as a pointer at the pool + this plan, not an ERC-20 ABI.
  - Rewrite `docs/integration.md` to the Wallet API recipe.
  - Mark `docs/privacy-plan.md` superseded.
  - Retire or relabel `scripts/prepare_strk20_tx.sh` / `scripts/demo_private_relay.sh` so they cannot be mistaken for pool transfers.
- Re-check fee / paymaster UX at build time before writing copy about who pays gas vs the pool fee.

## 7. Phase 3 — shadow accounts ⛔ blocked 2026-08-15: Wallet API route still has no stable shadow-account method

Status: blocked 2026-08-15 — re-verified, **not implemented**

Re-check (2026-08-15):
- Wallet API spec latest **stable** is still **v0.10.3**; **v0.10.4-rc.1** is in flight (not an entry-criterion pass).
- `@starknet-io/types-js@0.10.3` `STRK20_ACTION` is only `deposit | withdraw | transfer | invoke` — no `shadow_account_invoke`.
- Pinned `starknet@10.4.0` `WalletAccountV6` has no `strk20ShadowAccountCommitment` / shadow-account method (grep clean).
- By-example still says [Wallet API pending](https://strk20-by-example.org/builder-privacy-overview) for unlinkable accounts. SDK route exists (`packages/shadow_account_anonymizer`) but this app must not take it: a dapp never holds the viewing key.
- Criterion 3 (Ready on Sepolia) was not tested; it is moot until 1 and 2 pass.

- Entry criterion (all of):
  1. Wallet API spec exposes a shadow-account method in a **stable** release (watch v0.10.4+; v0.10.4-rc.1 is not enough).
  2. `@starknet-io/types-js` and `starknet` (`WalletAccountV6`) export that method on a non-RC pin.
  3. Ready extension performs it in a Sepolia test.
- Design-now (do not implement):
  - This app has no protocol calls yet. The candidate is a later "act on Starknet without publishing the Ready address" flow (e.g. a public receipt account), via `shadow_account_invoke` if that is the shipped name.
  - Shadow-account funds and txs are **public**; only the link to the main wallet is hidden. Do not label them as shielded balances.
  - Naming drift to re-read first: SDK `0.14.3-RC.5` uses **shadow accounts**; older skill text says sub-accounts; `packages/sub_account_anonymizer` is gone, `packages/shadow_account_anonymizer` exists. The next WalletAccount guide already lists `shadow_account_invoke` + `strk20ShadowAccountCommitment` — treat that as a preview, not Phase 1 API.
- No anonymizer contract is in scope for ChaosKey+ M3 unless the product later adds its own vault/swap/lend. This skill will not generate Cairo. If that day comes, the team owns review, audit, deploy, and maintenance; start from `packages/ekubo_swap_anonymizer` / `packages/vesu_lending_anonymizer` in [starknet-privacy](https://github.com/starkware-libs/starknet-privacy).

## 8. Testing

- Testnet (Sepolia) only until an explicit mainnet go.
- Ready extension + [wallet test dapp](https://starknet-wallet-account.vercel.app/).
- Headless: `cd frontend && npm test` / production build must stay green; add unit tests around capability detection in `starknetWallet.js` (version query, not balance probe).
- Existing backend pytest is out of scope for pool actions and must keep passing (`backend/tests/test_chaoskey.py`).
- Do not promise a Katana/devnet loop for wallet proving; the public SDK monorepo is the place to re-check local-testing tooling later.

## 9. Compliance & security notes

- Deposit screening is enforced onchain by the protocol (from v0.14.3); it applies on this Wallet API route. Self-hosted proving is irrelevant here and would not bypass screening anyway.
- Selective disclosure exists for a legitimate regulatory request; it is not automatic compliance and carries no regulator endorsement. ChaosKey+ still owns its own legal/compliance decisions.
- No viewing keys, notes, proofs, or Starknet private keys in the repo, env committed to git, or FastAPI handlers. `REACT_APP_STARKNET_RPC` is a public RPC URL only.
- Do not frame this product as a mixer or a screening workaround.

## 10. Open items to re-verify at build time

- get-starknet npm `next`: 6.0.3 (plan pin) vs 6.0.4 (current next as of 2026-08-15).
- `starknet` npm `next`: 10.7.0; confirm `WalletAccountV6` + `strk20InvokeTransaction` + `STRK20_ACTION` still match the guide.
- Wallet API spec: stay on v0.10.3 until 0.10.4 is stable; then re-read shadow-account support.
- Ready + Xverse: Ready is the Phase 1 target; Xverse dapp-facing Wallet API was in progress as of mid-July 2026.
- Sepolia ERC-20 addresses: official STRK is the same address on Sepolia and mainnet (`0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`). Sepolia **pool** address is still unset (`REACT_APP_STRK20_POOL`); fee display degrades until it is filled.
- Pool fee (`get_fee_amount`) and whether wallet-sponsored gas still excludes the pool fee — copy says gas may be sponsored, pool fee is not. Re-check if paymaster design lands.
- Shadow-account Wallet API: **blocked 2026-08-15**. types-js latest still 0.10.3 (no shadow action); spec 0.10.4 still RC; by-example still pending. Preview only: WalletAccount *next* docs + `packages/shadow_account_anonymizer`. Do not bump to an RC to unblock this dapp.
- Fee / paymaster design for shielded-token fee payment.

## 11. Links

- What STRK20 is: https://strk20-by-example.org/what-is-strk20
- Wallet API overview: https://strk20-by-example.org/starknet-wallet-api/overview
- starknet.js `WalletAccountV6`: https://strk20-by-example.org/starknet-wallet-api/starknet-js
- React hooks (not Phase 1, optional later): https://strk20-by-example.org/starknet-wallet-api/starknet-start-hook
- Compliance / screening: https://strk20-by-example.org/compliance
- WalletAccount guide (current API): https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6
- Wallet test dapp: https://starknet-wallet-account.vercel.app/
- Privacy SDK monorepo (reference; this app does not import it): https://github.com/starkware-libs/starknet-privacy
- Whitepaper: https://eprint.iacr.org/2026/474
- Pool (mainnet, canonical): https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
- Wallet API spec v0.10.3: https://github.com/starkware-libs/starknet-specs/releases/tag/v0.10.3
