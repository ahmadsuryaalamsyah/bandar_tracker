import type { Interval, Range } from "@/lib/data/types";
import type { TradeProfileId } from "@/lib/indicators/config";
import type { MarketState } from "@/lib/indicators/types";

export type TradeOutcome = "target" | "stop" | "timeout";

/**
 * Satu trade hasil walk-forward. Semua nilai harga memakai harga eksekusi
 * (open bar setelah sinyal), bukan close bar sinyal.
 */
export interface BacktestTrade {
  /** Indeks bar tempat sinyal `Long` terbentuk. */
  signalIndex: number;
  signalTime: number;
  entryIndex: number;
  entryTime: number;
  exitIndex: number;
  exitTime: number;
  entry: number;
  stop: number;
  target: number;
  exitPrice: number;
  outcome: TradeOutcome;
  /** Hasil dalam satuan R (1R = entry − stop). */
  rMultiple: number;
  /** Maximum adverse excursion dalam R (≥ 0, makin besar makin tertekan). */
  maeR: number;
  /** Maximum favourable excursion dalam R (≥ 0). */
  mfeR: number;
  holdingBars: number;
  state: MarketState;
  /** analysis.strength.score saat sinyal (0-100). */
  strength: number;
  /** Rencana R:R saat sinyal, sebelum hasil sebenarnya. */
  plannedRewardRisk: number;
}

export interface BacktestStats {
  signals: number;
  trades: number;
  wins: number;
  losses: number;
  timeouts: number;
  /** wins / trades. */
  winRate: number;
  /** Rata-rata rMultiple — inti kelayakan sebuah sistem. */
  expectancyR: number;
  avgWinR: number | null;
  avgLossR: number | null;
  /** Total profit kotor / total loss kotor; null bila tak ada loss (tak terdefinisi). */
  profitFactor: number | null;
  totalR: number;
  /** Drawdown maksimum kurva ekuitas (dalam R). */
  maxDrawdownR: number;
  avgHoldingBars: number;
  avgMaeR: number;
  avgMfeR: number;
  /** Kurva ekuitas kumulatif per trade (dalam R). */
  equityCurve: number[];
}

export interface BacktestResult {
  trades: BacktestTrade[];
  stats: BacktestStats;
  /** Bar awal yang dilewati karena histori belum cukup. */
  warmupBars: number;
  /** Jumlah bar yang dievaluasi untuk sinyal. */
  testedBars: number;
  /** Total bar yang tersedia. */
  totalBars: number;
}

/** Payload GET /api/backtest. */
export interface BacktestResponse {
  ticker: string;
  name?: string;
  currency: string;
  interval: Interval;
  range: Range;
  quoteTime: number | null;
  source: string;
  /** Profil trade yang dipakai saat menjalankan backtest. */
  profile: TradeProfileId;
  /** Waktu komputasi selesai (epoch ms). */
  generatedAt: number;
  result: BacktestResult;
}
