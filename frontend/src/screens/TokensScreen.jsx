import React, { useState } from "react";
import QRCode from "qrcode";
import { Key, Copy, Check, ArrowClockwise } from "@phosphor-icons/react";
import axios from "axios";
import {
  Btn,
  HashLine,
  HealthBadge,
  Overline,
  Panel,
  SourceBadge,
  StatLine,
} from "../components/ui";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  uuid: "RFC 4122 v4 UUID derived from entropy — not random.uuid() from libc, ChaosKey entropy.",
  totp: "Base32 secret for Google Authenticator / Authy. Scan the QR into your authenticator app.",
  otp: "Numeric one-time code. Useful for phone SMS-style flows.",
  session: "URL-safe base64 session token — 256 bits of physical entropy.",
};

export default function TokensScreen() {
  const [type, setType] = useState("bearer");
  const [cfg, setCfg] = useState(DEFAULTS.bearer);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [history, setHistory] = useState([]);

  function switchType(t) {
    setType(t);
    setCfg(DEFAULTS[t]);
    setResult(null);
    setQr("");
    setError("");
  }

  function update(field, val) {
    setCfg((p) => ({ ...p, [field]: val }));
  }

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    setQr("");
    try {
      const { data } = await axios.post(`${API}/generate_token`, {
        type,
        ...cfg,
        source: "system",
      });
      setResult(data);
      setHistory((h) => [{ id: data.block_id, type: data.type, token: data.token, ts: data.timestamp }, ...h].slice(0, 8));
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
    } catch (e) {
      setError(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || e?.message || "Token generation failed");
    } finally {
      setBusy(false);
    }
  }

  function copyToken() {
    if (!result?.token) return;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    try {
      const p = navigator?.clipboard?.writeText?.(result.token);
      if (p && typeof p.then === "function") {
        p.then(done).catch(() => {
          // Fallback: legacy execCommand in restricted contexts
          try {
            const ta = document.createElement("textarea");
            ta.value = result.token;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          } catch (_) {
            /* silently ignore clipboard failure */
          }
          done();
        });
      } else {
        done();
      }
    } catch (_) {
      done();
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="TOKEN GENERATOR :: SIGNED BY CHAOSKEY+"
        right={
          <Btn
            intent="primary"
            testid="generate-token-btn"
            onClick={generate}
            disabled={busy}
          >
            <Key size={12} weight="fill" className="inline mr-1.5 -mt-0.5" />
            {busy ? "Forging…" : "Generate"}
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

        {/* Type-specific config */}
        <div className="space-y-3">
          {type === "bearer" && (
            <>
              <LabeledInput
                label="Prefix"
                testid="prefix-input"
                value={cfg.prefix || ""}
                onChange={(v) => update("prefix", v.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))}
              />
              <LabeledNumber
                label="Body length"
                testid="length-input"
                min={8}
                max={128}
                value={cfg.length}
                onChange={(v) => update("length", v)}
              />
            </>
          )}
          {type === "password" && (
            <>
              <LabeledNumber
                label="Length"
                testid="length-input"
                min={6}
                max={128}
                value={cfg.length}
                onChange={(v) => update("length", v)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Toggle
                  label="a-z"
                  testid="opt-lower"
                  value={cfg.include_lower}
                  onChange={(v) => update("include_lower", v)}
                />
                <Toggle
                  label="A-Z"
                  testid="opt-upper"
                  value={cfg.include_upper}
                  onChange={(v) => update("include_upper", v)}
                />
                <Toggle
                  label="0-9"
                  testid="opt-digits"
                  value={cfg.include_digits}
                  onChange={(v) => update("include_digits", v)}
                />
                <Toggle
                  label="!@#$"
                  testid="opt-symbols"
                  value={cfg.include_symbols}
                  onChange={(v) => update("include_symbols", v)}
                />
              </div>
            </>
          )}
          {type === "totp" && (
            <>
              <LabeledInput
                label="Account label"
                testid="totp-label-input"
                value={cfg.totp_label || ""}
                onChange={(v) => update("totp_label", v.slice(0, 40))}
              />
              <LabeledInput
                label="Issuer"
                testid="totp-issuer-input"
                value={cfg.totp_issuer || ""}
                onChange={(v) => update("totp_issuer", v.slice(0, 32))}
              />
            </>
          )}
          {type === "otp" && (
            <LabeledNumber
              label="Digits"
              testid="otp-digits-input"
              min={4}
              max={10}
              value={cfg.otp_digits}
              onChange={(v) => update("otp_digits", v)}
            />
          )}
          {type === "session" && (
            <LabeledNumber
              label="Length"
              testid="length-input"
              min={16}
              max={128}
              value={cfg.length}
              onChange={(v) => update("length", v)}
            />
          )}
          {type === "uuid" && (
            <div className="text-[11px] font-mono text-white/40 italic">
              No config — v4 UUID has a fixed format.
            </div>
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
            <Btn intent="default" testid="copy-token-btn" onClick={copyToken}>
              {copied ? (
                <>
                  <Check size={12} className="inline mr-1.5 -mt-0.5" /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} className="inline mr-1.5 -mt-0.5" /> Copy
                </>
              )}
            </Btn>
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
                <img
                  data-testid="totp-qr"
                  src={qr}
                  alt="TOTP QR"
                  className="w-[160px] h-[160px] block"
                />
              </div>
              <div className="text-[11px] font-mono text-white/60 leading-relaxed">
                Scan this into Google Authenticator, Authy, 1Password, etc.
                The secret is ledgered under block #{result.block_id}, so you
                can prove it originated from physical chaos, not
                pseudo-random.
              </div>
            </div>
          )}

          <div className="mt-4">
            <StatLine label="block_id" value={`#${result.block_id}`} valueClass="text-cyan-300" testid="token-block-id" />
            <StatLine label="length" value={result.length} />
            <StatLine label="timestamp" value={new Date(result.timestamp * 1000).toISOString().slice(0, 19) + "Z"} />
          </div>
          <div className="mt-3">
            <Overline className="mb-1">signature (Ed25519)</Overline>
            <HashLine value={result.signature_hex} className="text-[#7AFF9B]" />
          </div>
        </Panel>
      )}

      {history.length > 0 && (
        <Panel
          title="RECENT"
          right={
            <Btn
              intent="default"
              testid="clear-history-btn"
              onClick={() => setHistory([])}
            >
              <ArrowClockwise size={12} className="inline mr-1.5 -mt-0.5" />
              Clear
            </Btn>
          }
          testid="token-history"
        >
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={`${h.id}-${h.ts}`}
                data-testid={`history-item-${h.id}`}
                className="flex items-center justify-between border border-white/8 bg-white/[0.02] px-3 py-2 gap-3"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-[0.22em] font-mono text-cyan-300 shrink-0">
                    {h.type}
                  </span>
                  <span className="font-mono text-[11px] text-white/70 truncate">
                    {h.token}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-white/40 shrink-0">
                  #{h.id}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

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
