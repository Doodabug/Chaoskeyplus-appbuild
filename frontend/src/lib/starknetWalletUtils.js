/** Pure helpers for the Wallet API route. No wallet or RPC imports. */

export const STRK20_MIN = { major: 0, minor: 10, patch: 0 };

/** Alchemy Starknet mainnet JSON-RPC v0.10 — replaces the dead Blast / free Nethermind endpoints. */
export const ALCHEMY_STARKNET_RPC =
  "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/alch_b-QRxZht79RwEiSAGer0q";

export const MAINNET_RPC = ALCHEMY_STARKNET_RPC;
export const DEFAULT_RPC = ALCHEMY_STARKNET_RPC;

export const DEFAULT_TOKEN =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const DEFAULT_POOL =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

export const DEFAULT_TOKEN_DECIMALS = 18;
export const MAINNET_EXPLORER = "https://voyager.online/tx";
export const DEFAULT_EXPLORER = MAINNET_EXPLORER;

export const MAINNET_CHAIN_ID = "0x534e5f4d41494e";
export const SEPOLIA_CHAIN_ID = "0x534e5f5345504f4c4941";
export const EXPECTED_CHAIN_ID = MAINNET_CHAIN_ID;

export const TX_WAIT_MS = 120000;
export const NOTE_MATURITY_BLOCKS = 10;

export function parseApiVersion(value) {
  const parts = String(value ?? "")
    .split(".")
    .map((n) => {
      const parsed = parseInt(n, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

export function compareApiVersion(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function isStrk20Capable(versions) {
  if (!Array.isArray(versions) || versions.length === 0) return false;
  return versions.some(
    (v) => compareApiVersion(parseApiVersion(v), STRK20_MIN) >= 0,
  );
}

export function sameAddress(a, b) {
  if (a == null || b == null || a === "" || b === "") return false;
  try {
    return BigInt(a) === BigInt(b);
  } catch (_) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
}

export function humanToBaseHex(human, decimals = DEFAULT_TOKEN_DECIMALS) {
  const raw = String(human ?? "").trim();
  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error("Enter a positive amount.");
  }
  const [wholePart, fracPart = ""] = raw.split(".");
  if (fracPart.length > decimals) {
    throw new Error(`At most ${decimals} decimal places.`);
  }
  const fracPadded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const base =
    BigInt(wholePart || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
  if (base <= 0n) throw new Error("Enter a positive amount.");
  return `0x${base.toString(16)}`;
}

export function baseToHuman(base, decimals = DEFAULT_TOKEN_DECIMALS) {
  let value;
  try {
    value = typeof base === "bigint" ? base : BigInt(base);
  } catch (_) {
    return "\u2014";
  }
  const neg = value < 0n;
  if (neg) value = -value;
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

export function classifyPoolError(err, fallback = "Pool action failed.") {
  const e = err;
  const code = e?.code ?? e?.error?.code;
  const msg = String(e?.message || e?.error?.message || err || "");
  if (code === 113 || /USER_REFUSED/i.test(msg)) {
    return { kind: "refused", message: "Wallet declined the request." };
  }
  if (code === 118 || /NOT_REGISTERED/i.test(msg)) {
    return {
      kind: "not_registered",
      message:
        "Ready has not written this account\u2019s viewing key on-chain yet. Shield a little STRK inside the Ready app first, then come back. This site never asks for that key.",
    };
  }
  if (code === 119 || /INSUFFICIENT_PRIVATE_BALANCE/i.test(msg)) {
    return {
      kind: "insufficient",
      message: "Shielded balance is too small for this amount plus the pool fee.",
    };
  }
  if (/address_blocked/i.test(msg) || /screening/i.test(msg) || /sanction/i.test(msg)) {
    return {
      kind: "screening",
      message:
        "Deposit declined by protocol screening. That is a pool outcome, not an app error.",
    };
  }
  return { kind: "unknown", message: msg || fallback };
}

export function classifyShieldError(err) {
  return classifyPoolError(err, "Shield failed.");
}

export function isFeltAddress(value) {
  const raw = String(value ?? "").trim();
  if (!/^0x[0-9a-fA-F]+$/.test(raw)) return false;
  try {
    return BigInt(raw) >= 0n;
  } catch (_) {
    return false;
  }
}

export function maturityRemaining(currentBlock, createdBlock, window = NOTE_MATURITY_BLOCKS) {
  if (createdBlock == null || currentBlock == null) return 0;
  const elapsed = Number(currentBlock) - Number(createdBlock);
  if (!Number.isFinite(elapsed)) return 0;
  return Math.max(0, window - elapsed);
}

export function maxSpendHuman(balanceBase, feeBase, decimals = DEFAULT_TOKEN_DECIMALS) {
  let bal;
  let fee = 0n;
  try {
    bal = typeof balanceBase === "bigint" ? balanceBase : BigInt(balanceBase ?? 0);
  } catch (_) {
    return "0";
  }
  try {
    fee = typeof feeBase === "bigint" ? feeBase : BigInt(feeBase ?? 0);
  } catch (_) {
    fee = 0n;
  }
  const spendable = bal - fee;
  if (spendable <= 0n) return "0";
  return baseToHuman(spendable, decimals);
}

export function explorerTxUrl(base, hash) {
  if (!hash) return "";
  const root = (base || DEFAULT_EXPLORER).replace(/\/$/, "");
  return `${root}/${hash}`;
}

export function walletDisplayName(wallet) {
  return wallet?.name || wallet?.id || "Unknown wallet";
}

export function stripChainPrefix(value) {
  const raw = String(value ?? "");
  return raw.replace(/^starknet:/i, "");
}

export function isSepoliaChainId(value) {
  if (value == null || value === "") return false;
  const raw = stripChainPrefix(value).toLowerCase();
  if (raw.includes("sepolia")) return true;
  try {
    return BigInt(raw.startsWith("0x") ? raw : `0x${raw}`) === BigInt(SEPOLIA_CHAIN_ID);
  } catch (_) {
    return false;
  }
}

export function formatChainLabel(value) {
  if (value == null || value === "") return "\u2014";
  const raw = stripChainPrefix(value);
  if (isSepoliaChainId(raw)) return "Sepolia";
  const lower = raw.toLowerCase();
  if (lower.includes("main") || lower === "sn_main") return "Mainnet";
  try {
    if (BigInt(raw.startsWith("0x") ? raw : `0x${raw}`) === BigInt(MAINNET_CHAIN_ID)) {
      return "Mainnet";
    }
  } catch (_) {
    /* ignore */
  }
  return raw;
}

export function looksLikeInjectedWallet(obj) {
  if (!obj || typeof obj !== "object") return false;
  const w = obj;
  return typeof w.request === "function" || typeof w.enable === "function";
}

export function prettyInjectedName(key) {
  if (/argent/i.test(key) || key === "starknet") return "Ready";
  if (/braavos/i.test(key)) return "Braavos";
  return key;
}

export function describeInjectedSlots(win) {
  const out = [];
  for (const key of Object.keys(win)) {
    if (!/^starknet/i.test(key)) continue;
    const val = win[key];
    if (!val || typeof val !== "object") continue;
    const ready = looksLikeInjectedWallet(val);
    const name =
      val.name || prettyInjectedName(key);
    out.push({ key, status: ready ? "ready" : "stub", name });
  }
  return out;
}

/** True when the app is boxed inside another page (Grok live preview). Extensions cannot inject there. */
export function isEmbeddedPreview() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch (_) {
    return true;
  }
}

export function feltIsZero(value) {
  if (value == null || value === "") return true;
  try {
    return BigInt(value) === 0n;
  } catch (_) {
    return true;
  }
}
