import { describe, expect, it } from "vitest";
import { computeLpmMa } from "@/lib/indicators/lpmMa";
import type { Candle, IndicatorPoint } from "@/lib/indicators/types";

function mockCandle(t: number, c: number): Candle {
  return { t, o: c, h: c + 10, l: c - 10, c, v: 1000 };
}

function mockIndicator(t: number, lpm: number): IndicatorPoint {
  return {
    t,
    lpm,
    intensity: 50,
    rotation: 50,
    lpRaw: (lpm - 50) / 10,
    intensityRaw: 1,
    rotationRaw: 1,
    rvol: 1,
    clv: 0,
  };
}

describe("computeLpmMa", () => {
  it("mengembalikan array kosong jika data kosong", () => {
    expect(computeLpmMa([], [])).toEqual([]);
  });

  it("menghitung garis MA dengan skala harga candle", () => {
    const bars = [
      mockCandle(100, 1000),
      mockCandle(200, 1050),
      mockCandle(300, 1100),
    ];
    const ind = [
      mockIndicator(100, 50),
      mockIndicator(200, 75), // Akumulasi
      mockIndicator(300, 80), // Akumulasi
    ];

    const result = computeLpmMa(bars, ind, 5);
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(1000);
    // Nilai bergerak di skala rupiah
    expect(result[1].value).toBeGreaterThan(1000);
    expect(result[2].value).toBeGreaterThan(result[1].value);
  });

  it("mendeteksi death_cross saat harga jatuh ke bawah garis LPM-MA", () => {
    // Bar 0: Rp 1000 (netral)
    // Bar 1: Rp 900 (jatuh dengan LPM rendah/distribusi) -> death cross
    const bars = [
      mockCandle(100, 1000),
      mockCandle(200, 900),
    ];
    const ind = [
      mockIndicator(100, 50),
      mockIndicator(200, 20),
    ];

    const result = computeLpmMa(bars, ind, 5);
    expect(result[0].isAccumulation).toBe(true);
    expect(result[1].isAccumulation).toBe(false);
    expect(result[1].crossover).toBe("death_cross");
  });

  it("mendeteksi golden_cross saat harga bangkit menembus ke atas garis", () => {
    // Bar 0: Rp 1000
    // Bar 1: Rp 900 (turun di bawah MA)
    // Bar 2: Rp 1150 (melonjak di atas MA dengan LPM akumulasi) -> golden cross
    const bars = [
      mockCandle(100, 1000),
      mockCandle(200, 900),
      mockCandle(300, 1150),
    ];
    const ind = [
      mockIndicator(100, 50),
      mockIndicator(200, 25),
      mockIndicator(300, 85),
    ];

    const result = computeLpmMa(bars, ind, 5);
    expect(result[1].crossover).toBe("death_cross");
    expect(result[2].isAccumulation).toBe(true);
    expect(result[2].crossover).toBe("golden_cross");
  });
});
