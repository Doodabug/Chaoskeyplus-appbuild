import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, FingerprintSimple, Copy, Check } from "@phosphor-icons/react";
import { getPubKey, getStatus } from "../lib/api";
import { Btn, HashLine, HealthBadge, Overline, Panel, SourceBadge, StatLine } from "../components/ui";

const HERO =
  "https://images.pexels.com/photos/30766684/pexels-photo-30766684.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function DeviceScreen() {
  const [status, setStatus] = useState(null);
  const [pub, setPub] = useState(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const [s, p] = await Promise.all([getStatus(), getPubKey()]);
    setStatus(s);
    setPub(p);
    try {
      const url = await QRCode.toDataURL(p.public_key_pem, {
        margin: 1,
        color: { dark: "#00F0FF", light: "#05050A" },
        width: 200,
      });
      setQr(url);
    } catch (e) {
      setQr("");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  function copyPub() {
    if (!pub) return;
    navigator.clipboard.writeText(pub.public_key_pem).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <section
        data-testid="device-hero"
        className="relative border border-white/10 overflow-hidden h-44"
        style={{
          backgroundImage: `linear-gradient(rgba(5,5,10,0.55), rgba(5,5,10,0.85)), url(${HERO})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="relative h-full flex flex-col justify-end p-5">
          <Overline className="mb-1.5 text-cyan-300/80">Hardware identity</Overline>
          <h1 className="font-display font-semibold text-2xl tracking-tight leading-none">
            ChaosKey<span className="text-[#00F0FF]">+</span> M3
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <FingerprintSimple size={14} className="text-cyan-300" />
            <span data-testid="device-id" className="font-mono text-[11px] text-white/70">
              {status?.device_id || "—"}
            </span>
          </div>
        </div>
      </section>

      <Panel title="OPERATIONAL STATUS" testid="status-panel">
        <StatLine
          label="Last block"
          value={status?.last_block_id != null ? `#${status.last_block_id}` : "—"}
          valueClass="text-cyan-300"
          testid="status-last-block"
        />
        <StatLine
          label="Total blocks"
          value={status?.total_blocks ?? 0}
          testid="status-total-blocks"
        />
        <div className="flex items-center justify-between border-b border-white/5 py-2">
          <span className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono">
            Last health
          </span>
          {status?.last_health_state ? (
            <HealthBadge state={status.last_health_state} testid="status-last-health" />
          ) : (
            <span className="font-mono text-sm text-white/50">—</span>
          )}
        </div>
        <div className="flex items-center justify-between border-b border-white/5 py-2">
          <span className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono">
            Last source
          </span>
          {status?.last_source ? (
            <SourceBadge source={status.last_source} />
          ) : (
            <span className="font-mono text-sm text-white/50">—</span>
          )}
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono">
            Chain integrity
          </span>
          <span
            data-testid="status-chain"
            className={`font-mono text-xs uppercase tracking-[0.22em] ${
              status?.chain_intact ? "text-[#7AFF9B]" : "text-[#FF6B8A]"
            }`}
          >
            {status?.chain_intact ? "✓ INTACT" : "⚠ BROKEN"}
          </span>
        </div>
      </Panel>

      <Panel
        title="DEVICE PUBLIC KEY (Ed25519)"
        right={
          <Btn intent="default" testid="copy-pubkey-btn" onClick={copyPub}>
            {copied ? (
              <>
                <Check size={12} className="inline mr-1.5 -mt-0.5" /> Copied
              </>
            ) : (
              <>
                <Copy size={12} className="inline mr-1.5 -mt-0.5" /> Copy PEM
              </>
            )}
          </Btn>
        }
        testid="pubkey-panel"
      >
        <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
          <div className="border border-white/10 p-2 bg-black">
            {qr ? (
              <img
                data-testid="pubkey-qr"
                src={qr}
                alt="public key QR"
                className="w-[120px] h-[120px] block"
              />
            ) : (
              <div className="w-[120px] h-[120px] bg-white/5" />
            )}
          </div>
          <div>
            <Overline className="mb-2">PEM</Overline>
            <HashLine
              testid="pubkey-pem"
              value={pub?.public_key_pem || ""}
              className="text-[10px] leading-snug"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-[0.22em]">
          <ShieldCheck size={12} className="text-cyan-300" />
          Every block is signed by this key. Verify offline.
        </div>
      </Panel>

      <Panel title="ABOUT">
        <p className="text-[12px] font-mono text-white/60 leading-relaxed">
          ChaosKey+ M3 derives randomness from physical chaos — either browser
          camera pixel-diffs or system entropy — then mixes it through
          HKDF-SHA512, runs NIST-style health tests, and appends a signed,
          chained block to the ledger. Every replication in the digital
          universe pulls fresh chaos. No cloning. No replay.
        </p>
      </Panel>
    </div>
  );
}
