import { defaultIndicatorConfig, type IndicatorConfig } from "./config";
import { computeIntensity } from "./intensity";
import { computeLpm } from "./lpm";
import { analyzeSignal } from "./signal";
import { buildTradePlan } from "./tradePlan";
import type { Candle, IndicatorPoint, IndicatorsResult } from "./types";
import { computeRotation } from "./volumeRotation";

/**
 * Menghitung seluruh indikator untuk satu seri candle.
 * Pure function: tidak melakukan I/O, sehingga mudah diuji & dipakai ulang.
 */
export function computeIndicators(
  candles: Candle[],
  config: IndicatorConfig = defaultIndicatorConfig,
): IndicatorsResult {
  if (candles.length === 0) {
    return { series: [], latest: null, signal: "Neutral", analysis: null, tradePlan: null };
  }

  const lpm = computeLpm(candles, config);
  const intensity = computeIntensity(candles, config);
  const rotation = computeRotation(candles, config);

  const series: IndicatorPoint[] = candles.map((candle, i) => ({
    t: candle.t,
    lpm: lpm.values[i],
    intensity: intensity.values[i],
    rotation: rotation.values[i],
    lpRaw: lpm.raw[i],
    intensityRaw: intensity.raw[i],
    rotationRaw: rotation.raw[i],
    rvol: lpm.rvol[i],
    clv: lpm.clv[i],
  }));

  const analysis = analyzeSignal({ candles, series, config });
  const tradePlan = buildTradePlan({ candles, analysis, config });

  return {
    series,
    latest: series[series.length - 1],
    signal: analysis.state,
    analysis,
    tradePlan,
  };
}

export { defaultIndicatorConfig };
export type { IndicatorConfig };
export { analyzeSignal } from "./signal";
export { buildTradePlan } from "./tradePlan";
export { computeAtr, trueRange } from "./atr";
export { findSwingPoints, nearestResistance, nearestSupport } from "./levels";
export * from "./types";
export * from "./interpret";
