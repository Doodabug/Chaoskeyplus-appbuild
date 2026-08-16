# STRK20 Privacy Integration Plan — ChaosKey+ M3 (`Chaoskeyplus-appbuild`)

Generated 2026-08-15 by the strk20-privacy-integration skill. **Updated in place 2026-08-16** — prior interview decisions kept; snapshot and phases rewritten against the code that is in the tree today. Statuses below were current at this update — re-verify the "coming soon" items and the Open items section before building.

This file supersedes `docs/privacy-plan.md` for on-chain privacy. That document is generic mempool/HSM advice. `strk20.json` + `docs/integration.md` already point at the Wallet API route. `docs/mainnet-transaction-plan.md` still describes deploying a token contract and is leftover wrong model — do not follow it.

### What changed 2026-08-16

- Snapshot was stale: it said no wallet-connect code existed. The Wallet API layer is now in the repo.
- Phase 1–2 library, docs, and tab chrome are still done. Phase 2b restored `PrivacyScreen.jsx` (2026-08-16 execute).
- Shadow accounts remain **blocked** on the Wallet API (stable spec / types-js / pinned starknet). Next-docs preview is not an entry-criterion pass.
- Freshness re-check (2026-08-16): types-js latest still `0.10.3`; wallet-api spec latest stable still `v0.10.3` (`v0.10.4-rc.1` in flight); get-starknet npm `next` is `6.0.4` (keep pin `6.0.3` unless execute-time re-check says otherwise); `packages/sub_account_anonymizer` is gone, `packages/shadow_account_anonymizer` exists.

## 1. Project snapshot

- Stack: React 18 CRA (`react-scripts@5.0.1`) mobile-first PWA in `frontend/`; FastAPI + MongoDB entropy/identity backend in `backend/server.py`; Ed25519 device keys at `backend/keys/`. Wallet layer: `starknet@10.4.0`, `@starknet-io/get-starknet-discovery@6.0.3`, `@starknet-io/get-starknet-wallet-standard@6.0.3`, `@starknet-io/types-js@0.10.3`. No Cairo, Scarb, or anonymizer contracts.
- Relevant code:
  - Wallet connection: `frontend/src/lib/starknetWallet.js:115-188` (`createStore` + `WalletAccountV6.connect`) via `frontend/src/providers/StarknetProvider.jsx`, wrapped in `frontend/src/index.js:9-11`.
  - Transaction layer: `frontend/src/lib/starknetWallet.js` — `shieldAmount` (318), `transferAmount` (335), `unshieldAmount` (354), `fetchShieldedBalances` (374), capability via `walletV6.supportedWalletApi` (127). Pure helpers + tests: `frontend/src/lib/starknetWalletUtils.js` + `.test.js`.
  - Navigation: `frontend/src/App.js:17-23` — five tabs (Harvest, Ledger, Universe, Device, Pool). Top-bar "Connect" (`App.js:61-74`) only switches to the Pool tab.
  - Pool UI: `frontend/src/screens/PrivacyScreen.jsx` — `useStarknet()` (no props). Connect picker, Sepolia prompt, capability degrade, shield / transfer / unshield, consent-gated balances, fee + maturity, explorer result.
  - Entropy ledger (not chain activity): `frontend/src/screens/LedgerScreen.jsx` ← `GET /api/ledger` (`backend/server.py:419`).
  - Device identity: `frontend/src/screens/DeviceScreen.jsx` (Ed25519 PEM + QR via `getPubKey()` in `frontend/src/lib/api.js:12`). Device PEM at `backend/server.py:60-78` is **not** a Starknet key and must never be treated as a viewing key.
- Privacy goal (from interview, confirmed 2026-08-16): hide who pays whom and transfer amounts; show the user their own shielded balances; later hide the public user↔account link (shadow accounts).
- Environment: Starknet **testnet (Sepolia) first**, Ready extension. Pool tab is wired; Ready manual check is still on the developer.

## 2. Chosen route: Privacy Wallet API via starknet.js

Normal dapp: the user connects Ready; the app asks the wallet to shield, privately transfer, unshield, and (when the user asks) read shielded balances. The wallet holds the viewing key, notes, and proofs. ChaosKey+'s FastAPI backend stays an entropy/identity service and never sees pool secrets.

**The rule this follows:** this app never touches viewing keys — the user's wallet acts on its behalf via starknet.js `WalletAccountV6`.

Shadow accounts (unlinkable on-chain identity) are **not** in Phase 1–2b. Official by-example still lists the Wallet API route as pending; the starknet.js *next* WalletAccount guide documents `shadow_account_invoke` + `strk20ShadowAccountCommitment`, and the SDK monorepo has `packages/shadow_account_anonymizer`. Phase 3 tracks that split and only builds after the Open-items re-check.

React convenience: [useStrk20 hooks](https://strk20-by-example.org/starknet-wallet-api/starknet-start-hook) exist, but this repo already owns connection in `starknetWallet.js`. Do not add starknet-react / starknetkit unless their current npm release is confirmed to hand the app a `WalletAccountV6`. Keep wiring on `useStarknet()` from `StarknetProvider.jsx`.

## 3. What this delivers — hidden vs visible

| Private (inside the pool) | Public (visible onchain) |
|---|---|
| Sender and receiver of a private transfer from the Pool tab | Shield (deposit) and unshield (withdraw) amounts — the public ERC-20 legs |
| Transfer amounts and token type | The fact that the connected address interacted with the pool, and when |
| Which notes were spent | Device Ed25519 identity, entropy ledger, harvest/universe activity (unchanged, off-pool) |
| Shielded balances, once the wallet consents to `strk20Balances` | Relayer address on the transaction envelope (same for every user) |

This plan hides **who pays whom** and **how much** on private transfers. It does **not** hide that a user talked to the pool, or the size of a shield/unshield. Shadow accounts (Phase 3) hide the **wallet↔acting-account link**; amounts and dapp activity on that account may still be public.

Do not bundle a shield with the private transfer it funds. The deposit ERC-20 leg names the depositor; composing it with the transfer publishes "this address put in X" next to the payment. Shield first, wait for note maturity (~10 blocks) or accept the composition leak in writing.

Any future "what did this user do" UI (history, rewards, analytics) must read the pool's `Deposit` event and filter on the **first indexed key (topic1)** — the depositing account. Never query `transactions where sender == the user's wallet` (always empty) and never group by `sender` (every shield attributed to the relayer).

## 4. Prerequisites & versions

Pin explicitly. `latest` on these packages is the wrong major. Already installed in `frontend/package.json` — do not reinstall unpinned.

- `starknet@10.4.0` (minimum for `WalletAccountV6`; npm `next` was `10.7.0` on 2026-08-16 — later 10.x is fine if it still exports the same STRK20 actions; do not install unpinned `starknet`)
- `@starknet-io/get-starknet-discovery@6.0.3`, `@starknet-io/get-starknet-wallet-standard@6.0.3` (skill-verified pair; npm `next` is **6.0.4** — keep 6.0.3 unless execute-time re-check of the WalletAccount guide requires the bump)
- `@starknet-io/types-js@0.10.3` (Wallet API spec v0.10.3; v0.10.4-rc.1 is in flight — do not pin an RC)
- Test wallet: Ready extension (WalletAccount *next* guide also names Xverse as of 2026-08 — treat as re-check, not Phase 2b target)
- RPC: a Sepolia `nodeUrl` via env (`REACT_APP_STARKNET_RPC`), never hardcoded secrets
- No Cairo toolchain in this repo. None required for Phase 1–2b.

Existing connect shape (already in `starknetWallet.js`; matches the 2026-08-16 WalletAccount guide):

```js
import { createStore } from "@starknet-io/get-starknet-discovery";
import { WalletAccountV6, walletV6 } from "starknet";

const store = createStore();
const selected = /* wallet the user picked from store.getWallets() */;
const account = await WalletAccountV6.connect({ nodeUrl }, selected);
```

The *next* guide also shows `@starknet-io/get-starknet/discovery` — that is a different package name. Keep the pinned `@starknet-io/get-starknet-discovery` import already in this repo.

API to implement against (fetch again at execute time, do not guess): [WalletAccount + get-starknet v6](https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6).

## 5. Phase 1 — first shielded flow ✅ done 2026-08-15

Status: done 2026-08-15 (manual Ready wallet check still on the developer)

Shipped and still present:

1. Pinned packages in `frontend/package.json`.
2. `frontend/src/lib/starknetWallet.js` — `createStore()`, `WalletAccountV6.connect`, `walletV6.supportedWalletApi` (never `strk20Balances` for feature-detect), `onChange` reconstruct, `waitForTransaction` raced against a timeout, `strk20InvokeTransaction([{ type: "deposit", … }])`.
3. Fifth tab in `frontend/src/App.js:17-23` (Pool). Device tab stays Ed25519 hardware identity.
4. Capability helpers + unit tests in `starknetWalletUtils.js` / `.test.js`.
5. `StarknetProvider` in `frontend/src/index.js`.

Pool UI lives in Phase 2b (`PrivacyScreen.jsx`). Do not re-install packages.

## 6. Phase 2 — feature integration ✅ done 2026-08-15 (library + docs)

Status: library and docs done 2026-08-15; Pool UI in Phase 2b.

Still present:

- `transferAmount` / `unshieldAmount` / `fetchShieldedBalances` / `spendLocked` (~10-block maturity) in `starknetWallet.js`.
- Consent-gated balances: `strk20Balances` only via `fetchShieldedBalances` (docstring: Pool tab only).
- Backend stays out. `backend/server.py` has no viewing keys, notes, proofs, or relayer credentials.
- `strk20.json` is a pool pointer, not an ERC-20 ABI.
- `docs/integration.md` is the Wallet API recipe.
- `docs/privacy-plan.md` marked superseded.
- `scripts/prepare_strk20_tx.sh` / `scripts/demo_private_relay.sh` retired.

Pool tab UI restored in Phase 2b.

## 6b. Phase 2b — restore the Pool tab ✅ done 2026-08-16

Status: done 2026-08-16 (manual Ready wallet check still on the developer)

Rewrite `frontend/src/screens/PrivacyScreen.jsx` against `useStarknet()` from `StarknetProvider.jsx`. Match `Panel` / `Btn` / `Overline` in `frontend/src/components/ui.jsx`. `App.js` keeps rendering `<Active />` with no props.

1. Wallet list from `session.wallets`, connect / disconnect, show address + chain. Prompt a Sepolia switch if `chainId` is not Sepolia (`starknetWallet.js` already tries).
2. Capability degrade: if `capable` is false, hide shield / transfer / unshield / balances and show "needs a STRK20-capable wallet (Ready)". Detect only from the version query already stored on the session.
3. **Shield** — `starknet.shield(amount)`. UI names both wallet prompts: public ERC-20 `approve`, then the private deposit. Amounts in the token's smallest unit (helpers already convert). Surface screening decline as a declined deposit (`classifyPoolError` kind `screening`).
4. **Private transfer** — `starknet.transfer(amount, recipient)`. Do not compose with a same-tx deposit. Disable while `maturityLeft > 0` (or call `refreshMaturity` and honor `spendLocked`).
5. **Unshield** — `starknet.unshield(amount, recipient)`. Label the amount as public.
6. **Shielded balances** — only after a dedicated control on this tab (`starknet.fetchBalances`). Copy must say the wallet will ask to share shielded balances. Never call this from Harvest / Ledger / Universe / Device.
7. Honest labels: "private transfer (sender, receiver, amount hidden)" vs "shield / unshield (amount public)".
8. Pool fee via `starknet.fetchFee()`; subtract from any MAX prefills. If `REACT_APP_STRK20_POOL` is unset, degrade fee display (already returns `{ available: false }`). Do not invent a fee-sponsorship UX.
9. After submit: explorer link from the wallet helper; timeout = "submitted", not a hang.

Manual check at phase end: connect Ready → unsupported wallet hidden → shield STRK → approve then deposit both shown → wait ~10 blocks → private transfer → unshield. Deposit amount is public on the explorer; transfer sender/receiver/amount are not.

## 7. Phase 3 — shadow accounts ⛔ blocked 2026-08-16: Wallet API route still has no stable shadow-account method

Status: blocked 2026-08-16 — execute requested; re-verified again, **not implemented**

Re-check (2026-08-16, execute attempt):
- Wallet API spec latest **stable** is still **v0.10.3** ([Latest](https://github.com/starkware-libs/starknet-specs/releases/tag/v0.10.3)). **v0.10.4-rc.1** (13 Aug, pre-release) renames sub-accounts → shadow accounts — not an entry-criterion pass.
- `@starknet-io/types-js` latest still **0.10.3**; `STRK20_ACTION` is only `deposit | withdraw | transfer | invoke` — no `shadow_account_invoke`.
- Pinned `starknet@10.4.0` `WalletAccountV6` has `strk20InvokeTransaction` / `strk20Balances` / `strk20PrepareInvoke` — no `strk20ShadowAccountCommitment`.
- By-example still says [Wallet API pending](https://strk20-by-example.org/builder-privacy-overview) for unlinkable accounts. SDK route exists (`packages/shadow_account_anonymizer`) but this app must not take it: a dapp never holds the viewing key.
- The WalletAccount *next* guide documents `shadow_account_invoke` as a fifth action. Preview only — do not bump to an RC to unblock this dapp.
- Criterion 3 (Ready on Sepolia) was not tested; it is moot until 1 and 2 pass.

- Entry criterion (all of):
  1. Wallet API spec exposes a shadow-account method in a **stable** release (watch v0.10.4+; v0.10.4-rc.1 is not enough).
  2. `@starknet-io/types-js` and `starknet` (`WalletAccountV6`) export that method on a non-RC pin.
  3. Ready extension performs it in a Sepolia test.
- Design-now (do not implement):
  - This app has no protocol calls yet. The candidate is a later "act on Starknet without publishing the Ready address" flow (e.g. a public receipt account), via `shadow_account_invoke` if that is the shipped name.
  - Shadow-account funds and txs are **public**; only the link to the main wallet is hidden. Do not label them as shielded balances.
  - Naming: SDK / next docs use **shadow accounts**; older skill text says sub-accounts; `packages/sub_account_anonymizer` is gone, `packages/shadow_account_anonymizer` exists.
- No anonymizer contract is in scope for ChaosKey+ M3 unless the product later adds its own vault/swap/lend. This skill will not generate Cairo. If that day comes, the team owns review, audit, deploy, and maintenance; start from `packages/ekubo_swap_anonymizer` / `packages/vesu_lending_anonymizer` in [starknet-privacy](https://github.com/starkware-libs/starknet-privacy).

## 8. Testing

- Testnet (Sepolia) only until an explicit mainnet go.
- Ready extension + [wallet test dapp](https://starknet-wallet-account.vercel.app/).
- Headless: `cd frontend && npm test` / production build must stay green; Phase 2b does not need new test framework — keep capability tests in `starknetWalletUtils.test.js`.
- Existing backend pytest is out of scope for pool actions and must keep passing (`backend/tests/test_chaoskey.py`).
- Do not promise a Katana/devnet loop for wallet proving; the public SDK monorepo is the place to re-check local-testing tooling later.

## 9. Compliance & security notes

- Deposit screening is enforced onchain by the protocol (from v0.14.3); it applies on this Wallet API route. Self-hosted proving is irrelevant here and would not bypass screening anyway.
- Selective disclosure exists for a legitimate regulatory request; it is not automatic compliance and carries no regulator endorsement. ChaosKey+ still owns its own legal/compliance decisions.
- No viewing keys, notes, proofs, or Starknet private keys in the repo, env committed to git, or FastAPI handlers. `REACT_APP_STARKNET_RPC` is a public RPC URL only.
- Do not frame this product as a mixer or a screening workaround.

## 10. Open items to re-verify at build time

- get-starknet npm `next`: 6.0.3 (plan pin) vs 6.0.4 (current next as of 2026-08-16).
- `starknet` npm `next`: 10.7.0; confirm `WalletAccountV6` + `strk20InvokeTransaction` + `STRK20_ACTION` still match the guide on the pinned 10.4.0.
- Wallet API spec: stay on v0.10.3 until 0.10.4 is stable; then re-read shadow-account support.
- Ready + Xverse: Ready is the Phase 2b target. WalletAccount *next* guide now names both as STRK20 wallets (2026-08); confirm Xverse in a real Sepolia connect before advertising it.
- Sepolia ERC-20 addresses: official STRK is the same address on Sepolia and mainnet (`0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`). Sepolia **pool** address is still unset (`REACT_APP_STRK20_POOL`); fee display degrades until it is filled.
- Pool fee (`get_fee_amount`) and whether wallet-sponsored gas still excludes the pool fee — copy says gas may be sponsored, pool fee is not. Re-check if paymaster design lands.
- Shadow-account Wallet API: **blocked 2026-08-16** (execute requested, criteria still fail). types-js latest still 0.10.3 (no shadow action); spec latest stable v0.10.3; v0.10.4-rc.1 is a pre-release rename only. Preview: WalletAccount *next* docs + `packages/shadow_account_anonymizer`. Do not bump to an RC; do not take the SDK route.
- Fee / paymaster design for shielded-token fee payment.
- `docs/mainnet-transaction-plan.md` marked superseded 2026-08-16 (wrong token-deploy model).

## 11. Links

- What STRK20 is: https://strk20-by-example.org/what-is-strk20
- Wallet API overview: https://strk20-by-example.org/starknet-wallet-api/overview
- starknet.js `WalletAccountV6`: https://strk20-by-example.org/starknet-wallet-api/starknet-js
- React hooks (not used; optional later): https://strk20-by-example.org/starknet-wallet-api/starknet-start-hook
- Compliance / screening: https://strk20-by-example.org/compliance
- Builder overview / unlinkable accounts: https://strk20-by-example.org/builder-privacy-overview
- WalletAccount guide (current API): https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6
- Wallet test dapp: https://starknet-wallet-account.vercel.app/
- Privacy SDK monorepo (reference; this app does not import it): https://github.com/starkware-libs/starknet-privacy
- Whitepaper: https://eprint.iacr.org/2026/474
- Pool (mainnet, canonical): https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
- Wallet API spec v0.10.3: https://github.com/starkware-libs/starknet-specs/releases/tag/v0.10.3
