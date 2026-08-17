// Pure helpers for the Wallet API route. No wallet or RPC imports —
// keep this file unit-testable without a browser extension.

export const STRK20_MIN = { major: 0, minor: 10, patch: 0 };

// Official STRK ERC-20 — same address on mainnet, Sepolia, and devnet.
export const DEFAULT_TOKEN =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const DEFAULT_TOKEN_DECIMALS = 18;
export const SEPOLIA_CHAIN_ID = "0x534e5f5345504f4c4941";
export const MAINNET_CHAIN_ID = "0x534e5f4d41494e";
export const TX_WAIT_MS = 120000;
export const NOTE_MATURITY_BLOCKS = 10;

/**
 * Network presets. The runtime `network` selection in StarknetProvider
 * picks one of these; env values still act as overrides for the initial
 * selection when present.
 */
export const NETWORKS = {
  sepolia: {
    id: "sepolia",
    label: "Sepolia",
    rpc: "https://free-rpc.nethermind.io/sepolia-juno/v0_10",
    chainId: SEPOLIA_CHAIN_ID,
    token: DEFAULT_TOKEN,
    // No public STRK20 pool exists on Sepolia. Empty by design.
    pool: "",
    explorer: "https://sepolia.voyager.online/tx",
    // STRK20 privacy pool is live on mainnet only — Sepolia is preview.
    strk20Live: false,
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    rpc: "https://free-rpc.nethermind.io/mainnet-juno/v0_10",
    chainId: MAINNET_CHAIN_ID,
    token: DEFAULT_TOKEN,
    pool: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
    explorer: "https://voyager.online/tx",
    strk20Live: true,
  },
};

export const DEFAULT_RPC = NETWORKS.sepolia.rpc;
export const DEFAULT_EXPLORER = NETWORKS.sepolia.explorer;

/**
 * Pick a NETWORKS entry from a possibly-user-provided key or an RPC URL.
 * Falls back to Sepolia if unclear.
 */
export function resolveNetwork(input) {
  if (!input) return NETWORKS.sepolia;
  const s = String(input).toLowerCase();
  if (NETWORKS[s]) return NETWORKS[s];
  if (/mainnet|sn_main|starknet-juno|main-juno/i.test(s)) return NETWORKS.mainnet;
  if (/sepolia|sn_sepolia|sepolia-juno/i.test(s)) return NETWORKS.sepolia;
  return NETWORKS.sepolia;
}

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

/** True if any advertised Wallet API version is >= 0.10 (STRK20). */
export function isStrk20Capable(versions) {
  if (!Array.isArray(versions) || versions.length === 0) return false;
  return versions.some(
    (v) => compareApiVersion(parseApiVersion(v), STRK20_MIN) >= 0
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

/** Human decimal string → base units as decimal-string FELT (per STRK20 spec). */
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
  const base = BigInt(wholePart || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
  if (base <= 0n) throw new Error("Enter a positive amount.");
  // FELT accepts both hex and decimal per STRK20 spec; use decimal string —
  // matches SDK examples and avoids wallets that reject unpadded hex felts.
  return base.toString();
}

export function baseToHuman(base, decimals = DEFAULT_TOKEN_DECIMALS) {
  let value;
  try {
    value = typeof base === "bigint" ? base : BigInt(base);
  } catch (_) {
    return "—";
  }
  const neg = value < 0n;
  if (neg) value = -value;
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

export function classifyPoolError(err, fallback = "Pool action failed.") {
  const code = err?.code ?? err?.error?.code;
  const msg = String(err?.message || err?.error?.message || err || "");
  if (code === 113 || /USER_REFUSED/i.test(msg)) {
    return { kind: "refused", message: "Wallet declined the request." };
  }
  if (code === 118 || /NOT_REGISTERED/i.test(msg)) {
    return {
      kind: "not_registered",
      message:
        "First-time use: Ready needs to register your account in the pool. This happens once, then Shield works. Follow the Ready wallet prompts.",
    };
  }
  if (code === 119 || /INSUFFICIENT_PRIVATE_BALANCE/i.test(msg)) {
    return {
      kind: "insufficient",
      message: "Shielded balance is too small for this amount plus the pool fee.",
    };
  }
  if (
    /address_blocked/i.test(msg) ||
    /screening/i.test(msg) ||
    /sanction/i.test(msg)
  ) {
    return {
      kind: "screening",
      message:
        "Deposit declined by protocol screening. That is a pool outcome, not an app error.",
    };
  }
  return { kind: "unknown", message: msg || fallback };
}

/** @deprecated use classifyPoolError */
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
