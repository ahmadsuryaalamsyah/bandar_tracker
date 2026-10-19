import type { IndicatorConfig } from "../config";
import { stddevAt } from "../movingAverage";
import { clamp } from "../normalize";
import type { Candle, MomentumAnalysis, RiskAnalysis, RiskLabel, TrendAnalysis, VolumeAnalysis } from "../types";

/**
 * RISK — heuristik risiko 0..1 (bukan probabilitas).
 *
 * Menggabungkan: guncangan volatilitas, drawdown dari recent high, posisi di bawah
 * SMA50, volume jual meningkat, kejauhan harga di atas SMA50 (risiko mean-reversion),
 * dan divergensi trend vs momentum.
 */
export function computeRisk(
  candles: Candle[],
  trend: TrendAnalysis,
  momentum: MomentumAnalysis,
  volume: VolumeAnalysis,
  config: IndicatorConfig,
): RiskAnalysis {
  const cfg = config.signalEngine;
  const last = candles.length - 1;
  const closes = candles.map((candle) => candle.c);
  const returns = closes.map((close, i) => (i === 0 || closes[i - 1] <= 0 ? 0 : close / closes[i - 1] - 1));

  const fastVolatility = stddevAt(returns, last, cfg.fastWindow);
  const slowVolatility = stddevAt(returns, last, cfg.slowWindow);
  const volatilityRatio = slowVolatility > 1e-12 ? fastVolatility / slowVolatility : 1;

  const start = Math.max(0, last - cfg.rangeLookback + 1);
  let high = -Infinity;
  for (let i = start; i <= last; i += 1) high = Math.max(high, candles[i].h);
  const close = closes[last];
  const drawdownFromHigh = high > 0 ? close / high - 1 : 0;

  const belowSma50 = trend.closeVsSma50 !== null && trend.closeVsSma50 < 0 ? 1 : 0;
  const extendedAboveSma50 = trend.closeVsSma50 !== null ? Math.max(0, trend.closeVsSma50) : 0;

  // Divergensi: arah tren vs momentum tidak sejalan (mis. tren bullish tapi momentum mendingin).
  const divergence =
    (trend.label === "Bullish" && (momentum.label === "Cooling" || momentum.label === "Weak")) ||
    (trend.label === "Bearish" && (momentum.label === "Strengthening" || momentum.label === "Recovering"))
      ? 1
      : 0;

  const s = cfg.scales.risk;
  const w = cfg.weights.risk;
  const rVolatility = clamp((volatilityRatio - 1) / s.volatility, 0, 1);
  const rDrawdown = clamp(-drawdownFromHigh / s.drawdown, 0, 1);
  const rSell = clamp((volume.sellVolumeRatio - 1) / s.sellVolume, 0, 1);
  const rExtension = clamp(extendedAboveSma50 / s.extension, 0, 1);

  const score = clamp(
    w.volatility * rVolatility +
      w.drawdown * rDrawdown +
      w.belowSma50 * belowSma50 +
      w.sellVolume * rSell +
      w.extension * rExtension +
      w.divergence * divergence,
    0,
    1,
  );

  const label: RiskLabel =
    score >= cfg.thresholds.riskHigh
      ? "High"
      : score >= cfg.thresholds.riskModerate
        ? "Moderate"
        : "Low";

  return { label, score, volatilityRatio, drawdownFromHigh, extendedAboveSma50 };
}
