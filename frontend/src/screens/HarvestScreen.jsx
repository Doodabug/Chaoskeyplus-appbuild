import React, { useEffect, useRef, useState } from "react";
import { CameraRotate, Lightning, ShieldCheck, Pulse } from "@phosphor-icons/react";
import { ChaosCameraSession } from "../lib/chaosCamera";
import { postRandom } from "../lib/api";
import { Btn, HashLine, HealthBadge, Overline, Panel, SourceBadge, StatLine } from "../components/ui";

export default function HarvestScreen() {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState({ collected: 0, total: 0, variance: 0 });
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [numFrames, setNumFrames] = useState(12);
  const [length, setLength] = useState(64);
  const [contextLabel, setContextLabel] = useState("mobile_harvest");

  async function startCam() {
    setError("");
    try {
      const s = new ChaosCameraSession({ width: 160, height: 120, fps: 14 });
      await s.start(videoRef.current);
      sessionRef.current = s;
      setCamReady(true);
    } catch (e) {
      setError(e?.message || "Camera permission denied");
    }
  }

  function stopCam() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setCamReady(false);
  }

  useEffect(() => () => stopCam(), []);

  async function harvest() {
    if (!sessionRef.current) return;
    setBusy(true);
    setLast(null);
    try {
      const { frame_diffs_b64 } = await sessionRef.current.harvest({
        numFrames,
        onTick: setTick,
      });
      const r = await postRandom({
        length,
        context: contextLabel || "mobile_harvest",
        source: "camera",
        frame_diffs_b64,
      });
      setLast(r);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Harvest failed");
    } finally {
      setBusy(false);
    }
  }

  async function systemOnly() {
    setBusy(true);
    setLast(null);
    try {
      const r = await postRandom({
        length,
        context: contextLabel || "system_entropy",
        source: "system",
      });
      setLast(r);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="CAMERA :: PHYSICAL CHAOS INGEST" testid="harvest-panel">
        <div className="relative aspect-[4/3] border border-white/10 bg-black overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            data-testid="camera-video"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          {/* tracing bracket corners */}
          <span className="bracket-corner top-2 left-2 border-t-2 border-l-2" />
          <span className="bracket-corner top-2 right-2 border-t-2 border-r-2" />
          <span className="bracket-corner bottom-2 left-2 border-b-2 border-l-2" />
          <span className="bracket-corner bottom-2 right-2 border-b-2 border-r-2" />
          {/* scan beam */}
          {busy && (
            <div className="absolute inset-x-0 h-px bg-cyan-300 scan-beam shadow-[0_0_18px_2px_#00F0FF]" />
          )}
          {!camReady && (
            <div className="absolute inset-0 flex items-center justify-center text-center p-4">
              <div>
                <CameraRotate size={36} weight="thin" className="mx-auto text-cyan-300 mb-2" />
                <Overline className="mb-2">Camera offline</Overline>
                <div className="text-xs text-white/60 max-w-[240px] mx-auto leading-relaxed">
                  Tap below to grant camera access. Frames stay on-device; only
                  pixel-diff entropy is sent to the ledger.
                </div>
              </div>
            </div>
          )}
          {camReady && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <span className="block h-[6px] w-[6px] bg-[#00FF41] led-pulse text-[#00FF41]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#7AFF9B]">
                LIVE
              </span>
            </div>
          )}
          {busy && (
            <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-200">
              <span data-testid="harvest-progress">
                FRAMES {tick.collected}/{tick.total}
              </span>
              <span>VAR {tick.variance ? tick.variance.toFixed(1) : "—"}</span>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {!camReady ? (
            <Btn
              intent="primary"
              testid="start-camera-btn"
              onClick={startCam}
              className="col-span-2"
            >
              ▶ Initialise Camera
            </Btn>
          ) : (
            <>
              <Btn
                intent="primary"
                testid="harvest-btn"
                onClick={harvest}
                disabled={busy}
              >
                <Lightning size={14} weight="fill" className="inline mr-1.5 -mt-0.5" />
                {busy ? "Harvesting…" : "Harvest"}
              </Btn>
              <Btn intent="default" testid="stop-camera-btn" onClick={stopCam} disabled={busy}>
                Stop Camera
              </Btn>
            </>
          )}
          <Btn
            intent="default"
            testid="system-entropy-btn"
            onClick={systemOnly}
            disabled={busy}
            className="col-span-2"
          >
            <ShieldCheck size={14} weight="bold" className="inline mr-1.5 -mt-0.5" />
            Fallback :: SYSTEM ENTROPY
          </Btn>
        </div>

        {error && (
          <div
            data-testid="harvest-error"
            className="mt-3 border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A]"
          >
            ERR :: {error}
          </div>
        )}
      </Panel>

      <Panel title="REQUEST PARAMETERS">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Overline className="mb-1">Output bytes</Overline>
            <input
              data-testid="length-input"
              type="number"
              min={8}
              max={512}
              value={length}
              onChange={(e) => setLength(Math.max(8, Math.min(512, parseInt(e.target.value) || 8)))}
              className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none"
            />
          </label>
          <label className="block">
            <Overline className="mb-1">Frames / harvest</Overline>
            <input
              data-testid="frames-input"
              type="number"
              min={4}
              max={48}
              value={numFrames}
              onChange={(e) =>
                setNumFrames(Math.max(4, Math.min(48, parseInt(e.target.value) || 4)))
              }
              className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none"
            />
          </label>
          <label className="col-span-2 block">
            <Overline className="mb-1">Context label</Overline>
            <input
              data-testid="context-input"
              type="text"
              value={contextLabel}
              onChange={(e) => setContextLabel(e.target.value)}
              className="w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none"
            />
          </label>
        </div>
      </Panel>

      {last && (
        <Panel
          title="LAST BLOCK"
          right={
            <div className="flex items-center gap-2">
              <SourceBadge source={last.source} />
              <HealthBadge state={last.health_state} testid="last-health-badge" />
            </div>
          }
          testid="last-block-panel"
        >
          <StatLine label="block_id" value={`#${last.block_id}`} valueClass="text-cyan-300" testid="last-block-id" />
          <StatLine label="reason" value={last.health_reason} />
          <StatLine label="avg_var" value={last.avg_variance.toFixed(2)} />
          <StatLine label="length" value={`${last.random_hex.length / 2} B`} />
          <div className="mt-4">
            <Overline className="mb-2">random_hex</Overline>
            <HashLine
              testid="last-random-hex"
              value={last.random_hex}
              className="border border-cyan-400/20 bg-cyan-400/[0.04] p-3"
            />
          </div>
          <div className="mt-3">
            <Overline className="mb-2">mixed_hash</Overline>
            <HashLine value={last.mixed_hash_hex} />
          </div>
          <div className="mt-3">
            <Overline className="mb-2">signature (Ed25519)</Overline>
            <HashLine value={last.signature_hex} className="text-[#7AFF9B]" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-[0.22em]">
            <Pulse size={12} />
            Block appended &amp; signed. Chain advanced.
          </div>
        </Panel>
      )}
    </div>
  );
}
