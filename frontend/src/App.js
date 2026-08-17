import React, { useEffect, useState } from "react";
import {
  Aperture,
  Stack,
  Planet,
  IdentificationCard,
  Key,
} from "@phosphor-icons/react";
import HarvestScreen from "./screens/HarvestScreen";
import LedgerScreen from "./screens/LedgerScreen";
import UniverseScreen from "./screens/UniverseScreen";
import DeviceScreen from "./screens/DeviceScreen";
import TokensScreen from "./screens/TokensScreen";
import { getStatus } from "./lib/api";

const TABS = [
  { id: "harvest", label: "Harvest", Icon: Aperture, Comp: HarvestScreen },
  { id: "tokens", label: "Tokens", Icon: Key, Comp: TokensScreen },
  { id: "ledger", label: "Ledger", Icon: Stack, Comp: LedgerScreen },
  { id: "universe", label: "Universe", Icon: Planet, Comp: UniverseScreen },
  { id: "device", label: "Device", Icon: IdentificationCard, Comp: DeviceScreen },
];

function TopBar({ status }) {
  const ok = status?.chain_intact;
  return (
    <header className="sticky top-0 z-20 backdrop-blur-2xl bg-[#05050A]/80 border-b border-white/10">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="block h-[7px] w-[7px] bg-[#00F0FF] led-pulse"
            style={{ color: "#00F0FF" }}
          />
          <span className="font-display font-semibold tracking-tight text-[15px]">
            ChaosKey<span className="text-[#00F0FF]">+</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.24em] text-white/40 font-mono ml-1">
            M3
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.22em]">
          <span className="text-white/45">
            BLK{" "}
            <span data-testid="topbar-block-count" className="text-cyan-300">
              {status?.total_blocks ?? 0}
            </span>
          </span>
          <span
            data-testid="topbar-chain"
            className={ok ? "text-[#7AFF9B]" : "text-[#FF6B8A]"}
          >
            {ok ? "▣ CHAIN OK" : "▣ CHAIN ✗"}
          </span>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-2xl bg-black/80 border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                data-testid={`nav-${id}`}
                onClick={() => onChange(id)}
                className={`w-full py-3 flex flex-col items-center justify-center gap-1 transition-colors duration-150 ${
                  isActive
                    ? "text-cyan-300"
                    : "text-white/45 hover:text-white/80"
                }`}
              >
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
                <span
                  className={`text-[9px] font-mono uppercase tracking-[0.2em] ${
                    isActive ? "text-cyan-200" : "text-white/45"
                  }`}
                >
                  {label}
                </span>
                {isActive && (
                  <span className="block h-[2px] w-6 bg-cyan-300 -mb-[2px]" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function App() {
  const [active, setActive] = useState("harvest");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const s = await getStatus();
        if (mounted) setStatus(s);
      } catch (_) {
        /* ignore */
      }
    }
    poll();
    const t = setInterval(poll, 6000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [active]);

  const Active = TABS.find((t) => t.id === active)?.Comp || HarvestScreen;

  return (
    <div className="min-h-screen text-white grid-bg noise relative">
      <TopBar status={status} />
      <main
        data-testid="app-main"
        className="max-w-md mx-auto px-4 py-4 pb-28 relative z-10"
      >
        <Active />
      </main>
      <BottomNav active={active} onChange={setActive} />
    </div>
  );
}
