import type { MarketState, StrengthLabel, TradeDirection } from "@/lib/indicators/types";
import type { TradeProfileId } from "@/lib/indicators/config";

/**
 * Satu baris hasil screening untuk sebuah ticker.
 * Semua field "null" berarti data belum/tidak tersedia (mis. ticker gagal dimuat).
 */
export interface ScreenerRow {
  ticker: string;
  name?: string;
  currency: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  state: MarketState | null;
  strength: StrengthLabel | null;
  /** analysis.strength.score (0-100). */
  score: number | null;
  direction: TradeDirection | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  rewardRisk: number | null;
  horizonDays: number | null;
  /** Jumlah gate yang lolos (untuk menampilkan "hampir lolos"). */
  gatesPassed: number | null;
  gatesTotal: number | null;
  /** Label gate pertama yang gagal — dipakai mengelompokkan penyebab tersaringnya. */
  blockedBy: string | null;
  /** Alasan `No Trade` (tradePlan.note). */
  note: string | null;
  /** Pesan error bila fetch/compute ticker ini gagal. */
  error?: string | null;
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  generatedAt: number;
  /** Profil trade yang dipakai saat memindai. */
  profile: TradeProfileId;
}
