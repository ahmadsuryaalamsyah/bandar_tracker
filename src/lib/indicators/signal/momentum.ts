import type { IndicatorConfig } from "../config";
import { ema } from "../movingAverage";
import { clamp, squash } from "../normalize";
import type { Candle, MomentumAnalysis, MomentumLabel } from "../types";

/**
 * MOMENTUM — arah & kekuatan beberapa candle terakhir (bukan hanya candle terakhir).
 *
 *   momentumScore = wSlope·squash(slopeLpm) + wLevel·squash(lpmLevel − 50)
 *                 + wIntensity·squash(slopeIntensity) + wRet·squash(retMom)
 *
 * Slope memakai EMA(5) − EMA(20) dari seri indikator; `level` memakai posisi LPM
 * terhadap netral 50 agar rezim yang persisten (mis. downtrend panjang) tetap
 * terbaca, bukan hanya perubahannya.
 */
export function computeMomentum(
  candles: Candle[],
  lpmValues: number[],
  intensityValues: number[],
  config: IndicatorConfig,
): MomentumAnalysis {
  const cfg = config.signalEngine;
  const last = candles.length - 1;

  const slopeOf = (values: number[]): number => {
    if (values.length === 0) return 0;
    const fast = ema(values, cfg.fastWindow);
    const slow = ema(values, cfg.slowWindow);
    return fast[fast.length - 1] - slow[slow.length - 1];
  };

  const lpmSlope = slopeOf(lpmValues);
  const intensitySlope = slopeOf(intensityValues);
  const lpmLatest = lpmValues.length > 0 ? lpmValues[lpmValues.length - 1] : 50;

  const closes = candles.map((candle) => candle.c);
  const index = last - cfg.returnMomentumWindow;
  const returnMomentum = index >= 0 && closes[index] > 0 ? closes[last] / closes[index] - 1 : 0;

  const w = cfg.weights.momentum;
  const s = cfg.scales.momentum;
  const score = clamp(
    w.lpmSlope * squash(lpmSlope, s.lpmSlope) +
      w.lpmLevel * squash(lpmLatest - 50, s.lpmLevel) +
      w.intensitySlope * squash(intensitySlope, s.intensitySlope) +
      w.ret * squash(returnMomentum, s.ret),
    -1,
    1,
  );

  let label: MomentumLabel;
  if (score >= cfg.thresholds.momentumStrengthening) label = "Strengthening";
  else if (score <= cfg.thresholds.momentumWeak) label = "Weak";
  // Di antara dua ambang: arah slope LPM menentukan membaik atau mendingin.
  else label = lpmSlope >= 0 ? "Recovering" : "Cooling";

  return { label, score, lpmSlope, intensitySlope, returnMomentum };
}
