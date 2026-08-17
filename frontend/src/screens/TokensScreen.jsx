import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Key,
  Copy,
  Check,
  ShieldCheck,
  CameraRotate,
  Lightning,
  Clock,
} from "@phosphor-icons/react";
import { postToken } from "../lib/api";
import { ChaosCameraSession } from "../lib/chaosCamera";
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

// Expiry presets — value is seconds; 0 = never
const EXPIRIES = [
  { id: 0, label: "Never" },
  { id: 60 * 15, label: "15 min" },
  { id: 60 * 60, label: "1 hour" },
  { id: 60 * 60 * 24, label: "24 hours" },
  { id: 60 * 60 * 24 * 7, label: "7 days" },
  { id: 60 * 60 * 24 * 30, label: "30 days" },
];

function fmtCountdown(expiresAtSec) {
  if (!expiresAtSec) return "never";
  const rem = Math.max(0, Math.floor(expiresAtSec - Date.now() / 1000));
  if (rem === 0) return "EXPIRED";
  const d = Math.floor(rem / 86400);
  const h = Math.floor((rem % 86400) / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const s = rem % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function TokensScreen() {
  const [type, setType] = useState("bearer");
  const [cfg, setCfg] = useState(DEFAULTS.bearer);
  const [source, setSource] = useState("system"); // system | camera
  const [expires, setExpires] = useState(0); // seconds
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [totpQr, setTotpQr] = useState("");
  const [verifyQr, setVerifyQr] = useState("");
  const [, setNow] = useState(Date.now()); // ticker for expiry countdown

  // Camera
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [camTick, setCamTick] = useState({ collected: 0, total: 0, variance: 0 });

  // Countdown ticker for expiry display
  useEffect(() => {
    if (!result?.expires_at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [result?.expires_at]);

  function switchType(t) {
    setType(t);
    setCfg(DEFAULTS[t]);
    setResult(null);
    setTotpQr("");
    setVerifyQr("");
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

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    setTotpQr("");
    setVerifyQr("");
    try {
      let frame_diffs_b64 = null;
      if (source === "camera") {
        if (!camReady) throw new Error("Start the camera first");
        const harvest = await sessionRef.current.harvest({
          numFrames: 10,
          onTick: setCamTick,
        });
        frame_diffs_b64 = harvest.frame_diffs_b64;
      }
      const data = await postToken({
        type, ...cfg,
        source,
        frame_diffs_b64,
        expires_in_seconds: expires || null,
      });
      setResult(data);

      // TOTP QR
      if (data.otpauth_uri) {
        try {
          const url = await QRCode.toDataURL(data.otpauth_uri, {
            margin: 1,
            color: { dark: "#00F0FF", light: "#05050A" },
            width: 160,
          });
          setTotpQr(url);
        } catch (_) { /* ignore */ }
      }

      // Verify QR — encodes /verify?block_id=X&token=Y so any phone
      // scanning it opens the public verifier prefilled.
      try {
        const verifyUrl = `${window.location.origin}/verify?block_id=${data.block_id}&token=${encodeURIComponent(data.token)}`;
        const url = await QRCode.toDataURL(verifyUrl, {
          margin: 1,
          color: { dark: "#00FF41", light: "#05050A" },
          width: 160,
          errorCorrectionLevel: "M",
        });
        setVerifyQr(url);
      } catch (_) { /* ignore */ }
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

  const countdown = result?.expires_at ? fmtCountdown(result.expires_at) : null;
  const isExpired = countdown === "EXPIRED";

  return (
    <div className="space-y-4">
      <Panel
        title="TOKEN GENERATOR"
        right={
          <Btn intent="primary" testid="generate-token-btn" onClick={generate} disabled={busy}>
            <Key size={12} weight="fill" className="inline mr-1.5 -mt-0.5" />
            {busy ? "Forging…" : "Generate"}
          </Btn>
        }
        testid="tokens-panel"
      >
        <p className="text-[11px] font-mono text-white/55 leading-relaxed mb-4">
          ChaosKey entropy tokens (bearer, password, UUID, TOTP, OTP, session).
          Not an ERC-20 and not STRK20. Private on-chain transfers live on the
          Pool tab with Ready.
        </p>
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

        {/* Camera preview */}
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
                    <div className="text-[10px] font-mono text-white/55">Camera offline</div>
                  </div>
                </div>
              )}
              {camReady && (
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <span className="block h-[6px] w-[6px] bg-[#00FF41] led-pulse text-[#00FF41]" />
                  <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#7AFF9B]">LIVE</span>
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
                <ToggleBtn label="a-z" testid="opt-lower" value={cfg.include_lower} onChange={(v) => update("include_lower", v)} />
                <ToggleBtn label="A-Z" testid="opt-upper" value={cfg.include_upper} onChange={(v) => update("include_upper", v)} />
                <ToggleBtn label="0-9" testid="opt-digits" value={cfg.include_digits} onChange={(v) => update("include_digits", v)} />
                <ToggleBtn label="!@#$" testid="opt-symbols" value={cfg.include_symbols} onChange={(v) => update("include_symbols", v)} />
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

        {/* Expiry */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={12} className="text-cyan-300" />
            <Overline>Expiry — cryptographically bound</Overline>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {EXPIRIES.map((e) => {
              const active = e.id === expires;
              return (
                <button
                  key={e.id}
                  data-testid={`expiry-${e.id}`}
                  onClick={() => setExpires(e.id)}
                  className={`py-2 border text-[10px] uppercase tracking-[0.22em] font-mono transition-colors ${
                    active
                      ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
                      : "border-white/10 text-white/45 hover:border-white/30 hover:text-white/80"
                  }`}
                >
                  {e.label}
                </button>
              );
            })}
          </div>
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

      {result && (
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
            <Btn intent="default" testid="copy-token-btn" onClick={() => safeCopy(result.token)}>
              {copied ? <><Check size={12} className="inline mr-1.5 -mt-0.5" />Copied</> : <><Copy size={12} className="inline mr-1.5 -mt-0.5" />Copy</>}
            </Btn>
          </div>
          <div
            data-testid="token-value"
            className="border border-cyan-400/25 bg-cyan-400/[0.04] px-3 py-3 font-mono text-[13px] text-cyan-100 break-all leading-relaxed no-caret select-all"
          >
            {result.token}
          </div>

          {/* Expiry countdown */}
          {result.expires_at && (
            <div
              data-testid="token-expiry"
              className={`mt-3 flex items-center justify-between border px-3 py-2 text-[11px] font-mono ${
                isExpired
                  ? "border-[#FF003C]/50 bg-[#FF003C]/5 text-[#FF6B8A]"
                  : "border-[#FFB800]/40 bg-[#FFB800]/5 text-[#FFC846]"
              }`}
            >
              <span className="uppercase tracking-[0.22em] text-[10px]">
                {isExpired ? "EXPIRED" : "expires in"}
              </span>
              <span className="text-sm">
                {countdown}
                <span className="text-white/40 text-[10px] ml-2">
                  · {new Date(result.expires_at * 1000).toISOString().slice(0, 19)}Z
                </span>
              </span>
            </div>
          )}

          {/* Verification QR (scan → opens /verify prefilled) */}
          {verifyQr && (
            <div className="mt-4 flex items-start gap-4 border border-[#00FF41]/20 bg-[#00FF41]/[0.02] p-3">
              <div className="border border-white/10 p-2 bg-black shrink-0">
                <img
                  data-testid="verify-qr"
                  src={verifyQr}
                  alt="Verify QR"
                  className="w-[130px] h-[130px] block"
                />
              </div>
              <div className="text-[10px] font-mono text-white/60 leading-relaxed">
                <div className="text-[#7AFF9B] uppercase tracking-[0.22em] mb-1.5">Scan-to-verify</div>
                Anyone can scan this QR to open the public verifier and
                confirm the token was minted by this device. No account
                needed.
                <div className="mt-2">
                  <a
                    data-testid="verify-link"
                    href={`/verify?block_id=${result.block_id}&token=${encodeURIComponent(result.token)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 hover:text-cyan-100 underline"
                  >
                    Open /verify →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TOTP QR */}
          {totpQr && (
            <div className="mt-4 flex items-start gap-4">
              <div className="border border-white/10 p-2 bg-black shrink-0">
                <img data-testid="totp-qr" src={totpQr} alt="TOTP QR" className="w-[160px] h-[160px] block" />
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
        </Panel>
      )}
    </div>
  );
}

// ── field primitives ─────────────────────────
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

function ToggleBtn({ label, value, onChange, testid }) {
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
