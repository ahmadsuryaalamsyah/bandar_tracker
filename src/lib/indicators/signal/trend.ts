import type { IndicatorConfig } from "../config";
import { smaAt } from "../movingAverage";
import { clamp, squash } from "../normalize";
import type { Candle, TrendAnalysis, TrendLabel } from "../types";

/**
 * TREND — struktur harga multi-bar.
 *
 *   trendScore = Σ wi · squash(fi, si)   (dinormalisasi bila SMA50 belum tersedia)
 *
 * Input: close vs SMA20, close vs SMA50, SMA20 vs SMA50, slope SMA20, dan posisi
 * close terhadap recent high/low. Hasilnya -1..+1.
 */
export function computeTrend(candles: Candle[], config: IndicatorConfig): TrendAnalysis {
  const cfg = config.signalEngine;
  const closes = candles.map((candle) => candle.c);
  const last = closes.length - 1;
  const close = closes[last];

  const sma20 = smaAt(closes, last, cfg.slowWindow);
  const hasLong = candles.length >= cfg.longWindow;
  const sma50 = hasLong ? smaAt(closes, last, cfg.longWindow) : Number.NaN;

  const closeVsSma20 = Number.isFinite(sma20) && sma20 > 0 ? close / sma20 - 1 : 0;
  const closeVsSma50 =
    hasLong && Number.isFinite(sma50) && sma50 > 0 ? close / sma50 - 1 : null;
  const sma20VsSma50 =
    hasLong && Number.isFinite(sma50) && sma50 > 0 && Number.isFinite(sma20) ? sma20 / sma50 - 1 : null;

  const previousIndex = last - cfg.slopeLookback;
  let sma20Slope = 0;
  if (previousIndex >= 0 && Number.isFinite(sma20) && sma20 > 0) {
    const previous = smaAt(closes, previousIndex, cfg.slowWindow);
    if (Number.isFinite(previous) && previous > 0) sma20Slope = (sma20 - previous) / previous;
  }

  const start = Math.max(0, last - cfg.rangeLookback + 1);
  let high = -Infinity;
  let low = Infinity;
  for (let i = start; i <= last; i += 1) {
    high = Math.max(high, candles[i].h);
    low = Math.min(low, candles[i].l);
  }
  const range = high - low;
  const positionInRange = range > 0 ? (close - low) / range : 0.5;

  const w = cfg.weights.trend;
  const s = cfg.scales.trend;
  let weighted = 0;
  let weightSum = 0;

  const add = (value: number, weight: number, scale: number) => {
    weighted += weight * squash(value, scale);
    weightSum += weight;
  };

  add(closeVsSma20, w.d20, s.d20);
  if (closeVsSma50 !== null) add(closeVsSma50, w.d50, s.d50);
  if (sma20VsSma50 !== null) add(sma20VsSma50, w.sma, s.sma);
  add(sma20Slope, w.slope, s.slope);
  weighted += w.position * (2 * positionInRange - 1);
  weightSum += w.position;

  const score = weightSum > 0 ? clamp(weighted / weightSum, -1, 1) : 0;

  const label: TrendLabel =
    score >= cfg.thresholds.trendBullish
      ? "Bullish"
      : score <= cfg.thresholds.trendBearish
        ? "Bearish"
        : "Sideways";

  return {
    label,
    score,
    strength: Math.abs(score),
    closeVsSma20,
    closeVsSma50,
    sma20VsSma50,
    sma20Slope,
    positionInRange,
  };
}
