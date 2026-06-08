// Small UI primitives for the Control Room aesthetic.
import React from "react";

export const Overline = ({ children, className = "", ...rest }) => (
  <div
    className={`text-[10px] font-mono uppercase tracking-[0.28em] text-white/50 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export const StatLine = ({ label, value, valueClass = "text-white", testid }) => (
  <div className="flex items-center justify-between border-b border-white/5 py-2 last:border-b-0">
    <span className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono">
      {label}
    </span>
    <span
      data-testid={testid}
      className={`font-mono text-sm ${valueClass}`}
    >
      {value}
    </span>
  </div>
);

export const Panel = ({ title, right, children, className = "", testid }) => (
  <section
    data-testid={testid}
    className={`relative border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 fade-up ${className}`}
  >
    {(title || right) && (
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="block h-[6px] w-[6px] bg-[#00F0FF] led-pulse text-[#00F0FF]" />
          <Overline>{title}</Overline>
        </div>
        {right}
      </header>
    )}
    {children}
  </section>
);

export const Btn = ({
  children,
  onClick,
  disabled,
  intent = "default",
  className = "",
  testid,
  type = "button",
}) => {
  const palette = {
    default:
      "border-white/15 text-white/80 hover:border-cyan-400 hover:text-cyan-300 hover:bg-white/5",
    primary:
      "border-cyan-400/60 text-cyan-300 hover:border-cyan-200 hover:text-cyan-100 hover:bg-cyan-400/10",
    danger:
      "border-[#FF003C]/60 text-[#FF6B8A] hover:border-[#FF003C] hover:text-white hover:bg-[#FF003C]/10",
    success:
      "border-[#00FF41]/60 text-[#7AFF9B] hover:border-[#00FF41] hover:text-white hover:bg-[#00FF41]/10",
  }[intent];
  return (
    <button
      type={type}
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 border ${palette} font-mono text-xs uppercase tracking-[0.2em] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
};

export const HealthBadge = ({ state, testid }) => {
  const ok = state === "OK";
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-2 border px-2 py-[3px] text-[10px] uppercase tracking-[0.22em] font-mono ${
        ok
          ? "border-[#00FF41]/40 text-[#7AFF9B]"
          : "border-[#FF003C]/50 text-[#FF6B8A]"
      }`}
    >
      <span
        className={`block h-[6px] w-[6px] ${
          ok ? "bg-[#00FF41]" : "bg-[#FF003C]"
        } led-pulse`}
        style={{ color: ok ? "#00FF41" : "#FF003C" }}
      />
      {state || "—"}
    </span>
  );
};

export const SourceBadge = ({ source }) => {
  const isCam = source === "camera";
  return (
    <span
      className={`inline-flex items-center gap-2 border px-2 py-[3px] text-[10px] uppercase tracking-[0.22em] font-mono ${
        isCam
          ? "border-cyan-400/40 text-cyan-200"
          : "border-white/15 text-white/55"
      }`}
    >
      {isCam ? "PHYS::CAM" : "SYS::URANDOM"}
    </span>
  );
};

export const HashLine = ({ value, testid, className = "" }) => (
  <div
    data-testid={testid}
    className={`font-mono text-[11px] text-white/70 break-all leading-relaxed ${className}`}
  >
    {value}
  </div>
);

export const Slider = ({ label, value, min, max, step, onChange, testid, suffix = "" }) => (
  <label className="block">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-mono">
        {label}
      </span>
      <span
        data-testid={`${testid}-value`}
        className="font-mono text-xs text-cyan-300"
      >
        {value}
        {suffix}
      </span>
    </div>
    <input
      data-testid={testid}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-cyan-400 bg-transparent"
    />
  </label>
);
