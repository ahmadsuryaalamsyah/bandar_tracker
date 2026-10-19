/** Minimal OHLCV candle yang dibutuhkan lapisan indikator (tanpa dependensi ke lapisan data). */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/* ------------------------------------------------------------------ */
/* Label komponen signal engine                                       */
/* ------------------------------------------------------------------ */

export type TrendLabel = "Bullish" | "Bearish" | "Sideways";

export type MomentumLabel = "Strengthening" | "Cooling" | "Weak" | "Recovering";

export type VolumeLabel = "Expanding" | "Normal" | "Contracting";

export type RiskLabel = "Low" | "Moderate" | "High";

export type StrengthLabel = "Weak" | "Moderate" | "Strong";

/** State pasar keseluruhan (turunan dari komponen trend/momentum/volume). */
export type MarketState =
  | "Strong Buying"
  | "Accumulation"
  | "Bullish Consolidation"
  | "Neutral"
  | "Distribution"
  | "Bearish Consolidation"
  | "Strong Selling";

/** State utama; dipertahankan agar UI/test yang sudah ada tetap bekerja. */
export type SignalLabel = MarketState;

/* ------------------------------------------------------------------ */
/* Analisis komponen                                                  */
/* ------------------------------------------------------------------ */

export interface TrendAnalysis {
  label: TrendLabel;
  /** -1..+1 (0 = netral). */
  score: number;
  /** |score| sebagai kekuatan komponen. */
  strength: number;
  closeVsSma20: number;
  closeVsSma50: number | null;
  sma20VsSma50: number | null;
  sma20Slope: number;
  /** 0..1 posisi close di dalam range recent high/low. */
  positionInRange: number;
}

export interface MomentumAnalysis {
  label: MomentumLabel;
  score: number;
  lpmSlope: number;
  intensitySlope: number;
  returnMomentum: number;
}

export interface VolumeAnalysis {
  label: VolumeLabel;
  score: number;
  volumeRatio: number;
  rotationSlope: number;
  /** Volume rata-rata candle turun dibagi candle naik; > 1 = tekanan jual. */
  sellVolumeRatio: number;
}

export interface RiskAnalysis {
  label: RiskLabel;
  /** 0..1. */
  score: number;
  volatilityRatio: number;
  drawdownFromHigh: number;
  extendedAboveSma50: number;
}

export interface StrengthAnalysis {
  label: StrengthLabel;
  /** 0..100, heuristik kesepakatan komponen — bukan probabilitas. */
  score: number;
}

export type TradeDirection = "Long" | "No Trade";

export interface TradePlanGate {
  label: string;
  passed: boolean;
}

/**
 * Rencana trading indikatif (swing harian). Bukan rekomendasi investasi.
 * Level diturunkan dari ATR + swing pivot; arah hanya "Long" bila semua gate lolos.
 */
export interface TradePlan {
  direction: TradeDirection;
  valid: boolean;
  entry: number | null;
  stop: number | null;
  target: number | null;
  /** (target − entry) / (entry − stop). */
  rewardRisk: number | null;
  /** Perkiraan waktu tempuh ke target, dalam hari bursa. */
  horizonDays: number | null;
  stopBasis: "support" | "atr" | null;
  targetBasis: "resistance" | "atr" | null;
  atr: number;
  /** Rata-rata nilai transaksi (harga × volume) pada lookback. */
  avgValue: number;
  gates: TradePlanGate[];
  note: string | null;
  basis: string[];
}

export interface SignalAnalysis {
  state: MarketState;
  strength: StrengthAnalysis;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  volume: VolumeAnalysis;
  risk: RiskAnalysis;
  explanation: string;
}

/* ------------------------------------------------------------------ */
/* Seri indikator                                                     */
/* ------------------------------------------------------------------ */

export interface IndicatorPoint {
  t: number;
  /** Liquidity Pressure (LPM-like), 0-100 (50 netral). */
  lpm: number;
  /** Intensity aktivitas, 0-100 (50 = normal). */
  intensity: number;
  /** Volume Rotation, 0-100 (50 netral). */
  rotation: number;
  lpRaw: number;
  intensityRaw: number;
  rotationRaw: number;
  /** Volume relatif terhadap rata-rata window. */
  rvol: number;
  /** Close location value, -1..1. */
  clv: number;
}

export interface IndicatorsResult {
  series: IndicatorPoint[];
  latest: IndicatorPoint | null;
  signal: SignalLabel;
  analysis: SignalAnalysis | null;
  tradePlan: TradePlan | null;
}
