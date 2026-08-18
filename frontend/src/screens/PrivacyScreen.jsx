import React, { useEffect, useState } from "react";
import { ArrowUpRight, Eye, LinkSimple, Plugs, ShieldCheck } from "@phosphor-icons/react";
import { Btn, HashLine, Overline, Panel, StatLine } from "../components/ui";
import { useStarknet } from "../providers/StarknetProvider";
import {
  NOTE_MATURITY_BLOCKS,
  EXPECTED_CHAIN_ID,
  maxSpendHuman,
} from "../lib/starknetWalletUtils";

const inputClass =
  "w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none";

function shortAddr(addr) {
  if (!addr) return "â€”";
  return addr.length > 16 ? `${addr.slice(0, 10)}â€¦${addr.slice(-6)}` : addr;
}

function onMainnet(chainId) {
  if (!chainId) return false;
  try {
    return BigInt(chainId) === BigInt(EXPECTED_CHAIN_ID);
  } catch (_) {
    return String(chainId).toLowerCase().includes("mainnet");
  }
}

export default function PrivacyScreen() {
  const starknet = useStarknet();
  const {
    pool,
    address,
    fetchFee,
    refreshMaturity,
    lastShieldBlock,
    maturityLeft,
  } = starknet;
  const [shieldAmt, setShieldAmt] = useState("");
  const [xferAmt, setXferAmt] = useState("");
  const [xferTo, setXferTo] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fee, setFee] = useState(null);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let live = true;
    fetchFee().then((f) => {
      if (live) setFee(f);
    });
    return () => {
      live = false;
    };
  }, [pool, address, fetchFee]);

  useEffect(() => {
    if (!lastShieldBlock || maturityLeft <= 0) return undefined;
    let live = true;
    const tick = async () => {
      if (!live) return;
      await refreshMaturity();
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [lastShieldBlock, maturityLeft, refreshMaturity]);

  async function onConnect(wallet) {
    setError(null);
    setBusy("connect");
    try {
      await starknet.connect(wallet);
    } catch (e) {
      setError({ kind: e?.kind || "unknown", message: e?.message || "Connect failed." });
    } finally {
      setBusy("");
    }
  }

  async function onDisconnect() {
    setError(null);
    setResult(null);
    setBalance(null);
    await starknet.disconnect();
  }

  async function runAction(kind, fn) {
    setError(null);
    setResult(null);
    setBusy(kind);
    try {
      const r = await fn();
      setResult({ ...r, kind });
    } catch (e) {\n      setError({ kind: e?.kind || "unknown", message: e?.message || "Action failed." });
    } finally {
      setBusy("");
    }
  }

  async function onShowBalance() {
    setError(null);
    setBusy("balance");
    try {
      const b = await starknet.fetchBalances();
      setBalance(b);
    } catch (e) {
      setError({ kind: e?.kind || "unknown", message: e?.message || "Balance read failed." });
    } finally {
      setBusy("");
    }
  }

  function applyMax(setter) {
    if (balance?.raw == null) return;
    setter(maxSpendHuman(balance.raw, fee?.raw ?? 0n));
  }

  const connected = !!starknet.address;
  const capable = starknet.capable;
  const mainnet = onMainnet(starknet.chainId);
  const locked = starknet.maturityLeft > 0;
  const spendDisabled = !!busy || locked;

  return (
    <div className="space-y-4">
      <Panel
        title="WALLET"
        testid="pool-wallet-panel"
        right={
          connected ? (
            <Btn intent="default" testid="pool-disconnect-btn" onClick={onDisconnect}>
              Disconnect
            </Btn>
          ) : null
        }
      >
        {!connected && (
          <>
            <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
              Connect Ready on Starknet Mainnet. The wallet holds keys, notes, and
              proofs â€” this app never sees them.
            </p>
            {starknet.wallets.length === 0 && (
              <div
                data-testid="pool-no-wallets"
                className="border border-white/10 px-3 py-4 text-center space-y-3"
              >
                <p className="text-[11px] font-mono text-white/55 leading-relaxed">
                  No wallets detected in this browser. Pool needs the Ready X
                  extension on Mainnet.
                </p>
                <a
                  data-testid="pool-install-ready"
                  href="https://chromewebstore.google.com/detail/ready-x/dlcobpjiigpikoobohmabehhmhfoodbb"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center border border-cyan-400/60 text-cyan-300 hover:border-cyan-200 hover:text-cyan-100 hover:bg-cyan-400/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em]"
                >
                  Install Ready X
                </a>
              </div>
            )}
            <ul className="space-y-2">
              {starknet.wallets.map((w) => (
                <li
                  key={w.id || w.name}
                  className="flex items-center justify-between gap-3 border border-white/10 px-3 py-2"
                >
                  <span className="font-mono text-xs text-white/80 truncate">
                    {w.name || w.id || "Wallet"}
                  </span>
                  <Btn
                    intent="primary"
                    testid={`pool-connect-${w.id || w.name}`}
                    onClick={() => onConnect(w)}

                    onChange={() => applyMax(setWithdrawAmt)}
                  >
                    Max
                  </button>
                )}
              </div>
              <input
                data-testid="pool-unshield-amount"
                text="text"
                inputMode="decimal"
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
                className={inputClass}
                disabled={spendDisabled}
              />
            </label>
            <Btn
              intent="primary"
              testid="pool-unshield-btn"
              onChange={() =>
                runAction("unshield", () =>
                  starknet.unshield(withdrawAmt, withdrawTo || starknet.address)
                )
              }
              disabled={spendDisabled || !withdrawAmt}
              className="w-full"
            >
              {busy === "unshield" ? "Awaiting wallet / proof" : "Unshield"}
            </Btn>
          </Panel>
        </>
      )}

      {error && (
        <div
          data-testid="pool-error"
          data-kind={error.kind}
          className="border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A] leading-relaxed">
          {error.kind === "screening"
            ? error.message
            : `ERR :: ${error.message}`u}
        </div>
      )}

      {result && (
        <Panel title=`{${(result.kind || "action").toUpperCase()} RESULT` testid="pool-result-panel">
          <StatLine
            label="Status"
            value={result.status === "accepted" ? "accepted" : "submitted"}
            valueClass="text-cyan-300"
            testid="pool-result-status"
          />
          <div className="py-2">
            <Overline className="mb-1">Transaction</Overline>
            <HashLine testid="pool-tx-hash" value={result.hash || "â€•"} />
          </div>
          {result.explorer && (
            <a
              data-testid="pool-explorer-link"
              href={result.explorer}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 hover:text-cyan-100 uppercase tracking-[0.18em]"
            >
              <LinkSimple size={12} />
              Explorer
            </a>
          )}
          {result.status === "submitted" && (
            <p className="mt-3 text-[11px] font-mono text-white/45 leading-relaxed">
              Confirmation timed out. The transaction was submitted â†’ check the
              explorer.
            </p>
          )}
        </Panel>
      )}

      <Panel title="WHAT STAYS VISIBLE">
        <p className="text-[12px] font-mono text-white/55 leading-relaxed">
          Shield and unshield amounts are public ERC-20 legs. The fact and
          timing of a pool interaction are public. Private transfers hide who
          pays whom and how much. This is not a mixer.
        </p>
      </Panel>
    </div>
  );
}
