import type { Candle } from "./types";

export interface SwingPoint {
  index: number;
  t: number;
  price: number;
}

export interface SwingPoints {
  highs: SwingPoint[];
  lows: SwingPoint[];
}

/**
 * Deteksi swing point (fractal): bar `i` adalah swing high bila H_i adalah nilai
 * tertinggi di antara H[i−k .. i+k] (dan sebaliknya untuk swing low). Hanya titik
 * yang sudah terkonfirmasi (`i ≤ n−1−k`) yang dikembalikan, agar tidak repaint.
 */
export function findSwingPoints(candles: Candle[], k: number, fromIndex = 0): SwingPoints {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  const radius = Math.max(1, Math.floor(k));
  const start = Math.max(radius, fromIndex);
  const end = candles.length - 1 - radius;

  for (let i = start; i <= end; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - radius; j <= i + radius; j += 1) {
      if (j === i) continue;
      if (candles[j].h >= candles[i].h) isHigh = false;
      if (candles[j].l <= candles[i].l) isLow = false;
    }
    if (isHigh) highs.push({ index: i, t: candles[i].t, price: candles[i].h });
    if (isLow) lows.push({ index: i, t: candles[i].t, price: candles[i].l });
  }

  return { highs, lows };
}

/** Support terdekat: swing low tertinggi yang berada di bawah `price` dalam jarak `maxDistance`. */
export function nearestSupport(lows: SwingPoint[], price: number, maxDistance: number): SwingPoint | null {
  let best: SwingPoint | null = null;
  for (const low of lows) {
    if (low.price >= price) continue;
    if (price - low.price > maxDistance) continue;
    if (!best || low.price > best.price) best = low;
  }
  return best;
}

/** Resistance terdekat: swing high terendah yang berada di atas `price` dalam jarak `maxDistance`. */
export function nearestResistance(highs: SwingPoint[], price: number, maxDistance: number): SwingPoint | null {
  let best: SwingPoint | null = null;
  for (const high of highs) {
    if (high.price <= price) continue;
    if (high.price - price > maxDistance) continue;
    if (!best || high.price < best.price) best = high;
  }
  return best;
}
