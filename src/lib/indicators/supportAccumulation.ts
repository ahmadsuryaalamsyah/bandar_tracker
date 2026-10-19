import type { OhlcvBar } from "@/lib/data/types";
import { computeAtr } from "./atr";
import { findSwingPoints } from "./levels";
import type { Candle, IndicatorPoint } from "./types";

export interface AccumulationLevel {
  label: string;
  price: number;
  type: "support_1" | "support_2" | "stop_loss";
  description: string;
  distancePct: number; // Jarak dari harga sekarang (%)
}

export interface SupportAccumulationResult {
  currentPrice: number;
  accumulationZone: {
    min: number;
    max: number;
    label: string;
  };
  support1: AccumulationLevel | null;
  support2: AccumulationLevel | null;
  stopLoss: AccumulationLevel | null;
  status: "ideal_entry" | "fair_entry" | "extended" | "breakdown";
  statusText: string;
  statusBadge: string;
  recommendation: string;
}

/**
 * Menghitung level-level support strategis untuk akumulasi:
 * 1. Support 1 (Minor / Swing Low terdekat): Pantulan teknikal jangka pendek.
 * 2. Support 2 (Major / Modal Bandar): Area harga dengan akumulasi volume terbesar.
 * 3. Stop Loss: Batas toleransi risiko jika support jebol.
 */
export function calculateAccumulationSupports(
  bars: Array<OhlcvBar | Candle>,
  indicators: IndicatorPoint[],
  lookback = 60,
): SupportAccumulationResult | null {
  if (bars.length < 10) return null;

  const currentPrice = bars[bars.length - 1].c;
  const atrs = computeAtr(bars, 14);
  const atr = atrs[atrs.length - 1] || currentPrice * 0.02;

  // 1. Ambil Swing Lows 60 bar terakhir
  const swings = findSwingPoints(bars, 3, Math.max(0, bars.length - lookback));
  const validLows = swings.lows
    .map((l) => l.price)
    .filter((p) => p < currentPrice)
    .sort((a, b) => b - a); // Urut dari yang paling tinggi (paling dekat harga sekarang)

  // Support 1: Swing low terdekat di bawah harga saat ini
  let s1Price = validLows.length > 0 ? validLows[0] : currentPrice - atr * 1.2;

  // Jika support 1 terlalu dekat (< 0.5% dari harga), cari swing berikutnya jika ada
  if (currentPrice - s1Price < currentPrice * 0.005 && validLows.length > 1) {
    s1Price = validLows[1];
  }

  // 2. Support 2: Volume-Weighted Accumulation Node (Modal Bandar)
  // Menghitung harga rata-rata tertimbang pada candle yang memiliki LPM > 50 (hari akumulasi)
  let accWeightedSum = 0;
  let accWeightSum = 0;
  const recentStart = Math.max(0, bars.length - lookback);

  for (let i = recentStart; i < bars.length; i += 1) {
    const b = bars[i];
    const ind = indicators[i] ?? indicators[indicators.length - 1];
    if (ind && ind.lpm >= 50 && b.c < currentPrice) {
      const w = b.v * (ind.lpm / 50);
      accWeightedSum += b.c * w;
      accWeightSum += w;
    }
  }

  let s2Price: number;
  if (accWeightSum > 0) {
    s2Price = accWeightedSum / accWeightSum;
    // Pastikan s2 berada di bawah s1 atau setidaknya tidak lebih tinggi dari s1
    if (s2Price >= s1Price) {
      s2Price = validLows.length > 1 ? validLows[1] : s1Price - atr * 1.2;
    }
  } else {
    s2Price = validLows.length > 1 ? validLows[1] : s1Price - atr * 1.5;
  }

  // Bulatkan harga sesuai fraksi harga wajar
  s1Price = Math.round(s1Price);
  s2Price = Math.round(s2Price);

  // Stop Loss: 1 ATR di bawah Support 2
  const stopLossPrice = Math.round(s2Price - atr * 0.8);

  const s1Distance = Number((((currentPrice - s1Price) / currentPrice) * 100).toFixed(1));
  const s2Distance = Number((((currentPrice - s2Price) / currentPrice) * 100).toFixed(1));
  const slDistance = Number((((currentPrice - stopLossPrice) / currentPrice) * 100).toFixed(1));

  // Penentuan status entry
  let status: SupportAccumulationResult["status"] = "fair_entry";
  let statusText = "Area Wajar (Cicil Bertahap)";
  let statusBadge = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  let recommendation = `Harga saat ini berada ${s1Distance}% di atas Support 1. Disarankan antre beli bertahap di rentang Rp ${s2Price.toLocaleString()} – Rp ${s1Price.toLocaleString()}.`;

  if (s1Distance <= 1.8 && s1Distance >= 0) {
    status = "ideal_entry";
    statusText = "Area Beli Sangat Ideal (Dekat Support)";
    statusBadge = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    recommendation = `Harga saat ini sangat dekat dengan Support 1 (${s1Distance}%). Rasio Risk/Reward sangat menguntungkan untuk mulai akumulasi.`;
  } else if (s1Distance > 4.5) {
    status = "extended";
    statusText = "Sudah Jauh dari Support (Tunggu Retest)";
    statusBadge = "bg-rose-500/15 text-rose-400 border-rose-500/30";
    recommendation = `Harga sudah terbang ${s1Distance}% dari support terdekat. Hindari mengejar harga (FOMO), tunggu harga retest ke area Rp ${s1Price.toLocaleString()}.`;
  } else if (currentPrice < s1Price) {
    status = "breakdown";
    statusText = "Menembus Support (Tunggu Konfirmasi Pantulan)";
    statusBadge = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    recommendation = `Harga sedang menguji area support bawah. Tunggu muncul candle pantulan atau stopping volume sebelum masuk.`;
  }

  return {
    currentPrice,
    accumulationZone: {
      min: s2Price,
      max: s1Price,
      label: `Rp ${s2Price.toLocaleString()} – Rp ${s1Price.toLocaleString()}`,
    },
    support1: {
      label: "Support 1 (Swing Low)",
      price: s1Price,
      type: "support_1",
      description: "Support pantulan terdekat dari ayunan harga historis.",
      distancePct: s1Distance,
    },
    support2: {
      label: "Support 2 (Modal Bandar)",
      price: s2Price,
      type: "support_2",
      description: "Area rata-rata penyerapan barang bervolume besar oleh Smart Money.",
      distancePct: s2Distance,
    },
    stopLoss: {
      label: "Cut Loss / Proteksi",
      price: stopLossPrice,
      type: "stop_loss",
      description: "Batas pengaman modal apabila tekanan jual menjebol seluruh support.",
      distancePct: slDistance,
    },
    status,
    statusText,
    statusBadge,
    recommendation,
  };
}
