/**
 * Seluruh bobot, skala, & ambang batas ada di sini (single source of truth).
 * Nilai-nilai ini adalah pilihan desain kami yang transparan dan dapat diubah,
 * BUKAN salinan formula proprietary platform lain. Lihat docs/FORMULAS.md.
 */
export interface IndicatorWeights {
  lpm: {
    /** Bobot posisi close dalam range candle (CLV). */
    closePosition: number;
    /** Bobot perubahan harga (return) yang dinormalisasi. */
    priceChange: number;
  };
  intensity: {
    volume: number;
    range: number;
    ret: number;
  };
  rotation: {
    vsAverage: number;
    vsPrevious: number;
  };
}

/** Konfigurasi signal engine (trend/momentum/volume/risk/strength). */
export interface SignalEngineConfig {
  /** Window pendek (EMA & rasio volume). */
  fastWindow: number;
  /** Window menengah (SMA20, EMA panjang indikator). */
  slowWindow: number;
  /** Window panjang (SMA50). */
  longWindow: number;
  /** Jarak bar untuk menghitung slope SMA20. */
  slopeLookback: number;
  /** Lookback untuk recent high/low & rasio volume jual. */
  rangeLookback: number;
  /** Jarak bar untuk momentum return. */
  returnMomentumWindow: number;
  thresholds: {
    trendBullish: number;
    trendBearish: number;
    momentumStrengthening: number;
    momentumWeak: number;
    volumeExpanding: number;
    volumeContracting: number;
    riskModerate: number;
    riskHigh: number;
    strengthModerate: number;
    strengthStrong: number;
    /** Rasio volume jual/beli yang dianggap elevated. */
    sellVolumeElevated: number;
    /** Ambang LPM untuk Accumulation saat trend bullish. */
    accumulationLpm: number;
    /** Ambang LPM untuk Accumulation saat sideways. */
    sidewaysAccumulationLpm: number;
    /** Ambang LPM untuk Distribution saat sideways. */
    sidewaysDistributionLpm: number;
  };
  scales: {
    trend: { d20: number; d50: number; sma: number; slope: number };
    momentum: { lpmSlope: number; lpmLevel: number; intensitySlope: number; ret: number };
    volume: { ratio: number; slope: number };
    risk: { volatility: number; drawdown: number; extension: number; sellVolume: number };
  };
  weights: {
    trend: { d20: number; d50: number; sma: number; slope: number; position: number };
    momentum: { lpmSlope: number; lpmLevel: number; intensitySlope: number; ret: number };
    volume: { ratio: number; slope: number };
    risk: {
      volatility: number;
      drawdown: number;
      belowSma50: number;
      sellVolume: number;
      extension: number;
      divergence: number;
    };
    strength: { magnitude: number; agreement: number; trend: number };
  };
}

export interface IndicatorConfig {
  /** Window untuk baseline volume/range/return (rolling). */
  window: number;
  weights: IndicatorWeights;
  /**
   * Skala pemetaan nilai mentah -> 0-100 (fixed-scale).
   * Semakin kecil, semakin cepat jenuh. Lihat docs/FORMULAS.md.
   */
  scales: {
    lpm: number;
    intensity: number;
    rotation: number;
  };
  signalEngine: SignalEngineConfig;
  tradePlan: TradePlanConfig;
  backtest: BacktestConfig;
}

/**
 * Konfigurasi backtest walk-forward.
 *
 * Evaluasi bersifat no-lookahead: sinyal pada bar `i` hanya memakai candle `0..i`,
 * dan eksekusi terjadi pada open bar berikutnya (bukan close bar sinyal).
 */
export interface BacktestConfig {
  /** Bar minimum sebelum sinyal boleh dihitung (menunggu SMA50 & lookback lain matang). */
  warmupBars: number;
  /** Batas maksimum menahan posisi; lewat ini posisi ditutup di close (timeout). */
  maxHoldingBars: number;
  /** Jeda eksekusi: 1 = masuk di open bar berikutnya setelah sinyal. */
  entryDelayBars: number;
  /** Bila stop & target tersentuh di bar yang sama, asumsikan stop lebih dulu (konservatif). */
  stopFirstOnAmbiguous: boolean;
  /** Batas jumlah bar terakhir yang dievaluasi (biaya walk-forward ~O(n²)). */
  maxTestBars: number;
}

/** Konfigurasi Trade Plan (swing harian). */
export interface TradePlanConfig {
  /** Periode ATR (Wilder). */
  atrPeriod: number;
  /** Radius fractal untuk deteksi swing high/low. */
  pivotRadius: number;
  /** Fallback jarak stop = k × ATR bila tak ada support terdekat. */
  stopAtrMultiple: number;
  /** Buffer stop di bawah support = k × ATR. */
  stopBufferAtr: number;
  /** Fallback jarak target = k × ATR bila tak ada resistance terdekat. */
  targetAtrMultiple: number;
  /** Jarak maksimum support dari harga = k × ATR. */
  supportSearchAtr: number;
  /** Jarak maksimum resistance dari harga = k × ATR. */
  resistanceSearchAtr: number;
  /** Ambang minimum reward/risk agar setup dianggap layak. */
  minRewardRisk: number;
  /** Efisiensi pergerakan per bar (fraksi ATR) untuk estimasi horizon. */
  horizonEfficiency: number;
  minHorizonDays: number;
  maxHorizonDays: number;
  /** Ambang minimum rata-rata nilai transaksi (mata uang kuotasi). */
  minAvgValue: number;
  /** Tolak setup bila komponen risiko = High. */
  blockHighRisk: boolean;
  /** Lookback bar untuk deteksi swing high/low (level support/resistance). */
  levelLookback: number;
  /**
   * Syarat gate trend pertama.
   * - `bullish`     : menuntut `trend.label = Bullish` (SMA20 & SMA50 searah). Untuk swing.
   * - `above-sma20` : cukup harga di atas SMA20. Untuk trade cepat, karena menuntut
   *                   alignment SMA50 tidak relevan pada horizon 1-3 hari.
   */
  trendGate: "bullish" | "above-sma20";
  /** Bila true, volume `Contracting` menggagalkan setup (gerak cepat butuh partisipasi). */
  requireVolumeExpansion: boolean;
}

export type TradeProfileId = "swing" | "fast";

/** Satu paket parameter trade: rencana + aturan backtest-nya. */
export interface TradeProfile {
  id: TradeProfileId;
  label: string;
  description: string;
  tradePlan: TradePlanConfig;
  backtest: BacktestConfig;
}

export const defaultIndicatorConfig: IndicatorConfig = {
  window: 20,
  weights: {
    lpm: { closePosition: 0.6, priceChange: 0.4 },
    intensity: { volume: 0.5, range: 0.3, ret: 0.2 },
    rotation: { vsAverage: 0.6, vsPrevious: 0.4 },
  },
  scales: {
    lpm: 1.5,
    intensity: 1,
    rotation: 0.8,
  },
  signalEngine: {
    fastWindow: 5,
    slowWindow: 20,
    longWindow: 50,
    slopeLookback: 5,
    rangeLookback: 50,
    returnMomentumWindow: 5,
    thresholds: {
      trendBullish: 0.2,
      trendBearish: -0.2,
      momentumStrengthening: 0.15,
      momentumWeak: -0.3,
      volumeExpanding: 0.15,
      volumeContracting: -0.15,
      riskModerate: 0.2,
      riskHigh: 0.5,
      strengthModerate: 25,
      strengthStrong: 60,
      sellVolumeElevated: 1.2,
      accumulationLpm: 52,
      sidewaysAccumulationLpm: 55,
      sidewaysDistributionLpm: 45,
    },
    scales: {
      trend: { d20: 0.02, d50: 0.03, sma: 0.02, slope: 0.02 },
      momentum: { lpmSlope: 8, lpmLevel: 10, intensitySlope: 8, ret: 0.05 },
      volume: { ratio: 0.1, slope: 8 },
      risk: { volatility: 0.6, drawdown: 0.25, extension: 0.2, sellVolume: 0.5 },
    },
    weights: {
      trend: { d20: 0.34, d50: 0.16, sma: 0.16, slope: 0.26, position: 0.08 },
      momentum: { lpmSlope: 0.3, lpmLevel: 0.4, intensitySlope: 0.1, ret: 0.2 },
      volume: { ratio: 0.6, slope: 0.4 },
      risk: { volatility: 0.15, drawdown: 0.25, belowSma50: 0.15, sellVolume: 0.1, extension: 0.15, divergence: 0.2 },
      strength: { magnitude: 0.5, agreement: 0.2, trend: 0.3 },
    },
  },
  tradePlan: {
    atrPeriod: 14,
    pivotRadius: 3,
    stopAtrMultiple: 1.5,
    stopBufferAtr: 0.25,
    targetAtrMultiple: 3,
    supportSearchAtr: 3,
    resistanceSearchAtr: 6,
    minRewardRisk: 2,
    horizonEfficiency: 0.6,
    minHorizonDays: 2,
    maxHorizonDays: 30,
    minAvgValue: 2_000_000_000,
    blockHighRisk: true,
    levelLookback: 50,
    trendGate: "bullish",
    requireVolumeExpansion: false,
  },
  backtest: {
    warmupBars: 60,
    // Harus > tradePlan.maxHorizonDays (30); kalau sama, target berhorizon panjang
    // akan selalu timeout sebelum tercapai dan statistiknya bias.
    maxHoldingBars: 40,
    entryDelayBars: 1,
    stopFirstOnAmbiguous: true,
    maxTestBars: 500,
  },
};

/**
 * Profil trade. Indikator & signal engine **sama** untuk semua profil — yang berbeda
 * hanya cara level digambar, gate kelayakan, dan aturan backtest-nya.
 */
export const TRADE_PROFILES: Record<TradeProfileId, TradeProfile> = {
  swing: {
    id: "swing",
    label: "Swing",
    description: "Horizon 2–30 hari bursa; target dari resistance atau 3×ATR.",
    tradePlan: defaultIndicatorConfig.tradePlan,
    backtest: defaultIndicatorConfig.backtest,
  },
  fast: {
    id: "fast",
    label: "Cepat 1–3 hari",
    description:
      "Stop & target rapat (ATR-7), wajib di atas SMA20, likuid, dan volume mengembang.",
    tradePlan: {
      atrPeriod: 7,
      pivotRadius: 2,
      stopAtrMultiple: 0.9,
      stopBufferAtr: 0.15,
      targetAtrMultiple: 1.3,
      supportSearchAtr: 2,
      resistanceSearchAtr: 2.5,
      minRewardRisk: 1.2,
      horizonEfficiency: 0.5,
      minHorizonDays: 1,
      maxHorizonDays: 3,
      minAvgValue: 5_000_000_000,
      blockHighRisk: true,
      levelLookback: 20,
      trendGate: "above-sma20",
      requireVolumeExpansion: true,
    },
    backtest: {
      warmupBars: 35,
      maxHoldingBars: 3,
      entryDelayBars: 1,
      stopFirstOnAmbiguous: true,
      maxTestBars: 500,
    },
  },
};

export function isTradeProfileId(value: string): value is TradeProfileId {
  return value in TRADE_PROFILES;
}

/** IndicatorConfig untuk satu profil; indikator & signal engine tetap default. */
export function configForProfile(id: TradeProfileId): IndicatorConfig {
  const profile = TRADE_PROFILES[id];
  return { ...defaultIndicatorConfig, tradePlan: profile.tradePlan, backtest: profile.backtest };
}

/**
 * Validasi bobot di IndicatorConfig: setiap grup bobot harus berjumlah 1.0 (±0.001).
 * Lempar Error bila ada grup yang tidak valid, sehingga konfigurasi yang salah
 * terdeteksi sejak awal (bukan diam-diam menghasilkan skor yang off).
 *
 * Panggil sekali saat startup (mis. di root layout atau API route init).
 */
export function validateConfig(config: IndicatorConfig): void {
  const TOLERANCE = 0.001;

  function assertSumsToOne(name: string, weights: Record<string, number>): void {
    const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
    if (Math.abs(sum - 1) > TOLERANCE) {
      throw new Error(
        `[validateConfig] Bobot "${name}" berjumlah ${sum.toFixed(4)}, harus 1.0 (±${TOLERANCE}).`,
      );
    }
  }

  assertSumsToOne("weights.lpm", config.weights.lpm);
  assertSumsToOne("weights.intensity", config.weights.intensity);
  assertSumsToOne("weights.rotation", config.weights.rotation);

  const se = config.signalEngine;
  assertSumsToOne("signalEngine.weights.trend", se.weights.trend);
  assertSumsToOne("signalEngine.weights.momentum", se.weights.momentum);
  assertSumsToOne("signalEngine.weights.volume", se.weights.volume);
  assertSumsToOne("signalEngine.weights.risk", se.weights.risk);
  assertSumsToOne("signalEngine.weights.strength", se.weights.strength);
}
