import { describe, expect, it } from "vitest";
import { defaultIndicatorConfig, type IndicatorConfig } from "@/lib/indicators/config";
import type { Candle, TradePlan } from "@/lib/indicators/types";
import { runBacktest, simulatePosition, summarizeTrades } from "@/lib/backtest/engine";
import type { BacktestTrade } from "@/lib/backtest/types";

/* ------------------------------------------------------------------ */
/* Fixture builder (deterministik, sama seperti test indikator lain)  */
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

const withBacktest = (overrides: Partial<IndicatorConfig["backtest"]>): IndicatorConfig => ({
  ...defaultIndicatorConfig,
  backtest: { ...defaultIndicatorConfig.backtest, ...overrides },
});

function trade(rMultiple: number, outcome: BacktestTrade["outcome"] = rMultiple > 0 ? "target" : "stop"): BacktestTrade {
  return {
    signalIndex: 0,
    signalTime: 0,
    entryIndex: 1,
    entryTime: 1,
    exitIndex: 2,
    exitTime: 2,
    entry: 100,
    stop: 90,
    target: 120,
    exitPrice: 100 + rMultiple * 10,
    outcome,
    rMultiple,
    maeR: 0,
    mfeR: 0,
    holdingBars: 2,
    state: "Accumulation",
    strength: 50,
    plannedRewardRisk: 2,
  };
}

/* ------------------------------------------------------------------ */
/* summarizeTrades                                                    */
/* ------------------------------------------------------------------ */

describe("summarizeTrades", () => {
  it("kosong -> statistik nol tanpa NaN", () => {
    const stats = summarizeTrades([], 3);
    expect(stats.signals).toBe(3);
    expect(stats.trades).toBe(0);
    expect(stats.expectancyR).toBe(0);
    expect(stats.profitFactor).toBeNull();
    expect(stats.avgWinR).toBeNull();
    expect(stats.equityCurve).toEqual([]);
  });

  it("menghitung win-rate, expectancy, profit factor, dan drawdown", () => {
    const stats = summarizeTrades([trade(2), trade(-1), trade(2), trade(-1)]);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(2);
    expect(stats.winRate).toBeCloseTo(0.5, 10);
    expect(stats.expectancyR).toBeCloseTo(0.5, 10);
    expect(stats.avgWinR).toBeCloseTo(2, 10);
    expect(stats.avgLossR).toBeCloseTo(-1, 10);
    expect(stats.profitFactor).toBeCloseTo(2, 10);
    expect(stats.totalR).toBeCloseTo(2, 10);
    expect(stats.equityCurve).toEqual([2, 1, 3, 2]);
    expect(stats.maxDrawdownR).toBeCloseTo(1, 10);
  });

  it("profit factor null saat tidak ada loss (tidak terdefinisi)", () => {
    expect(summarizeTrades([trade(2), trade(1)]).profitFactor).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* simulatePosition                                                   */
/* ------------------------------------------------------------------ */

describe("simulatePosition", () => {
  const plan = { stop: 90, target: 110, rewardRisk: 2 } as TradePlan & {
    stop: number;
    target: number;
    rewardRisk: number;
  };

  it("stop & target tersentuh di bar yang sama -> konservatif ambil stop", () => {
    const candles: Candle[] = [
      { t: 0, o: 100, h: 100, l: 100, c: 100, v: 1 },
      { t: 1, o: 100, h: 120, l: 80, c: 105, v: 1 },
    ];
    const result = simulatePosition(candles, 1, plan, defaultIndicatorConfig, 0, "Accumulation", 50);
    expect(result?.outcome).toBe("stop");
    expect(result?.exitPrice).toBe(90);
    expect(result?.rMultiple).toBeCloseTo(-1, 10);
    expect(result?.maeR).toBeCloseTo(2, 10);
    expect(result?.mfeR).toBeCloseTo(2, 10);
  });

  it("aturan longgar -> ambil target bila ambigu", () => {
    const candles: Candle[] = [
      { t: 0, o: 100, h: 100, l: 100, c: 100, v: 1 },
      { t: 1, o: 100, h: 120, l: 80, c: 105, v: 1 },
    ];
    const config = withBacktest({ stopFirstOnAmbiguous: false });
    const result = simulatePosition(candles, 1, plan, config, 0, "Accumulation", 50);
    expect(result?.outcome).toBe("target");
    expect(result?.rMultiple).toBeCloseTo(1, 10);
  });

  it("timeout: ditutup di close bar terakhir bila tak ada level tersentuh", () => {
    const candles: Candle[] = [
      { t: 0, o: 100, h: 100, l: 100, c: 100, v: 1 },
      { t: 1, o: 100, h: 101, l: 99, c: 101, v: 1 },
      { t: 2, o: 101, h: 102, l: 100, c: 102, v: 1 },
      { t: 3, o: 102, h: 103, l: 101, c: 103, v: 1 },
      { t: 4, o: 103, h: 104, l: 102, c: 104, v: 1 },
    ];
    const config = withBacktest({ maxHoldingBars: 3 });
    const result = simulatePosition(candles, 1, plan, config, 0, "Neutral", 50);
    expect(result?.outcome).toBe("timeout");
    expect(result?.exitIndex).toBe(3);
    expect(result?.exitPrice).toBe(103);
    expect(result?.holdingBars).toBe(3);
    expect(result?.rMultiple).toBeCloseTo(0.3, 10);
  });

  it("gap di bawah stop -> tidak ada trade (risk tidak positif)", () => {
    const candles: Candle[] = [
      { t: 0, o: 100, h: 100, l: 100, c: 100, v: 1 },
      { t: 1, o: 85, h: 88, l: 84, c: 86, v: 1 },
    ];
    expect(simulatePosition(candles, 1, plan, defaultIndicatorConfig, 0, "Neutral", 50)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* runBacktest                                                        */
/* ------------------------------------------------------------------ */

describe("runBacktest", () => {
  const uptrend = buildCandles(ramp(300, 100, 400), flat(300, 20_000_000), 0.5);
  const downtrend = buildCandles(ramp(300, 400, 100), flat(300, 20_000_000), -0.5);

  it("uptrend monoton -> semua trade menang di target", () => {
    const result = runBacktest({ candles: uptrend, config: defaultIndicatorConfig });
    expect(result.stats.trades).toBeGreaterThan(0);
    expect(result.stats.signals).toBeGreaterThanOrEqual(result.stats.trades);
    expect(result.stats.winRate).toBe(1);
    for (const item of result.trades) {
      expect(item.outcome).toBe("target");
      expect(item.rMultiple).toBeGreaterThan(0);
    }
  });

  it("tidak ada look-ahead: sinyal selalu >= warmup dan entry di open bar berikutnya", () => {
    const result = runBacktest({ candles: uptrend, config: defaultIndicatorConfig });
    for (const item of result.trades) {
      expect(item.signalIndex).toBeGreaterThanOrEqual(defaultIndicatorConfig.backtest.warmupBars);
      expect(item.entryIndex).toBe(item.signalIndex + defaultIndicatorConfig.backtest.entryDelayBars);
      expect(item.entry).toBe(uptrend[item.entryIndex].o);
      expect(item.exitIndex).toBeGreaterThanOrEqual(item.entryIndex);
    }
  });

  it("hanya satu posisi terbuka: trade berikutnya mulai setelah trade sebelumnya ditutup", () => {
    const result = runBacktest({ candles: uptrend, config: defaultIndicatorConfig });
    for (let i = 1; i < result.trades.length; i += 1) {
      expect(result.trades[i].signalIndex).toBeGreaterThan(result.trades[i - 1].exitIndex);
    }
  });

  it("downtrend -> tanpa sinyal Long dan tanpa trade", () => {
    const result = runBacktest({ candles: downtrend, config: defaultIndicatorConfig });
    expect(result.stats.trades).toBe(0);
    expect(result.stats.signals).toBe(0);
    expect(result.trades).toEqual([]);
  });

  it("data lebih pendek dari warmup -> tidak ada bar yang diuji", () => {
    const short = buildCandles(ramp(40, 100, 140), flat(40, 20_000_000), 0.5);
    const result = runBacktest({ candles: short, config: defaultIndicatorConfig });
    expect(result.testedBars).toBe(0);
    expect(result.stats.trades).toBe(0);
    expect(result.totalBars).toBe(40);
  });

  it("kosong -> hasil kosong tanpa error", () => {
    const result = runBacktest({ candles: [], config: defaultIndicatorConfig });
    expect(result.stats.trades).toBe(0);
    expect(result.stats.equityCurve).toEqual([]);
    expect(Number.isFinite(result.stats.expectancyR)).toBe(true);
  });

  it("maxTestBars membatasi jumlah bar yang dievaluasi", () => {
    const config = withBacktest({ maxTestBars: 50 });
    const result = runBacktest({ candles: uptrend, config });
    expect(result.testedBars).toBe(50);
  });

  it("selalu menghasilkan angka yang dapat dirender (tanpa NaN)", () => {
    const result = runBacktest({ candles: uptrend, config: withBacktest({ maxHoldingBars: 5 }) });
    const { stats } = result;
    for (const value of [
      stats.winRate,
      stats.expectancyR,
      stats.totalR,
      stats.maxDrawdownR,
      stats.avgHoldingBars,
      stats.avgMaeR,
      stats.avgMfeR,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
