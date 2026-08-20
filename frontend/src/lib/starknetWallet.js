// Wallet API via starknet.js WalletAccountV6.
// This module never reads viewing keys, notes, or proofs.

import { createStore } from "@starknet-io/get-starknet-discovery";
import { Contract, RpcProvider, WalletAccountV6, constants, walletV6 } from "starknet";
import {
  DEFAULT_EXPLORER,
  DEFAULT_RPC,
  DEFAULT_TOKEN,
  DEFAULT_TOKEN_DECIMALS,
  EXPECTED_CHAIN_ID,
  NOTE_MATURITY_BLOCKS,
  TX_WAIT_MS,
  baseToHuman,
  classifyPoolError,
  explorerTxUrl,
  humanToBaseHex,
  isFeltAddress,
  isStrk20Capable,
  maturityRemaining,
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
  Const snap = getSession();
  listeners.forEach((fn) => fn(snap));
}

function nodeUrl() {
  return process.env.REACT_APP_STARKNET_RPC || DEFAULT_RPC;
}

/** RPC URL used by WalletAccountV6 / RpcProvider. */
export function getRpcUrl() {
  return nodeUrl();
}

/** Read provider: connected WalletAccountV6, else a bare RpcProvider. */
export function getProvider() {
  return session.account ?? new RpcProvider({ nodeUrl: nodeUrl() });
}
&flush;function tokenAddress() {
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
    token: Ñ½­•¹‘‘É•ÍÌ ¤°(€€€Á½½°èÁ½½±‘‘É•ÍÌ ¤°(€€€•áÁ±½É•É	…Í”è•áÁ±½É•É	…Í” ¤°(€€€±…ÍÑM¡¥•±‘	±½¬èÍ•ÍÍ¥½¸¹±…ÍÑM¡¥•±‘	±½¬°(€€€ÕÉÉ•¹Ñ	±½¬èÍ•ÍÍ¥½¸¹ÕÉÉ•¹Ñ	±½¬°(€€€µ…ÑÕÉ¥Ñå1•™Ğèµ…ÑÕÉ¥ÑåI•µ…¥¹¥¹œ (€€€€€Í•ÍÍ¥½¸¹ÕÉÉ•¹Ñ	±½¬°(€€€€€Í•ÍÍ¥½¸¹±…ÍÑM¡¥•±‘	±½¬°(€€€€€9=Q}5QUI%Qe}	1=-L(€€€€¤°(€ôì)ô()•áÁ½ÉĞ™Õ¹Ñ¥½¸ÍÕ‰ÍÉ¥‰•M•ÍÍ¥½¸¡™¸¤ì(€±¥ÍÑ•¹•ÉÌ¹…‘¡™¸¤ì(€™¸¡•ÑM•ÍÍ¥½¸ ¤¤ì(€É•ÑÕÉ¸€ ¤€ôø±¥ÍÑ•¹•ÉÌ¹‘•±•Ñ”¡™¸¤ì)ô()•áÁ½ÉĞ™Õ¹Ñ¥½¸¥¹¥Ñ]…±±•ÑMÑ½É” ¤ì(€¥˜€¡Í•ÍÍ¥½¸¹ÍÑ½É”¤É•ÑÕÉ¸Í•ÍÍ¥½¸¹ÍÑ½É”ì(€Í•ÍÍ¥½¸¹ÍÑ½É”€ôÉ•…Ñ•MÑ½É” ¤ì(€½¹ÍĞÉ•™É•Í €ô€ ¤€ôøì(€€€Í•ÍÍ¥½¸¹İ…±±•ÑÌ€ôÍ•ÍÍ¥½¸¹ÍÑ½É”¹•Ñ]…±±•ÑÌ ¤ì(€€€•µ¥Ğ ¤ì(€ôì(€Í•ÍÍ¥½¸¹ÍÑ½É•U¹ÍÕˆ€ôÍ•ÍÍ¥½¸¹ÍÑ½É”¹ÍÕ‰ÍÉ¥‰”¡É•™É•Í ¤ì(€É•™É•Í  ¤ì(€É•ÑÕÉ¸ session.store;
}

export async function readWalletApiVersions(wallet) {
  if (!wallet) return [];
  try {
    const versions = await walletU6.supportedWalletApi(wallet);
    return Array.isArray(versions) ? versions.map(String) : [];
  } catch (_) {
    try {
      const specs = await walletU6.supportedSpecs(wallet);
      return Array.isArray(specs) ? specs.map(String) : [];
    } catch (__) {
      return [];
    }@(€ô)ô()…Íå¹Œ™Õ¹Ñ¥½¸…ÁÁ±å½¹¹•Ñ•¡İ…±±•Ğ°…½Õ¹Ğ¤ì(€¥˜€¡Í•ÍÍ¥½¸¹¡…¹•U¹ÍÕˆ¤ì(€€€ÑÉäì(€€€€€Í•ÍÍ¥½¸¹¡…¹•U¹ÍÕˆ ¤ì(€€€ô…Ñ €¡|¤ì(€€€€€€¼¨¥¹½É”€¨¼(€€€ô(€€€Í•ÍÍ¥½¸¹¡…¹•U¹ÍÕˆ€ô¹Õ±°ì(€ô(€Í•ÍÍ¥½¸¹İ…±±•Ğ€ôİ…±±•Ğì(€Í•ÍÍ¥½¸¹…½Õ¹Ğ€ô…½Õ¹Ğì(€Í•ÍÍ¥½¸¹…‘‘É•ÍÌ€ô…½Õ¹Ğü¹…½Õ¹Ğ¹…‘‘É•ÍÌñğ€ˆˆì(€ÑÉäì(€€€Í•ÍÍ¥½¸¹¡…¥¹%€ô…½Õ¹Ğ€ü…İ…¥Ğ…½Õ¹Ğ¹•Ñ¡…¥¹% ¤€è€ˆˆì(€ô…Ñ €¡|¤ì(€€€Í•ÍÍ¥½¸¹¡…¥¹%€ô€ˆˆì(€ô(€Í•ÍÍ¥½¸¹…Á¥Y•ÉÍ¥½¹Ì€ô…İ…¥ĞÉ•…‘]…±±•ÑÁ¥Y•ÉÍ¥½¹Ì¡İ…±±•Ğ¤ì(€Í•ÍÍ¥½¸¹…Á…‰±”€ô¥ÍMÑÉ¬ÈÁ…Á…‰±”¡Í•ÍÍ¥½¸¹…Á¥Y•ÉÍ¥½¹Ì¤ì(€¥˜€¡…½Õ¹Ğü¹½¹¡…¹”¤ì(€€€Í•ÍÍ¥½¸¹¡…¹•U¹ÍÕˆ€ô…½Õ¹Ğ¹½¹¡…¹”¡…Íå¹Œ€ ¤€ôøì(€€€€€ÑÉäì(€€€€€€€½¹ÍĞ¹•áĞ€ô…İ…¥Ğ]…±±•Ñ½Õ¹ÑXØ¹½¹¹•Ğ¡ì¹½‘•UÉ°è¹½‘•UÉ° ¤ô°İ…±±•Ğ¤ì(€€€€€€€…İ…¥Ğ…ÁÁ±å½¹¹•Ñ•¡İ…±±•Ğ°¹•áĞ¤ì(€€€€€ô…Ñ €¡|¤ì(€€€€€€€…İ…¥Ğ‘¥Í½¹¹•Ñ]…±±•Ğ ¤ì(€€€€€ô(€€€ô¤ì(€ô(€•µ¥Ğ ¤ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸½¹¹•Ñ]…±±•Ğ¡İ…±±•Ğ¤ì(€¥˜€ …İ…±±•Ğ¤Ñ¡É½Ü¹•ÜÉÉ½È ‰A¥¬„İ…±±•Ğ¸ˆ¤ì(€¥¹¥Ñ]…±±•ÑMÑ½É” ¤ì(€½¹ÍĞ…½Õ¹Ğ€ô…İ…¥Ğ]…±±•Ñ½Õ¹ÑXØ¹½¹¹•Ğ¡ì¹½‘•UÉ°è¹½‘•UÉ° ¤ô°İ…±±•Ğ¤ì(€ÑÉäì(€€€½¹ÍĞİÉ¥Ñ•%€ô…İ…¥Ğİ…±±•ÑXØ¹É•ÅÕ•ÍÑ¡…¥¹%¡İ…±±•Ğ¤ì(€€€¥˜€ …Í…µ•‘‘É•ÍÌ¡İÉ¥Ñ•%°aAQ}!%9}%¤¤ì(€€€€€…İ…¥Ğ…½Õ¹Ğ¹Íİ¥Ñ¡MÑ…É­¹•Ñ¡…¥¸¡½¹ÍÑ…¹ÑÌ¹MÑ…É­¹•Ñ¡…¥¹%¹M9}5%8¤ì(€€€ô(€ô…Ñ €¡|¤ì(€€€€¼¨İ…±±•Ğµ…äÉ•™ÕÍ”Ñ¡”Íİ¥Ñ ìAÉ¥Ù…åMÉ••¸Í¡½İÌÑ¡”¡…¥¸€¨¼(€ô(€…İ…¥Ğ…ÁÁ±å½¹¹•Ñ•¡İ…±±•Ğ°…½Õ¹Ğ¤ì(€É•ÑÕÉ¸•ÑM•ÍÍ¥½¸ ¤ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸‘¥Í½¹¹•Ñ]…±±•Ğ ¤ì(€¥˜€¡Í•ÍÍ¥½¸¹¡…¹•U¹ÍÕˆ¤ì(€€€ÑÉäì(€€€€€Í•ÍÍ¥½¸¹¡…¹•U¹ÍÕˆ ¤ì(€€€ô…Ñ €¡|¤ì(€€€€€€¼¨¥¹½É”€¨¼(€€€ô(€ô(€¥˜session.account?.unsubscribePïn disconnectWallet();
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
      session.account.unsubscribeChange(i;
    } catch (_) {
      /* ignore */
    }
  }
  session.wallet = null;
  session.account: null;
  session.address = "";
  session.chainId = "";
  session.capable = false,
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
    return { available: true, raw* value, human: baseToHuman(value, DEFAULT_TOKEN_DECIMALS) };
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
  return Number.isFinite(n) ? n  : null;
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

,** Consent-gated. Call only from the Pool tab after the user asks to see balances. */
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
