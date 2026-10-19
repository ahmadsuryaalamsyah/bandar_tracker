import { describe, expect, it } from "vitest";
import { computeIndicators } from "@/lib/indicators";
import type { Candle } from "@/lib/indicators/types";

/* ------------------------------------------------------------------ */
/* Fixture builder (deterministik)                                    */
/* ------------------------------------------------------------------ */

/** Bangun candle dari deret close/volume. `clv` mengatur posisi close di range (-1..1). */
function candles(closes: number[], volumes: number[], clv = 0): Candle[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1];
    const range = Math.max(Math.abs(c - o), c * 0.01);
    const half = range / 2;
    const h = Math.max(c + (1 - clv) * half, o, c);
    const l = Math.min(c - (1 + clv) * half, o, c);
    return { t: i, o, h, l, c, v: volumes[i] };
  });
}

function ramp(n: number, from: number, to: number): number[] {
  if (n === 1) return [to];
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}

const flat = (n: number, value: number): number[] => Array.from({ length: n }, () => value);

function wave(n: number, base: number, amp: number, drift = 0): number[] {
  return Array.from({ length: n }, (_, i) => base + Math.sin(i / 3) * amp + (drift * i) / Math.max(1, n - 1));
}

const concat = (...arrays: number[][]): number[] => arrays.flat();

/* ------------------------------------------------------------------ */
/* Skenario                                                           */
/* ------------------------------------------------------------------ */

// Uptrend kuat + volume ekspansi + close dekat high.
const strongBuying = candles(ramp(120, 100, 240), ramp(120, 1_000_000, 2_500_000), 0.6);

// Uptrend moderat, volume normal.
const accumulation = candles(ramp(120, 100, 165), flat(120, 1_200_000), 0.25);

// Rally 260 -> 400 lalu konsolidasi datar di dekat high dengan volume mengering.
const bullishConsolidation = candles(
  concat(ramp(90, 260, 400), wave(25, 398, 0.8)),
  concat(ramp(90, 1_000_000, 1_200_000), ramp(25, 1_200_000, 420_000)),
  0.2,
);

// Sideways tenang (amplitudo kecil), volume normal.
const neutral = candles(wave(120, 100, 0.4), flat(120, 1_000_000), 0);

// Rally lalu harga stagnan di area atas dengan tekanan jual (clv negatif) + volume ekspansi.
const distribution = candles(
  concat(ramp(80, 100, 200), ramp(40, 200, 196)),
  concat(ramp(80, 1_000_000, 1_300_000), ramp(40, 1_300_000, 2_600_000)),
  -0.6,
);

// Downtrend lalu melandai dengan volume mengering.
const bearishConsolidation = candles(
  concat(ramp(100, 200, 120), wave(25, 121, 1.5, -1)),
  concat(ramp(100, 1_200_000, 800_000), ramp(25, 800_000, 350_000)),
  0,
);

// Downtrend kuat + volume ekspansi + close dekat low.
const strongSelling = candles(ramp(120, 200, 80), ramp(120, 1_000_000, 2_500_000), -0.5);

/* ------------------------------------------------------------------ */

describe("signal engine — market state per skenario", () => {
  it("uptrend kuat + volume ekspansi -> Strong Buying", () => {
    const result = computeIndicators(strongBuying);
    expect(result.signal).toBe("Strong Buying");
    expect(result.analysis?.trend.label).toBe("Bullish");
    expect(result.analysis?.momentum.label).toBe("Strengthening");
    expect(result.analysis?.volume.label).toBe("Expanding");
    expect(result.analysis?.strength.label).toBe("Strong");
  });

  it("uptrend moderat + volume normal -> Accumulation", () => {
    expect(computeIndicators(accumulation).signal).toBe("Accumulation");
  });

  it("rally lalu konsolidasi (volume kontraksi) -> Bullish Consolidation, BUKAN bearish", () => {
    const result = computeIndicators(bullishConsolidation);
    expect(result.signal).toBe("Bullish Consolidation");
    expect(result.signal).not.toBe("Strong Selling");
    expect(result.signal).not.toBe("Distribution");

    const analysis = result.analysis!;
    expect(analysis.trend.label).toBe("Bullish");
    expect(analysis.momentum.label).toBe("Cooling");
    expect(analysis.volume.label).toBe("Contracting");
    expect(analysis.risk.label).toBe("Moderate");
    expect(analysis.strength.label).toBe("Moderate");
  });

  it("sideways tenang -> Neutral", () => {
    const result = computeIndicators(neutral);
    expect(result.signal).toBe("Neutral");
    expect(result.analysis?.trend.label).toBe("Sideways");
    expect(result.analysis?.strength.label).toBe("Weak");
  });

  it("roll-over di area atas + volume ekspansi -> Distribution", () => {
    const result = computeIndicators(distribution);
    expect(result.signal).toBe("Distribution");
    expect(result.analysis?.momentum.label).toBe("Weak");
  });

  it("downtrend melandai + volume kontraksi -> Bearish Consolidation", () => {
    const result = computeIndicators(bearishConsolidation);
    expect(result.signal).toBe("Bearish Consolidation");
    expect(result.analysis?.trend.label).toBe("Bearish");
    expect(result.analysis?.volume.label).toBe("Contracting");
  });

  it("downtrend kuat + volume ekspansi -> Strong Selling", () => {
    const result = computeIndicators(strongSelling);
    expect(result.signal).toBe("Strong Selling");
    expect(result.analysis?.trend.label).toBe("Bearish");
    expect(result.analysis?.momentum.label).toBe("Weak");
    expect(result.analysis?.volume.label).toBe("Expanding");
    expect(result.analysis?.risk.label).toBe("High");
  });
});

describe("signal engine — komponen & explanation", () => {
  it("komponen skor berada dalam rentang yang wajar", () => {
    for (const fixture of [strongBuying, accumulation, bullishConsolidation, neutral, distribution, bearishConsolidation, strongSelling]) {
      const analysis = computeIndicators(fixture).analysis!;
      expect(analysis.trend.score).toBeGreaterThanOrEqual(-1);
      expect(analysis.trend.score).toBeLessThanOrEqual(1);
      expect(analysis.momentum.score).toBeGreaterThanOrEqual(-1);
      expect(analysis.momentum.score).toBeLessThanOrEqual(1);
      expect(analysis.volume.score).toBeGreaterThanOrEqual(-1);
      expect(analysis.volume.score).toBeLessThanOrEqual(1);
      expect(analysis.risk.score).toBeGreaterThanOrEqual(0);
      expect(analysis.risk.score).toBeLessThanOrEqual(1);
      expect(analysis.strength.score).toBeGreaterThanOrEqual(0);
      expect(analysis.strength.score).toBeLessThanOrEqual(100);
    }
  });

  it("explanation berupa kalimat dari data (bukan kosong)", () => {
    const analysis = computeIndicators(bullishConsolidation).analysis!;
    expect(typeof analysis.explanation).toBe("string");
    expect(analysis.explanation.length).toBeGreaterThan(20);
    expect(analysis.explanation).not.toMatch(/BBCA|BBRI|ANTM/);
  });

  it("trend Sideways tidak pernah mendapat Strength 'Strong'", () => {
    const analysis = computeIndicators(neutral).analysis!;
    expect(analysis.strength.label).not.toBe("Strong");
  });
});

describe("signal engine — edge case", () => {
  it("satu candle: tidak error & state terdefinisi", () => {
    const result = computeIndicators([{ t: 0, o: 10, h: 12, l: 9, c: 11, v: 1000 }]);
    expect(result.analysis).not.toBeNull();
    expect(result.signal).toBeDefined();
    expect(result.analysis?.trend.closeVsSma50).toBeNull();
  });

  it("data < 50 bar: SMA50 tidak dipakai (null) tapi tetap jalan", () => {
    const fixture = candles(ramp(30, 100, 130), flat(30, 1_000_000), 0.3);
    const analysis = computeIndicators(fixture).analysis!;
    expect(analysis.trend.closeVsSma50).toBeNull();
    expect(analysis.trend.label).toBe("Bullish");
    expect(Number.isFinite(analysis.trend.score)).toBe(true);
  });

  it("volume nol: tidak ada NaN", () => {
    const fixture = candles(ramp(60, 100, 140), flat(60, 0), 0);
    const analysis = computeIndicators(fixture).analysis!;
    expect(Number.isFinite(analysis.momentum.score)).toBe(true);
    expect(Number.isFinite(analysis.volume.score)).toBe(true);
    expect(Number.isFinite(analysis.risk.score)).toBe(true);
  });
});
