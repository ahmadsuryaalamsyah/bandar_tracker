import type { OhlcvBar } from "@/lib/data/types";
import type { Candle, IndicatorPoint } from "./types";

export type BandarStatus =
  | "Big Acc"
  | "Normal Acc"
  | "Small Acc"
  | "Neutral"
  | "Small Dist"
  | "Normal Dist"
  | "Big Dist";

export interface BandarMatrixPeriod {
  label: string;
  days: number;
  status: BandarStatus;
  avgLpm: number;
  netFlow: number;
  avgRvol: number;
  priceChangePct: number;
}

export function classifyBandarStatus(avgLpm: number, netFlow: number): BandarStatus {
  // Kombinasi avgLpm dan netFlow
  if (avgLpm >= 64 || (avgLpm >= 60 && netFlow > 3)) return "Big Acc";
  if (avgLpm >= 56 || (avgLpm >= 53 && netFlow > 1)) return "Normal Acc";
  if (avgLpm >= 51.5 || netFlow > 0.3) return "Small Acc";
  if (avgLpm <= 36 || (avgLpm <= 40 && netFlow < -3)) return "Big Dist";
  if (avgLpm <= 44 || (avgLpm <= 47 && netFlow < -1)) return "Normal Dist";
  if (avgLpm <= 48.5 || netFlow < -0.3) return "Small Dist";
  return "Neutral";
}

export function getBandarStatusStyle(status: BandarStatus): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case "Big Acc":
      return {
        bg: "bg-emerald-500/25",
        text: "text-emerald-300 font-bold",
        border: "border-emerald-500/50",
        dot: "bg-emerald-400",
      };
    case "Normal Acc":
      return {
        bg: "bg-emerald-500/15",
        text: "text-emerald-400 font-semibold",
        border: "border-emerald-500/30",
        dot: "bg-emerald-400",
      };
    case "Small Acc":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-300",
        border: "border-emerald-500/20",
        dot: "bg-emerald-300",
      };
    case "Big Dist":
      return {
        bg: "bg-rose-500/25",
        text: "text-rose-300 font-bold",
        border: "border-rose-500/50",
        dot: "bg-rose-400",
      };
    case "Normal Dist":
      return {
        bg: "bg-rose-500/15",
        text: "text-rose-400 font-semibold",
        border: "border-rose-500/30",
        dot: "bg-rose-400",
      };
    case "Small Dist":
      return {
        bg: "bg-rose-500/10",
        text: "text-rose-300",
        border: "border-rose-500/20",
        dot: "bg-rose-300",
      };
    default:
      return {
        bg: "bg-surface-elevated",
        text: "text-fg-muted font-medium",
        border: "border-line",
        dot: "bg-fg-subtle",
      };
  }
}

const PERIOD_CONFIGS = [
  { label: "1D", days: 1 },
  { label: "3D", days: 3 },
  { label: "5D (1W)", days: 5 },
  { label: "10D (2W)", days: 10 },
  { label: "20D (1M)", days: 20 },
];

export function computeBandarMatrix(
  bars: Array<{ c: number } | OhlcvBar | Candle>,
  indicators: IndicatorPoint[],
): BandarMatrixPeriod[] {
  if (bars.length === 0 || indicators.length === 0) return [];

  const total = indicators.length;
  const lastClose = bars[bars.length - 1].c;

  return PERIOD_CONFIGS.map((cfg) => {
    const lookback = Math.min(cfg.days, total);
    const startIdx = total - lookback;

    let sumLpm = 0;
    let sumFlow = 0;
    let sumRvol = 0;

    for (let i = startIdx; i < total; i += 1) {
      sumLpm += indicators[i].lpm;
      sumFlow += indicators[i].lpRaw;
      sumRvol += indicators[i].rvol;
    }

    const avgLpm = Number((sumLpm / lookback).toFixed(1));
    const netFlow = Number(sumFlow.toFixed(2));
    const avgRvol = Number((sumRvol / lookback).toFixed(2));

    const initialClose = bars[startIdx].c;
    const priceChangePct =
      initialClose > 0 ? Number((((lastClose - initialClose) / initialClose) * 100).toFixed(2)) : 0;

    const status = classifyBandarStatus(avgLpm, netFlow);

    return {
      label: cfg.label,
      days: cfg.days,
      status,
      avgLpm,
      netFlow,
      avgRvol,
      priceChangePct,
    };
  });
}

export interface BandarMovementPoint {
  t: number;
  /** Nilai kumulatif pergerakan bandar */
  movement: number;
  /** MA 10 dari pergerakan bandar untuk sinyal turning point */
  signalMa: number;
  /** Net flow harian (bar) */
  dailyNet: number;
}

export function computeBandarMovementSeries(
  indicators: IndicatorPoint[],
  maPeriod = 10,
): BandarMovementPoint[] {
  if (indicators.length === 0) return [];

  let cum = 0;
  const cumValues: number[] = [];

  for (let i = 0; i < indicators.length; i += 1) {
    cum += indicators[i].lpRaw;
    cumValues.push(cum);
  }

  const result: BandarMovementPoint[] = [];

  for (let i = 0; i < indicators.length; i += 1) {
    const start = Math.max(0, i - maPeriod + 1);
    let sum = 0;
    for (let k = start; k <= i; k += 1) {
      sum += cumValues[k];
    }
    const count = i - start + 1;
    const ma = sum / count;

    result.push({
      t: indicators[i].t,
      movement: Number(cumValues[i].toFixed(2)),
      signalMa: Number(ma.toFixed(2)),
      dailyNet: Number(indicators[i].lpRaw.toFixed(2)),
    });
  }

  return result;
}
