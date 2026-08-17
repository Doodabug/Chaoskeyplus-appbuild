# STRK20 Integration — Wallet API

ChaosKey+ M3 talks to the STRK20 privacy pool through the user's Ready wallet. The app never holds a viewing key, notes, or proofs.

Authoritative plan: `../STRK20_INTEGRATION_PLAN.md`. Tutorial: https://strk20-by-example.org/starknet-wallet-api/overview

## What this is

STRK20 is a note-based (UTXO) pool for any ERC-20 on Starknet. Shield deposits public tokens as encrypted notes; private transfers stay inside the pool; unshield withdraws back to a public address.

It is not a token standard (`transfer` / `approve` / `balanceOf`) and not a mixer.

## How this app integrates

1. Connect Ready via get-starknet v6 (`frontend/src/lib/starknetWallet.js`).
2. Detect STRK20 with `walletV6.supportedWalletApi` (Wallet API `>= 0.10`). Never probe `strk20Balances` to feature-detect.
3. Ask the wallet to act with `WalletAccountV6.strk20InvokeTransaction`:
   - shield: `{ type: "deposit", token, amount }`
   - private transfer: `{ type: "transfer", token, amount, recipient }`
   - unshield: `{ type: "withdraw", token, amount, recipient }`
4. Amounts are the token's smallest unit (`0x` hex). A shield is two wallet prompts: public ERC-20 approve, then the private deposit.
5. Shielded balances are optional and consent-gated (`strk20Balances`) on the Pool tab only.

## Hidden vs visible

| Private | Public |
|---|---|
| Sender, receiver, and amount of a private transfer | Shield / unshield amounts |
| Which notes were spent | That an address interacted with the pool, and when |

Do not bundle a shield with the transfer it funds. Freshly shielded notes mature ~10 blocks before they can be spent.

## Attribution

Private transactions are relayed. The transaction `sender` is the relayer, not the user. Per-user activity must read the pool `Deposit` event and filter on the first indexed key (topic1). Do not put that history on the entropy Ledger screen.

## Packages

Pin exactly: `starknet@10.4.0`, `@starknet-io/get-starknet-discovery@6.0.3`, `@starknet-io/get-starknet-wallet-standard@6.0.3`, `@starknet-io/types-js@0.10.3`.
