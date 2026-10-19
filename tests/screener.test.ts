import { describe, expect, it } from "vitest";
import type { OhlcvBar, OhlcvSeries } from "@/lib/data/types";
import { configForProfile } from "@/lib/indicators/config";
import { MAX_TICKERS_PER_REQUEST, SCAN_CHUNK_GAP_MS } from "@/lib/screener/limits";
import {
  buildScreenerErrorRow,
  buildScreenerRow,
  selectGoodToBuy,
  selectNearMisses,
  summarizeBlockers,
} from "@/lib/screener/select";
import type { ScreenerRow } from "@/lib/screener/types";
import { DEFAULT_UNIVERSE } from "@/lib/screener/universe";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildCandles(closes: number[], volumes: number[], clv = 0): OhlcvBar[] {
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

function seriesFrom(bars: OhlcvBar[], ticker = "TEST"): OhlcvSeries {
  return {
    ticker,
    symbol: `${ticker}.JK`,
    name: `${ticker} Tbk`,
    currency: "IDR",
    exchange: "JKSE",
    timezone: "Asia/Jakarta",
    interval: "1d",
    range: "1y",
    quoteTime: null,
    source: "test",
    bars,
  };
}

function row(partial: Partial<ScreenerRow>): ScreenerRow {
  return {
    ticker: "X",
    currency: "IDR",
    price: null,
    change: null,
    changePct: null,
    state: null,
    strength: null,
    score: null,
    direction: null,
    entry: null,
    stop: null,
    target: null,
    rewardRisk: null,
    horizonDays: null,
    gatesPassed: null,
    gatesTotal: null,
    blockedBy: null,
    note: null,
    error: null,
    ...partial,
  };
}

/* ------------------------------------------------------------------ */
/* buildScreenerRow                                                   */
/* ------------------------------------------------------------------ */

describe("buildScreenerRow", () => {
  const uptrend = seriesFrom(buildCandles(ramp(120, 100, 200), flat(120, 20_000_000), 0.5), "UP");
  const downtrend = seriesFrom(buildCandles(ramp(120, 200, 100), flat(120, 20_000_000), -0.5), "DOWN");

  it("uptrend likuid -> Long dengan harga & perubahan dari dua bar terakhir", () => {
    const result = buildScreenerRow(uptrend);
    const bars = uptrend.bars;
    const last = bars[bars.length - 1].c;
    const prev = bars[bars.length - 2].c;

    expect(result.ticker).toBe("UP");
    expect(result.direction).toBe("Long");
    expect(result.price).toBeCloseTo(last, 6);
    expect(result.change).toBeCloseTo(last - prev, 6);
    expect(result.changePct).toBeCloseTo((last - prev) / prev, 10);
    expect(result.state).not.toBeNull();
    expect(result.score).not.toBeNull();
    expect(result.rewardRisk).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.note).toBeNull();
  });

  it("downtrend -> No Trade dengan alasan", () => {
    const result = buildScreenerRow(downtrend);
    expect(result.direction).toBe("No Trade");
    expect(result.note).toMatch(/belum bullish/i);
  });

  it("data kosong -> nota tanpa error", () => {
    const result = buildScreenerRow(seriesFrom([], "EMPTY"));
    expect(result.price).toBeNull();
    expect(result.direction).toBeNull();
    expect(result.error).toBeNull();
    expect(result.note).toMatch(/tidak tersedia/i);
  });

  it("melaporkan jumlah gate yang lolos dan gate pertama yang memblokir", () => {
    const long = buildScreenerRow(uptrend);
    expect(long.gatesTotal).toBe(5);
    expect(long.gatesPassed).toBe(5);
    expect(long.blockedBy).toBeNull();

    // Downtrend: gate trend gagal lebih dulu, walau beberapa gate lain (R:R,
    // likuiditas) tetap lolos — jumlahnya saja tidak cukup, urutannya penting.
    const down = buildScreenerRow(downtrend);
    expect(down.gatesTotal).toBe(5);
    expect(down.gatesPassed).toBeLessThan(down.gatesTotal!);
    expect(down.blockedBy).toBe("Trend bullish");
  });

  it("memakai config profil yang diberikan (profil cepat -> 6 gate)", () => {
    const fast = buildScreenerRow(uptrend, configForProfile("fast"));
    expect(fast.gatesTotal).toBe(6);
    expect(fast.gatesPassed).not.toBeNull();
    expect(fast.blockedBy).not.toBe("Trend bullish");
  });

  it("ATR nol -> gate tidak dihitung (null)", () => {
    const flatBar: OhlcvBar = { t: 0, o: 100, h: 100, l: 100, c: 100, v: 1_000_000 };
    const result = buildScreenerRow(seriesFrom([flatBar], "FLAT"));
    expect(result.gatesPassed).toBeNull();
    expect(result.gatesTotal).toBeNull();
    expect(result.note).toMatch(/volatilitas/i);
  });
});

/* ------------------------------------------------------------------ */
/* selectNearMisses & summarizeBlockers                               */
/* ------------------------------------------------------------------ */

describe("selectNearMisses", () => {
  it("hanya mengambil No Trade yang gagal tepat satu gate, urut skor menurun", () => {
    const rows = [
      row({ ticker: "A", direction: "No Trade", gatesPassed: 4, gatesTotal: 5, score: 40 }),
      row({ ticker: "B", direction: "No Trade", gatesPassed: 3, gatesTotal: 5, score: 99 }),
      row({ ticker: "C", direction: "No Trade", gatesPassed: 4, gatesTotal: 5, score: 70 }),
      row({ ticker: "D", direction: "Long", gatesPassed: 5, gatesTotal: 5, score: 90 }),
      row({ ticker: "E", direction: "No Trade", gatesPassed: null, gatesTotal: null, score: 80 }),
    ];
    expect(selectNearMisses(rows).map((r) => r.ticker)).toEqual(["C", "A"]);
  });

  it("menghormati limit", () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      row({ ticker: `T${i}`, direction: "No Trade", gatesPassed: 4, gatesTotal: 5, score: i }),
    );
    expect(selectNearMisses(rows, 3)).toHaveLength(3);
  });
});

describe("summarizeBlockers", () => {
  it("mengelompokkan penyebab dan mengurutkan dari yang terbanyak", () => {
    const rows = [
      row({ ticker: "A", direction: "No Trade", blockedBy: "Trend bullish" }),
      row({ ticker: "B", direction: "No Trade", blockedBy: "Trend bullish" }),
      row({ ticker: "C", direction: "No Trade", blockedBy: "R:R ≥ 2" }),
      row({ ticker: "D", direction: "Long", blockedBy: null }),
      row({ ticker: "E", error: "gagal", direction: "No Trade", blockedBy: "Likuiditas cukup" }),
    ];
    expect(summarizeBlockers(rows)).toEqual([
      { label: "Trend bullish", count: 2 },
      { label: "R:R ≥ 2", count: 1 },
    ]);
  });

  it("kosong bila tidak ada yang tersaring", () => {
    expect(summarizeBlockers([row({ direction: "Long" })])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* selectGoodToBuy                                                    */
/* ------------------------------------------------------------------ */

describe("selectGoodToBuy", () => {
  it("membuang No Trade/error dan mengurutkan R:R lalu skor menurun", () => {
    const rows = [
      row({ ticker: "A", direction: "Long", rewardRisk: 2.1, score: 40 }),
      row({ ticker: "B", direction: "No Trade", rewardRisk: 5, score: 99 }),
      row({ ticker: "C", direction: "Long", rewardRisk: 3.0, score: 30 }),
      row({ ticker: "D", direction: "Long", rewardRisk: 3.0, score: 80 }),
      row({ ticker: "E", direction: null, error: "gagal" }),
    ];

    expect(selectGoodToBuy(rows).map((r) => r.ticker)).toEqual(["D", "C", "A"]);
  });

  it("mengembalikan array kosong bila tak ada Long", () => {
    expect(selectGoodToBuy([row({ direction: "No Trade" })])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* buildScreenerErrorRow                                              */
/* ------------------------------------------------------------------ */

describe("buildScreenerErrorRow", () => {
  it("menyimpan pesan error dan mennull-kan sisanya", () => {
    const result = buildScreenerErrorRow("ZZZZ", "Gagal memuat data saham.");
    expect(result.ticker).toBe("ZZZZ");
    expect(result.error).toBe("Gagal memuat data saham.");
    expect(result.direction).toBeNull();
    expect(result.price).toBeNull();
    expect(result.note).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* DEFAULT_UNIVERSE & batas pemindaian                                */
/* ------------------------------------------------------------------ */

describe("DEFAULT_UNIVERSE", () => {
  it("tidak punya duplikat (duplikat = permintaan upstream terbuang)", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const ticker of DEFAULT_UNIVERSE) {
      if (seen.has(ticker)) duplicates.push(ticker);
      seen.add(ticker);
    }
    expect(duplicates).toEqual([]);
  });

  it("semua kode berbentuk valid dan memakai huruf besar", () => {
    for (const ticker of DEFAULT_UNIVERSE) {
      expect(ticker).toMatch(/^[A-Z0-9]{2,8}$/);
    }
  });

  it("cukup besar untuk butuh pemindaian bertahap", () => {
    expect(DEFAULT_UNIVERSE.length).toBeGreaterThan(MAX_TICKERS_PER_REQUEST);
    expect(DEFAULT_UNIVERSE.length).toBeGreaterThan(100);
  });

  it("kode prioritas (likuid) berada di depan", () => {
    // Bila pemindaian terpotong, yang terpenting harus sudah terperiksa lebih dulu.
    expect(DEFAULT_UNIVERSE.slice(0, 4)).toEqual(["BBCA", "BBRI", "BMRI", "BBNI"]);
  });
});

describe("batas pemindaian", () => {
  it("batas per permintaan positif dan masuk akal", () => {
    expect(MAX_TICKERS_PER_REQUEST).toBeGreaterThan(0);
    expect(MAX_TICKERS_PER_REQUEST).toBeLessThanOrEqual(60);
    expect(SCAN_CHUNK_GAP_MS).toBeGreaterThan(0);
  });
});
