import type { IndicatorConfig } from "../config";
import { ema, smaAt } from "../movingAverage";
import { clamp, squash } from "../normalize";
import type { Candle, VolumeAnalysis, VolumeLabel } from "../types";

/**
 * VOLUME — ekspansi/kontraksi volume.
 *
 *   volumeScore = .6·squash(ratioVolume − 1) + .4·squash(slopeRotation)
 *
 * ratioVolume = SMA(V,5) / SMA(V,20). `sellVolumeRatio` membandingkan rata-rata
 * volume pada candle turun vs candle naik sepanjang `rangeLookback`.
 */
export function computeVolume(
  candles: Candle[],
  rotationValues: number[],
  config: IndicatorConfig,
): VolumeAnalysis {
  const cfg = config.signalEngine;
  const last = candles.length - 1;
  const volumes = candles.map((candle) => candle.v);

  const volumeShort = smaAt(volumes, last, cfg.fastWindow);
  const volumeLong = smaAt(volumes, last, cfg.slowWindow);
  const volumeRatio =
    Number.isFinite(volumeShort) && Number.isFinite(volumeLong) && volumeLong > 0
      ? volumeShort / volumeLong
      : 1;

  let rotationSlope = 0;
  if (rotationValues.length > 0) {
    const fast = ema(rotationValues, cfg.fastWindow);
    const slow = ema(rotationValues, cfg.slowWindow);
    rotationSlope = fast[fast.length - 1] - slow[slow.length - 1];
  }

  const start = Math.max(0, last - cfg.rangeLookback + 1);
  let downVolume = 0;
  let downCount = 0;
  let upVolume = 0;
  let upCount = 0;
  for (let i = start; i <= last; i += 1) {
    const candle = candles[i];
    if (candle.c < candle.o) {
      downVolume += candle.v;
      downCount += 1;
    } else if (candle.c > candle.o) {
      upVolume += candle.v;
      upCount += 1;
    }
  }
  const downAverage = downCount > 0 ? downVolume / downCount : 0;
  const upAverage = upCount > 0 ? upVolume / upCount : 0;
  const sellVolumeRatio = upAverage > 0 ? downAverage / upAverage : downAverage > 0 ? 2 : 1;

  const w = cfg.weights.volume;
  const s = cfg.scales.volume;
  const score = clamp(
    w.ratio * squash(volumeRatio - 1, s.ratio) + w.slope * squash(rotationSlope, s.slope),
    -1,
    1,
  );

  const label: VolumeLabel =
    score >= cfg.thresholds.volumeExpanding
      ? "Expanding"
      : score <= cfg.thresholds.volumeContracting
        ? "Contracting"
        : "Normal";

  return { label, score, volumeRatio, rotationSlope, sellVolumeRatio };
}
