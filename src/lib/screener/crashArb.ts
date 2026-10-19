import type { OhlcvSeries } from "@/lib/data/types";
import { computeIndicators } from "@/lib/indicators";
import { defaultIndicatorConfig } from "@/lib/indicators/config";
import { computeAtr } from "@/lib/indicators/atr";

/**
 * Skor oportunitas arb crash untuk satu saham.
 * Skala 0-100 (makin tinggi = makin menarik untuk arb recovery).
 *
 * Filosofi:
 *   Saat crash massal (MSCI rebalancing, kepanikan global, aksi jual institusi),
 *   saham-saham yang ikut jatuh karena *forced selling* — bukan karena masalah
 *   fundamental — cenderung rebound lebih cepat dari indeks.
 *   Kandidat arb ideal: drawdown tajam + volume spike (panic sell) +
 *   LPM mulai pulih (beli sudah masuk) + struktur harga belum rusak.
 */
export interface CrashArbRow {
  ticker: string;
  name?: string;
  currency: string;
  price: number | null;

  /** Perubahan harga 1 hari (persentase). */
  changePct1d: number | null;
  /** Perubahan harga 5 hari (persentase). Proxy drawdown jangka pendek. */
  changePct5d: number | null;
  /** Perubahan harga 20 hari (persentase). */
  changePct20d: number | null;

  /** LPM saat ini (0-100, <40 = tekanan jual kuat = oversold). */
  lpm: number | null;
  /** Intensity saat ini (>65 = ada spike aktivitas). */
  intensity: number | null;
  /** Volume relatif vs rata-rata 20 hari. */
  rvol: number | null;

  /** State pasar (dari analyzeSignal). */
  marketState: string | null;
  /** Trend label. */
  trendLabel: string | null;

  /** Drawdown dari recent high 50-bar (persentase negatif). */
  drawdownFromHigh: number | null;

  /** ATR-14 untuk ukuran risk. */
  atr: number | null;
  /** Potensi R:R ke SMA20 (jarak ke SMA20 / ATR). */
  potentialToSma20: number | null;

  /**
   * Skor arb 0-100.
   * Komponen: drawdown tajam + volume spike + LPM oversold + struktur belum rusak.
   */
  arbScore: number | null;

  /** Label kelayakan: "Prime" | "Watchlist" | "Terlalu Rusak". */
  arbLabel: "Prime" | "Watchlist" | "Terlalu Rusak" | null;

  /** Alasan singkat. */
  reason: string | null;

  error?: string | null;
}

export interface CrashArbResponse {
  rows: CrashArbRow[];
  generatedAt: number;
  /** Kondisi pasar keseluruhan berdasarkan rata-rata drawdown semua saham. */
  marketDrawdown: number | null;
  /** Persentase saham yang turun >3% dalam 5 hari. */
  breadthDown: number | null;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Hitung semua metrik dan skor arb dari satu seri OHLCV.
 * Pure function, tidak ada I/O.
 */
export function buildCrashArbRow(series: OhlcvSeries): CrashArbRow {
  const base: CrashArbRow = {
    ticker: series.ticker,
    name: series.name,
    currency: series.currency,
    price: null,
    changePct1d: null,
    changePct5d: null,
    changePct20d: null,
    lpm: null,
    intensity: null,
    rvol: null,
    marketState: null,
    trendLabel: null,
    drawdownFromHigh: null,
    atr: null,
    potentialToSma20: null,
    arbScore: null,
    arbLabel: null,
    reason: null,
    error: null,
  };

  const bars = series.bars;
  if (bars.length < 25) {
    return { ...base, error: "Data tidak cukup (min 25 bar)." };
  }

  const last = bars[bars.length - 1];
  const close = last.c;

  // ── Perubahan harga multi-periode ─────────────────────────────────────────
  const prev1 = bars.length > 1 ? bars[bars.length - 2].c : last.o;
  const prev5 = bars.length > 5 ? bars[bars.length - 6].c : null;
  const prev20 = bars.length > 20 ? bars[bars.length - 21].c : null;

  const changePct1d = prev1 > 0 ? (close - prev1) / prev1 : null;
  const changePct5d = prev5 && prev5 > 0 ? (close - prev5) / prev5 : null;
  const changePct20d = prev20 && prev20 > 0 ? (close - prev20) / prev20 : null;

  // ── Indikator ─────────────────────────────────────────────────────────────
  const { series: indSeries, analysis } = computeIndicators(bars, defaultIndicatorConfig);
  const latest = indSeries[indSeries.length - 1];

  const lpm = latest?.lpm ?? null;
  const intensity = latest?.intensity ?? null;
  const rvol = latest?.rvol ?? null;

  // ── Drawdown dari recent high 50-bar ──────────────────────────────────────
  const lookback = Math.min(50, bars.length);
  const start50 = bars.length - lookback;
  let recentHigh = -Infinity;
  for (let i = start50; i < bars.length; i++) {
    recentHigh = Math.max(recentHigh, bars[i].h);
  }
  const drawdownFromHigh = recentHigh > 0 ? (close / recentHigh - 1) : null;

  // ── ATR & potensi ke SMA20 ────────────────────────────────────────────────
  const atrSeries = computeAtr(bars, 14);
  const atr = atrSeries[atrSeries.length - 1];

  // Hitung SMA20
  const closes = bars.map((b) => b.c);
  const sma20Window = closes.slice(Math.max(0, closes.length - 20));
  const sma20 = sma20Window.reduce((s, v) => s + v, 0) / sma20Window.length;
  const distToSma20 = sma20 - close; // positif = harga di bawah SMA20
  const potentialToSma20 =
    Number.isFinite(atr) && atr > 0 ? distToSma20 / atr : null;

  // ── Scoring Arb ───────────────────────────────────────────────────────────
  // Komponen 1: Drawdown tajam (30 poin, makin dalam makin poin)
  //   -5%  → 10 poin, -10% → 20 poin, -20% → 30 poin
  const drawdownScore =
    drawdownFromHigh !== null
      ? clamp((Math.abs(drawdownFromHigh) / 0.2) * 30, 0, 30)
      : 0;

  // Komponen 2: Oversold LPM (25 poin, LPM<38 = tekanan jual keras)
  //   LPM 38 → 0, LPM 25 → 25
  const lpmScore =
    lpm !== null ? clamp(((38 - lpm) / 13) * 25, 0, 25) : 0;

  // Komponen 3: Volume spike / panic sell (20 poin, RVOL>2)
  //   RVOL 1 → 0, RVOL 3+ → 20
  const rvolScore =
    rvol !== null ? clamp(((rvol - 1) / 2) * 20, 0, 20) : 0;

  // Komponen 4: Struktur trend belum rusak total (15 poin)
  //   Bullish=15, Sideways=10, Bearish=0
  const trendLabel = analysis?.trend.label ?? null;
  const structureScore =
    trendLabel === "Bullish" ? 15 : trendLabel === "Sideways" ? 10 : 0;

  // Komponen 5: Intensity tinggi — ada partisipasi (10 poin)
  //   intensity<50 = 0, 50-70 = linear, >70 = 10
  const intensityScore =
    intensity !== null ? clamp(((intensity - 50) / 20) * 10, 0, 10) : 0;

  const arbScore = clamp(
    drawdownScore + lpmScore + rvolScore + structureScore + intensityScore,
    0,
    100,
  );

  // ── Label kelayakan ───────────────────────────────────────────────────────
  let arbLabel: CrashArbRow["arbLabel"] = null;
  let reason = "";

  // Struktur rusak parah — skip
  if (trendLabel === "Bearish" && (drawdownFromHigh ?? 0) < -0.25) {
    arbLabel = "Terlalu Rusak";
    reason = "Trend bearish + drawdown >25% — bukan kandidat arb.";
  } else if (arbScore >= 50) {
    arbLabel = "Prime";
    const parts: string[] = [];
    if ((drawdownFromHigh ?? 0) < -0.08) parts.push(`Turun ${(Math.abs(drawdownFromHigh ?? 0) * 100).toFixed(1)}% dari high`);
    if (lpm !== null && lpm < 40) parts.push(`LPM oversold (${lpm.toFixed(0)})`);
    if (rvol !== null && rvol > 2) parts.push(`Volume spike ${rvol.toFixed(1)}x`);
    reason = parts.length > 0 ? parts.join(" · ") : "Skor arb tinggi.";
  } else if (arbScore >= 25) {
    arbLabel = "Watchlist";
    reason = "Drawdown moderat atau belum cukup oversold — pantau saja.";
  } else {
    arbLabel = "Terlalu Rusak";
    reason = "Skor arb rendah — belum ada tanda forced selling atau sudah rebound.";
  }

  return {
    ...base,
    price: close,
    changePct1d,
    changePct5d,
    changePct20d,
    lpm,
    intensity,
    rvol,
    marketState: analysis?.state ?? null,
    trendLabel,
    drawdownFromHigh,
    atr: Number.isFinite(atr) ? atr : null,
    potentialToSma20,
    arbScore,
    arbLabel,
    reason,
  };
}

/**
 * Urutkan kandidat: Prime dulu, lalu by arbScore desc, Terlalu Rusak paling bawah.
 * Di dalam tiap grup, urut by drawdown terbesar (paling dalam = paling menarik).
 */
export function sortCrashArbRows(rows: CrashArbRow[]): CrashArbRow[] {
  const order = { Prime: 0, Watchlist: 1, "Terlalu Rusak": 2 };
  return [...rows].sort((a, b) => {
    const labelA = order[a.arbLabel ?? "Terlalu Rusak"];
    const labelB = order[b.arbLabel ?? "Terlalu Rusak"];
    if (labelA !== labelB) return labelA - labelB;
    return (b.arbScore ?? 0) - (a.arbScore ?? 0);
  });
}

/**
 * Hitung kondisi pasar keseluruhan dari sekumpulan baris arb.
 */
export function summarizeCrashMarket(rows: CrashArbRow[]): {
  marketDrawdown: number | null;
  breadthDown: number | null;
} {
  const valid = rows.filter((r) => !r.error && r.drawdownFromHigh !== null);
  if (valid.length === 0) return { marketDrawdown: null, breadthDown: null };

  const marketDrawdown =
    valid.reduce((s, r) => s + (r.drawdownFromHigh ?? 0), 0) / valid.length;

  const downCount = valid.filter((r) => (r.changePct5d ?? 0) < -0.03).length;
  const breadthDown = downCount / valid.length;

  return { marketDrawdown, breadthDown };
}
