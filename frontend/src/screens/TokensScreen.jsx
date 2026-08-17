import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Key,
  Copy,
  Check,
  Vault,
  LockKey,
  LockKeyOpen,
  Trash,
  Eye,
  EyeSlash,
  ShieldCheck,
  CameraRotate,
  Lightning,
} from "@phosphor-icons/react";
import { postToken, postTokensBulk } from "../lib/api";
import { ChaosCameraSession } from "../lib/chaosCamera";
import { vaultExists, saveVault, loadVault, clearVault } from "../lib/vault";
import {
  Btn,
  HashLine,
  HealthBadge,
  Overline,
  Panel,
  SourceBadge,
  StatLine,
} from "../components/ui";

const TYPES = [
  { id: "bearer", label: "Bearer" },
  { id: "password", label: "Password" },
  { id: "uuid", label: "UUID" },
  { id: "totp", label: "TOTP" },
  { id: "otp", label: "OTP" },
  { id: "session", label: "Session" },
];

const DEFAULTS = {
  bearer: { length: 40, prefix: "ck_live" },
  password: { length: 20, include_digits: true, include_symbols: true, include_upper: true, include_lower: true },
  uuid: {},
  totp: { length: 32, totp_label: "chaoskey-user", totp_issuer: "ChaosKey+" },
  otp: { otp_digits: 6 },
  session: { length: 43 },
};

const DESCRIPTIONS = {
  bearer: "API-style token: <prefix>_<base62 body>. Great for API keys.",
  password: "Configurable-alphabet password. Toggle character classes below.",
  uuid: "RFC 4122 v4 UUID derived from ChaosKey entropy — not libc random.",
  totp: "Base32 secret for Google Authenticator / Authy. Scan the QR into your app.",
  otp: "Numeric one-time code. Useful for phone SMS-style flows.",
  session: "URL-safe base64 session token — 256 bits of physical entropy.",
};

export default function TokensScreen() {
  const [tab, setTab] = useState("generate"); // generate | vault
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <SubTab id="generate" tab={tab} setTab={setTab} label="Generate" testid="subtab-generate" />
        <SubTab id="vault" tab={tab} setTab={setTab} label="Vault" testid="subtab-vault" />
      </div>
      {tab === "generate" ? <GenerateView /> : <VaultView />}
    </div>
  );
}

function SubTab({ id, tab, setTab, label, testid }) {
  const active = tab === id;
  return (
    <button
      data-testid={testid}
      onClick={() => setTab(id)}
      className={`py-2.5 border text-[11px] uppercase tracking-[0.24em] font-mono transition-colors ${
        active
          ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
          : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/85 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════
// GENERATE VIEW
// ══════════════════════════════════════════════════════════════════
function GenerateView() {
  const [type, setType] = useState("bearer");
  const [cfg, setCfg] = useState(DEFAULTS.bearer);
  const [source, setSource] = useState("system"); // system | camera
  const [bulk, setBulk] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [batch, setBatch] = useState(null); // list of TokenResponse
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");

  // Camera
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [camTick, setCamTick] = useState({ collected: 0, total: 0, variance: 0 });

  function switchType(t) {
    setType(t);
    setCfg(DEFAULTS[t]);
    setResult(null);
    setBatch(null);
    setQr("");
    setError("");
  }

  function update(field, val) {
    setCfg((p) => ({ ...p, [field]: val }));
  }

  async function startCam() {
    setError("");
    try {
      const s = new ChaosCameraSession({ width: 160, height: 120, fps: 14 });
      await s.start(videoRef.current);
      sessionRef.current = s;
      setCamReady(true);
    } catch (e) {
      setError(e?.message || "Camera unavailable");
      setSource("system");
    }
  }
  function stopCam() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setCamReady(false);
  }
  useEffect(() => () => stopCam(), []);
  useEffect(() => {
    if (source !== "camera") stopCam();
  }, [source]);

  async function harvestCameraFrames() {
    if (!sessionRef.current) throw new Error("Camera not started");
    const { frame_diffs_b64 } = await sessionRef.current.harvest({
      numFrames: 10,
      onTick: setCamTick,
    });
    return frame_diffs_b64;
  }

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    setBatch(null);
    setQr("");
    try {
      let frame_diffs_b64 = null;
      if (source === "camera") {
        if (!camReady) throw new Error("Start the camera first");
        frame_diffs_b64 = await harvestCameraFrames();
      }
      const template = { type, ...cfg, source, frame_diffs_b64 };

      if (bulk) {
        const { tokens } = await postTokensBulk({ count: bulkCount, template });
        setBatch(tokens);
      } else {
        const data = await postToken(template);
        setResult(data);
        if (data.otpauth_uri) {
          try {
            const url = await QRCode.toDataURL(data.otpauth_uri, {
              margin: 1,
              color: { dark: "#00F0FF", light: "#05050A" },
              width: 180,
            });
            setQr(url);
          } catch (_) {
            setQr("");
          }
        }
      }
    } catch (e) {
      setError(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  function safeCopy(text) {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    };
    try {
      const p = navigator?.clipboard?.writeText?.(text);
      if (p?.then) p.then(done).catch(done);
      else done();
    } catch (_) {
      done();
    }
  }

  async function saveOne(tokenObj) {
    const pass = prompt("Vault passphrase (used to encrypt your saved tokens):");
    if (!pass) return;
    let existing = [];
    if (vaultExists()) {
      try {
        existing = await loadVault(pass);
      } catch (_) {
        alert("Wrong passphrase — this vault is protected by a different one. Aborted.");
        return;
      }
    }
    existing.unshift({
      id: `${tokenObj.block_id}-${Date.now()}`,
      block_id: tokenObj.block_id,
      type: tokenObj.type,
      token: tokenObj.token,
      timestamp: tokenObj.timestamp,
      token_signature_hex: tokenObj.token_signature_hex,
      note: "",
    });
    await saveVault(pass, existing);
    alert(`Saved. Vault now has ${existing.length} item(s).`);
  }

  return (
    <>
      <Panel
        title="TOKEN GENERATOR"
        right={
          <Btn
            intent="primary"
            testid="generate-token-btn"
            onClick={generate}
            disabled={busy}
          >
            <Key size={12} weight="fill" className="inline mr-1.5 -mt-0.5" />
            {busy ? "Forging…" : bulk ? `Generate ×${bulkCount}` : "Generate"}
          </Btn>
        }
        testid="tokens-panel"
      >
        {/* Type chips */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {TYPES.map((t) => {
            const active = t.id === type;
            return (
              <button
                key={t.id}
                data-testid={`type-${t.id}`}
                onClick={() => switchType(t.id)}
                className={`py-2 px-2 border text-[10px] uppercase tracking-[0.22em] font-mono transition-colors ${
                  active
                    ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
                    : "border-white/15 text-white/55 hover:border-white/40 hover:text-white/85 hover:bg-white/5"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div
          data-testid="type-description"
          className="text-[11px] font-mono text-white/55 leading-relaxed border-l-2 border-cyan-400/40 pl-3 py-1 mb-4"
        >
          {DESCRIPTIONS[type]}
        </div>

        {/* Source toggle */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            data-testid="source-system-btn"
            onClick={() => setSource("system")}
            className={`py-2 border text-[10px] uppercase tracking-[0.22em] font-mono transition-colors ${
              source === "system"
                ? "border-white/50 text-white bg-white/10"
                : "border-white/10 text-white/45 hover:border-white/30 hover:text-white/80"
            }`}
          >
            <ShieldCheck size={12} className="inline mr-1.5 -mt-0.5" />
            SYS
          </button>
          <button
            data-testid="source-camera-btn"
            onClick={() => setSource("camera")}
            className={`py-2 border text-[10px] uppercase tracking-[0.22em] font-mono transition-colors ${
              source === "camera"
                ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
                : "border-white/10 text-white/45 hover:border-white/30 hover:text-white/80"
            }`}
          >
            <CameraRotate size={12} className="inline mr-1.5 -mt-0.5" />
            CAM
          </button>
        </div>

        {/* Camera preview (only when source=camera) */}
        {source === "camera" && (
          <div className="mb-4">
            <div className="relative aspect-[4/3] border border-white/10 bg-black overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                data-testid="tokens-camera-video"
                className="absolute inset-0 w-full h-full object-cover opacity-90"
              />
              <span className="bracket-corner top-2 left-2 border-t-2 border-l-2" />
              <span className="bracket-corner top-2 right-2 border-t-2 border-r-2" />
              <span className="bracket-corner bottom-2 left-2 border-b-2 border-l-2" />
              <span className="bracket-corner bottom-2 right-2 border-b-2 border-r-2" />
              {busy && (
                <div className="absolute inset-x-0 h-px bg-cyan-300 scan-beam shadow-[0_0_18px_2px_#00F0FF]" />
              )}
              {!camReady && (
                <div className="absolute inset-0 flex items-center justify-center text-center p-4">
                  <div>
                    <CameraRotate size={26} weight="thin" className="mx-auto text-cyan-300 mb-1" />
                    <div className="text-[10px] font-mono text-white/55">
                      Camera offline
                    </div>
                  </div>
                </div>
              )}
              {camReady && (
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <span className="block h-[6px] w-[6px] bg-[#00FF41] led-pulse text-[#00FF41]" />
                  <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#7AFF9B]">
                    LIVE
                  </span>
                </div>
              )}
              {busy && camReady && (
                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-200">
                  <span>FRAMES {camTick.collected}/{camTick.total}</span>
                  <span>VAR {camTick.variance ? camTick.variance.toFixed(1) : "—"}</span>
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {!camReady ? (
                <Btn intent="default" testid="tokens-start-cam-btn" onClick={startCam} className="col-span-2">
                  <Lightning size={12} className="inline mr-1.5 -mt-0.5" />
                  Initialise Camera
                </Btn>
              ) : (
                <Btn intent="default" testid="tokens-stop-cam-btn" onClick={stopCam} disabled={busy} className="col-span-2">
                  Stop Camera
                </Btn>
              )}
            </div>
          </div>
        )}

        {/* Type-specific config */}
        <div className="space-y-3">
          {type === "bearer" && (
            <>
              <LabeledInput label="Prefix" testid="prefix-input" value={cfg.prefix || ""}
                onChange={(v) => update("prefix", v.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))} />
              <LabeledNumber label="Body length" testid="length-input" min={8} max={128}
                value={cfg.length} onChange={(v) => update("length", v)} />
            </>
          )}
          {type === "password" && (
            <>
              <LabeledNumber label="Length" testid="length-input" min={6} max={128}
                value={cfg.length} onChange={(v) => update("length", v)} />
              <div className="grid grid-cols-2 gap-2">
                <Toggle label="a-z" testid="opt-lower" value={cfg.include_lower} onChange={(v) => update("include_lower", v)} />
                <Toggle label="A-Z" testid="opt-upper" value={cfg.include_upper} onChange={(v) => update("include_upper", v)} />
                <Toggle label="0-9" testid="opt-digits" value={cfg.include_digits} onChange={(v) => update("include_digits", v)} />
                <Toggle label="!@#$" testid="opt-symbols" value={cfg.include_symbols} onChange={(v) => update("include_symbols", v)} />
              </div>
            </>
          )}
          {type === "totp" && (
            <>
              <LabeledInput label="Account label" testid="totp-label-input" value={cfg.totp_label || ""}
                onChange={(v) => update("totp_label", v.slice(0, 40))} />
              <LabeledInput label="Issuer" testid="totp-issuer-input" value={cfg.totp_issuer || ""}
                onChange={(v) => update("totp_issuer", v.slice(0, 32))} />
            </>
          )}
          {type === "otp" && (
            <LabeledNumber label="Digits" testid="otp-digits-input" min={4} max={10}
              value={cfg.otp_digits} onChange={(v) => update("otp_digits", v)} />
          )}
          {type === "session" && (
            <LabeledNumber label="Length" testid="length-input" min={16} max={128}
              value={cfg.length} onChange={(v) => update("length", v)} />
          )}
          {type === "uuid" && (
            <div className="text-[11px] font-mono text-white/40 italic">
              No config — v4 UUID has a fixed format.
            </div>
          )}
        </div>

        {/* Bulk */}
        <div className="mt-4 border-t border-white/10 pt-4 grid grid-cols-[auto_1fr] items-center gap-3">
          <button
            data-testid="bulk-toggle"
            onClick={() => setBulk((v) => !v)}
            className={`py-1.5 px-3 border text-[10px] uppercase tracking-[0.22em] font-mono transition-colors ${
              bulk
                ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
                : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/85"
            }`}
          >
            {bulk ? "✓ BULK" : "○ BULK"}
          </button>
          {bulk ? (
            <label className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/50 font-mono">count</span>
              <input
                data-testid="bulk-count-input"
                type="number"
                min={1}
                max={20}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="w-20 bg-transparent border border-white/15 px-2 py-1 text-sm text-cyan-300 font-mono focus:border-cyan-400 outline-none"
              />
            </label>
          ) : (
            <span className="text-[10px] font-mono text-white/35 uppercase tracking-[0.22em]">
              Off — single token per press
            </span>
          )}
        </div>

        {error && (
          <div
            data-testid="token-error"
            className="mt-3 border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A]"
          >
            ERR :: {error}
          </div>
        )}
      </Panel>

      {result && !batch && (
        <Panel
          title="OUTPUT"
          right={
            <div className="flex items-center gap-2">
              <SourceBadge source={result.source} />
              <HealthBadge state={result.health_state} testid="token-health" />
            </div>
          }
          testid="token-output"
        >
          <div className="mb-1 flex items-center justify-between">
            <Overline>{result.type} · {result.display_hint}</Overline>
            <div className="flex gap-2">
              <Btn intent="default" testid="copy-token-btn" onClick={() => safeCopy(result.token)}>
                {copied ? <><Check size={12} className="inline mr-1.5 -mt-0.5" />Copied</> : <><Copy size={12} className="inline mr-1.5 -mt-0.5" />Copy</>}
              </Btn>
              <Btn intent="success" testid="save-vault-btn" onClick={() => saveOne(result)}>
                <Vault size={12} className="inline mr-1.5 -mt-0.5" />Save
              </Btn>
            </div>
          </div>
          <div
            data-testid="token-value"
            className="border border-cyan-400/25 bg-cyan-400/[0.04] px-3 py-3 font-mono text-[13px] text-cyan-100 break-all leading-relaxed no-caret select-all"
          >
            {result.token}
          </div>

          {qr && (
            <div className="mt-4 flex items-start gap-4">
              <div className="border border-white/10 p-2 bg-black">
                <img data-testid="totp-qr" src={qr} alt="TOTP QR" className="w-[160px] h-[160px] block" />
              </div>
              <div className="text-[11px] font-mono text-white/60 leading-relaxed">
                Scan into your authenticator. Secret ledgered under block #{result.block_id}.
              </div>
            </div>
          )}

          <div className="mt-4">
            <StatLine label="block_id" value={`#${result.block_id}`} valueClass="text-cyan-300" testid="token-block-id" />
            <StatLine label="length" value={result.length} />
            <StatLine label="timestamp" value={new Date(result.timestamp * 1000).toISOString().slice(0, 19) + "Z"} />
          </div>
          <div className="mt-3">
            <Overline className="mb-1">token_hash (SHA-256)</Overline>
            <HashLine value={result.token_hash_hex} />
          </div>
          <div className="mt-3">
            <Overline className="mb-1">token_signature (Ed25519)</Overline>
            <HashLine value={result.token_signature_hex} className="text-[#7AFF9B]" />
          </div>
          <div className="mt-4 border border-cyan-400/20 bg-cyan-400/[0.03] p-3">
            <Overline className="mb-1">Shareable verification receipt</Overline>
            <div className="text-[11px] font-mono text-white/70 break-all leading-relaxed">
              Anyone can verify this token at{" "}
              <a
                href={`${window.location.origin}/verify?block_id=${result.block_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 hover:text-cyan-100 underline"
              >
                /verify?block_id={result.block_id}
              </a>
            </div>
          </div>
        </Panel>
      )}

      {batch && (
        <Panel
          title={`BATCH · ${batch.length} tokens`}
          right={
            <Btn intent="default" testid="copy-batch-btn" onClick={() => safeCopy(batch.map((b) => b.token).join("\n"))}>
              {copied ? <><Check size={12} className="inline mr-1.5 -mt-0.5" />Copied</> : <><Copy size={12} className="inline mr-1.5 -mt-0.5" />Copy all</>}
            </Btn>
          }
          testid="token-batch"
        >
          <ul className="space-y-2">
            {batch.map((t) => (
              <li
                key={t.block_id}
                data-testid={`batch-item-${t.block_id}`}
                className="border border-white/10 bg-white/[0.02] px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-cyan-300 font-mono">#{t.block_id} · {t.type}</div>
                  <div className="font-mono text-[11px] text-white/85 truncate">{t.token}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => safeCopy(t.token)}
                    className="p-1.5 border border-white/15 text-white/60 hover:border-cyan-400 hover:text-cyan-300"
                    aria-label="copy"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={() => saveOne(t)}
                    className="p-1.5 border border-[#00FF41]/40 text-[#7AFF9B] hover:border-[#00FF41] hover:text-white"
                    aria-label="save"
                  >
                    <Vault size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// VAULT VIEW
// ══════════════════════════════════════════════════════════════════
function VaultView() {
  const [locked, setLocked] = useState(true);
  const [pass, setPass] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState({});
  const [exists, setExists] = useState(vaultExists());

  async function unlock() {
    setError("");
    if (!pass) return;
    try {
      if (!vaultExists()) {
        setItems([]);
        setLocked(false);
        return;
      }
      const data = await loadVault(pass);
      setItems(data);
      setLocked(false);
    } catch (_) {
      setError("Wrong passphrase (or vault corrupted).");
    }
  }

  async function persist(next) {
    await saveVault(pass, next);
    setItems(next);
    setExists(true);
  }

  async function removeItem(id) {
    const next = items.filter((it) => it.id !== id);
    await persist(next);
  }

  async function destroy() {
    if (!window.confirm("This permanently erases the encrypted vault from this device.")) return;
    clearVault();
    setItems([]);
    setExists(false);
    setLocked(true);
    setPass("");
  }

  if (locked) {
    return (
      <Panel title="VAULT :: LOCKED" testid="vault-locked">
        <div className="flex items-center gap-3 mb-4">
          <LockKey size={24} weight="fill" className="text-cyan-300" />
          <div className="text-[11px] font-mono text-white/60 leading-relaxed">
            {exists
              ? "Enter your passphrase to decrypt this device's token vault. Never leaves your phone."
              : "No vault exists yet on this device. Set a passphrase to create one."}
          </div>
        </div>
        <label className="block mb-3">
          <Overline className="mb-1">Passphrase</Overline>
          <input
            data-testid="vault-pass-input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none"
            autoComplete="off"
          />
        </label>
        {error && (
          <div className="mb-3 border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A]">
            {error}
          </div>
        )}
        <Btn intent="primary" testid="vault-unlock-btn" onClick={unlock} disabled={!pass} className="w-full">
          <LockKeyOpen size={12} className="inline mr-1.5 -mt-0.5" />
          {exists ? "Unlock" : "Create Vault"}
        </Btn>
        {exists && (
          <button
            data-testid="vault-destroy-btn"
            onClick={destroy}
            className="mt-3 w-full py-2 border border-[#FF003C]/40 text-[#FF6B8A] text-[10px] uppercase tracking-[0.22em] font-mono hover:border-[#FF003C] hover:text-white hover:bg-[#FF003C]/10 transition-colors"
          >
            <Trash size={11} className="inline mr-1.5 -mt-0.5" /> Wipe this vault
          </button>
        )}
        <div className="mt-4 text-[10px] font-mono text-white/35 leading-relaxed">
          Encrypted client-side with AES-GCM. Key derived via PBKDF2-SHA256 · 100k iters. Losing the passphrase means the vault is unrecoverable.
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={`VAULT :: ${items.length} item(s)`}
      right={
        <Btn intent="default" testid="vault-lock-btn" onClick={() => { setLocked(true); setPass(""); setItems([]); setReveal({}); }}>
          <LockKey size={12} className="inline mr-1.5 -mt-0.5" /> Lock
        </Btn>
      }
      testid="vault-open"
    >
      {items.length === 0 && (
        <div className="text-center py-8 text-white/40 text-[11px] uppercase tracking-[0.22em] font-mono">
          Vault is empty. Save a token from Generate to populate it.
        </div>
      )}
      <ul className="space-y-3">
        {items.map((it) => {
          const shown = !!reveal[it.id];
          return (
            <li
              key={it.id}
              data-testid={`vault-item-${it.id}`}
              className="border border-white/10 bg-white/[0.025] p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-[0.22em]">
                    #{it.block_id} · {it.type}
                  </span>
                  <span className="text-[10px] font-mono text-white/40">
                    {new Date(it.timestamp * 1000).toISOString().slice(0, 10)}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    data-testid={`vault-reveal-${it.id}`}
                    onClick={() => setReveal((p) => ({ ...p, [it.id]: !p[it.id] }))}
                    className="p-1.5 border border-white/15 text-white/60 hover:border-cyan-400 hover:text-cyan-300"
                    aria-label="reveal"
                  >
                    {shown ? <EyeSlash size={12} /> : <Eye size={12} />}
                  </button>
                  <button
                    data-testid={`vault-copy-${it.id}`}
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(it.token).catch(() => {});
                      } catch (_) { /* ignore */ }
                    }}
                    className="p-1.5 border border-white/15 text-white/60 hover:border-cyan-400 hover:text-cyan-300"
                    aria-label="copy"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    data-testid={`vault-delete-${it.id}`}
                    onClick={() => removeItem(it.id)}
                    className="p-1.5 border border-[#FF003C]/40 text-[#FF6B8A] hover:border-[#FF003C] hover:text-white"
                    aria-label="delete"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
              <div className={`font-mono text-[11px] break-all leading-relaxed ${shown ? "text-cyan-100" : "text-white/40 blur-sm select-none"}`}>
                {shown ? it.token : "•".repeat(Math.min(48, it.token.length))}
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > 0 && (
        <button
          data-testid="vault-destroy-btn"
          onClick={destroy}
          className="mt-4 w-full py-2 border border-[#FF003C]/40 text-[#FF6B8A] text-[10px] uppercase tracking-[0.22em] font-mono hover:border-[#FF003C] hover:text-white hover:bg-[#FF003C]/10 transition-colors"
        >
          <Trash size={11} className="inline mr-1.5 -mt-0.5" /> Wipe vault
        </button>
      )}
    </Panel>
  );
}

// ── shared field primitives ─────────────────────────
function LabeledInput({ label, value, onChange, testid }) {
  return (
    <label className="block">
      <Overline className="mb-1">{label}</Overline>
      <input
        data-testid={testid}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none"
      />
    </label>
  );
}

function LabeledNumber({ label, value, onChange, min, max, testid }) {
  return (
    <label className="block">
      <Overline className="mb-1">{label}</Overline>
      <input
        data-testid={testid}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
        className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none"
      />
    </label>
  );
}

function Toggle({ label, value, onChange, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={() => onChange(!value)}
      className={`py-2 px-3 border text-xs uppercase tracking-[0.2em] font-mono transition-colors ${
        value
          ? "border-cyan-400/60 text-cyan-300 bg-cyan-400/10"
          : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
      }`}
    >
      {value ? "✓" : "○"} {label}
    </button>
  );
}
