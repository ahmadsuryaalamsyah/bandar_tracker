import type { IndicatorConfig } from "../config";
import type {
  MarketState,
  MomentumAnalysis,
  StrengthAnalysis,
  StrengthLabel,
  TrendAnalysis,
  VolumeAnalysis,
} from "../types";

export interface MarketStateInput {
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  volume: VolumeAnalysis;
  lpmLatest: number;
  config: IndicatorConfig;
}

/**
 * OVERALL MARKET STATE — aturan berurutan yang mengutamakan konteks trend.
 *
 * Prinsip: kontraksi volume/melemahnya momentum setelah rally TIDAK otomatis
 * bearish selama trend masih Bullish -> "Bullish Consolidation". Bobot bearish
 * kuat hanya bila trend Bearish DAN momentum Weak DAN volume ekspansi/volume jual naik.
 */
export function classifyMarketState({
  trend,
  momentum,
  volume,
  lpmLatest,
  config,
}: MarketStateInput): MarketState {
  const t = config.signalEngine.thresholds;
  const volumeExpanding = volume.label === "Expanding";
  const sellVolumeElevated = volume.sellVolumeRatio >= t.sellVolumeElevated;
  const sellingPressure = volumeExpanding || sellVolumeElevated;

  if (trend.label === "Bullish") {
    if (momentum.label === "Strengthening" && volumeExpanding) return "Strong Buying";
    if (
      (momentum.label === "Strengthening" || momentum.label === "Recovering") &&
      lpmLatest >= t.accumulationLpm
    ) {
      return "Accumulation";
    }
    if (momentum.label === "Weak" && sellingPressure) return "Distribution";
    return "Bullish Consolidation";
  }

  if (trend.label === "Bearish") {
    if (momentum.label === "Weak" && sellingPressure) return "Strong Selling";
    return "Bearish Consolidation";
  }

  // Sideways
  if (lpmLatest >= t.sidewaysAccumulationLpm && volume.label !== "Contracting") return "Accumulation";
  if (lpmLatest <= t.sidewaysDistributionLpm && sellingPressure) return "Distribution";
  // Momentum lemah hanya dianggap Distribution bila juga ada tekanan jual (volume atau LPM rendah).
  // Tanpa konfirmasi dari volume/LPM, tetap Neutral agar tidak over-label.
  if (momentum.label === "Weak" && sellingPressure) return "Distribution";
  return "Neutral";
}

/**
 * STRENGTH — heuristik kesepakatan/kekuatan komponen, BUKAN probabilitas.
 *
 *   strength = 100 · (wm·rata-rata|skor| + wa·|rata-rata skor| + wt·|trendScore|)
 *
 * Bila trend Sideways, kekuatan di-cap ke Moderate (tidak ada keyakinan arah kuat).
 */
export function computeStrength(
  trend: TrendAnalysis,
  momentum: MomentumAnalysis,
  volume: VolumeAnalysis,
  config: IndicatorConfig,
): StrengthAnalysis {
  const cfg = config.signalEngine;
  const scores = [trend.score, momentum.score, volume.score];
  const magnitude = scores.reduce((sum, value) => sum + Math.abs(value), 0) / scores.length;
  const agreement = Math.abs(scores.reduce((sum, value) => sum + value, 0) / scores.length);

  const w = cfg.weights.strength;
  let score = 100 * (w.magnitude * magnitude + w.agreement * agreement + w.trend * Math.abs(trend.score));

  if (trend.label === "Sideways") {
    score = Math.min(score, cfg.thresholds.strengthStrong - 0.01);
  }

  const label: StrengthLabel =
    score >= cfg.thresholds.strengthStrong
      ? "Strong"
      : score >= cfg.thresholds.strengthModerate
        ? "Moderate"
        : "Weak";

  return { label, score };
}
