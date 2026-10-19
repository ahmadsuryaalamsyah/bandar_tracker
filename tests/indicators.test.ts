import { describe, expect, it } from "vitest";
import { defaultIndicatorConfig, type IndicatorConfig } from "@/lib/indicators/config";
import { ema, smaAt, stddevAt, zScoreAt } from "@/lib/indicators/movingAverage";
import { logistic100 } from "@/lib/indicators/normalize";
import { closeLocationValue, computeLpm } from "@/lib/indicators/lpm";
import { computeIndicators } from "@/lib/indicators";
import type { Candle } from "@/lib/indicators/types";

function candle(t: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { t, o, h, l, c, v };
}

const flatSeries = (count: number, price = 100, volume = 1000): Candle[] =>
  Array.from({ length: count }, (_, i) => candle(i, price, price, price, price, volume));

describe("closeLocationValue", () => {
  it("mengembalikan +1 saat close di high", () => {
    expect(closeLocationValue(candle(0, 5, 10, 0, 10, 1))).toBe(1);
  });

  it("mengembalikan -1 saat close di low", () => {
    expect(closeLocationValue(candle(0, 5, 10, 0, 0, 1))).toBe(-1);
  });

  it("mengembalikan 0 saat close di tengah", () => {
    expect(closeLocationValue(candle(0, 5, 10, 0, 5, 1))).toBe(0);
  });

  it("aman saat range nol", () => {
    expect(closeLocationValue(candle(0, 10, 10, 10, 10, 1))).toBe(0);
  });
});

describe("helper statistik", () => {
  it("smaAt memakai window terakhir", () => {
    expect(smaAt([1, 2, 3, 4, 5], 4, 5)).toBe(3);
    expect(smaAt([1, 2, 3, 4, 5], 4, 2)).toBe(4.5);
  });

  it("smaAt mengembang saat histori kurang", () => {
    expect(smaAt([10, 20], 1, 20)).toBe(15);
  });

  it("stddevAt mengembalikan 0 saat data < 2", () => {
    expect(stddevAt([42], 0, 20)).toBe(0);
  });

  it("zScoreAt mengembalikan 0 saat variansi nol", () => {
    expect(zScoreAt([5, 5, 5, 5], 3, 4)).toBe(0);
  });

  it("ema mengembalikan nilai awal untuk data konstan", () => {
    expect(ema([7, 7, 7], 3)).toEqual([7, 7, 7]);
  });
});

describe("logistic100", () => {
  it("netral di 0", () => {
    expect(logistic100(0)).toBe(50);
  });

  it("monoton naik dan terbatas 0-100", () => {
    expect(logistic100(1)).toBeGreaterThan(50);
    expect(logistic100(-1)).toBeLessThan(50);
    expect(logistic100(1000)).toBe(100);
    expect(logistic100(-1000)).toBe(0);
    expect(logistic100(Number.NaN)).toBe(50);
  });
});

describe("computeLpm (raw)", () => {
  it("RVOL = 1 saat volume konstan", () => {
    const candles = flatSeries(10, 100, 5000);
    const { rvol } = computeLpm(candles, defaultIndicatorConfig);
    expect(rvol[9]).toBeCloseTo(1, 10);
  });

  it("tekanan positif saat close selalu di high dan harga naik", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      candle(i, 100 + i, 100 + i + 2, 100 + i - 1, 100 + i + 2, 1000 + i * 100),
    );
    const { raw } = computeLpm(candles, defaultIndicatorConfig);
    expect(raw[raw.length - 1]).toBeGreaterThan(0);
  });

  it("tekanan negatif saat close selalu di low dan harga turun", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      candle(i, 200 - i, 200 - i + 1, 200 - i - 2, 200 - i - 2, 1000 + i * 100),
    );
    const { raw } = computeLpm(candles, defaultIndicatorConfig);
    expect(raw[raw.length - 1]).toBeLessThan(0);
  });
});

describe("computeIndicators", () => {
  it("seri konstan -> semua skor 50 dan sinyal Neutral", () => {
    const result = computeIndicators(flatSeries(30));
    expect(result.series).toHaveLength(30);
    expect(result.latest?.lpm).toBeCloseTo(50, 6);
    expect(result.latest?.intensity).toBeCloseTo(50, 6);
    expect(result.latest?.rotation).toBeCloseTo(50, 6);
    expect(result.signal).toBe("Neutral");
  });

  it("uptrend dengan volume naik -> LPM di atas netral", () => {
    const candles = Array.from({ length: 60 }, (_, i) =>
      candle(i, 100 + i, 100 + i + 2, 100 + i - 1, 100 + i + 1.5, 1000 + i * 80),
    );
    const result = computeIndicators(candles);
    expect(result.latest!.lpm).toBeGreaterThan(50);
    expect(["Strong Buying", "Accumulation"]).toContain(result.signal);
  });

  it("downtrend -> LPM di bawah netral", () => {
    const candles = Array.from({ length: 60 }, (_, i) =>
      candle(i, 200 - i, 200 - i + 1, 200 - i - 2, 200 - i - 1.5, 1000 + i * 80),
    );
    const result = computeIndicators(candles);
    expect(result.latest!.lpm).toBeLessThan(50);
    expect(["Strong Selling", "Distribution"]).toContain(result.signal);
  });

  it("semua skor berada di rentang 0-100 dan tidak NaN", () => {
    const candles = Array.from({ length: 120 }, (_, i) => {
      const base = 1000 + Math.sin(i / 3) * 50 + i;
      const high = base + 10 + (i % 5);
      const low = base - 10 - (i % 3);
      const close = low + ((high - low) * ((i * 37) % 100)) / 100;
      return candle(i, base, high, low, close, 1000 + ((i * 7919) % 5000));
    });
    const result = computeIndicators(candles);
    for (const point of result.series) {
      for (const value of [point.lpm, point.intensity, point.rotation]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("aman untuk satu candle", () => {
    const result = computeIndicators([candle(0, 10, 12, 9, 11, 1000)]);
    expect(result.series).toHaveLength(1);
    expect(result.latest).not.toBeNull();
    expect(Number.isFinite(result.latest!.lpm)).toBe(true);
    expect(result.signal).toBeDefined();
  });

  it("aman saat volume nol", () => {
    const candles = flatSeries(30, 100, 0);
    const result = computeIndicators(candles);
    for (const point of result.series) {
      expect(Number.isFinite(point.lpm)).toBe(true);
      expect(Number.isFinite(point.rotation)).toBe(true);
    }
  });

  it("kosong -> hasil kosong", () => {
    const result = computeIndicators([]);
    expect(result.series).toHaveLength(0);
    expect(result.latest).toBeNull();
  });

  it("menghormati override konfigurasi", () => {
    const config: IndicatorConfig = { ...defaultIndicatorConfig, window: 5 };
    const candles = Array.from({ length: 20 }, (_, i) =>
      candle(i, 100 + i, 100 + i + 2, 100 + i - 1, 100 + i + 1.5, 1000 + i * 80),
    );
    const result = computeIndicators(candles, config);
    expect(result.series).toHaveLength(20);
    expect(result.latest!.lpm).toBeGreaterThan(50);
  });
});
