// Wallet API via starknet.js WalletAccountV6.
// This module never reads viewing keys, notes, or proofs.

import { createStore } from "@starknet-io/get-starknet-discovery";
import { Contract, RpcProvider, WalletAccountV6, constants, walletV6 } from "starknet";
import {
  DEFAULT_EXPLORER,
  DEFAULT_POOL,
  DEFAULT_RPC,
  DEFAULT_TOKEN,
  DEFAULT_TOKEN_DECIMALS,
  EXPECTED_CHAIN_ID,
  NOTE_MATURITY_BLOCKS,
  TX_WAIT_MS,
  baseToHuman,
  classifyPoolError,
  explorerTxUrl,
  feltIsZero,
  humanToBaseHex,
  isFeltAddress,
  isStrk20Capable,
  maturityRemaining,
  sameAddress,
  walletDisplayName,
} from "./starknetWalletUtils";

const POOL_ABI = [
  {
    type: "function",
    name: "get_fee_amount",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_public_key",
    inputs: [{ name: "user_addr", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::felt252" }],
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
};

function emit() {
  const snap = getSession();
  listeners.forEach((fn) => fn(snap));
}

function nodeUrl() {
  return process.env.REACT_APP_STARKNET_RPC || DEFAULT_RPC;
}

export function getRpcUrl() {
  return nodeUrl();
}

export function getProvider() {
  return session.account ?? new RpcProvider({ nodeUrl: nodeUrl() });
}

function tokenAddress() {
  return process.env.REACT_APP_STRK20_TOKEN || DEFAULT_TOKEN;
}

function poolAddress() {
  return (process.env.REACT_APP_STRK20_POOL || DEFAULT_POOL).trim();
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

export function initWalletStore() {
  if (session.store) return session.store;
  session.store = createStore();
  const refresh = () => {
    session.wallets = session.store.getWallets();
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
  try {
    session.chainId = account ? await account.getChainId() : "";
  } catch (_) {
    session.chainId = "";
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

export async function connectWallet(wallet) {
  if (!wallet) throw new Error("Pick a wallet.");
  initWalletStore();
  const account = await WalletAccountV6.connect({ nodeUrl: nodeUrl() }, wallet);
  try {
    const writeId = await walletV6.requestChainId(wallet);
    if (!sameAddress(writeId, EXPECTED_CHAIN_ID)) {
      await account.switchStarknetChain(constants.StarknetChainId.SN_MAIN);
    }
  } catch (_) {
    /* wallet may refuse the switch; PrivacyScreen shows the chain */
  }
  await applyConnected(wallet, account);
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
    const pool = new Contract({ abi: POOL_ABI, address, providerOrAccount: provider });
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

export async function fetchPoolRegistration(userAddress) {
  const poolAddr = poolAddress();
  const user = (userAddress || session.address || "").trim();
  if (!poolAddr || !user) return { registered: false, publicKey: null };
  try {
    const provider = session.account ?? new RpcProvider({ nodeUrl: nodeUrl() });
    const pool = new Contract({ abi: POOL_ABI, address: poolAddr, providerOrAccount: provider });
    const raw = await pool.get_public_key(user);
    const key =
      raw?.public_key ??
      raw?.[0] ??
      (typeof raw === "bigint" || typeof raw === "string" || typeof raw === "number" ? raw : null);
    if (key == null || feltIsZero(key)) return { registered: false, publicKey: null };
    return { registered: true, publicKey: typeof key === "bigint" ? `0x${key.toString(16)}` : String(key) };
  } catch (_) {
    return { registered: false, publicKey: null };
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
  // Pass actions array directly -- wrapping in { actions } causes INVALID_REQUEST_PAYLOAD
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

export async function fetchShieldedBalances() {
  assertReady();
  try {
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
  } catch (err) {
    throw wrapPoolError(err, "Balance read failed.");
  }
}

function sameToken(addr) {
  try {
    return BigInt(addr) === BigInt(tokenAddress());
  } catch (_) {
    return false;
  }
}

// Stub for provider
export function rescanWallets() {
    initWalletStore();
    return getSession();
}

export function registerInPool() {
    throw new Error("Registration is handled by the wallet on first Shield.");
}
