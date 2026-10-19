import { describe, expect, it } from "vitest";
import type { OhlcvBar, OhlcvSeries } from "@/lib/data/types";
import {
  buildCrashArbRow,
  sortCrashArbRows,
  summarizeCrashMarket,
  type CrashArbRow,
} from "@/lib/screener/crashArb";

function buildCandles(closes: number[], volumes: number[]): OhlcvBar[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1];
    const range = Math.max(Math.abs(c - o), c * 0.02);
    const h = Math.max(c, o) + range * 0.2;
    const l = Math.min(c, o) - range * 0.2;
    return { t: 1_700_000_000 + i * 86_400, o, h, l, c, v: volumes[i] };
  });
}

function makeSeries(closes: number[], volumes: number[], ticker = "BBCA"): OhlcvSeries {
  return {
    ticker,
    symbol: `${ticker}.JK`,
    name: `${ticker} Bank`,
    exchange: "IDX",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    interval: "1d",
    range: "1y",
    quoteTime: null,
    bars: buildCandles(closes, volumes),
    source: "yahoo",
  };
}

describe("crashArb engine", () => {
  it("mengembalikan row error jika data bar kurang dari 30", () => {
    const series = makeSeries([1000, 1020, 1010], [1000, 1000, 1000]);
    const row = buildCrashArbRow(series);
    expect(row.error).toBeDefined();
    expect(row.arbScore).toBeNull();
  });

  it("mendeteksi saham crash dengan volume spike dan memberi skor arb tinggi", () => {
    // 60 hari stabil/uptrend lalu 5 hari terakhir crash tajam dengan volume spike 3x
    const normalCloses = Array.from({ length: 60 }, (_, i) => 10000 + i * 20); // 10000 -> 11180
    const crashCloses = [10500, 10000, 9500, 9000, 8500]; // drawdown ~24%
    const closes = [...normalCloses, ...crashCloses];

    const normalVolumes = Array.from({ length: 60 }, () => 1_000_000);
    const spikeVolumes = [2_500_000, 3_000_000, 4_000_000, 5_000_000, 4_500_000]; // volume spike (forced selling)
    const volumes = [...normalVolumes, ...spikeVolumes];

    const series = makeSeries(closes, volumes, "BBCA");
    const row = buildCrashArbRow(series);

    expect(row.error).toBeFalsy();
    expect(row.price).toBe(8500);
    expect(row.drawdownFromHigh).toBeLessThan(-0.2); // drawdown > 20%
    expect(row.rvol).toBeGreaterThan(2); // spike volume > 2x
    expect(row.arbScore).toBeGreaterThan(45);
    expect(["Prime", "Watchlist"]).toContain(row.arbLabel);
  });

  it("sortCrashArbRows menaruh Prime di atas, terurut arbScore desc", () => {
    const mockRows: CrashArbRow[] = [
      {
        ticker: "RUSAK",
        currency: "IDR",
        price: 500,
        changePct1d: -0.05,
        changePct5d: -0.2,
        changePct20d: -0.3,
        lpm: 20,
        intensity: 50,
        rvol: 1,
        marketState: null,
        trendLabel: "Bearish",
        drawdownFromHigh: -0.5,
        atr: 20,
        potentialToSma20: 1,
        arbScore: 30,
        arbLabel: "Terlalu Rusak",
        reason: "Struktur rusak",
      },
      {
        ticker: "WATCH",
        currency: "IDR",
        price: 2000,
        changePct1d: -0.02,
        changePct5d: -0.07,
        changePct20d: -0.05,
        lpm: 35,
        intensity: 60,
        rvol: 1.8,
        marketState: null,
        trendLabel: "Bullish",
        drawdownFromHigh: -0.08,
        atr: 50,
        potentialToSma20: 1.5,
        arbScore: 42,
        arbLabel: "Watchlist",
        reason: "Drawdown moderat",
      },
      {
        ticker: "PRIME_HIGH",
        currency: "IDR",
        price: 8000,
        changePct1d: -0.04,
        changePct5d: -0.15,
        changePct20d: -0.12,
        lpm: 25,
        intensity: 75,
        rvol: 3.2,
        marketState: null,
        trendLabel: "Bullish",
        drawdownFromHigh: -0.18,
        atr: 120,
        potentialToSma20: 2.5,
        arbScore: 78,
        arbLabel: "Prime",
        reason: "Panic sell tajam",
      },
      {
        ticker: "PRIME_MID",
        currency: "IDR",
        price: 4000,
        changePct1d: -0.03,
        changePct5d: -0.12,
        changePct20d: -0.1,
        lpm: 30,
        intensity: 70,
        rvol: 2.5,
        marketState: null,
        trendLabel: "Bullish",
        drawdownFromHigh: -0.14,
        atr: 80,
        potentialToSma20: 2.0,
        arbScore: 65,
        arbLabel: "Prime",
        reason: "Drawdown tajam",
      },
    ];

    const sorted = sortCrashArbRows(mockRows);
    expect(sorted.map((r) => r.ticker)).toEqual([
      "PRIME_HIGH",
      "PRIME_MID",
      "WATCH",
      "RUSAK",
    ]);
  });

  it("summarizeCrashMarket menghitung marketDrawdown dan breadthDown dengan benar", () => {
    const rows: CrashArbRow[] = [
      {
        ticker: "A",
        currency: "IDR",
        price: 100,
        changePct1d: -0.02,
        changePct5d: -0.05, // <- turun > 3%
        changePct20d: -0.1,
        lpm: 30,
        intensity: 50,
        rvol: 2,
        marketState: null,
        trendLabel: null,
        drawdownFromHigh: -0.1,
        atr: 5,
        potentialToSma20: 1,
        arbScore: 50,
        arbLabel: "Prime",
        reason: null,
      },
      {
        ticker: "B",
        currency: "IDR",
        price: 200,
        changePct1d: -0.01,
        changePct5d: -0.01, // <- tidak turun > 3%
        changePct20d: 0.02,
        lpm: 45,
        intensity: 50,
        rvol: 1,
        marketState: null,
        trendLabel: null,
        drawdownFromHigh: -0.04,
        atr: 5,
        potentialToSma20: 1,
        arbScore: 30,
        arbLabel: "Watchlist",
        reason: null,
      },
    ];

    const summary = summarizeCrashMarket(rows);
    // Drawdown rata-rata: (-0.1 + -0.04) / 2 = -0.07
    expect(summary.marketDrawdown).toBeCloseTo(-0.07, 3);
    // 1 dari 2 turun > 3% = 0.5 (50%)
    expect(summary.breadthDown).toBe(0.5);
  });
});
