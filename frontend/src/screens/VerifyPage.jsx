import React, { useEffect, useState } from "react";
import { ShieldCheck, XCircle, CheckCircle, ArrowLeft } from "@phosphor-icons/react";
import { postVerifyToken } from "../lib/api";
import { Btn, HashLine, Overline, Panel, StatLine } from "../components/ui";

const HERO =
  "https://images.pexels.com/photos/30766684/pexels-photo-30766684.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const REASON_LABEL = {
  ok: "Token verified — genuine ChaosKey+ output",
  block_not_found: "No such block on this device's ledger",
  block_is_not_a_token_block: "This block exists but wasn't produced by the token generator",
  block_signature_invalid: "Block's Ed25519 signature failed verification (device compromised?)",
  token_hash_mismatch: "This token was NOT produced by that block (forged / mistyped)",
  token_signature_invalid: "Token-binding signature failed verification (tamper detected)",
};

export default function VerifyPage() {
  const [token, setToken] = useState("");
  const [blockId, setBlockId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Prefill from ?block_id=... query
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const b = sp.get("block_id");
    if (b) setBlockId(b);
    const t = sp.get("token");
    if (t) setToken(t);
  }, []);

  async function verify() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const bid = parseInt(blockId, 10);
      if (isNaN(bid) || bid < 0) throw new Error("block_id must be a non-negative integer");
      if (!token || token.trim().length < 4) throw new Error("Enter the token exactly as generated");
      const r = await postVerifyToken({ token: token.trim(), block_id: bid });
      setResult(r);
    } catch (e) {
      setError(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || e?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen text-white grid-bg noise relative">
      <header className="sticky top-0 z-20 backdrop-blur-2xl bg-[#05050A]/80 border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between max-w-md mx-auto">
          <a
            href="/"
            data-testid="verify-back-link"
            className="flex items-center gap-2 text-white/60 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft size={14} />
            <span className="font-display font-semibold tracking-tight text-[15px]">
              ChaosKey<span className="text-[#00F0FF]">+</span>
            </span>
          </a>
          <span className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80 font-mono">
            /verify
          </span>
        </div>
      </header>

      <main data-testid="verify-main" className="max-w-md mx-auto px-4 py-4 pb-16 relative z-10 space-y-4">
        <section
          className="relative border border-white/10 overflow-hidden h-32"
          style={{
            backgroundImage: `linear-gradient(rgba(5,5,10,0.6), rgba(5,5,10,0.85)), url(${HERO})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 grid-bg opacity-60" />
          <div className="relative h-full flex flex-col justify-end p-4">
            <Overline className="mb-1 text-cyan-300/80">Public verifier</Overline>
            <h1 className="font-display font-semibold text-xl tracking-tight leading-none">
              Verify a ChaosKey<span className="text-[#00F0FF]">+</span> token
            </h1>
          </div>
        </section>

        <Panel title="INPUT" testid="verify-input">
          <p className="text-[11px] font-mono text-white/55 leading-relaxed mb-4 border-l-2 border-cyan-400/40 pl-3 py-1">
            Paste a token and the block_id it was generated under. We'll check
            the token's SHA-256 matches what's recorded in the device's signed
            ledger, and verify both Ed25519 signatures.
          </p>
          <label className="block mb-3">
            <Overline className="mb-1">block_id</Overline>
            <input
              data-testid="verify-block-id"
              type="number"
              min={0}
              value={blockId}
              onChange={(e) => setBlockId(e.target.value)}
              className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-cyan-200 font-mono focus:border-cyan-400 outline-none"
              placeholder="e.g. 42"
            />
          </label>
          <label className="block mb-3">
            <Overline className="mb-1">token</Overline>
            <textarea
              data-testid="verify-token-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={3}
              className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none resize-none"
              placeholder="ck_live_..."
            />
          </label>
          <Btn intent="primary" testid="verify-btn" onClick={verify} disabled={busy} className="w-full">
            <ShieldCheck size={12} weight="bold" className="inline mr-1.5 -mt-0.5" />
            {busy ? "Verifying…" : "Verify"}
          </Btn>
          {error && (
            <div
              data-testid="verify-error"
              className="mt-3 border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A]"
            >
              ERR :: {error}
            </div>
          )}
        </Panel>

        {result && (
          <Panel
            title={result.valid ? "VERIFIED :: AUTHENTIC" : "INVALID"}
            testid="verify-result"
          >
            <div
              data-testid="verify-verdict"
              className={`flex items-start gap-3 border p-3 mb-4 ${
                result.valid
                  ? "border-[#00FF41]/50 bg-[#00FF41]/5"
                  : "border-[#FF003C]/50 bg-[#FF003C]/5"
              }`}
            >
              {result.valid ? (
                <CheckCircle size={26} weight="fill" className="text-[#00FF41] shrink-0 mt-0.5" />
              ) : (
                <XCircle size={26} weight="fill" className="text-[#FF003C] shrink-0 mt-0.5" />
              )}
              <div>
                <div className={`font-display font-semibold ${result.valid ? "text-[#7AFF9B]" : "text-[#FF6B8A]"}`}>
                  {result.valid ? "Token is authentic" : "Verification failed"}
                </div>
                <div className="text-[11px] font-mono text-white/60 mt-1">
                  {REASON_LABEL[result.reason] || result.reason}
                </div>
              </div>
            </div>

            <StatLine label="device_id" value={result.device_id} valueClass="text-cyan-300" testid="verify-device-id" />
            <StatLine label="block_id" value={`#${result.block_id}`} />
            {result.token_type && <StatLine label="token_type" value={result.token_type} />}
            {result.timestamp && (
              <StatLine
                label="issued"
                value={new Date(result.timestamp * 1000).toISOString().slice(0, 19) + "Z"}
              />
            )}
            {result.mixed_hash_hex && (
              <div className="mt-3">
                <Overline className="mb-1">mixed_hash</Overline>
                <HashLine value={result.mixed_hash_hex} />
              </div>
            )}
            {result.signature_hex && (
              <div className="mt-3">
                <Overline className="mb-1">block signature</Overline>
                <HashLine value={result.signature_hex} className="text-[#7AFF9B]" />
              </div>
            )}
          </Panel>
        )}

        <div className="text-center text-[10px] font-mono text-white/35 uppercase tracking-[0.22em] pt-2">
          Open source · client-side verifiable · device pubkey at{" "}
          <a href="/" className="text-cyan-300 hover:text-cyan-100">/</a> → Device tab
        </div>
      </main>
    </div>
  );
}
