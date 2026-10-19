import { describe, expect, it } from "vitest";
import {
  classifyBandarStatus,
  computeBandarMatrix,
  computeBandarMovementSeries,
} from "@/lib/indicators/bandarMatrix";
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

describe("Bandar Matrix & Movement", () => {
  it("classifyBandarStatus mengelompokkan status dengan tepat", () => {
    expect(classifyBandarStatus(70, 5)).toBe("Big Acc");
    expect(classifyBandarStatus(58, 2)).toBe("Normal Acc");
    expect(classifyBandarStatus(52, 0.4)).toBe("Small Acc");
    expect(classifyBandarStatus(50, 0)).toBe("Neutral");
    expect(classifyBandarStatus(46, -0.5)).toBe("Small Dist");
    expect(classifyBandarStatus(40, -2)).toBe("Normal Dist");
    expect(classifyBandarStatus(30, -5)).toBe("Big Dist");
  });

  it("computeBandarMatrix menghitung periode 1D s/d 20D", () => {
    const bars = Array.from({ length: 25 }, (_, i) => mockCandle(i, 1000 + i * 10));
    const ind = Array.from({ length: 25 }, (_, i) => mockIndicator(i, 65));

    const matrix = computeBandarMatrix(bars, ind);
    expect(matrix).toHaveLength(5);
    expect(matrix[0].label).toBe("1D");
    expect(matrix[4].label).toBe("20D (1M)");
    expect(matrix[0].status).toBe("Big Acc");
  });

  it("computeBandarMovementSeries menghitung kumulatif movement dan signal MA", () => {
    const ind = [
      mockIndicator(1, 60), // lpRaw = 1.0
      mockIndicator(2, 70), // lpRaw = 2.0
      mockIndicator(3, 40), // lpRaw = -1.0
    ];

    const series = computeBandarMovementSeries(ind, 2);
    expect(series).toHaveLength(3);
    expect(series[0].movement).toBe(1.0);
    expect(series[1].movement).toBe(3.0);
    expect(series[2].movement).toBe(2.0);
    expect(series[2].signalMa).toBe(2.5); // (3.0 + 2.0) / 2
  });
});
