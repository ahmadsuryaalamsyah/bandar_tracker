import type { OhlcvSeries } from "@/lib/data/types";
import { computeIndicators } from "@/lib/indicators";
import { defaultIndicatorConfig, type IndicatorConfig } from "@/lib/indicators/config";
import type { ScreenerRow } from "./types";

/** Bangun baris screening dari satu seri OHLCV. Pure (tanpa I/O). */
export function buildScreenerRow(
  series: OhlcvSeries,
  config: IndicatorConfig = defaultIndicatorConfig,
): ScreenerRow {
  const base: ScreenerRow = {
    ticker: series.ticker,
    name: series.name,
    currency: series.currency,
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
  };

  const bars = series.bars;
  if (bars.length === 0) {
    return { ...base, note: "Data harga tidak tersedia." };
  }

  const last = bars[bars.length - 1];
  const previousClose = bars.length > 1 ? bars[bars.length - 2].c : last.o;
  const change = last.c - previousClose;
  const changePct = previousClose > 0 ? change / previousClose : 0;

  const { analysis, tradePlan } = computeIndicators(bars, config);

  const gates = tradePlan?.gates ?? [];
  const passed = gates.filter((gate) => gate.passed).length;
  const firstFail = gates.find((gate) => !gate.passed);
  const hasPlan = tradePlan !== null && gates.length > 0;

  return {
    ...base,
    price: last.c,
    change,
    changePct,
    state: analysis?.state ?? null,
    strength: analysis?.strength.label ?? null,
    score: analysis?.strength.score ?? null,
    direction: tradePlan?.direction ?? null,
    entry: tradePlan?.entry ?? null,
    stop: tradePlan?.stop ?? null,
    target: tradePlan?.target ?? null,
    rewardRisk: tradePlan?.rewardRisk ?? null,
    horizonDays: tradePlan?.horizonDays ?? null,
    gatesPassed: hasPlan ? passed : null,
    gatesTotal: hasPlan ? gates.length : null,
    blockedBy: firstFail?.label ?? null,
    note: tradePlan?.note ?? null,
  };
}

export function buildScreenerErrorRow(ticker: string, message: string): ScreenerRow {
  return {
    ticker,
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
    error: message,
  };
}

/**
 * Bandingkan dua nilai `number | null` secara menurun, `null` dianggap paling kecil.
 * Ditulis eksplisit karena `-Infinity - -Infinity` menghasilkan NaN, yang membuat
 * `Array.sort` berperilaku tidak deterministik.
 */
function compareNullableDesc(a: number | null, b: number | null): number {
  const left = a ?? -Infinity;
  const right = b ?? -Infinity;
  if (left === right) return 0;
  return right - left;
}

function byRewardRiskThenScore(a: ScreenerRow, b: ScreenerRow): number {
  const byRewardRisk = compareNullableDesc(a.rewardRisk, b.rewardRisk);
  if (byRewardRisk !== 0) return byRewardRisk;
  return compareNullableDesc(a.score, b.score);
}

/** Saring saham yang lolos semua gate (Long), lalu urutkan R:R & skor menurun. */
export function selectGoodToBuy(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.filter((row) => row.direction === "Long").sort(byRewardRiskThenScore);
}

/**
 * Saham yang gagal **tepat satu** gate — kandidat terdekat untuk lolos.
 * Berguna saat tidak ada yang lolos: memberi tahu apa yang hampir berhasil,
 * bukan sekadar daftar kosong.
 */
export function selectNearMisses(rows: ScreenerRow[], limit = 5): ScreenerRow[] {
  return rows
    .filter(
      (row) =>
        !row.error &&
        row.direction === "No Trade" &&
        row.gatesTotal !== null &&
        row.gatesPassed === row.gatesTotal - 1,
    )
    .sort(byRewardRiskThenScore)
    .slice(0, limit);
}

/** Hitung penyebab tersaringnya, diurutkan dari yang paling sering. */
export function summarizeBlockers(rows: ScreenerRow[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.error || row.direction !== "No Trade" || !row.blockedBy) continue;
    counts.set(row.blockedBy, (counts.get(row.blockedBy) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
