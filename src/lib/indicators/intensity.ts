import type { IndicatorConfig } from "./config";
import { zScoreAt } from "./movingAverage";
import { toScore } from "./normalize";
import type { Candle } from "./types";

export interface IntensitySeries {
  values: number[];
  raw: number[];
}

/**
 * Intensity (approximation) — seberapa besar aktivitas vs baseline historis.
 *
 *   Intensity_raw = wVol * z(V) + wRange * z(H-L) + wRet * z(|return|)
 *
 * Tiap komponen sudah z-score terhadap window, lalu dijumlah dengan bobot.
 * Skor akhir 0-100 via logistik: >50 = lebih ramai dari biasanya.
 */
export function computeIntensity(candles: Candle[], config: IndicatorConfig): IntensitySeries {
  const volumes = candles.map((candle) => candle.v);
  const ranges = candles.map((candle) => candle.h - candle.l);
  const absReturns = candles.map((candle, i) =>
    i === 0 || candles[i - 1].c <= 0 ? 0 : Math.abs(candle.c / candles[i - 1].c - 1),
  );

  const { volume: wVol, range: wRange, ret: wRet } = config.weights.intensity;
  const raw: number[] = [];
  const values: number[] = [];

  for (let i = 0; i < candles.length; i += 1) {
    const volumeZ = zScoreAt(volumes, i, config.window);
    const rangeZ = zScoreAt(ranges, i, config.window);
    const retZ = zScoreAt(absReturns, i, config.window);

    const score = wVol * volumeZ + wRange * rangeZ + wRet * retZ;
    raw.push(score);
    values.push(toScore(score, config.scales.intensity));
  }

  return { values, raw };
}
