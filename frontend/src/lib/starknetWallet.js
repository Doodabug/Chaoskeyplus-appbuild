// Wallet API via starknet.js WalletAccountV6.
// This module never reads viewing keys, notes, or proofs.

import { createStore } from "@starknet-io/get-starknet-discovery";
import { Contract, RpcProvider, WalletAccountV6, constants, walletV6 } from "starknet";
import {
  DEFAULT_EXPLORER,
  DEFAULT_RPC,
  DEFAULT_TOKEN,
  DEFAULT_TOKEN_DECIMALS,
  NETWORKS,
  NOTE_MATURITY_BLOCKS,
  TX_WAIT_MS,
  baseToHuman,
  classifyPoolError,
  explorerTxUrl,
  humanToBaseHex,
  isFeltAddress,
  isStrk20Capable,
  maturityRemaining,
  resolveNetwork,
  sameAddress,
  walletDisplayName,
} from "./starknetWalletUtils";

const FEE_ABI = [
  {
    type: "function",
    name: "get_fee_amount",
    inputs: [],
    outputs: [
      {
        type: "core::integer::u256",
      },
    ],
    state_mutability: "view",
  },
];

const NETWORK_STORAGE_KEY = "chaoskey.strk20.network";

const listeners = new Set();

function initialNetwork() {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage?.getItem(NETWORK_STORAGE_KEY);
      if (stored && NETWORKS[stored]) return NETWORKS[stored];
    } catch (_) {
      /* private mode / SSR */
    }
  }
  return resolveNetwork(process.env.REACT_APP_STARKNET_RPC);
}

const session = {
  store: null,
  storeUnsub: null,
  wallets: [],
  wallet: null,
  account: null,
  address: "",
  chainId: "",
  capable: false,
  apiVersions: [],
  changeUnsub: null,
  lastShieldBlock: null,
  currentBlock: null,
  network: initialNetwork(),
};

function emit() {
  const snap = getSession();
  listeners.forEach((fn) => fn(snap));
}

function nodeUrl() {
  return session.network?.rpc || process.env.REACT_APP_STARKNET_RPC || DEFAULT_RPC;
}

/** Starknet RPC URL used by WalletAccountV6 / RpcProvider (respects current network). */
export function getRpcUrl() {
  return nodeUrl();
}

/** Read provider: connected WalletAccountV6, else a bare RpcProvider. */
export function getProvider() {
  return session.account ?? new RpcProvider({ nodeUrl: nodeUrl() });
}

function tokenAddress() {
  return session.network?.token || process.env.REACT_APP_STRK20_TOKEN || DEFAULT_TOKEN;
}

function poolAddress() {
  const fromNetwork = session.network?.pool;
  if (fromNetwork) return fromNetwork.trim();
  return (process.env.REACT_APP_STRK20_POOL || "").trim();
}

function explorerBase() {
  return session.network?.explorer || process.env.REACT_APP_STARKNET_EXPLORER || DEFAULT_EXPLORER;
}

/** Change the active network. Disconnects the current wallet if the chain changes. */
export async function setNetwork(networkKey) {
  const next = NETWORKS[networkKey];
  if (!next) throw new Error(`Unknown network: ${networkKey}`);
  if (session.network?.id === next.id) return getSession();
  session.network = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.setItem(NETWORK_STORAGE_KEY, next.id);
    } catch (_) {
      /* ignore */
    }
  }
  // Any prior wallet session references the old chain — clear it so the user
  // is prompted to reconnect on the new network.
  if (session.account || session.wallet) {
    await disconnectWallet();
  } else {
    emit();
  }
  return getSession();
}

export function getSession() {
  return {
    wallets: session.wallets,
    wallet: session.wallet,
    account: session.account,
    address: session.address,
    chainId: session.chainId,
    capable: session.capable,
    apiVersions: session.apiVersions,
    walletName: walletDisplayName(session.wallet),
    token: tokenAddress(),
    pool: poolAddress(),
    explorerBase: explorerBase(),
    rpcUrl: nodeUrl(),
    network: session.network,
    lastShieldBlock: session.lastShieldBlock,
    currentBlock: session.currentBlock,
    maturityLeft: maturityRemaining(
      session.currentBlock,
      session.lastShieldBlock,
      NOTE_MATURITY_BLOCKS
    ),
  };
}

export function subscribeSession(fn) {
  listeners.add(fn);
  fn(getSession());
  return () => listeners.delete(fn);
}

function legacyInjectedWallets() {
  if (typeof window === "undefined") return [];
  // Fall back to window.ready ?? window.starknet ?? window.starknet_argentX ?? window.starknet_braavos
  const found = [];
  const seen = new Set();
  const push = (w, fallbackId, fallbackName) => {
    if (!w || seen.has(w)) return;
    seen.add(w);
    found.push({
      ...w,
      id: w.id || fallbackId,
      name: w.name || fallbackName,
    });
  };
  push(window.ready, "ready", "Ready");
  push(window.starknet, "starknet", "Starknet Wallet");
  push(window.starknet_argentX, "argentX", "Argent X");
  push(window.starknet_braavos, "braavos", "Braavos");
  return found;
}

export function initWalletStore() {
  if (session.store) return session.store;
  session.store = createStore();
  const refresh = () => {
    const discovered = session.store.getWallets();
    // If modern Wallet Standard finds nothing, fall back to legacy window injections
    session.wallets = discovered.length > 0 ? discovered : legacyInjectedWallets();
    emit();
  };
  session.storeUnsub = session.store.subscribe(refresh);
  refresh();
  return session.store;
}

export async function readWalletApiVersions(wallet) {
  if (!wallet) return [];
  try {
    const versions = await walletV6.supportedWalletApi(wallet);
    return Array.isArray(versions) ? versions.map(String) : [];
  } catch (_) {
    try {
      const specs = await walletV6.supportedSpecs(wallet);
      return Array.isArray(specs) ? specs.map(String) : [];
    } catch (__) {
      return [];
    }
  }
}

async function readChainId(wallet, account) {
  // Preferred: account.getChainId() (uses starknet.js WalletAccountV6)
  try {
    const cid = account ? await account.getChainId() : "";
    if (cid) return String(cid);
  } catch (e) {
    console.warn("[starknetWallet] account.getChainId failed:", e?.message || e);
  }
  // Fallback 1: ask the wallet directly via Wallet API
  try {
    const cid = await walletV6.requestChainId(wallet);
    if (cid) return String(cid);
  } catch (e) {
    console.warn("[starknetWallet] walletV6.requestChainId failed:", e?.message || e);
  }
  // Fallback 2: some legacy wallets expose chainId on the injection object
  const legacyId = wallet?.chainId || wallet?.provider?.chainId;
  if (legacyId) return String(legacyId);
  return "";
}

async function applyConnected(wallet, account) {
  if (session.changeUnsub) {
    try {
      session.changeUnsub();
    } catch (_) {
      /* ignore */
    }
    session.changeUnsub = null;
  }
  session.wallet = wallet;
  session.account = account;
  session.address = account?.address || "";
  session.chainId = await readChainId(wallet, account);
  session.apiVersions = await readWalletApiVersions(wallet);
  session.capable = isStrk20Capable(session.apiVersions);
  if (account?.onChange) {
    session.changeUnsub = account.onChange(async () => {
      try {
        const next = await WalletAccountV6.connect({ nodeUrl: nodeUrl() }, wallet);
        await applyConnected(wallet, next);
      } catch (_) {
        await disconnectWallet();
      }
    });
  }
  emit();
}

export async function connectWallet(wallet) {
  if (!wallet) throw new Error("Pick a wallet.");
  initWalletStore();
  const account = await WalletAccountV6.connect({ nodeUrl: nodeUrl() }, wallet);
  await applyConnected(wallet, account);
  // Try auto-switch if we detected a chain mismatch vs the app's expected network
  const expected = session.network?.chainId;
  if (expected && session.chainId && !sameAddress(session.chainId, expected)) {
    try {
      await switchWalletChain();
    } catch (_) {
      /* switch failed; user can retry from the UI, which will surface the error */
    }
  }
  return getSession();
}

/** Ask the wallet to switch to the network the app currently expects. Surfaces errors. */
export async function switchWalletChain() {
  if (!session.wallet) throw new Error("Connect a wallet first.");
  const target = session.network?.id === "mainnet"
    ? constants.StarknetChainId.SN_MAIN
    : constants.StarknetChainId.SN_SEPOLIA;
  try {
    // Prefer wallet-level switch (works even before WalletAccountV6 refreshes)
    if (typeof walletV6.switchStarknetChain === "function") {
      await walletV6.switchStarknetChain(session.wallet, target);
    } else if (session.account?.switchStarknetChain) {
      await session.account.switchStarknetChain(target);
    } else {
      throw new Error("Wallet does not expose switchStarknetChain.");
    }
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (/USER_REFUSED|refused|reject/i.test(msg)) {
      const wrapped = new Error("You declined the network switch in the wallet.");
      wrapped.kind = "refused";
      throw wrapped;
    }
    const label = session.network?.label || "the expected network";
    const wrapped = new Error(
      `Could not switch to ${label} — do it manually in your wallet. (${msg || "unknown error"})`
    );
    wrapped.kind = "switch_failed";
    throw wrapped;
  }
  // Refresh account + chainId after switch
  try {
    const next = await WalletAccountV6.connect({ nodeUrl: nodeUrl() }, session.wallet);
    await applyConnected(session.wallet, next);
  } catch (_) {
    session.chainId = await readChainId(session.wallet, session.account);
    emit();
  }
  return getSession();
}

/** Alias kept for backwards compatibility with earlier iterations. */
export const switchToSepolia = switchWalletChain;

export async function disconnectWallet() {
  if (session.changeUnsub) {
    try {
      session.changeUnsub();
    } catch (_) {
      /* ignore */
    }
  }
  if (session.account?.unsubscribeChange) {
    try {
      session.account.unsubscribeChange();
    } catch (_) {
      /* ignore */
    }
  }
  session.wallet = null;
  session.account = null;
  session.address = "";
  session.chainId = "";
  session.capable = false;
  session.apiVersions = [];
  session.changeUnsub = null;
  session.lastShieldBlock = null;
  session.currentBlock = null;
  emit();
}

export async function fetchPoolFee() {
  const address = poolAddress();
  if (!address) return { available: false, human: null };
  try {
    const provider = session.account ?? new RpcProvider({ nodeUrl: nodeUrl() });
    const pool = new Contract({ abi: FEE_ABI, address, providerOrAccount: provider });
    const raw = await pool.get_fee_amount();
    const value =
      raw?.fee_amount ??
      raw?.[0] ??
      (typeof raw === "bigint" || typeof raw === "string" || typeof raw === "number"
        ? raw
        : raw?.low != null
          ? BigInt(raw.low) + (BigInt(raw.high || 0) << 128n)
          : null);
    if (value == null) return { available: false, human: null };
    return { available: true, raw: value, human: baseToHuman(value, DEFAULT_TOKEN_DECIMALS) };
  } catch (_) {
    return { available: false, human: null };
  }
}

export async function waitForTx(hash) {
  const account = session.account;
  if (!account || !hash) return { status: "submitted", hash };
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), TX_WAIT_MS);
  });
  try {
    const raced = await Promise.race([account.waitForTransaction(hash), timeout]);
    if (raced?.timedOut) return { status: "submitted", hash };
    return { status: "accepted", hash, receipt: raced };
  } finally {
    clearTimeout(timer);
  }
}

function assertReady() {
  if (!session.account) throw new Error("Connect a wallet first.");
}

function friendlyMissingApi(err) {
  const msg = String(err?.message || err || "");
  if (
    /is not a function/i.test(msg) ||
    /strk20/i.test(msg) ||
    /METHOD_NOT_FOUND|method not (supported|found)|unknown method/i.test(msg)
  ) {
    const wrapped = new Error(
      "This wallet does not implement the STRK20 Wallet API. Install Ready (or another STRK20-capable wallet) to shield, transfer, or unshield."
    );
    wrapped.kind = "unsupported_wallet";
    wrapped.cause = err;
    return wrapped;
  }
  return null;
}

function wrapPoolError(err, fallback) {
  const classified = classifyPoolError(err, fallback);
  const wrapped = new Error(classified.message);
  wrapped.kind = classified.kind;
  wrapped.cause = err;
  return wrapped;
}

async function invokeActions(actions) {
  if (typeof session.account?.strk20InvokeTransaction !== "function") {
    const err = new Error("strk20InvokeTransaction is not a function on this wallet.");
    const friendly = friendlyMissingApi(err);
    throw friendly || err;
  }
  console.log("[strk20] invoke →", JSON.stringify(actions));
  let result;
  try {
    result = await session.account.strk20InvokeTransaction(actions);
    console.log("[strk20] invoke result →", result);
  } catch (err) {
    console.error("[strk20] invoke FAILED →", err);
    // Preserve original error kind classification
    throw err;
  }
  const hash = result?.transaction_hash || "";
  const wait = await waitForTx(hash);
  return {
    ...wait,
    explorer: explorerTxUrl(explorerBase(), hash),
  };
}

async function readBlockNumber() {
  if (!session.account) return null;
  try {
    const n = await session.account.getBlockNumber();
    session.currentBlock = Number(n);
    return session.currentBlock;
  } catch (_) {
    return session.currentBlock;
  }
}

function receiptBlock(receipt) {
  const raw =
    receipt?.block_number ??
    receipt?.blockNumber ??
    receipt?.value?.block_number ??
    null;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function refreshMaturity() {
  await readBlockNumber();
  emit();
  return getSession();
}

export function spendLocked() {
  return (
    maturityRemaining(
      session.currentBlock,
      session.lastShieldBlock,
      NOTE_MATURITY_BLOCKS
    ) > 0
  );
}

export async function shieldAmount(humanAmount) {
  assertReady();
  const amount = humanToBaseHex(humanAmount, DEFAULT_TOKEN_DECIMALS);
  try {
    const wait = await invokeActions([
      { type: "deposit", token: tokenAddress(), amount },
    ]);
    const fromReceipt = receiptBlock(wait.receipt);
    session.lastShieldBlock = fromReceipt ?? (await readBlockNumber());
    await readBlockNumber();
    emit();
    return wait;
  } catch (err) {
    throw wrapPoolError(err, "Shield failed.");
  }
}

/**
 * Public invoke of pool.register() — one-time first-use registration.
 * The STRK20 privacy pool requires the caller to be registered before deposit;
 * this calls that entrypoint via the wallet's standard Starknet execute path.
 */
export async function registerInPool() {
  assertReady();
  const pool = poolAddress();
  if (!pool) {
    throw new Error("REACT_APP_STRK20_POOL is not configured — cannot register.");
  }
  console.log("[strk20] register → pool:", pool);
  let result;
  try {
    if (typeof session.account?.execute === "function") {
      result = await session.account.execute({
        contractAddress: pool,
        entrypoint: "register",
        calldata: [],
      });
    } else if (typeof session.account?.addInvokeTransaction === "function") {
      // Fallback for wallets that only expose the low-level Wallet API method
      result = await session.account.addInvokeTransaction({
        calls: [{ contract_address: pool, entry_point: "register", calldata: [] }],
      });
    } else {
      throw new Error("Wallet account has no execute/addInvokeTransaction method.");
    }
    console.log("[strk20] register result →", result);
  } catch (err) {
    console.error("[strk20] register FAILED →", err);
    const msg = String(err?.message || err || "");
    if (/USER_REFUSED|refused|reject/i.test(msg)) {
      const wrapped = new Error("You declined the register signature in the wallet.");
      wrapped.kind = "refused";
      throw wrapped;
    }
    if (/already_registered|ALREADY_REGISTERED/i.test(msg)) {
      const wrapped = new Error("This account is already registered in the pool.");
      wrapped.kind = "already_registered";
      throw wrapped;
    }
    const wrapped = new Error(`Register failed: ${msg}`);
    wrapped.kind = "register_failed";
    throw wrapped;
  }
  const hash = result?.transaction_hash || "";
  const wait = await waitForTx(hash);
  return {
    ...wait,
    explorer: explorerTxUrl(explorerBase(), hash),
  };
}

export async function transferAmount(humanAmount, recipient) {
  assertReady();
  const to = String(recipient ?? "").trim();
  if (!isFeltAddress(to)) throw new Error("Recipient must be a 0x Starknet address.");
  if (spendLocked()) {
    throw new Error(
      `Freshly shielded notes mature in ~${NOTE_MATURITY_BLOCKS} blocks. Wait before transferring.`
    );
  }
  const amount = humanToBaseHex(humanAmount, DEFAULT_TOKEN_DECIMALS);
  try {
    return await invokeActions([
      { type: "transfer", token: tokenAddress(), amount, recipient: to },
    ]);
  } catch (err) {
    throw wrapPoolError(err, "Private transfer failed.");
  }
}

export async function unshieldAmount(humanAmount, recipient) {
  assertReady();
  const to = String(recipient ?? "").trim() || session.address;
  if (!isFeltAddress(to)) throw new Error("Recipient must be a 0x Starknet address.");
  if (spendLocked()) {
    throw new Error(
      `Freshly shielded notes mature in ~${NOTE_MATURITY_BLOCKS} blocks. Wait before unshielding.`
    );
  }
  const amount = humanToBaseHex(humanAmount, DEFAULT_TOKEN_DECIMALS);
  try {
    return await invokeActions([
      { type: "withdraw", token: tokenAddress(), amount, recipient: to },
    ]);
  } catch (err) {
    throw wrapPoolError(err, "Unshield failed.");
  }
}

/** Consent-gated. Call only from the Pool tab after the user asks to see balances. */
export async function fetchShieldedBalances() {
  assertReady();
  if (typeof session.account?.strk20Balances !== "function") {
    throw friendlyMissingApi(new Error("strk20Balances is not a function on this wallet.")) ||
      new Error("Wallet does not support shielded balance reads.");
  }
  const entries = await session.account.strk20Balances([tokenAddress()]);
  const list = Array.isArray(entries) ? entries : [];
  const match =
    list.find((e) => e && (e.token === tokenAddress() || sameToken(e.token))) ||
    list[0];
  const raw = match?.balance ?? "0x0";
  return {
    entries: list,
    raw,
    human: baseToHuman(raw, DEFAULT_TOKEN_DECIMALS),
  };
}

function sameToken(addr) {
  try {
    return BigInt(addr) === BigInt(tokenAddress());
  } catch (_) {
    return false;
  }
}
