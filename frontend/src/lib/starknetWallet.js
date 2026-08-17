// Wallet API via starknet.js WalletAccountV6.
// This module never reads viewing keys, notes, or proofs.

import { createStore } from "@starknet-io/get-starknet-discovery";
import { StarknetInjectedWallet } from "@starknet-io/get-starknet-wallet-standard";
import { Contract, RpcProvider, WalletAccountV6, constants, walletV6 } from "starknet";
import {
  DEFAULT_EXPLORER,
  DEFAULT_RPC,
  DEFAULT_TOKEN,
  DEFAULT_TOKEN_DECIMALS,
  NOTE_MATURITY_BLOCKS,
  PLACEHOLDER_WALLET_ICON,
  TX_WAIT_MS,
  baseToHuman,
  classifyPoolError,
  describeInjectedSlots,
  explorerTxUrl,
  humanToBaseHex,
  isFeltAddress,
  isSepoliaChainId,
  isStrk20Capable,
  listStarknetWindowKeys,
  looksLikeInjectedWallet,
  maturityRemaining,
  prettyInjectedName,
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

const listeners = new Set();

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
  scanTimer: null,
  focusUnsub: null,
  injectedHints: [],
};

function emit() {
  const snap = getSession();
  listeners.forEach((fn) => fn(snap));
}

function nodeUrl() {
  return process.env.REACT_APP_STARKNET_RPC || DEFAULT_RPC;
}

/** Sepolia RPC URL used by WalletAccountV6 / RpcProvider. */
export function getRpcUrl() {
  return nodeUrl();
}

/** Read provider: connected WalletAccountV6, else a bare RpcProvider. */
export function getProvider() {
  return session.account ?? new RpcProvider({ nodeUrl: nodeUrl() });
}

function tokenAddress() {
  return process.env.REACT_APP_STRK20_TOKEN || DEFAULT_TOKEN;
}

function poolAddress() {
  return (process.env.REACT_APP_STRK20_POOL || "").trim();
}

function explorerBase() {
  return process.env.REACT_APP_STARKNET_EXPLORER || DEFAULT_EXPLORER;
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
    lastShieldBlock: session.lastShieldBlock,
    currentBlock: session.currentBlock,
    scanning: !!session.scanTimer,
    injectedHints: session.injectedHints,
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

function walletIdentity(wallet) {
  return String(wallet?.id || wallet?.name || "").toLowerCase();
}

function mergeWallets(primary, extra) {
  const out = [];
  const seen = new Set();
  for (const wallet of [...primary, ...extra]) {
    const id = walletIdentity(wallet);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    if (wallet) out.push(wallet);
  }
  return out;
}

function wrapInjected(raw, key) {
  if (!looksLikeInjectedWallet(raw) || typeof raw.request !== "function") return null;
  const icon =
    typeof raw.icon === "string" && raw.icon.startsWith("data:")
      ? raw.icon
      : raw.icon?.light && String(raw.icon.light).startsWith("data:")
        ? raw.icon.light
        : PLACEHOLDER_WALLET_ICON;
  const swo = {
    id: String(raw.id || key || "injected"),
    name: String(raw.name || prettyInjectedName(key)),
    version: String(raw.version || "0"),
    icon,
    request: (...args) => raw.request(...args),
    on: typeof raw.on === "function" ? (...args) => raw.on(...args) : () => {},
    off: typeof raw.off === "function" ? (...args) => raw.off(...args) : () => {},
  };
  try {
    return new StarknetInjectedWallet(swo);
  } catch (_) {
    return null;
  }
}

function collectInjectedWallets() {
  if (typeof window === "undefined") return [];
  const extras = [];
  for (const key of listStarknetWindowKeys(window)) {
    let value;
    try {
      value = window[key];
    } catch (_) {
      continue;
    }
    const wrapped = wrapInjected(value, key);
    if (wrapped) extras.push(wrapped);
  }
  return extras;
}

function pullWallets() {
  if (session.store) {
    try {
      session.store._refreshInjectedWallets();
    } catch (_) {
      /* ignore */
    }
  }
  const fromStore = session.store ? session.store.getWallets() : [];
  session.wallets = mergeWallets(fromStore, collectInjectedWallets());
  session.injectedHints =
    typeof window === "undefined" ? [] : describeInjectedSlots(window);
  emit();
}

function startWalletScan(ms = 20000) {
  if (typeof window === "undefined") return;
  if (session.scanTimer) {
    clearInterval(session.scanTimer);
    session.scanTimer = null;
  }
  const started = Date.now();
  session.scanTimer = setInterval(() => {
    pullWallets();
    if (session.wallets.length > 0 || Date.now() - started > ms) {
      clearInterval(session.scanTimer);
      session.scanTimer = null;
      emit();
    }
  }, 500);
  emit();
}

export function initWalletStore() {
  if (session.store) return session.store;
  session.store = createStore();
  session.storeUnsub = session.store.subscribe(() => pullWallets());
  pullWallets();
  startWalletScan();
  if (typeof window !== "undefined" && !session.focusUnsub) {
    const onFocus = () => pullWallets();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    session.focusUnsub = () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }
  return session.store;
}

async function wakeInjectedWallets() {
  if (typeof window === "undefined") return;
  for (const key of listStarknetWindowKeys(window)) {
    let value;
    try {
      value = window[key];
    } catch (_) {
      continue;
    }
    if (!value || typeof value !== "object") continue;
    try {
      if (typeof value.enable === "function") {
        await value.enable();
      } else if (typeof value.request === "function") {
        await value.request({
          type: "wallet_requestAccounts",
          params: { silent_mode: false },
        });
      }
    } catch (_) {
      /* locked, refused, or not a wallet */
    }
  }
}

/** Re-scan window.starknet* and ask Ready to inject/unlock if it is present. */
export async function rescanWallets() {
  initWalletStore();
  startWalletScan(20000);
  await wakeInjectedWallets();
  pullWallets();
  if (session.wallets.length === 0) startWalletScan(20000);
  return getSession();
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

function resolveWallet(wallet) {
  if (wallet) return wallet;
  if (session.wallet) return session.wallet;
  const fromAccount = session.account?.walletProvider;
  if (fromAccount) return fromAccount;
  const list = session.wallets || [];
  if (list.length === 1) return list[0];
  return null;
}

async function readWriteChainId(wallet) {
  if (!wallet) return "";
  try {
    return await walletV6.requestChainId(wallet);
  } catch (_) {
    return "";
  }
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
  const writeId = await readWriteChainId(wallet);
  if (writeId) {
    session.chainId = writeId;
  } else {
    try {
      session.chainId = account ? await account.getChainId() : "";
    } catch (_) {
      session.chainId = "";
    }
  }
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

const SEPOLIA_SWITCH_IDS = [
  constants.StarknetChainId.SN_SEPOLIA,
  "SN_SEPOLIA",
];

async function requestSepoliaSwitch(wallet) {
  let lastErr;
  for (const id of SEPOLIA_SWITCH_IDS) {
    try {
      await walletV6.switchStarknetChain(wallet, id);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  if (session.account?.switchStarknetChain) {
    try {
      await session.account.switchStarknetChain(constants.StarknetChainId.SN_SEPOLIA);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  const detail = lastErr?.message || lastErr?.error?.message || "";
  throw new Error(
    detail
      ? `Could not switch Ready to Sepolia. ${detail}`
      : "Could not switch Ready to Sepolia. Approve the Ready popup, or open Ready → Network → Starknet Sepolia."
  );
}

/** Ask Ready to write on Sepolia, then rebuild WalletAccountV6 on the new network. */
export async function switchToSepolia(walletArg) {
  const wallet = resolveWallet(walletArg);
  if (!wallet) {
    throw new Error("Connect Ready first, then switch to Sepolia.");
  }
  initWalletStore();
  const current = await readWriteChainId(wallet);
  if (!isSepoliaChainId(current)) {
    await requestSepoliaSwitch(wallet);
  }
  const account = await WalletAccountV6.connect({ nodeUrl: nodeUrl() }, wallet);
  await applyConnected(wallet, account);
  const writeId = await readWriteChainId(wallet);
  if (writeId) {
    session.chainId = writeId;
    emit();
  }
  if (!isSepoliaChainId(session.chainId)) {
    throw new Error(
      "Ready is still not on Sepolia. Open Ready → Network → Starknet Sepolia, then tap Switch again."
    );
  }
  return getSession();
}

export async function connectWallet(wallet) {
  if (!wallet) throw new Error("Pick a wallet.");
  initWalletStore();
  const account = await WalletAccountV6.connect({ nodeUrl: nodeUrl() }, wallet);
  await applyConnected(wallet, account);
  if (!isSepoliaChainId(session.chainId)) {
    return switchToSepolia(wallet);
  }
  return getSession();
}

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
  if (!session.capable) {
    throw new Error("Needs a STRK20-capable wallet (Ready).");
  }
}

function wrapPoolError(err, fallback) {
  const classified = classifyPoolError(err, fallback);
  const wrapped = new Error(classified.message);
  wrapped.kind = classified.kind;
  wrapped.cause = err;
  return wrapped;
}

async function invokeActions(actions) {
  const result = await session.account.strk20InvokeTransaction(actions);
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
