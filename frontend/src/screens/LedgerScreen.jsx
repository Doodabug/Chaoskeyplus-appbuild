import React, { useEffect, useState } from "react";
import { ArrowClockwise, LinkSimple } from "@phosphor-icons/react";
import { getLedger } from "../lib/api";
import { Btn, HashLine, HealthBadge, Overline, Panel, SourceBadge } from "../components/ui";

function trunc(s, head = 10, tail = 6) {
  if (!s) return "";
  return s.length > head + tail ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

function ts(secs) {
  const d = new Date(secs * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export default function LedgerScreen() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

  async function load() {
    setLoading(true);
    try {
      const data = await getLedger({ limit: 50 });
      setBlocks(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <Panel
        title="LEDGER :: SIGNED ENTROPY CHAIN"
        right={
          <Btn intent="default" testid="ledger-refresh-btn" onClick={load} disabled={loading}>
            <ArrowClockwise size={12} className="inline mr-1.5 -mt-0.5" />
            {loading ? "Loading" : "Refresh"}
          </Btn>
        }
        testid="ledger-panel"
      >
        <div className="flex items-center justify-between mb-4 text-[11px] font-mono">
          <span className="text-white/40 uppercase tracking-[0.22em]">
            Blocks shown
          </span>
          <span data-testid="ledger-count" className="text-cyan-300">
            {blocks.length}
          </span>
        </div>

        {blocks.length === 0 && !loading && (
          <div className="text-center py-8 text-white/40 text-xs uppercase tracking-[0.22em]">
            Chain is empty. Harvest entropy to forge the first block.
          </div>
        )}

        <div className="relative">
          {/* vertical chain line */}
          {blocks.length > 1 && (
            <div className="absolute left-[14px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan-400/40 via-white/15 to-transparent" />
          )}

          <ul className="space-y-3">
            {blocks.map((b, i) => {
              const isOpen = !!expanded[b.block_id];
              return (
                <li
                  key={b.block_id}
                  data-testid={`ledger-block-${b.block_id}`}
                  className="relative pl-10"
                >
                  {/* node dot */}
                  <span
                    className={`absolute left-[8px] top-[18px] block h-[14px] w-[14px] border ${
                      b.health_state === "OK"
                        ? "border-[#00FF41] bg-[#00FF41]/20"
                        : "border-[#FF003C] bg-[#FF003C]/20"
                    }`}
                  />

                  <div className="border border-white/10 bg-white/[0.025] p-4">
                    <header className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          data-testid={`block-id-${b.block_id}`}
                          className="text-cyan-300 font-mono text-sm"
                        >
                          #{b.block_id}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                          {ts(b.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SourceBadge source={b.source} />
                        <HealthBadge state={b.health_state} />
                      </div>
                    </header>

                    <div className="grid grid-cols-1 gap-1 mb-2">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-white/40">mixed_hash</span>
                        <span className="text-white/80">{trunc(b.mixed_hash_hex)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-white/40 flex items-center gap-1">
                          <LinkSimple size={10} /> prev
                        </span>
                        <span className="text-white/55">{trunc(b.prev_block_hash_hex)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-white/40">sig</span>
                        <span className="text-[#7AFF9B]">{trunc(b.signature_hex)}</span>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                        <div>
                          <Overline className="mb-1">raw_hash</Overline>
                          <HashLine value={b.raw_hash_hex} />
                        </div>
                        <div>
                          <Overline className="mb-1">mixed_hash</Overline>
                          <HashLine value={b.mixed_hash_hex} />
                        </div>
                        <div>
                          <Overline className="mb-1">prev_block_hash</Overline>
                          <HashLine value={b.prev_block_hash_hex} />
                        </div>
                        <div>
                          <Overline className="mb-1">signature (Ed25519)</Overline>
                          <HashLine value={b.signature_hex} className="text-[#7AFF9B]" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-white/50">
                          <div>
                            <span className="text-white/40">ctx</span>: {b.context || "—"}
                          </div>
                          <div>
                            <span className="text-white/40">var</span>:{" "}
                            {(b.avg_variance ?? 0).toFixed(2)}
                          </div>
                          <div className="col-span-2">
                            <span className="text-white/40">reason</span>:{" "}
                            {b.health_reason || "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      data-testid={`block-toggle-${b.block_id}`}
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [b.block_id]: !p[b.block_id] }))
                      }
                      className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/40 hover:text-cyan-300 transition-colors"
                    >
                      {isOpen ? "− Collapse" : "+ Expand block"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>
    </div>
  );
}
