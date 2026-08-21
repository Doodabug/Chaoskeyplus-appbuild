import React, { useEffect, useState } from "react";
import { ArrowSquareOut, ArrowUpRight, Eye, LinkSimple, Plugs, ShieldCheck } from "@phosphor-icons/react";
import { Btn, HashLine, Overline, Panel, StatLine } from "../components/ui";
import { useStarknet } from "../providers/StarknetProvider";
import {
  NOTE_MATURITY_BLOCKS,
  EXPECTED_CHAIN_ID,
  formatChainLabel,
  isEmbeddedPreview,
  maxSpendHuman,
} from "../lib/starknetWalletUtils";

const inputClass =
  "w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none";

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.length > 16 ? addr.slice(0, 10) + "…" + addr.slice(-6) : addr;
}

function onMainnet(chainId) {
  if (!chainId) return false;
  try {
    return BigInt(chainId) === BigInt(EXPECTED_CHAIN_ID);
  } catch (_) {
    return String(chainId).toLowerCase().includes("mainnet");
  }
}

function openOwnTab() {
  window.open(window.location.href, "_blank", "noopener,noreferrer");
}

export default function PrivacyScreen() {
  const starknet = useStarknet();
  const { pool, address, fetchFee, fetchRegistration, refreshMaturity, lastShieldBlock, maturityLeft } =
    starknet;
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
  const [registered, setRegistered] = useState(null);
  const [embedded] = useState(() => isEmbeddedPreview());

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
    if (!address) {
      setRegistered(null);
      return undefined;
    }
    let live = true;
    fetchRegistration(address).then((r) => {
      if (live) setRegistered(r.registered);
    });
    return () => {
      live = false;
    };
  }, [address, fetchRegistration]);

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
    setRegistered(null);
    await starknet.disconnect();
  }

  async function runAction(kind, fn) {
    setError(null);
    setResult(null);
    setBusy(kind);
    try {
      const r = await fn();
      setResult({ ...r, kind });
      if (kind === "shield") setRegistered(true);
    } catch (e) {
      const kindErr = e?.kind || "unknown";
      setError({ kind: kindErr, message: e?.message || "Action failed." });
      if (kindErr === "not_registered") setRegistered(false);
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
      const kindErr = e?.kind || "unknown";
      setError({ kind: kindErr, message: e?.message || "Balance read failed." });
      if (kindErr === "not_registered") setRegistered(false);
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
  const spendDisabled = !!busy || locked || registered === false;
  const inPool = registered === true;
  const noWallets = starknet.wallets.length === 0;

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
            {embedded && noWallets ? (
              <div data-testid="pool-embedded-block" className="space-y-3">
                <p className="text-[12px] font-mono text-white/70 leading-relaxed">
                  Ready cannot see this preview window. Open ChaosKey+ in its own browser tab,
                  then connect. This site never asks for your viewing key.
                </p>
                <Btn intent="primary" testid="pool-open-tab" onClick={openOwnTab} className="w-full">
                  <ArrowSquareOut size={14} className="inline mr-1.5 -mt-0.5" />
                  Open in its own tab
                </Btn>
                <p className="text-[11px] font-mono text-white/45 leading-relaxed">
                  Harvest still works here. Pool needs a full tab so the Ready extension can inject.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
                  Connect Ready on Starknet Mainnet. The wallet holds keys, notes, and proofs — this
                  app never sees them. RPC: Alchemy v0.10.
                </p>
                {noWallets && (
                  <div
                    data-testid="pool-no-wallets"
                    className="border border-white/10 px-3 py-4 text-center space-y-3"
                  >
                    <p className="text-[11px] font-mono text-white/55 leading-relaxed">
                      No wallets detected. Pool needs the Ready X extension on Mainnet.
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
                <ul className="space-y-2 mt-3">
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
                        {busy === "connect" ? "…" : "Connect"}
                      </Btn>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {connected && (
          <div className="space-y-1">
            <StatLine label="Address" value={shortAddr(starknet.address)} valueClass="text-cyan-300" testid="pool-address" />
            <StatLine
              label="Network"
              value={formatChainLabel(starknet.chainId)}
              valueClass={mainnet ? "text-[#7AFF9B]" : "text-[#FF6B8A]"}
              testid="pool-network"
            />
            <StatLine
              label="STRK20"
              value={capable ? "READY" : "UNSUPPORTED"}
              valueClass={capable ? "text-[#7AFF9B]" : "text-[#FF6B8A]"}
            />
            <StatLine
              label="Pool"
              value={registered == null ? "…" : inPool ? "IN" : "NOT YET"}
              valueClass={inPool ? "text-[#7AFF9B]" : "text-[#FFC846]"}
              testid="pool-membership"
            />
            <StatLine label="RPC" value="Alchemy · mainnet v0.10" valueClass="text-white/70" testid="pool-rpc" />
            <StatLine label="Pool fee" value={fee?.human ? `${fee.human} STRK` : "—"} />
            {balance && (
              <StatLine
                label="Shielded"
                value={`${balance.human} STRK`}
                valueClass="text-cyan-300"
                testid="pool-shielded"
              />
            )}
            {inPool && (
              <div className="pt-3">
                <Btn intent="default" testid="pool-balance-btn" onClick={onShowBalance} disabled={!!busy} className="w-full">
                  <Eye size={14} className="inline mr-1.5 -mt-0.5" />
                  {busy === "balance" ? "Reading…" : "Show shielded balance"}
                </Btn>
              </div>
            )}
            {!mainnet && (
              <div className="mt-3 border border-[#FFB800]/40 bg-[#FFB800]/5 px-3 py-2 text-[11px] font-mono text-[#FFC846] leading-relaxed">
                Switch Ready to Starknet Mainnet. STRK20 privacy is live on mainnet only.
              </div>
            )}
          </div>
        )}
      </Panel>

      {connected && capable && registered === false && (
        <div
          data-testid="pool-setup"
          className="border border-[#FFB800]/40 bg-[#FFB800]/5 px-3 py-3 text-[12px] font-mono text-[#FFC846] leading-relaxed space-y-2"
        >
          <p>
            This account is not in the pool yet. Ready must write the viewing key — that happens
            inside the Ready app, not here. Shield a little STRK in Ready first, then come back.
          </p>
          <p className="text-white/50">
            You can still try Shield below. If Ready says not registered, stop. Do not keep
            approving. This site never asks for that key.
          </p>
        </div>
      )}

      {connected && capable && (
        <>
          {locked && (
            <div className="border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-[11px] font-mono text-cyan-200">
              Freshly shielded notes mature in {NOTE_MATURITY_BLOCKS} blocks. Transfer and unshield
              locked for {starknet.maturityLeft} more{" "}
              {starknet.maturityLeft === 1 ? "block" : "blocks"}.
            </div>
          )}
          <Panel title="SHIELD :: AMOUNT PUBLIC" testid="pool-shield-panel">
            <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
              Deposit public STRK into a private note. Amount is visible; ownership is not.
              {inPool
                ? " Ready already has this account in the pool."
                : " If this is the first time, Ready may need to Shield once inside its own app."}
            </p>
            <label className="block mb-4">
              <div className="flex items-center justify-between mb-1">
                <Overline>Amount (STRK)</Overline>
              </div>
              <input
                data-testid="pool-shield-amount"
                type="text"
                inputMode="decimal"
                value={shieldAmt}
                onChange={(e) => setShieldAmt(e.target.value)}
                className={inputClass}
                disabled={!!busy}
              />
            </label>
            <Btn
              intent="primary"
              testid="pool-shield-btn"
              onClick={() => runAction("shield", () => starknet.shield(shieldAmt))}
              disabled={!!busy || !shieldAmt}
              className="w-full"
            >
              <ShieldCheck size={14} className="inline mr-1.5 -mt-0.5" />
              {busy === "shield" ? "Awaiting wallet / proof" : "Shield"}
            </Btn>
          </Panel>

          {inPool && (
            <>
              <Panel title="PRIVATE TRANSFER :: HIDDEN" testid="pool-transfer-panel">
                <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
                  Private transfer (sender, receiver, amount hidden). Recipient must already be
                  registered.
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
                    disabled={spendDisabled}
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
                    disabled={spendDisabled}
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
                  Withdraw STRK to a public address. Defaults to your connected wallet.
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
                    disabled={spendDisabled}
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
                    disabled={spendDisabled}
                  />
                </label>
                <Btn
                  intent="primary"
                  testid="pool-unshield-btn"
                  onClick={() =>
                    runAction("unshield", () =>
                      starknet.unshield(withdrawAmt, withdrawTo || starknet.address),
                    )
                  }
                  disabled={spendDisabled || !withdrawAmt}
                  className="w-full"
                >
                  <Plugs size={14} className="inline mr-1.5 -mt-0.5" />
                  {busy === "unshield" ? "Awaiting wallet / proof" : "Unshield"}
                </Btn>
              </Panel>
            </>
          )}
        </>
      )}

      {error && error.kind !== "not_registered" && (
        <div
          data-testid="pool-error"
          data-kind={error.kind}
          className={
            error.kind === "screening"
              ? "border border-[#FFB800]/40 bg-[#FFB800]/5 px-3 py-2 text-[11px] font-mono text-[#FFC846] leading-relaxed"
              : "border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A] leading-relaxed"
          }
        >
          {error.kind === "screening" ? error.message : "ERR :: " + error.message}
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
        </Panel>
      )}

      <Panel title="WHAT STAYS VISIBLE">
        <p className="text-[12px] font-mono text-white/55 leading-relaxed">
          Shield and unshield amounts are public ERC-20 approvals. The fact and timing of a pool
          interaction are public. Private transfers hide who pays whom and how much. This is not a
          mixer. Activity is never attributed from the transaction sender — that address is the
          relayer.
        </p>
      </Panel>
    </div>
  );
}
