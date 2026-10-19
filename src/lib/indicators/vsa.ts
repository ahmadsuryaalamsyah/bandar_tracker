import type { OhlcvBar } from "@/lib/data/types";
import { smaAt } from "./movingAverage";
import type { Candle } from "./types";

export type VsaPatternType =
  | "stopping_volume"  // Volume raksasa menyerap kepanikan jual (Reversal Bottom)
  | "no_supply"        // Volume kering di area support (Siap Terbang)
  | "upthrust"         // Puncak palsu, ekor atas panjang + volume tinggi (Distribusi Puncak)
  | "effort_no_result" // Volume meledak tapi spread sempit (Aktivitas Churning)
  | null;

export interface VsaAnalysisResult {
  hasPattern: boolean;
  type: VsaPatternType;
  title: string;
  description: string;
  actionBias: "Bullish" | "Bearish" | "Neutral";
  significance: "high" | "medium" | "low";
  candleIndex: number;
}

/**
 * Menganalisis Volume Spread Analysis (VSA) pada candle-candle terkini.
 */
export function analyzeVsa(
  bars: Array<OhlcvBar | Candle>,
  window = 20,
): VsaAnalysisResult {
  const empty: VsaAnalysisResult = {
    hasPattern: false,
    type: null,
    title: "Normal Price Spread",
    description: "Volume dan rentang candle bergerak proporsional tanpa anomali VSA ekstrem.",
    actionBias: "Neutral",
    significance: "low",
    candleIndex: bars.length - 1,
  };

  if (bars.length < 5) return empty;

  const volumes = bars.map((b) => b.v);
  const ranges = bars.map((b) => b.h - b.l);

  // Periksa 3 candle terakhir (dari yang paling baru ke belakang)
  for (let idx = bars.length - 1; idx >= Math.max(0, bars.length - 3); idx -= 1) {
    const cur = bars[idx];
    const prev = bars[idx - 1];
    if (!prev) continue;

    const avgVol = smaAt(volumes, idx, window);
    const avgRange = smaAt(ranges, idx, window);

    const rvol = avgVol > 0 ? cur.v / avgVol : 1;
    const spreadRatio = avgRange > 0 ? (cur.h - cur.l) / avgRange : 1;
    const bodyRange = cur.h - cur.l;

    if (bodyRange <= 0) continue;

    const lowerWick = Math.min(cur.o, cur.c) - cur.l;
    const upperWick = cur.h - Math.max(cur.o, cur.c);
    const lowerWickRatio = lowerWick / bodyRange;
    const upperWickRatio = upperWick / bodyRange;
    const isDown = cur.c < prev.c;

    // 1. Stopping Volume / Absorption
    // Syarat: Volume sangat tinggi (RVOL > 1.6), harga turun menembus low sebelumnya,
    // tapi ekor bawah panjang (> 40% body) atau close di separuh atas range.
    if (rvol >= 1.6 && isDown && (lowerWickRatio >= 0.4 || cur.c >= cur.l + bodyRange * 0.5)) {
      return {
        hasPattern: true,
        type: "stopping_volume",
        title: "Stopping Volume (Absorption Bottom)",
        description: `Terjadi lonjakan volume ${rvol.toFixed(1)}x lipat dengan ekor bawah panjang. Smart money masuk menyapu bersih tekanan jual kepanikan (Panic Selling Diserap).`,
        actionBias: "Bullish",
        significance: "high",
        candleIndex: idx,
      };
    }

    // 2. Upthrust / Fake Breakout
    // Syarat: Harga sempat melonjak di atas high sebelumnya, volume tinggi (RVOL > 1.4),
    // tapi ditutup kembali di bawah dengan ekor atas panjang (> 45%).
    if (rvol >= 1.4 && cur.h > prev.h && upperWickRatio >= 0.45 && cur.c <= cur.l + bodyRange * 0.4) {
      return {
        hasPattern: true,
        type: "upthrust",
        title: "Upthrust (Fake Breakout / Bull Trap)",
        description: `Candle sempat menguji harga tinggi dengan volume ${rvol.toFixed(1)}x rata-rata, namun tertolak keras ke bawah. Bandar memanfaatkan FOMO ritel untuk buang barang.`,
        actionBias: "Bearish",
        significance: "high",
        candleIndex: idx,
      };
    }

    // 3. No Supply Bar (Float Terkunci / Penjual Habis)
    // Syarat: Volume sangat kering (RVOL < 0.65), spread sempit (< 0.75x rata-rata),
    // candle merah kecil di dekat support.
    if (rvol <= 0.65 && spreadRatio <= 0.75 && isDown) {
      return {
        hasPattern: true,
        type: "no_supply",
        title: "No Supply Bar (Penjual Kering)",
        description: `Rentang harga sempit dengan volume sangat tipis (${(rvol * 100).toFixed(0)}% rata-rata). Tekanan jual sudah habis, potensi pantulan teknikal besar.`,
        actionBias: "Bullish",
        significance: "medium",
        candleIndex: idx,
      };
    }

    // 4. Effort vs Result (Climactic Churn)
    // Syarat: Volume raksasa (RVOL > 2.0), tapi spread candle sempit (< 0.8x rata-rata).
    if (rvol >= 2.0 && spreadRatio <= 0.8) {
      return {
        hasPattern: true,
        type: "effort_no_result",
        title: "Effort vs Result (Climactic Churn)",
        description: `Volume transaksi meledak ${rvol.toFixed(1)}x lipat namun pergerakan harga tertahan dalam rentang sempit. Terjadi perpindahan kepemilikan saham masif.`,
        actionBias: isDown ? "Bullish" : "Bearish",
        significance: "medium",
        candleIndex: idx,
      };
    }
  }

  return empty;
}
