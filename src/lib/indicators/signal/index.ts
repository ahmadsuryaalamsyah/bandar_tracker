import type { IndicatorConfig } from "../config";
import type { Candle, IndicatorPoint, SignalAnalysis } from "../types";
import { buildExplanation } from "./explanation";
import { classifyMarketState, computeStrength } from "./marketState";
import { computeMomentum } from "./momentum";
import { computeRisk } from "./risk";
import { computeTrend } from "./trend";
import { computeVolume } from "./volume";

export interface AnalyzeSignalInput {
  candles: Candle[];
  series: IndicatorPoint[];
  config: IndicatorConfig;
}

/**
 * Menganalisis seluruh seri dan menghasilkan state pasar + komponennya.
 * Pure function tanpa I/O.
 */
export function analyzeSignal({ candles, series, config }: AnalyzeSignalInput): SignalAnalysis {
  const lpmValues = series.map((point) => point.lpm);
  const intensityValues = series.map((point) => point.intensity);
  const rotationValues = series.map((point) => point.rotation);

  const trend = computeTrend(candles, config);
  const momentum = computeMomentum(candles, lpmValues, intensityValues, config);
  const volume = computeVolume(candles, rotationValues, config);
  const risk = computeRisk(candles, trend, momentum, volume, config);

  const lpmLatest = lpmValues.length > 0 ? lpmValues[lpmValues.length - 1] : 50;
  const state = classifyMarketState({ trend, momentum, volume, lpmLatest, config });
  const strength = computeStrength(trend, momentum, volume, config);
  const explanation = buildExplanation({ trend, momentum, volume, risk, state });

  return { state, strength, trend, momentum, volume, risk, explanation };
}

export { classifyMarketState, computeStrength } from "./marketState";
export { computeTrend } from "./trend";
export { computeMomentum } from "./momentum";
export { computeVolume } from "./volume";
export { computeRisk } from "./risk";
export { buildExplanation } from "./explanation";
