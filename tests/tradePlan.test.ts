import { describe, expect, it } from "vitest";
import { computeAtr } from "@/lib/indicators/atr";
import { defaultIndicatorConfig, type IndicatorConfig } from "@/lib/indicators/config";
import { computeIndicators } from "@/lib/indicators";
import { findSwingPoints, nearestResistance, nearestSupport } from "@/lib/indicators/levels";
import { buildTradePlan } from "@/lib/indicators/tradePlan";
import type { Candle, SignalAnalysis } from "@/lib/indicators/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function candle(t: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { t, o, h, l, c, v };
}

function buildCandles(closes: number[], volumes: number[], clv = 0): Candle[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1];
    const range = Math.max(Math.abs(c - o), c * 0.01);
    const half = range / 2;
    const h = Math.max(c + (1 - clv) * half, o, c);
    const l = Math.min(c - (1 + clv) * half, o, c);
    return { t: i, o, h, l, c, v: volumes[i] };
  });
}

const ramp = (n: number, from: number, to: number): number[] =>
  n === 1 ? [to] : Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));

const flat = (n: number, value: number): number[] => Array.from({ length: n }, () => value);

const withTargetMultiple = (multiple: number): IndicatorConfig => ({
  ...defaultIndicatorConfig,
  tradePlan: { ...defaultIndicatorConfig.tradePlan, targetAtrMultiple: multiple },
});

/** Ambil analisis signal untuk fixture, agar trade plan bisa diuji langsung. */
function analysisOf(candles: Candle[]): SignalAnalysis {
  const result = computeIndicators(candles);
  return result.analysis!;
}

/* ------------------------------------------------------------------ */
/* ATR                                                                */
/* ------------------------------------------------------------------ */

describe("ATR (Wilder)", () => {
  it("konstan saat true range konstan", () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(i, 100, 102, 98, 100, 1000));
    const atr = computeAtr(candles, 14);
    expect(atr[atr.length - 1]).toBeCloseTo(4, 10);
  });

  it("mengikuti smoothing Wilder", () => {
    // True range = 2, 4, 6, 8 (close konstan 100)
    const candles = [2, 4, 6, 8].map((r, i) => candle(i, 100, 100 + r / 2, 100 - r / 2, 100, 1000));
    const atr = computeAtr(candles, 3);
    expect(atr[0]).toBeCloseTo(2, 10);
    expect(atr[1]).toBeCloseTo(3, 10);
    expect(atr[2]).toBeCloseTo(4, 10);
    expect(atr[3]).toBeCloseTo(16 / 3, 10);
  });

  it("aman untuk histori lebih pendek dari periode", () => {
    const candles = [candle(0, 100, 102, 98, 100, 1000), candle(1, 100, 104, 98, 100, 1000)];
    const atr = computeAtr(candles, 14);
    expect(Number.isFinite(atr[1])).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Swing pivot                                                        */
/* ------------------------------------------------------------------ */

describe("swing pivot", () => {
  const highs = [10, 11, 12, 13, 20, 13, 12, 11, 10];
  const lows = highs.map((h) => h - 1);
  const candles = highs.map((h, i) => candle(i, h - 0.5, h, lows[i], h - 0.5, 1000));

  it("mendeteksi swing high", () => {
    const { highs: swingHighs } = findSwingPoints(candles, 3);
    expect(swingHighs.map((p) => p.index)).toEqual([4]);
    expect(swingHighs[0].price).toBe(20);
  });

  it("nearestSupport / nearestResistance memilih level terdekat", () => {
    const levels = [
      { index: 0, t: 0, price: 95 },
      { index: 1, t: 1, price: 98 },
    ];
    expect(nearestSupport(levels, 100, 10)?.price).toBe(98);
    expect(nearestSupport(levels, 100, 1)).toBeNull();

    const resistance = [
      { index: 0, t: 0, price: 108 },
      { index: 1, t: 1, price: 104 },
    ];
    expect(nearestResistance(resistance, 100, 10)?.price).toBe(104);
    expect(nearestResistance(resistance, 100, 2)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Trade plan                                                         */
/* ------------------------------------------------------------------ */

describe("trade plan", () => {
  const uptrend = buildCandles(ramp(120, 100, 200), flat(120, 20_000_000), 0.5);
  const downtrend = buildCandles(ramp(120, 200, 100), flat(120, 20_000_000), -0.5);
  const illiquid = buildCandles(ramp(120, 100, 200), flat(120, 50_000), 0.5);

  it("uptrend likuid -> Long dengan level & horizon wajar", () => {
    const plan = buildTradePlan({ candles: uptrend, analysis: analysisOf(uptrend), config: defaultIndicatorConfig });
    expect(plan.direction).toBe("Long");
    expect(plan.valid).toBe(true);
    expect(plan.entry).not.toBeNull();
    expect(plan.stop!).toBeLessThan(plan.entry!);
    expect(plan.target!).toBeGreaterThan(plan.entry!);
    expect(plan.rewardRisk!).toBeGreaterThan(1.99);
    expect(plan.rewardRisk!).toBeCloseTo(2, 5);
    expect(plan.horizonDays!).toBeGreaterThanOrEqual(defaultIndicatorConfig.tradePlan.minHorizonDays);
    expect(plan.horizonDays!).toBeLessThanOrEqual(defaultIndicatorConfig.tradePlan.maxHorizonDays);
    expect(plan.note).toBeNull();
    expect(plan.gates).toHaveLength(5);
    expect(plan.gates.every((gate) => gate.passed)).toBe(true);
    expect(plan.stopBasis).toBe("atr");
    expect(plan.targetBasis).toBe("atr");
  });

  it("downtrend -> No Trade karena trend tidak bullish", () => {
    const plan = buildTradePlan({ candles: downtrend, analysis: analysisOf(downtrend), config: defaultIndicatorConfig });
    expect(plan.direction).toBe("No Trade");
    expect(plan.valid).toBe(false);
    expect(plan.note).toMatch(/belum bullish/i);
  });

  it("R:R terlalu rendah -> No Trade", () => {
    const plan = buildTradePlan({
      candles: uptrend,
      analysis: analysisOf(uptrend),
      config: withTargetMultiple(1),
    });
    expect(plan.direction).toBe("No Trade");
    expect(plan.rewardRisk!).toBeLessThan(2);
    expect(plan.note).toMatch(/reward\/risk/i);
  });

  it("likuiditas kurang -> No Trade", () => {
    const plan = buildTradePlan({ candles: illiquid, analysis: analysisOf(illiquid), config: defaultIndicatorConfig });
    expect(plan.avgValue).toBeLessThan(defaultIndicatorConfig.tradePlan.minAvgValue);
    expect(plan.direction).toBe("No Trade");
    expect(plan.note).toMatch(/kurang likuid/i);
  });

  it("data terlalu pendek/kosong -> No Trade tanpa error", () => {
    const plan = buildTradePlan({ candles: [], analysis: analysisOf(uptrend), config: defaultIndicatorConfig });
    expect(plan.direction).toBe("No Trade");
    expect(plan.entry).toBeNull();
  });

  it("computeIndicators menyertakan tradePlan", () => {
    const result = computeIndicators(uptrend);
    expect(result.tradePlan).not.toBeNull();
    expect(result.tradePlan!.entry).toBeCloseTo(uptrend[uptrend.length - 1].c, 6);
    expect(computeIndicators([]).tradePlan).toBeNull();
  });
});
