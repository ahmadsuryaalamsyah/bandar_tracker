import { describe, expect, it } from "vitest";
import { calculateAccumulationSupports } from "@/lib/indicators/supportAccumulation";
import type { Candle, IndicatorPoint } from "@/lib/indicators/types";

function mockCandle(t: number, c: number, l = c - 10, h = c + 10): Candle {
  return { t, o: c, h, l, c, v: 1000 };
}

function mockIndicator(t: number, lpm: number): IndicatorPoint {
  return {
    t,
    lpm,
    intensity: 50,
    rotation: 50,
    lpRaw: 1,
    intensityRaw: 1,
    rotationRaw: 1,
    rvol: 1,
    clv: 0,
  };
}

describe("calculateAccumulationSupports", () => {
  it("mengembalikan null jika data kurang dari 10", () => {
    expect(calculateAccumulationSupports([], [])).toBeNull();
  });

  it("menghitung Support 1, Support 2, dan Stop Loss dengan tepat", () => {
    // Buat 30 candle dengan swing low di 950 dan 920, harga sekarang di 1000
    const bars: Candle[] = [];
    const ind: IndicatorPoint[] = [];

    for (let i = 0; i < 30; i += 1) {
      let c = 1000;
      if (i === 10) c = 920; // Swing low 2
      if (i === 20) c = 950; // Swing low 1
      bars.push(mockCandle(i, c, c - 5, c + 5));
      ind.push(mockIndicator(i, 65)); // Akumulasi
    }

    const res = calculateAccumulationSupports(bars, ind, 30);
    expect(res).not.toBeNull();
    expect(res!.currentPrice).toBe(1000);
    expect(res!.support1).not.toBeNull();
    expect(res!.support1!.price).toBeLessThan(1000);
    expect(res!.support2).not.toBeNull();
    expect(res!.stopLoss).not.toBeNull();
    expect(res!.stopLoss!.price).toBeLessThan(res!.support2!.price);
    expect(res!.accumulationZone.label).toContain("Rp");
  });
});
