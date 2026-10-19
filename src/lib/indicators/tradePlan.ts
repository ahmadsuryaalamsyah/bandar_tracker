import { computeAtr } from "./atr";
import type { IndicatorConfig } from "./config";
import { findSwingPoints, nearestResistance, nearestSupport } from "./levels";
import { clamp } from "./normalize";
import type { Candle, SignalAnalysis, TradePlan, TradePlanGate } from "./types";
import { formatMoney } from "@/lib/utils/format";

/** Toleransi floating-point untuk perbandingan R:R ≥ threshold. */
const FLOAT_EPSILON = 1e-9;

export interface TradePlanInput {
  candles: Candle[];
  analysis: SignalAnalysis;
  config: IndicatorConfig;
}



/**
 * Trade Plan (swing harian) — indikatif, bukan rekomendasi investasi.
 *
 * Level:
 *   support    = swing low terdekat di bawah harga (≤ supportSearchAtr × ATR)
 *   resistance = swing high terdekat di atas harga (≤ resistanceSearchAtr × ATR)
 *   entry      = harga close terakhir
 *   stop       = support − buffer·ATR  (fallback: close − stopAtrMultiple·ATR)
 *   target     = resistance            (fallback: close + targetAtrMultiple·ATR)
 *   R:R        = (target − entry) / (entry − stop)
 *   horizon    = (target − entry) / (horizonEfficiency · ATR)   [hari bursa]
 *
 * Arah `Long` hanya bila SEMUA gate lolos; jika tidak → `No Trade` + alasan.
 */
export function buildTradePlan({ candles, analysis, config }: TradePlanInput): TradePlan {
  const cfg = config.tradePlan;
  const last = candles.length - 1;

  const base: TradePlan = {
    direction: "No Trade",
    valid: false,
    entry: null,
    stop: null,
    target: null,
    rewardRisk: null,
    horizonDays: null,
    stopBasis: null,
    targetBasis: null,
    atr: 0,
    avgValue: 0,
    gates: [],
    note: null,
    basis: [],
  };

  if (last < 0) return { ...base, note: "Tidak ada data." };

  const close = candles[last].c;
  const atr = computeAtr(candles, cfg.atrPeriod)[last];

  if (!Number.isFinite(atr) || atr <= 0 || !Number.isFinite(close) || close <= 0) {
    return { ...base, note: "Volatilitas (ATR) tidak dapat diukur dari data ini." };
  }

  const levelStart = Math.max(0, last - cfg.levelLookback + 1);
  const swings = findSwingPoints(candles, cfg.pivotRadius, levelStart);
  const support = nearestSupport(swings.lows, close, cfg.supportSearchAtr * atr);
  const resistance = nearestResistance(swings.highs, close, cfg.resistanceSearchAtr * atr);

  const stop = support ? support.price - cfg.stopBufferAtr * atr : close - cfg.stopAtrMultiple * atr;
  const target = resistance ? resistance.price : close + cfg.targetAtrMultiple * atr;
  const risk = close - stop;
  const reward = target - close;
  const rewardRisk = risk > 0 ? reward / risk : 0;

  const horizonDays =
    reward > 0
      ? Math.round(
          clamp(reward / (atr * cfg.horizonEfficiency), cfg.minHorizonDays, cfg.maxHorizonDays),
        )
      : null;

  // Likuiditas diukur pada window lebih panjang (konteks volume), terpisah dari
  // window deteksi level agar tidak terlalu sensitif pada beberapa bar terakhir.
  const liquidityStart = Math.max(0, last - config.signalEngine.rangeLookback + 1);
  let valueSum = 0;
  let count = 0;
  for (let i = liquidityStart; i <= last; i += 1) {
    valueSum += candles[i].c * candles[i].v;
    count += 1;
  }
  const avgValue = count > 0 ? valueSum / count : 0;

  const trendGate: TradePlanGate =
    cfg.trendGate === "above-sma20"
      ? { label: "Harga di atas SMA20", passed: analysis.trend.closeVsSma20 > 0 }
      : { label: "Trend bullish", passed: analysis.trend.label === "Bullish" };

  const gates: TradePlanGate[] = [
    trendGate,
    { label: "Momentum tidak lemah", passed: analysis.momentum.label !== "Weak" },
  ];

  if (cfg.requireVolumeExpansion) {
    gates.push({ label: "Volume mengembang", passed: analysis.volume.label !== "Contracting" });
  }

  gates.push(
    { label: "Risiko tidak tinggi", passed: !cfg.blockHighRisk || analysis.risk.label !== "High" },
    { label: `R:R ≥ ${cfg.minRewardRisk}`, passed: rewardRisk >= cfg.minRewardRisk - FLOAT_EPSILON },
    { label: "Likuiditas cukup", passed: avgValue >= cfg.minAvgValue },
  );

  const firstFail = gates.find((gate) => !gate.passed);
  const notes: Record<string, string> = {
    "Trend bullish": "Trend belum bullish — belum ada setup long.",
    "Harga di atas SMA20": "Harga masih di bawah SMA20 — belum ada dorongan jangka pendek.",
    "Momentum tidak lemah": "Momentum lemah — hindari entry melawan tekanan jual.",
    "Volume mengembang": "Volume berkontraksi — gerak 1-3 hari butuh partisipasi volume.",
    "Risiko tidak tinggi": "Risiko tinggi (harga tertekan / terlalu jauh dari rata-rata).",
    [`R:R ≥ ${cfg.minRewardRisk}`]: `Reward/risk ${rewardRisk.toFixed(2)} < ${cfg.minRewardRisk} — resistance terlalu dekat relatif jarak stop.`,
    "Likuiditas cukup": `Nilai transaksi rata-rata Rp ${formatMoney(avgValue)} di bawah ambang Rp ${formatMoney(cfg.minAvgValue)} — saham kurang likuid.`,
  };

  const basis: string[] = [
    `Trend ${analysis.trend.label}`,
    `Momentum ${analysis.momentum.label}`,
    support ? `Stop di bawah support ${support.price.toFixed(0)}` : `Stop ${cfg.stopAtrMultiple}×ATR`,
    resistance ? `Target di resistance ${resistance.price.toFixed(0)}` : `Target ${cfg.targetAtrMultiple}×ATR`,
    `ATR ${atr.toFixed(1)}`,
  ];

  return {
    direction: firstFail ? "No Trade" : "Long",
    valid: !firstFail,
    entry: close,
    stop,
    target,
    rewardRisk,
    horizonDays,
    stopBasis: support ? "support" : "atr",
    targetBasis: resistance ? "resistance" : "atr",
    atr,
    avgValue,
    gates,
    note: firstFail ? (notes[firstFail.label] ?? `Gate gagal: ${firstFail.label}`) : null,
    basis,
  };
}
