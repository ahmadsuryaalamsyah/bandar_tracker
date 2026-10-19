import { describe, expect, it } from "vitest";
import { evaluateSignalConfidence } from "@/lib/indicators/signalConfidence";
import type { Candle, IndicatorPoint } from "@/lib/indicators/types";
import type { DivergenceResult } from "@/lib/indicators/divergence";
import type { VsaAnalysisResult } from "@/lib/indicators/vsa";

describe("evaluateSignalConfidence", () => {
  const dummyDivergence: DivergenceResult = {
    hasDivergence: false,
    type: null,
    title: "",
    description: "",
    severity: "none",
    pricePivots: null,
    bandarPivots: null,
    divergenceAgeBars: 0,
  };

  const dummyVsa: VsaAnalysisResult = {
    hasPattern: false,
    type: null,
    title: "",
    description: "",
    actionBias: "Neutral",
    significance: "low",
    candleIndex: 0,
  };

  it("mengembalikan default score jika data kurang dari 30 bar", () => {
    const res = evaluateSignalConfidence([], [], dummyDivergence, dummyVsa, "Neutral");
    expect(res.score).toBe(50);
    expect(res.grade).toBe("B");
  });

  it("meningkatkan score dan grade saat terdapat konfluensi Bullish Divergence dan VSA", () => {
    const bars: Candle[] = Array.from({ length: 40 }, (_, i) => ({
      t: i,
      o: 1000 + i * 2,
      h: 1010 + i * 2,
      l: 995 + i * 2,
      c: 1005 + i * 2,
      v: 1000,
    }));

    const ind: IndicatorPoint[] = Array.from({ length: 40 }, (_, i) => ({
      t: i,
      lpm: 56,
      intensity: 50,
      rotation: 50,
      lpRaw: 1,
      intensityRaw: 1,
      rotationRaw: 1,
      rvol: 1,
      clv: 0.5,
    }));

    const bullDivergence: DivergenceResult = {
      ...dummyDivergence,
      hasDivergence: true,
      type: "regular_bullish",
      title: "Bullish Divergence",
      severity: "high",
    };

    const bullVsa: VsaAnalysisResult = {
      ...dummyVsa,
      hasPattern: true,
      type: "stopping_volume",
      title: "Stopping Volume",
      actionBias: "Bullish",
      significance: "high",
    };

    const res = evaluateSignalConfidence(bars, ind, bullDivergence, bullVsa, "Strong Buying");
    expect(res.score).toBeGreaterThanOrEqual(70);
    expect(["A+", "A"]).toContain(res.grade);
    expect(res.factors.length).toBeGreaterThan(0);
  });
});
