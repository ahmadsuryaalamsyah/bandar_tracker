import type { IndicatorConfig } from "./config";
import { smaAt, stddevAt } from "./movingAverage";
import { toScore } from "./normalize";
import type { Candle } from "./types";

export interface LpmSeries {
  values: number[];
  raw: number[];
  clv: number[];
  rvol: number[];
}

/**
 * Close Location Value: posisi close di dalam range candle.
 * +1 = close di high (tekanan beli), -1 = close di low (tekanan jual).
 */
export function closeLocationValue(candle: Candle): number {
  const range = candle.h - candle.l;
  if (!(range > 0)) return 0;
  return (candle.c - candle.l - (candle.h - candle.c)) / range;
}

/**
 * Liquidity Pressure (LPM-like, approximation).
 *
 *   LP_raw = RVOL * ( wClose * CLV + wChange * tanh(r / sigma_r) )
 *
 * Menggabungkan tiga hal: volume relatif (RVOL), posisi close terhadap range
 * candle (CLV), dan perubahan harga yang dinormalisasi volatilitas (tanh).
 * Lalu dipetakan ke 0-100 dengan skala tetap (config.scales.lpm).
 */
export function computeLpm(candles: Candle[], config: IndicatorConfig): LpmSeries {
  const volumes = candles.map((candle) => candle.v);
  const returns = candles.map((candle, i) =>
    i === 0 || candles[i - 1].c <= 0 ? 0 : candle.c / candles[i - 1].c - 1,
  );

  const clv: number[] = [];
  const rvol: number[] = [];
  const raw: number[] = [];
  const values: number[] = [];

  const { closePosition, priceChange } = config.weights.lpm;

  for (let i = 0; i < candles.length; i += 1) {
    const avgVolume = smaAt(volumes, i, config.window);
    const rv = Number.isFinite(avgVolume) && avgVolume > 0 ? candles[i].v / avgVolume : 1;

    const location = closeLocationValue(candles[i]);

    const retSd = stddevAt(returns, i, config.window);
    const retNorm = retSd > 1e-12 ? Math.tanh(returns[i] / retSd) : 0;

    const r = rv * (closePosition * location + priceChange * retNorm);
    clv.push(location);
    rvol.push(rv);
    raw.push(r);
    values.push(toScore(r, config.scales.lpm));
  }

  return { values, raw, clv, rvol };
}
