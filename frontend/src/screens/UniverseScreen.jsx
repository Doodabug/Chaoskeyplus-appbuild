import React, { useMemo, useState } from "react";
import { Planet, Play } from "@phosphor-icons/react";
import { postSimulate } from "../lib/api";
import { Btn, Overline, Panel, Slider, StatLine } from "../components/ui";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1579567761406-4684ee0c75b6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWJzdHJhY3QlMjBuZXR3b3JrJTIwbm9kZXN8ZW58MHx8fHwxNzgwOTU4NzY4fDA&ixlib=rb-4.1.0&q=85";

function TrajectoryChart({ data }) {
  // SVG line chart for population, resources (scaled), avg_energy (scaled)
  if (!data.length) return null;
  const W = 320,
    H = 180,
    PAD = 24;
  const xs = data.map((d) => d.step);
  const maxStep = Math.max(...xs);
  const maxPop = Math.max(1, ...data.map((d) => d.population));
  const maxRes = Math.max(1, ...data.map((d) => d.resources));
  const maxEn = Math.max(1, ...data.map((d) => d.avg_energy));

  const xScale = (s) => PAD + ((s - 1) / Math.max(1, maxStep - 1)) * (W - PAD * 2);
  const popY = (v) => H - PAD - (v / maxPop) * (H - PAD * 2);
  const resY = (v) => H - PAD - (v / maxRes) * (H - PAD * 2);
  const enY = (v) => H - PAD - (v / maxEn) * (H - PAD * 2);

  const popPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.step)} ${popY(d.population)}`)
    .join(" ");
  const resPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.step)} ${resY(d.resources)}`)
    .join(" ");
  const enPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.step)} ${enY(d.avg_energy)}`)
    .join(" ");

  return (
    <div className="relative">
      <svg
        data-testid="trajectory-chart"
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
      >
        {/* grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={PAD}
            x2={W - PAD}
            y1={PAD + p * (H - PAD * 2)}
            y2={PAD + p * (H - PAD * 2)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
        ))}
        {/* axes */}
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.18)" />
        <line x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.18)" />
        {/* resources (amber) */}
        <path d={resPath} fill="none" stroke="#FFB800" strokeWidth="1.5" opacity="0.85" />
        {/* avg energy (success green) */}
        <path d={enPath} fill="none" stroke="#00FF41" strokeWidth="1.5" opacity="0.85" />
        {/* population (cyan) */}
        <path d={popPath} fill="none" stroke="#00F0FF" strokeWidth="2" />
        {/* population points */}
        {data.map((d) => (
          <circle
            key={d.step}
            cx={xScale(d.step)}
            cy={popY(d.population)}
            r="2"
            fill="#00F0FF"
          />
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-[10px] font-mono uppercase tracking-[0.2em]">
        <span className="flex items-center gap-1.5 text-cyan-300">
          <span className="block w-3 h-[2px] bg-[#00F0FF]" /> population
        </span>
        <span className="flex items-center gap-1.5 text-[#FFB800]">
          <span className="block w-3 h-[2px] bg-[#FFB800]" /> resources
        </span>
        <span className="flex items-center gap-1.5 text-[#7AFF9B]">
          <span className="block w-3 h-[2px] bg-[#00FF41]" /> avg energy
        </span>
      </div>
    </div>
  );
}

export default function UniverseScreen() {
  const [steps, setSteps] = useState(30);
  const [pop, setPop] = useState(5);
  const [res, setRes] = useState(500);
  const [prob, setProb] = useState(0.35);
  const [cons, setCons] = useState(4.0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await postSimulate({
        steps,
        initial_pop: pop,
        initial_resources: res,
        replication_prob: prob,
        consumption_per_entity: cons,
        source: "system",
      });
      setResult(r);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  const finalStats = useMemo(() => {
    if (!result?.trajectory?.length) return null;
    const last = result.trajectory[result.trajectory.length - 1];
    return last;
  }, [result]);

  return (
    <div className="space-y-4">
      <Panel
        title="UNIVERSE :: PHYSICAL CHAOS SIMULATION"
        right={
          <Btn intent="primary" testid="run-sim-btn" onClick={run} disabled={busy}>
            <Play size={12} weight="fill" className="inline mr-1.5 -mt-0.5" />
            {busy ? "Computing…" : "Run"}
          </Btn>
        }
        testid="universe-panel"
      >
        <div
          className="relative border border-white/10 overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(rgba(5,5,10,0.78), rgba(5,5,10,0.92)), url(${BG_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="p-4">
            {!result && !busy && (
              <div className="text-center py-12">
                <Planet size={42} weight="thin" className="mx-auto text-cyan-300 mb-3" />
                <Overline className="mb-2">Awaiting initial conditions</Overline>
                <div className="text-xs text-white/55 max-w-[260px] mx-auto leading-relaxed">
                  Each entity's origin will be derived from a fresh signed
                  entropy block. No cloning. Every birth is ledgered.
                </div>
              </div>
            )}
            {busy && (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <div className="mt-3 text-[11px] font-mono uppercase tracking-[0.22em] text-cyan-200">
                  Seeding origins · advancing steps · forging blocks
                </div>
              </div>
            )}
            {result && <TrajectoryChart data={result.trajectory} />}
          </div>
        </div>

        {error && (
          <div className="mt-3 border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A]">
            ERR :: {error}
          </div>
        )}
      </Panel>

      <Panel title="INITIAL CONDITIONS">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Slider testid="steps-slider" label="Steps" min={5} max={60} step={1} value={steps} onChange={setSteps} />
          <Slider testid="pop-slider" label="Initial pop" min={1} max={20} step={1} value={pop} onChange={setPop} />
          <Slider testid="res-slider" label="Resources" min={50} max={2000} step={50} value={res} onChange={setRes} suffix="" />
          <Slider testid="prob-slider" label="Repl. prob" min={0} max={1} step={0.05} value={prob} onChange={setProb} />
          <Slider testid="cons-slider" label="Cons / entity" min={0.5} max={10} step={0.1} value={cons} onChange={setCons} />
        </div>
      </Panel>

      {result && (
        <Panel title="EMERGENCE :: RESULTS" testid="universe-results">
          <StatLine
            label="Steps executed"
            value={result.steps_executed}
            valueClass="text-cyan-300"
            testid="result-steps"
          />
          <StatLine
            label="Final population"
            value={result.final_population}
            valueClass={result.final_population > 0 ? "text-[#7AFF9B]" : "text-[#FF6B8A]"}
            testid="result-final-pop"
          />
          <StatLine
            label="Unique origins"
            value={result.total_unique_origins}
            testid="result-origins"
          />
          {finalStats && (
            <>
              <StatLine label="Resources (end)" value={finalStats.resources.toFixed(1)} />
              <StatLine label="Avg energy (end)" value={finalStats.avg_energy.toFixed(2)} />
            </>
          )}
          <div className="mt-4">
            <Overline className="mb-2">Emergence pattern</Overline>
            <div
              data-testid="result-summary"
              className="font-mono text-sm text-cyan-200 border border-cyan-400/20 bg-cyan-400/[0.04] px-3 py-2"
            >
              {result.emergence_summary}
            </div>
          </div>
          <div className="mt-3 text-[10px] font-mono text-white/40 leading-relaxed">
            {result.note}
          </div>
        </Panel>
      )}
    </div>
  );
}
