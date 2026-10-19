import type { Candle } from "./types";

/**
 * True Range per bar:
 *   TR_i = max(H_i − L_i, |H_i − C_{i−1}|, |L_i − C_{i−1}|)
 * Bar pertama memakai H − L.
 */
export function trueRange(candles: Candle[]): number[] {
  return candles.map((candle, i) => {
    if (i === 0) return candle.h - candle.l;
    const previousClose = candles[i - 1].c;
    return Math.max(
      candle.h - candle.l,
      Math.abs(candle.h - previousClose),
      Math.abs(candle.l - previousClose),
    );
  });
}

/**
 * Average True Range (Wilder). Seed = rata-rata TR pada `period` bar pertama,
 * lalu smoothing Wilder: ATR_i = (ATR_{i−1}·(n−1) + TR_i) / n.
 * Saat histori < period, memakai rata-rata mengembang agar bar awal tetap punya nilai.
 */
export function computeAtr(candles: Candle[], period: number): number[] {
  const tr = trueRange(candles);
  const out: number[] = new Array(tr.length);
  const n = Math.max(1, Math.floor(period));

  let sum = 0;
  for (let i = 0; i < tr.length; i += 1) {
    if (i < n) {
      sum += tr[i];
      out[i] = sum / (i + 1);
    } else {
      out[i] = (out[i - 1] * (n - 1) + tr[i]) / n;
    }
  }

  return out;
}

export function atrAt(candles: Candle[], index: number, period: number): number {
  const series = computeAtr(candles, period);
  if (index < 0 || index >= series.length) return Number.NaN;
  return series[index];
}
