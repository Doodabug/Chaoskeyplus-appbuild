import React, { useEffect, useState } from "react";
import { ArrowUpRight, Eye, LinkSimple, Plugs, ShieldCheck } from "@phosphor-icons/react";
import { Btn, HashLine, Overline, Panel, StatLine } from "../components/ui";
import { useStarknet } from "../providers/StarknetProvider";
import {
  NOTE_MATURITY_BLOCKS,
  SEPOLIA_CHAIN_ID,
  maxSpendHuman,
} from "../lib/starknetWalletUtils";

const inputClass =
  "w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none";

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.length > 16 ? `${addr.slice(0, 10)}…${addr.slice(-6)}` : addr;
}

function onSepolia(chainId) {
  if (!chainId) return false;
  try {
    return BigInt(chainId) === BigInt(SEPOLIA_CHAIN_ID);
  } catch (_) {
    return String(chainId).toLowerCase().includes("sepolia");
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
    } catch (e) {
      setError({ kind: e?.kind || "unknown", message: e?.message || "Action failed." });
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
  const sepolia = onSepolia(starknet.chainId);
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
              Connect Ready on Starknet Sepolia. The wallet holds keys, notes, and
              proofs — this app never sees them.
            </p>
            {starknet.wallets.length === 0 && (
              <div
                data-testid="pool-no-wallets"
                className="text-[11px] font-mono text-white/45 uppercase tracking-[0.18em] py-4 text-center"
              >
                No wallets detected. Install the Ready extension.
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
                    disabled={!!busy}
                  >
                    <Plugs size={12} className="inline mr-1.5 -mt-0.5" />
                    {busy === "connect" ? "Connecting" : "Connect"}
                  </Btn>
                </li>
              ))}
            </ul>
          </>
        )}

        {connected && (
          <>
            <StatLine
              label="Wallet"
              value={starknet.walletName}
              valueClass="text-cyan-300"
              testid="pool-wallet-name"
            />
            <StatLine
              label="Address"
              value={shortAddr(starknet.address)}
              testid="pool-address"
            />
            <StatLine
              label="Network"
              value={sepolia ? "Sepolia" : starknet.chainId || "—"}
              valueClass={sepolia ? "text-[#7AFF9B]" : "text-[#FF6B8A]"}
              testid="pool-network"
            />
            <StatLine
              label="STRK20 API"
              value={capable ? "capable" : "unsupported"}
              valueClass={capable ? "text-[#7AFF9B]" : "text-[#FF6B8A]"}
              testid="pool-capability"
            />
            {!sepolia && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-mono text-[#FF6B8A] leading-relaxed">
                  Pool actions are Sepolia-only. Switch the wallet network, then retry.
                </p>
                <Btn
                  intent="primary"
                  testid="pool-switch-sepolia-btn"
                  onClick={() => onConnect(starknet.wallet)}
                  disabled={!!busy || !starknet.wallet}
                >
                  Switch to Sepolia
                </Btn>
              </div>
            )}
          </>
        )}
      </Panel>

      {connected && !capable && (
        <Panel title="LEGACY WALLET" testid="pool-unsupported">
          <p className="text-[12px] font-mono text-white/70 leading-relaxed">
            This wallet doesn't advertise the STRK20 Wallet API (spec ≥ 0.10).
            You can still try shield / transfer / unshield below — the wallet
            will reject the request if it can't handle it. For full support,
            use <span className="text-cyan-300">Ready</span>.
          </p>
        </Panel>
      )}

      {connected && sepolia && (
        <>
          <Panel title="SHIELDED BALANCE" testid="pool-balance-panel">
            <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
              The wallet will ask to share your shielded STRK balance. This app
              does not read notes or keys; skip this if you only want to act.
            </p>
            {balance ? (
              <StatLine
                label="Shielded STRK"
                value={balance.human}
                valueClass="text-cyan-300"
                testid="pool-balance-value"
              />
            ) : (
              <Btn
                intent="default"
                testid="pool-balance-btn"
                onClick={onShowBalance}
                disabled={!!busy}
              >
                <Eye size={12} className="inline mr-1.5 -mt-0.5" />
                {busy === "balance" ? "Waiting on wallet" : "Show shielded balance"}
              </Btn>
            )}
          </Panel>

          <Panel title="SHIELD :: AMOUNT PUBLIC" testid="pool-shield-panel">
            <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
              Public STRK → encrypted note. The deposit amount stays public.
              Do not bundle this with a private transfer.
            </p>
            <label className="block mb-4">
              <Overline className="mb-1">Amount (STRK)</Overline>
              <input
                data-testid="pool-amount-input"
                type="text"
                inputMode="decimal"
                value={shieldAmt}
                onChange={(e) => setShieldAmt(e.target.value)}
                className={inputClass}
              />
            </label>
            <div className="border border-white/10 bg-white/[0.03] px-3 py-3 mb-4 space-y-2">
              <p className="text-[11px] font-mono text-white/55 leading-relaxed">
                The wallet will prompt twice: first a public ERC-20 approve, then
                the private deposit. Both are required.
              </p>
              <p className="text-[11px] font-mono text-white/55 leading-relaxed">
                {fee?.available
                  ? `Pool fee ${fee.human} STRK per private operation. Subtracted from MAX. Separate from network gas.`
                  : "Pool fee unavailable until REACT_APP_STRK20_POOL is set. Separate from network gas."}
              </p>
            </div>
            <Btn
              intent="primary"
              testid="pool-shield-btn"
              onClick={() => runAction("shield", () => starknet.shield(shieldAmt))}
              disabled={!!busy || !shieldAmt}
              className="w-full"
            >
              <ShieldCheck size={14} weight="bold" className="inline mr-1.5 -mt-0.5" />
              {busy === "shield" ? "Awaiting wallet / proof" : "Shield"}
            </Btn>
          </Panel>

          {locked && (
            <div
              data-testid="pool-maturity"
              className="border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-[11px] font-mono text-cyan-200"
            >
              Freshly shielded notes mature in ~{NOTE_MATURITY_BLOCKS} blocks.
              Transfer and unshield locked for {starknet.maturityLeft} more
              {starknet.maturityLeft === 1 ? " block" : " blocks"}.
            </div>
          )}

          <Panel title="PRIVATE TRANSFER :: HIDDEN" testid="pool-transfer-panel">
            <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
              Private transfer (sender, receiver, amount hidden). Recipient must
              already be registered. Not composed with a shield.
            </p>
            <label className="block mb-3">
              <Overline className="mb-1">Recipient</Overline>
              <input
                data-testid="pool-transfer-to"
                type="text"
                value={xferTo}
                onChange={(e) => setXferTo(e.target.value)}
                placeholder="0x…"
                className={inputClass}
              />
            </label>
            <label className="block mb-4">
              <div className="flex items-center justify-between mb-1">
                <Overline>Amount (STRK)</Overline>
                {balance && (
                  <button
                    type="button"
                    data-testid="pool-transfer-max"
                    className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300"
                    onClick={() => applyMax(setXferAmt)}
                  >
                    Max
                  </button>
                )}
              </div>
              <input
                data-testid="pool-transfer-amount"
                type="text"
                inputMode="decimal"
                value={xferAmt}
                onChange={(e) => setXferAmt(e.target.value)}
                className={inputClass}
              />
            </label>
            <Btn
              intent="primary"
              testid="pool-transfer-btn"
              onClick={() => runAction("transfer", () => starknet.transfer(xferAmt, xferTo))}
              disabled={spendDisabled || !xferAmt || !xferTo}
              className="w-full"
            >
              <ArrowUpRight size={14} className="inline mr-1.5 -mt-0.5" />
              {busy === "transfer" ? "Awaiting wallet / proof" : "Private transfer"}
            </Btn>
          </Panel>

          <Panel title="UNSHIELD :: AMOUNT PUBLIC" testid="pool-unshield-panel">
            <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
              Shield / unshield (amount public). Withdraws STRK to a public
              address. Defaults to your connected wallet.
            </p>
            <label className="block mb-3">
              <Overline className="mb-1">Public recipient</Overline>
              <input
                data-testid="pool-unshield-to"
                type="text"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                placeholder={starknet.address || "0x…"}
                className={inputClass}
              />
            </label>
            <label className="block mb-4">
              <div className="flex items-center justify-between mb-1">
                <Overline>Amount (STRK)</Overline>
                {balance && (
                  <button
                    type="button"
                    data-testid="pool-unshield-max"
                    className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300"
                    onClick={() => applyMax(setWithdrawAmt)}
                  >
                    Max
                  </button>
                )}
              </div>
              <input
                data-testid="pool-unshield-amount"
                type="text"
                inputMode="decimal"
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
                className={inputClass}
              />
            </label>
            <Btn
              intent="primary"
              testid="pool-unshield-btn"
              onClick={() =>
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
          className="border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A] leading-relaxed"
        >
          {error.kind === "screening"
            ? error.message
            : `ERR :: ${error.message}`}
        </div>
      )}

      {result && (
        <Panel title={`${(result.kind || "action").toUpperCase()} RESULT`} testid="pool-result-panel">
          <StatLine
            label="Status"
            value={result.status === "accepted" ? "accepted" : "submitted"}
            valueClass="text-cyan-300"
            testid="pool-result-status"
          />
          <div className="py-2">
            <Overline className="mb-1">Transaction</Overline>
            <HashLine testid="pool-tx-hash" value={result.hash || "—"} />
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
              Confirmation timed out. The transaction was submitted — check the
              explorer.
            </p>
          )}
        </Panel>
      )}

      <Panel title="WHAT STAYS VISIBLE">
        <p className="text-[12px] font-mono text-white/55 leading-relaxed">
          Shield and unshield amounts are public ERC-20 legs. The fact and
          timing of a pool interaction are public. Private transfers hide who
          pays whom and how much. This is not a mixer. Activity is never
          attributed from the transaction sender — that address is the relayer.
        </p>
      </Panel>
    </div>
  );
}
