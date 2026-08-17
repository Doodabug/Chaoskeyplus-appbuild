# Mainnet Cutover Checklist — ChaosKey+ STRK20 Pool

**When to run this**: after the hackathon submission is validated and you're ready to make Shield / Transfer / Unshield real on Starknet mainnet.

**Why this document exists**: STRK20 privacy is deployed on Starknet mainnet only. The app currently runs against Sepolia (preview mode) so the Pool tab can be shown end-to-end without spending real STRK. This is the exact set of changes to promote it to live.

⚠️ **Real money warning**: mainnet uses real STRK. The pool has a flat fee (readable from `get_fee_amount()`). Notes mature for ~10 blocks before they can be moved. There are no rollbacks.

---

## Preconditions

1. **Wallet**: Ready extension installed, updated, and switched to Starknet Mainnet.
2. **Balance**: at least 5 STRK on your mainnet address (some for the shield, some for gas + pool fee).
3. **Testing done**: you have verified on Sepolia that the wallet chip, capability probe, and error banners render correctly.
4. **Backup**: your device Ed25519 keypair (`backend/keys/`) is backed up — unrelated to the pool cutover, but a good habit before any prod flip.

---

## Changes

### 1. `frontend/.env`

Change these four lines:

```
REACT_APP_STARKNET_RPC=https://free-rpc.nethermind.io/mainnet-juno/v0_10
REACT_APP_STRK20_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
REACT_APP_STRK20_POOL=0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
REACT_APP_STARKNET_EXPLORER=https://voyager.online/tx
```

Notes:
- **RPC**: use a mainnet endpoint. Nethermind is free-tier friendly; Alchemy / Infura also fine.
- **STRK token**: the STRK ERC-20 uses the same contract address on Sepolia and mainnet. This line stays the same as the current value. Verify before commit.
- **Pool**: this is the mainnet privacy pool address. Do not change.
- **Explorer**: drop the `sepolia.` prefix. Result panel links now open on mainnet Voyager.

### 2. `frontend/src/lib/starknetWalletUtils.js`

Add the mainnet chain constant and switch the gate helper:

```js
// Before:
export const SEPOLIA_CHAIN_ID = "0x534e5f5345504f4c4941";
// (used in PrivacyScreen.jsx by onSepolia())

// After (add both):
export const SEPOLIA_CHAIN_ID = "0x534e5f5345504f4c4941";
export const MAINNET_CHAIN_ID = "0x534e5f4d41494e";
export const EXPECTED_CHAIN_ID = MAINNET_CHAIN_ID; // mainnet cutover
```

### 3. `frontend/src/screens/PrivacyScreen.jsx`

Rename `SEPOLIA_CHAIN_ID` → `EXPECTED_CHAIN_ID` and `onSepolia()` → `onExpectedChain()`. Update the button label from "Switch to Sepolia" to "Switch to Mainnet". Remove the preview-mode banner (it self-hides because `starknet.rpcUrl` no longer contains "sepolia").

Concretely, four edits:

```jsx
// Import
import { EXPECTED_CHAIN_ID, ... } from "../lib/starknetWalletUtils";

// Helper
function onExpectedChain(chainId) {
  if (!chainId) return false;
  try {
    return BigInt(chainId) === BigInt(EXPECTED_CHAIN_ID);
  } catch (_) {
    return String(chainId).toLowerCase().includes("main");
  }
}

// Local var
const onExpected = onExpectedChain(starknet.chainId);

// Button copy
<Btn ... onClick={...}>Switch to Mainnet</Btn>
```

### 4. `frontend/src/lib/starknetWallet.js`

`switchToSepolia()` → `switchToMainnet()`:

```js
export async function switchToMainnet() {
  ...
  await walletV6.switchStarknetChain(session.wallet, constants.StarknetChainId.SN_MAIN);
  ...
}
```

Update the export in `providers/StarknetProvider.jsx` accordingly (rename the context field to `switchToMainnet`).

### 5. Verify

Build clean, restart frontend, then:

1. Load the app in a browser with Ready set to Mainnet.
2. Pool tab → Connect Ready → verify `NETWORK: Mainnet` (green).
3. Preview-mode banner should be **gone**.
4. Enter 0.5 STRK under SHIELD → tap Shield.
5. Ready pops up twice: approve ERC-20 spending, then STRK20 deposit.
6. Sign both. Wait for accepted state + Voyager link on mainnet Voyager.
7. Click the link → confirm the tx on `voyager.online`.

### 6. Post-cutover

- Wait ~10 blocks (2–3 minutes) before attempting Private Transfer or Unshield — the note maturity gate blocks earlier attempts and shows *"Notes still maturing — 9 blocks left."*
- Do NOT bundle a deposit with a private transfer to the same recipient in the same submission — it leaks the amount correlation. Shield first, wait, then transfer as a separate action.

---

## Rollback

If anything goes wrong post-cutover, flip `REACT_APP_STARKNET_RPC` and `REACT_APP_STARKNET_EXPLORER` back to Sepolia and restart. The two-line rollback restores preview mode. Your mainnet shielded notes remain on-chain and can be moved from any wallet on mainnet.

---

## What this cutover does NOT do

- **Does not add multi-network switching in the UI**. The app is single-network per env. If you need both mainnet and Sepolia toggleable at runtime, add a network switcher in `StarknetProvider.jsx` (out of scope for this checklist).
- **Does not deploy any Cairo**. STRK20 privacy is deployed by Starkware; you just point at it.
- **Does not touch the ChaosKey+ entropy/ledger/token features** — those are network-agnostic and stay unchanged.
