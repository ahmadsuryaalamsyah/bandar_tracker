import { describe, expect, it } from "vitest";
import {
  configForProfile,
  defaultIndicatorConfig,
  TRADE_PROFILES,
  isTradeProfileId,
} from "@/lib/indicators/config";
import { computeIndicators } from "@/lib/indicators";
import { buildTradePlan } from "@/lib/indicators/tradePlan";
import type { Candle } from "@/lib/indicators/types";

/* ------------------------------------------------------------------ */
/* Fixture builder (deterministik)                                    */
/* ------------------------------------------------------------------ */

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

/** Harga realistis IDX + volume besar agar lolos gate likuiditas profil cepat. */
const liquidUptrend = buildCandles(ramp(120, 1000, 2000), flat(120, 20_000_000), 0.5);
const liquidDowntrend = buildCandles(ramp(120, 2000, 1000), flat(120, 20_000_000), -0.5);
/** Harga kecil (≈100) -> nilai transaksi jauh di bawah ambang profil cepat. */
const cheapUptrend = buildCandles(ramp(120, 100, 200), flat(120, 20_000_000), 0.5);
/** Uptrend tapi volume terus mengering di 10 bar terakhir. */
const contractingUptrend = buildCandles(
  ramp(120, 1000, 2000),
  [...ramp(110, 25_000_000, 20_000_000), ...ramp(10, 8_000_000, 900_000)],
  0.5,
);

function planFor(candles: Candle[], profile: "swing" | "fast") {
  const config = configForProfile(profile);
  const analysis = computeIndicators(candles, config).analysis!;
  return buildTradePlan({ candles, analysis, config });
}

/* ------------------------------------------------------------------ */

describe("trade profile registry", () => {
  it("mengenali id profil yang valid", () => {
    expect(isTradeProfileId("swing")).toBe(true);
    expect(isTradeProfileId("fast")).toBe(true);
    expect(isTradeProfileId("scalp")).toBe(false);
  });

  it("configForProfile mengubah tradePlan & backtest saja, bukan indikator", () => {
    const swing = configForProfile("swing");
    const fast = configForProfile("fast");

    expect(swing.tradePlan).toBe(defaultIndicatorConfig.tradePlan);
    expect(swing.backtest).toBe(defaultIndicatorConfig.backtest);
    expect(swing).toEqual(defaultIndicatorConfig);

    expect(fast.window).toBe(defaultIndicatorConfig.window);
    expect(fast.scales).toEqual(defaultIndicatorConfig.scales);
    expect(fast.tradePlan).not.toBe(defaultIndicatorConfig.tradePlan);
    expect(fast.backtest.maxHoldingBars).toBe(3);
  });

  it("setiap profil punya backtest dengan holding yang cocok horizonnya", () => {
    expect(TRADE_PROFILES.swing.backtest.maxHoldingBars).toBeGreaterThan(
      TRADE_PROFILES.swing.tradePlan.maxHorizonDays,
    );
    expect(TRADE_PROFILES.fast.backtest.maxHoldingBars).toBe(
      TRADE_PROFILES.fast.tradePlan.maxHorizonDays,
    );
  });
});

describe("profil cepat (1-3 hari)", () => {
  it("uptrend likuid -> Long dengan horizon 1-3 hari dan gate lengkap", () => {
    const plan = planFor(liquidUptrend, "fast");
    expect(plan.direction).toBe("Long");
    expect(plan.horizonDays).toBeGreaterThanOrEqual(1);
    expect(plan.horizonDays).toBeLessThanOrEqual(3);
    expect(plan.rewardRisk!).toBeGreaterThanOrEqual(TRADE_PROFILES.fast.tradePlan.minRewardRisk);
    expect(plan.gates).toHaveLength(6);
    expect(plan.gates.every((gate) => gate.passed)).toBe(true);
    expect(plan.gates[0].label).toBe("Harga di atas SMA20");
  });

  it("mengganti gate trend menjadi 'Harga di atas SMA20' (bukan SMA50)", () => {
    const plan = planFor(liquidUptrend, "fast");
    expect(plan.gates.map((gate) => gate.label)).toContain("Harga di atas SMA20");
    expect(plan.gates.map((gate) => gate.label)).not.toContain("Trend bullish");
  });

  it("harga di bawah SMA20 -> No Trade dengan alasan SMA20", () => {
    const plan = planFor(liquidDowntrend, "fast");
    expect(plan.direction).toBe("No Trade");
    expect(plan.note).toMatch(/SMA20/);
  });

  it("volume berkontraksi -> gate volume menggagalkan setup", () => {
    const plan = planFor(contractingUptrend, "fast");
    const volumeGate = plan.gates.find((gate) => gate.label === "Volume mengembang");
    expect(volumeGate).toBeDefined();
    if (!volumeGate!.passed) {
      expect(plan.direction).toBe("No Trade");
      expect(plan.note).toMatch(/volume/i);
    }
  });

  it("likuiditas di bawah 5 miliar -> No Trade", () => {
    const plan = planFor(cheapUptrend, "fast");
    expect(plan.avgValue).toBeLessThan(TRADE_PROFILES.fast.tradePlan.minAvgValue);
    expect(plan.gates.find((gate) => gate.label === "Likuiditas cukup")?.passed).toBe(false);
    expect(plan.note).toMatch(/kurang likuid/i);
  });

  it("horizon tidak pernah melebihi 3 hari pada data acak", () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const closes = Array.from({ length: 120 }, (_, i) => 1000 + Math.sin((i + seed) / 4) * 40 + i * 2);
      const candles = buildCandles(closes, flat(120, 20_000_000), 0.3);
      const plan = planFor(candles, "fast");
      if (plan.horizonDays !== null) {
        expect(plan.horizonDays).toBeLessThanOrEqual(3);
        expect(plan.horizonDays).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("profil swing tidak berubah", () => {
  it("tetap 5 gate dengan gate trend 'Trend bullish'", () => {
    const plan = planFor(liquidUptrend, "swing");
    expect(plan.gates).toHaveLength(5);
    expect(plan.gates[0].label).toBe("Trend bullish");
    expect(plan.gates.map((gate) => gate.label)).not.toContain("Volume mengembang");
  });

  it("horizon swing boleh jauh lebih panjang dari profil cepat", () => {
    const swing = planFor(liquidUptrend, "swing");
    const fast = planFor(liquidUptrend, "fast");
    expect(swing.horizonDays!).toBeGreaterThan(fast.horizonDays!);
  });
});
