import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  Aperture,
  Stack,
  Planet,
  IdentificationCard,
  ShieldCheck,
  Key,
  DotsThree,
} from "@phosphor-icons/react";
import HarvestScreen from "./screens/HarvestScreen";
import LedgerScreen from "./screens/LedgerScreen";
import UniverseScreen from "./screens/UniverseScreen";
import DeviceScreen from "./screens/DeviceScreen";
import PrivacyScreen from "./screens/PrivacyScreen";
import TokensScreen from "./screens/TokensScreen";
import VerifyPage from "./screens/VerifyPage";
import { getStatus } from "./lib/api";
import { useStarknet } from "./providers/StarknetProvider";

const TABS = [
  { id: "harvest", label: "Harvest", Icon: Aperture, Comp: HarvestScreen },
  { id: "tokens", label: "Tokens", Icon: Key, Comp: TokensScreen },
  { id: "ledger", label: "Ledger", Icon: Stack, Comp: LedgerScreen },
  { id: "universe", label: "Universe", Icon: Planet, Comp: UniverseScreen },
  { id: "device", label: "Device", Icon: IdentificationCard, Comp: DeviceScreen },
  { id: "pool", label: "Pool", Icon: ShieldCheck, Comp: PrivacyScreen },
];

const PRIMARY_IDS = ["harvest", "tokens", "pool"];
const MORE_IDS = ["ledger", "universe", "device"];
const PRIMARY_TABS = TABS.filter((t) => PRIMARY_IDS.includes(t.id));
const MORE_TABS = TABS.filter((t) => MORE_IDS.includes(t.id));

function shortAddr(addr) {
  if (!addr) return "";
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function TopBar({ status, onOpenPool }) {
  const ok = status?.chain_intact;
  const { address, capable } = useStarknet();
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
          <button
            type="button"
            data-testid="topbar-wallet"
            onClick={onOpenPool}
            className={`border px-2 py-[3px] ${
              address
                ? capable
                  ? "border-cyan-400/50 text-cyan-300"
                  : "border-[#FF6B8A]/50 text-[#FF6B8A]"
                : "border-white/15 text-white/55 hover:text-white/80"
            }`}
          >
            {address ? shortAddr(address) : "Connect"}
          </button>
        </div>
      </div>
    </header>
  );
}

function NavBtn({ id, label, Icon, isActive, onClick }) {
  return (
    <button
      data-testid={`nav-${id}`}
      onClick={onClick}
      className={`w-full py-3 flex flex-col items-center justify-center gap-1 transition-colors duration-150 ${
        isActive ? "text-cyan-300" : "text-white/45 hover:text-white/80"
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
      {isActive && <span className="block h-[2px] w-6 bg-cyan-300 -mb-[2px]" />}
    </button>
  );
}

function BottomNav({ active, onChange, moreOpen, onToggleMore }) {
  const moreActive = MORE_IDS.includes(active);
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-2xl bg-black/80 border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {moreOpen && (
        <div
          data-testid="more-sheet"
          className="border-b border-white/10 px-3 py-3 grid grid-cols-3 gap-2"
        >
          {MORE_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              data-testid={`nav-${id}`}
              onClick={() => onChange(id)}
              className={`py-3 border flex flex-col items-center gap-1 ${
                active === id
                  ? "border-cyan-400/60 text-cyan-300"
                  : "border-white/10 text-white/55 hover:text-white/80"
              }`}
            >
              <Icon size={18} weight={active === id ? "fill" : "regular"} />
              <span className="text-[9px] font-mono uppercase tracking-[0.2em]">
                {label}
              </span>
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-4">
        {PRIMARY_TABS.map(({ id, label, Icon }) => (
          <li key={id}>
            <NavBtn
              id={id}
              label={label}
              Icon={Icon}
              isActive={active === id}
              onClick={() => onChange(id)}
            />
          </li>
        ))}
        <li>
          <NavBtn
            id="more"
            label="More"
            Icon={DotsThree}
            isActive={moreOpen || moreActive}
            onClick={onToggleMore}
          />
        </li>
      </ul>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function MainApp() {
  const [active, setActive] = useState("harvest");
  const [moreOpen, setMoreOpen] = useState(false);
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
      <TopBar
        status={status}
        onOpenPool={() => {
          setMoreOpen(false);
          setActive("pool");
        }}
      />
      <main
        data-testid="app-main"
        className="max-w-md mx-auto px-4 py-4 pb-28 relative z-10"
      >
        <Active />
      </main>
      <BottomNav
        active={active}
        moreOpen={moreOpen}
        onToggleMore={() => setMoreOpen((o) => !o)}
        onChange={(id) => {
          setActive(id);
          setMoreOpen(MORE_IDS.includes(id));
        }}
      />
    </div>
  );
}
