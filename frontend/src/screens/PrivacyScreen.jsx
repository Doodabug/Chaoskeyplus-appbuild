import React, { useEffect, useState } from "react";
import { ArrowUpRight, Eye, LinkSimple, Plugs, ShieldCheck } from "@phosphor-icons/react";
import { Btn, HashLine, Overline, Panel, StatLine } from "../components/ui";
import { useStarknet } from "../providers/StarknetProvider";
import {
  NOTE_MATURITY_BLOCKS,
  EXPECTED_CHAIN_ID,
  maxSpendHuman,
} from "../lib/starknetWalletUtils";

const inputClass =
  "w-full bg-transparent border border-white/15 px-3 py-2 text-sm text-white font-mono focus:border-cyan-400 outline-none";

function shortAddr(addr) {
  if (!addr) return "â€”";
  return addr.length > 16 ? `${addr.slice(0, 10)}â€¦${addr.slice(-6)}` : addr;
}

function onMainnet(chainId) {
  if (!chainId) return false;
  try {
    return BigInt(chainId) === BigInt(EXPECTED_CHAIN_ID);
  } catch (_) {
    return String(chainId).toLowerCase().includes("mainnet");
  }
}

export default function PrivacyScreen() {
  const starknet = useStarknet();
  const {
    pool,
    address,
    fetchFee,
    refreshMaturity,
    lastShieldBlock,
    maturityLeft,
  } = starknet;
  const [shieldAmt, setShieldAmt] = useState("");
  const [xferAmt, setXferAmt] = useState("");
  const [xferTo, setXferTo] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fee, setFee] = useState(null);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let live = true;
    fetchFee().then((f) => {
      if (live) setFee(f);
    });
    return () => {
      live = false;
    };
  }, [pool, address, fetchFee]);

  useEffect(() => {
    if (!lastShieldBlock || maturityLeft <= 0) return undefined;
    let live = true;
    const tick = async () => {
      if (!live) return;
      await refreshMaturity();
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [lastShieldBlock, maturityLeft, refreshMaturity]);

  async function onConnect(wallet) {
    setError(null);
    setBusy("connect");
    try {
      await starknet.connect(wallet);
    } catch (e) {
      setError({ kind: e?.kind || "unknown", message: e?.message || "Connect failed." });
    } finally {
      setBusy("");
    }
  }

  async function onDisconnect() {
    setError(null);
    setResult(null);
    setBalance(null);
    await starknet.disconnect();
  }

  async function runAction(kind, fn) {
    setError(null);
    setResult(null);
    setBusy(kind);
    try {
      const r = await fn();
      setResult({ ...r, kind });
    } catch (e) {\n      setError({ kind: e?.kind || "unknown", message: e?.message || "Action failed." });
    } finally {
      setBusy("");
    }
  }

  async function onShowBalance() {
    setError(null);
    setBusy("balance");
    try {
      const b = await starknet.fetchBalances();
      setBalance(b);
    } catch (e) {
      setError({ kind: e?.kind || "unknown", message: e?.message || "Balance read failed." });
    } finally {
      setBusy("");
    }
  }

  function applyMax(setter) {
    if (balance?.raw == null) return;
    setter(maxSpendHuman(balance.raw, fee?.raw ?? 0n));
  }

  const connected = !!starknet.address;
  const capable = starknet.capable;
  const mainnet = onMainnet(starknet.chainId);
  const locked = starknet.maturityLeft > 0;
  const spendDisabled = !!busy || locked;

  return (
    <div className="space-y-4">
      <Panel
        title="WALLET"
        testid="pool-wallet-panel"
        right={
          connected ? (
            <Btn intent="default" testid="pool-disconnect-btn" onClick={onDisconnect}>
              Disconnect
            </Btn>
          ) : null
        }
      >
        {!connected && (
          <>
            <p className="text-[12px] font-mono text-white/60 leading-relaxed mb-4">
              Connect Ready on Starknet Mainnet. The wallet holds keys, notes, and
              proofs â€” this app never sees them.
            </p>
            {starknet.wallets.length === 0 && (
              <div
                data-testid="pool-no-wallets"
                className="border border-white/10 px-3 py-4 text-center space-y-3"
              >
                <p className="text-[11px] font-mono text-white/55 leading-relaxed">
                  No wallets detected in this browser. Pool needs the Ready X
                  extension on Mainnet.
                </p>
                <a
                  data-testid="pool-install-ready"
                  href="https://chromewebstore.google.com/detail/ready-x/dlcobpjiigpikoobohmabehhmhfoodbb"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center border border-cyan-400/60 text-cyan-300 hover:border-cyan-200 hover:text-cyan-100 hover:bg-cyan-400/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em]"
                >
                  Install Ready X
                </a>
              </div>
            )}
            <ul className="space-y-2">
              {starknet.wallets.map((w) => (
                <li
                  key={w.id || w.name}
                  className="flex items-center justify-between gap-3 border border-white/10 px-3 py-2"
                >
                  <span className="font-mono text-xs text-white/80 truncate">
                    {w.name || w.id || "Wallet"}
                  </span>
                  <Btn
                    intent="primary"
                    testid={`pool-connect-${w.id || w.name}`}
                    onClick={() => onConnect(w)}
    -š\ØX›Y^ÈHX\Þ_Bˆ‚ˆYÜÈÚ^™O^ÌLŸHÛ\ÜÓ˜[YOHš[›[™H\‹LKH[]LHˆÏ‚ˆØ\ÞHOOH˜ÛÛ›™XÝˆÈÛÛ›™XÝ[™ÈˆˆÛÛ›™XÝŸBˆÐ‚ˆÛO‚ˆ
J_BˆÝ[‚ˆÏ‚ˆ
_B‚ˆØÛÛ›™XÝY	‰ˆ
ˆ‚ˆÝ][™BˆX™[H•Ø[]‚ˆ˜[YO^ÜÝ\šÛ™]Ø[]˜[Y_Bˆ˜[YPÛ\ÜÏH^XÞX[‹LÌ‚ˆ\ÝYHœÛÛ]Ø[][˜[YH‚ˆÏ‚ˆÝ][™BˆX™[HY™\ÜÈ‚ˆ˜[YO^ÜÚÜYŠÝ\šÛ™]˜Y™\ÜÊ_Bˆ\ÝYHœÛÛXY™\ÜÈ‚ˆÏ‚ˆÝ][™BˆX™[H“™]ÛÜšÈ‚ˆ˜[YO^ÛXZ[›™]È“XZ[›™]ˆˆÝ\šÛ™]˜ÚZ[’Y¸ %ŸBˆ˜[YPÛ\ÜÏ^ÛXZ[›™]È^VÈÍÐQ‘ŽP—Hˆˆ^VÈÑ‘ŽWHŸBˆ\ÝYHœÛÛ[™]ÛÜšÈ‚ˆÏ‚ˆÝ][™BˆX™[H”Õ’ÌŒTH‚ˆ˜[YO^ØØ\X›HÈ˜Ø\X›Hˆˆ[œÝ\ÜYŸBˆ˜[YPÛ\ÜÏ^ØØ\X›HÈ^VÈÍÐQ‘ŽP—Hˆˆ^VÈÑ‘ŽWHŸBˆ\ÝYHœÛÛXØ\Xš[]H‚ˆÏ‚ˆÈ[XZ[›™]	‰ˆ
ˆ]ˆÛ\ÜÓ˜[YOH›]LÈÜXÙK^KLˆ‚ˆÛ\ÜÓ˜[YOH^VÌL\H›Û[[Û›È^VÈÑ‘ŽWHXY[™Ë\™[^Y‚ˆÛÛXÝ[ÛœÈ\™HXZ[›™][Û›KˆÝÚ]ÚHØ[]™]ÛÜšË[ˆ™]žK‚ˆÜ‚ˆ‚ˆ[[Hœš[X\žH‚ˆ\ÝYHœÛÛ\ÝÚ]Ú[XZ[›™]Xˆ‚ˆÛÛXÚÏ^Ê
HOˆÛÛÛ›™XÝ
Ý\šÛ™]Ø[]
_Bˆ\ØX›Y^ÈHX\ÞH\Ý\šÛ™]Ø[]Bˆ‚ˆÝÚ]ÚÈXZ[›™]ˆÐ‚ˆÙ]‚ˆ
_BˆÏ‚ˆ
_BˆÔ[™[‚‚ˆØÛÛ›™XÝY	‰ˆXØ\X›H	‰ˆ
ˆ[™[]OH•S”ÕTÔ•QÐSUˆ\ÝYHœÛÛ][œÝ\ÜY‚ˆÛ\ÜÓ˜[YOH^VÌLœH›Û[[Û›È^]Ú]KÍÌXY[™Ë\™[^Y‚ˆ™YYÈHÕ’ÌŒXØ\X›HØ[]
™XYJKˆœ˜X]›ÜËš]žK[™Ý\‚ˆØ[]È\™H›Ý™\\™Y›ÜˆÛÛXÝ[ÛœËˆÚY[˜[œÙ™\‹[™ˆ[œÚY[\™HY[‹‚ˆÜ‚ˆÔ[™[‚ˆ
_B‚ˆØÛÛ›™XÝY	‰ˆØ\X›H	‰ˆXZ[›™]	‰ˆ
ˆ‚ˆ[™[]OH”ÒQSQSSÑHˆ\ÝYHœÛÛX˜[[˜ÙK\[™[‚ˆÛ\ÜÓ˜[YOH^VÌLœH›Û[[Û›È^]Ú]KÍŒXY[™Ë\™[^YX‹M‚ˆHØ[]Ú[\ÚÈÈÚ\™H[Ý\ˆÚY[YÕ’È˜[[˜ÙKˆ\È\ˆÙ\È›Ý™XY›Ý\ÈÜˆÙ^\ÎÈÚÚ\\ÈYˆ[ÝHÛ›HØ[ÈXÝ‚ˆÜ‚ˆØ˜[[˜ÙHÈ
ˆÝ][™BˆX™[H”ÚY[YÕ’È‚ˆ˜[YO^Ø˜[[˜ÙKš[X[ŸBˆ˜[YPÛ\ÜÏH^XÞX[‹LÌ‚ˆ\ÝYHœÛÛX˜[[˜ÙK]˜[YH‚ˆÏ‚ˆ
Hˆ
ˆ‚ˆ[[H™Y˜][‚ˆ\ÝYHœÛÛX˜[[˜ÙKXˆ‚ˆÛÛXÚÏ^ÛÛ”ÚÝÐ˜[[˜Ù_Bˆ\ØX›Y^ÈHX\Þ_Bˆ‚ˆ^YHÚ^™O^ÌLŸHÛ\ÜÓ˜[YOHš[›[™H\‹LKH[]LHˆÏ‚ˆØ\ÞHOOH˜˜[[˜ÙHˆÈ•ØZ][™ÈÛˆØ[]ˆˆ”ÚÝÈÚY[Y˜[[˜ÙHŸBˆÐ‚ˆ
_BˆÔ[™[‚‚ˆ[™[]OH”ÒQSŽˆSSÕS•P“PÈˆ\ÝYHœÛÛ\ÚY[\[™[‚ˆÛ\ÜÓ˜[YOH^VÌLœH›Û[[Û›È^]Ú]KÍŒXY[™Ë\™[^YX‹M‚ˆX›XÈÕ’È8¡¤ˆ[˜Üž\Y›ÝKˆH\ÜÚ][[Ý[Ý^\ÈX›XË‚ˆÈ›Ý[™H\ÈÚ]Hš]˜]H˜[œÙ™\‹‚ˆÜ‚ˆX™[Û\ÜÓ˜[YOH˜›ØÚÈX‹M‚ˆÝ™\›[™HÛ\ÜÓ˜[YOH›X‹LH[[Ý[
Õ’ÊOÓÝ™\›[™O‚ˆ[œ]ˆ]K]\ÝYHœÛÛX[[Ý[Z[œ]‚ˆ\OH^‚ˆ[œ][ÙOH™XÚ[X[‚ˆ˜[YO^ÜÚY[[]BˆÛÚ[™ÙO^ÊJHOˆÙ]ÚY[[]
K\™Ù]˜[YJ_BˆÛ\ÜÓ˜[YO^Ú[œ]Û\ÜßBˆÏ‚ˆÛX™[‚ˆ]ˆÛ\ÜÓ˜[YOH˜›Ü™\ˆ›Ü™\‹]Ú]KÌL™Ë]Ú]KÖÌŒ×HLÈKLÈX‹MÜXÙK^KLˆ‚ˆÛ\ÜÓ˜[YOH^VÌL\H›Û[[Û›È^]Ú]KÍMHXY[™Ë\™[^Y‚ˆHØ[]Ú[›Û\ÚXÙNˆš\œÝHX›XÈTËLŒ\›Ý™K[‚ˆHš]˜]H\ÜÚ]ˆ›Ý\™H™\]Z\™Y‚ˆÜ‚ˆÛ\ÜÓ˜[YOH^VÌL\H›Û[[Û›È^]Ú]KÍMHXY[™Ë\™[^Y‚ˆÙžYOË˜]˜Z[X›BˆÈÛÛ™YH	Ù™YKš[X[ŸHÕ’È\ˆš]˜]HÜ\˜][Û‹ˆÝX˜XÝYœ›ÛHPVˆÙ\\˜]Hœ›ÛH™]ÛÜšÈØ\Ë˜ˆˆ”ÛÛ™YH[˜]˜Z[X›H[[‘PPÕÐTÔÕ’ÌŒÔÓÓ\ÈÙ]ˆÙ\\˜]Hœ›ÛH™]ÛÜšÈØ\ËˆŸBˆÜ‚ˆÙ]‚ˆ‚ˆ[[Hœš[X\žH‚ˆ\ÝYHœÛÛ\ÚY[Xˆ‚ˆÛÛXÚÏ^Ê
HOˆ[XÝ[ÛŠœÚY[‹

HOˆÝ\šÛ™]œÚY[
ÚY[[]
J_Bˆ\ØX›Y^ÈHX\ÞH\ÚY[[]BˆÛ\ÜÓ˜[YOHËY[‚ˆ‚ˆÚY[ÚXÚÈÚ^™O^ÌMHÙZYÚH˜›ÛˆÛ\ÜÓ˜[YOHš[›[™H\‹LKH[]LHˆÏ‚ˆØ\ÞHOOHœÚY[ˆÈ]ØZ][™ÈØ[]È›ÛÙˆˆˆ”ÚY[ŸBˆÐ‚ˆÔ[™[‚‚ˆÛØÚÙY	‰ˆ
ˆ]ˆˆ]K]\ÝYHœÛÛ[X]\š]H‚ˆÛ\ÜÓ˜[YOH˜›Ü™\ˆ˜›Ü™\‹XÞX[‹MÌÌ™ËXÞX[‹MÍHLÈKLˆ^VÌL\H›Û[[Û›È^XÞX[‹LŒ‚ˆœ™\ÚHÚY[Y›Ý\ÈX]\™H[ˆžÓ“ÕWÓPUT’UWÐ“ÐÒÔßH›ØÚÜË‚ˆ˜[œÙ™\ˆ[™[œÚY[ØÚÙY›ÜˆÜÝ\šÛ™]›X]\š]SYH[Ü™BˆÜÝ\šÛ™]›X]\š]SYOOHHÈˆ›ØÚÈˆˆˆ›ØÚÜÈŸK‚ˆÙ]‚ˆ
_B‚ˆ[™[]OH”’UUHS”Ñ‘TˆŽˆQSˆˆ\ÝYHœÛÛ]˜[œÙ™\‹\[™[‚ˆÛ\ÜÓ˜[YOH^VÌLœH›Û[[Û›È^]Ú]KÍŒXY[™Ë\™[^YX‹M‚ˆš]˜]H˜[œÙ™\ˆ
Ù[™\‹™XÙZ]™\‹[[Ý[Y[ŠKˆ™XÚ\Y[]\Ýˆ[™XYH™H™YÚ\Ý\™Yˆ›ÝÛÛ\ÜÙYÚ]HÚY[‚ˆÜ‚ˆX™[Û\ÜÓ˜[YOH˜›ØÚÈX‹LÈ‚ˆÝ™\›[™HÛ\ÜÓ˜[YOH›X‹LH”™XÚ\Y[ÓÝ™\›[™O‚ˆ[œ]ˆ]K]\ÝYHœÛÛ]˜[œÙ™\‹]È‚ˆ\OH^‚ˆ˜[YO^Þ™\•ßBˆÛÚ[™ÙO^ÊJHOˆÙ]™\•ÊK\™Ù]˜[YJ_BˆXÙZÛ\HŒ8 )ˆ‚ˆÛ\ÜÓ˜[YO^Ú[œ]Û\ÜßBˆ\ØX›Y^ÜÜ[™\ØX›YBˆÏ‚ˆÛX™[‚ˆX™[Û\ÜÓ˜[YOH˜›ØÚÈX‹M‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆX‹LH‚ˆÝ™\›[™O[[Ý[
Õ’ÊOÓÝ™\›[™O‚ˆØ˜[[˜ÙH	‰ˆ
ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆ]K]\ÝYHœÛÛ]˜[œÙ™\‹[X^‚ˆÛ\ÜÓ˜[YOH^VÌLH›Û[[Û›È\\˜Ø\ÙH˜XÚÚ[™ËVÌŒN[WH^XÞX[‹LÌ‚ˆÛÚ[™ÙO^Ê
HOˆ\SX^
Ù]™\[]
_Bˆ‚ˆX^ˆØ]Û‚ˆ
_BˆÙ]‚ˆ[œ]ˆ]K]\ÝYHœÛÛ]˜[œÙ™\‹X[[Ý[‚ˆ\OH^‚ˆ[œ][ÙOH™XÚ[X[‚ˆ˜[YO^Þ™\[]BˆÛÚ[™ÙO^ÊJHOˆÙ]™\[]
K\™Ù]˜[YJ_BˆÛ\ÜÓ˜[YO^Ú[œ]Û\ÜßBˆ\ØX›Y^ÜÜ[™\ØX›YBˆÏ‚ˆÛX™[‚ˆ‚ˆ[[Hœš[X\žH‚ˆ\ÝYHœÛÛ]˜[œÙ™\‹Xˆ‚ˆÛÚ[™ÙO^Ê
HOˆ[XÝ[ÛŠ˜[œÙ™\ˆ‹

HOˆÝ\šÛ™]˜[œÙ™\Š™\[]™\•ÊJ_Bˆ\ØX›Y^ÜÜ[™\ØX›Y^™\[]^™\•ßBˆÛ\ÜÓ˜[YOHËY[‚ˆ‚ˆ\œ›ÝÕ\šYÚÚ^™O^ÌMHÛ\ÜÓ˜[YOHš[›[™H\‹LKH[]LHˆÏ‚ˆØ\ÞHOOH˜[œÙ™\ˆˆÈ]ØZ][™ÈØ[]È›ÛÙˆˆˆ”š]˜]H˜[œÙ™\ˆŸBˆÐ‚ˆÔ[™[‚‚ˆ[™[]OH•S”ÒQSŽˆSSÕS•P“PÈˆ\ÝYHœÛÛ][œÚY[\[™[‚ˆÛ\ÜÓ˜[YOH^VÌLœH›Û[[Û›È^]Ú]KÍŒXY[™Ë\™[^YX‹M‚ˆÚY[È[œÚY[
[[Ý[X›XÊKˆÚ]˜]ÜÈÕ’ÈÈHX›XÂˆY™\ÜËˆY˜][ÈÈ[Ý\ˆÛÛ›™XÝYØ[]‚ˆÜ‚ˆX™[Û\ÜÓ˜[YOH˜›ØÚÈX‹LÈ‚ˆÝ™\›[™HÛ\ÜÓ˜[YOH›X‹LH”X›XÈ™XÚ\Y[ÓÝ™\›[™O‚ˆ[œ]ˆ]K]\ÝYHœÛÛ][œÚY[]È‚ˆ^H^‚ˆ˜[YO^ÝÚ]˜]ÕÈœŸBˆÛÚ[™ÙO^ÊJHOˆÙ]Ú]˜]ÕÊK\™Ù]˜[YJ_BˆXÙZÛ\^ÜÝ\šÛ™]˜Y™\ÜÈŒ8 &ŸBˆÛ\ÜÓ˜[YO^Ú[œ]Û\ÜßBˆ\ØX›Y^ÜÜ[™\ØX›YBˆÏ‚ˆåi·¥>
            <label className="block mb-4">
              <div className="flex items-center justify-between mb-1">
                <Overline>Amount (STRK)</Overline>
                {balance && (
                  <button
                    type="button"
                    data-testid="pool-unshield-max"
                    className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300"
                    onChange={() => applyMax(setWithdrawAmt)}
                  >
                    Max
                  </button>
                )}
              </div>
              <input
                data-testid="pool-unshield-amount"
                text="text"
                inputMode="decimal"
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
                className={inputClass}
                disabled={spendDisabled}
              />
            </label>
            <Btn
              intent="primary"
              testid="pool-unshield-btn"
              onChange={() =>
                runAction("unshield", () =>
                  starknet.unshield(withdrawAmt, withdrawTo || starknet.address)
                )
              }
              disabled={spendDisabled || !withdrawAmt}
              className="w-full"
            >
              {busy === "unshield" ? "Awaiting wallet / proof" : "Unshield"}
            </Btn>
          </Panel>
        </>
      )}

      {error && (
        <div
          data-testid="pool-error"
          data-kind={error.kind}
          className="border border-[#FF003C]/50 bg-[#FF003C]/5 px-3 py-2 text-[11px] font-mono text-[#FF6B8A] leading-relaxed">
          {error.kind === "screening"
            ? error.message
            : `ERR :: ${error.message}`u}
        </div>
      )}

      {result && (
        <Panel title=`{${(result.kind || "action").toUpperCase()} RESULT` testid="pool-result-panel">
          <StatLine
            label="Status"
            value={result.status === "accepted" ? "accepted" : "submitted"}
            valueClass="text-cyan-300"
            testid="pool-result-status"
          />
          <div className="py-2">
            <Overline className="mb-1">Transaction</Overline>
            <HashLine testid="pool-tx-hash" value={result.hash || "â€•"} />
          </div>
          {result.explorer && (
            <a
              data-testid="pool-explorer-link"
              href={result.explorer}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 hover:text-cyan-100 uppercase tracking-[0.18em]"
            >
              <LinkSimple size={12} />
              Explorer
            </a>
          )}
          {result.status === "submitted" && (
            <p className="mt-3 text-[11px] font-mono text-white/45 leading-relaxed">
              Confirmation timed out. The transaction was submitted â†’ check the
              explorer.
            </p>
          )}
        </Panel>
      )}

      <Panel title="WHAT STAYS VISIBLE">
        <p className="text-[12px] font-mono text-white/55 leading-relaxed">
          Shield and unshield amounts are public ERC-20 legs. The fact and
          timing of a pool interaction are public. Private transfers hide who
          pays whom and how much. This is not a mixer.
        </p>
      </Panel>
    </div>
  );
}
