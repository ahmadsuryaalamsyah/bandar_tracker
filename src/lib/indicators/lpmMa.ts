import type { Candle, IndicatorPoint } from "./types";

export interface LpmMaPoint {
  t: number;
  value: number;
  /** Apakah candle tutup di atas garis LPM-MA (fase akumulasi) */
  isAccumulation: boolean;
  /** Persilangan baru pada bar ini */
  crossover: "golden_cross" | "death_cross" | null;
}

/**
 * Menghitung LPM-MA (Liquidity Pressure Weighted Moving Average).
 *
 * Garis ini berada langsung di skala harga candlestick (Rp) sehingga
 * bisa bersilangan dengan body candle:
 *
 * 1. Setiap candle dibobotkan berdasarkan volume dan skor LPM (0-100).
 *    Bobot = Volume * (LPM / 50).
 *    Candle dengan akumulasi/distribusi besar memberi pengaruh lebih dominan
 *    pada garis rata-rata modal bandar.
 * 2. Menghitung rolling weighted average selama window N (default 14).
 * 3. Persilangan (Crossover):
 *    - Candle memotong KE ATAS garis -> Golden Cross (Mulai Akumulasi)
 *    - Candle memotong KE BAWAH garis -> Death Cross (Mulai Distribusi)
 */
export function computeLpmMa(
  bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number } | Candle>,
  indicators: IndicatorPoint[],
  period = 14,
): LpmMaPoint[] {
  if (bars.length === 0 || indicators.length === 0) return [];

  const result: LpmMaPoint[] = [];

  for (let i = 0; i < bars.length; i += 1) {
    const start = Math.max(0, i - period + 1);
    let weightedPriceSum = 0;
    let weightSum = 0;
    let fallbackPriceSum = 0;

    for (let k = start; k <= i; k += 1) {
      const barK = bars[k];
      const indK = indicators[k] ?? indicators[indicators.length - 1];

      // Bobot kombinasi volume dan nilai LPM
      const lpmWeight = Math.max(5, indK.lpm);
      const volWeight = Number.isFinite(barK.v) && barK.v > 0 ? Math.sqrt(barK.v) : 1;
      const weight = volWeight * (lpmWeight / 50);

      weightedPriceSum += barK.c * weight;
      weightSum += weight;
      fallbackPriceSum += barK.c;
    }

    const count = i - start + 1;
    const maVal = weightSum > 0 ? weightedPriceSum / weightSum : fallbackPriceSum / count;
    const roundedVal = Number(maVal.toFixed(2));
    const isAccumulation = bars[i].c >= roundedVal;

    let crossover: "golden_cross" | "death_cross" | null = null;
    if (i > 0) {
      const prev = result[i - 1];
      if (!prev.isAccumulation && isAccumulation) {
        crossover = "golden_cross";
      } else if (prev.isAccumulation && !isAccumulation) {
        crossover = "death_cross";
      }
    }

    result.push({
      t: bars[i].t,
      value: roundedVal,
      isAccumulation,
      crossover,
    });
  }

  return result;
}
