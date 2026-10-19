import type { IndicatorConfig } from "./config";
import { smaAt } from "./movingAverage";
import { toScore } from "./normalize";
import type { Candle } from "./types";

export interface RotationSeries {
  values: number[];
  raw: number[];
}

/**
 * Volume Rotation (approximation) — perputaran volume vs rata-rata & periode lalu.
 *
 *   VR_raw = wAvg * (RVOL - 1) + wPrev * (V_i / V_{i-1} - 1)
 *
 * Lalu dinormalisasi z-score rolling -> logistik 0-100.
 * <50 = volume mengering, >50 = volume berputar naik.
 */
export function computeRotation(candles: Candle[], config: IndicatorConfig): RotationSeries {
  const volumes = candles.map((candle) => candle.v);
  const { vsAverage, vsPrevious } = config.weights.rotation;

  const raw: number[] = [];
  const values: number[] = [];

  for (let i = 0; i < candles.length; i += 1) {
    const avgVolume = smaAt(volumes, i, config.window);
    const rv = Number.isFinite(avgVolume) && avgVolume > 0 ? volumes[i] / avgVolume : 1;

    const previous = i > 0 ? volumes[i - 1] : volumes[i];
    const change = previous > 0 ? volumes[i] / previous - 1 : 0;

    const r = vsAverage * (rv - 1) + vsPrevious * change;
    raw.push(r);
    values.push(toScore(r, config.scales.rotation));
  }

  return { values, raw };
}
