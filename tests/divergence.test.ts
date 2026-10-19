import { describe, expect, it } from "vitest";
import { detectDivergence } from "@/lib/indicators/divergence";
import type { Candle, IndicatorPoint } from "@/lib/indicators/types";

function mockCandle(t: number, c: number, l = c - 10, h = c + 10): Candle {
  return { t, o: c, h, l, c, v: 1000 };
}

function mockIndicator(t: number, lpRaw: number): IndicatorPoint {
  return {
    t,
    lpm: 50 + lpRaw * 10,
    intensity: 50,
    rotation: 50,
    lpRaw,
    intensityRaw: 1,
    rotationRaw: 1,
    rvol: 1,
    clv: 0,
  };
}

describe("detectDivergence", () => {
  it("mengembalikan false jika data kurang dari 15 bar", () => {
    const res = detectDivergence([], []);
    expect(res.hasDivergence).toBe(false);
  });

  it("mendeteksi Bullish Divergence saat harga turun tapi bandar flow bertambah", () => {
    // 20 candle di mana harga melemah dari 1000 ke 900, tapi flow naik dari -2 ke +5
    const bars: Candle[] = [];
    const ind: IndicatorPoint[] = [];

    for (let i = 0; i < 20; i += 1) {
      bars.push(mockCandle(i, 1000 - i * 5)); // harga turun
      ind.push(mockIndicator(i, 0.4));        // net flow positif (akumulasi)
    }

    const res = detectDivergence(bars, ind, 20);
    expect(res.hasDivergence).toBe(true);
    expect(res.type).toBe("regular_bullish");
    expect(res.title).toContain("Bullish Divergence");
  });

  it("mendeteksi Bearish Divergence saat harga naik tapi bandar flow anjlok", () => {
    // 20 candle di mana harga dipompa dari 1000 ke 1200, tapi flow negatif (distribusi)
    const bars: Candle[] = [];
    const ind: IndicatorPoint[] = [];

    for (let i = 0; i < 20; i += 1) {
      bars.push(mockCandle(i, 1000 + i * 10)); // harga naik
      ind.push(mockIndicator(i, -0.5));        // net flow negatif (distribusi)
    }

    const res = detectDivergence(bars, ind, 20);
    expect(res.hasDivergence).toBe(true);
    expect(res.type).toBe("regular_bearish");
    expect(res.title).toContain("Bearish Divergence");
  });
});
