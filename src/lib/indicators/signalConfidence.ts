import type { OhlcvBar } from "@/lib/data/types";
import type { Candle, IndicatorPoint, MarketState } from "./types";
import type { DivergenceResult } from "./divergence";
import type { VsaAnalysisResult } from "./vsa";

export interface SignalConfidenceResult {
  score: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C";
  summary: string;
  winRatePct: number;
  totalHistoricalSignals: number;
  successfulSignals: number;
  factors: Array<{ label: string; impact: "positive" | "negative" | "neutral"; detail: string }>;
}

/**
 * Menghitung rekam jejak historis sinyal pada saham ini dan memadukannya dengan
 * faktor konfluensi (Divergensi, VSA, Market State) untuk menghasilkan skor keyakinan (Confidence Score).
 */
export function evaluateSignalConfidence(
  bars: Array<OhlcvBar | Candle>,
  indicators: IndicatorPoint[],
  divergence: DivergenceResult,
  vsa: VsaAnalysisResult,
  marketState: MarketState,
): SignalConfidenceResult {
  if (bars.length < 30 || indicators.length < 30) {
    return {
      score: 50,
      grade: "B",
      summary: "Data histori terbatas untuk menghitung probabilitas edge secara lengkap.",
      winRatePct: 50,
      totalHistoricalSignals: 0,
      successfulSignals: 0,
      factors: [],
    };
  }

  // 1. Simulasi historis cepat sinyal akumulasi di masa lalu pada saham ini
  let totalSignals = 0;
  let wins = 0;

  const targetReward = 0.04; // +4% target
  const stopRisk = 0.025;    // -2.5% stop

  for (let i = 20; i < bars.length - 12; i += 1) {
    const ind = indicators[i];
    const prevInd = indicators[i - 1];

    // Syarat sinyal masuk masa lalu: LPM menembus 55 dari bawah
    const isTrigger = prevInd && prevInd.lpm < 55 && ind.lpm >= 55;
    if (isTrigger) {
      totalSignals += 1;
      const entryPrice = bars[i].c;
      let won = false;

      // Pantau 10 candle ke depan
      for (let f = 1; f <= 10; f += 1) {
        const futureBar = bars[i + f];
        if (futureBar.h >= entryPrice * (1 + targetReward)) {
          won = true;
          break;
        }
        if (futureBar.l <= entryPrice * (1 - stopRisk)) {
          won = false;
          break;
        }
      }

      if (won) wins += 1;
    }
  }

  const rawWinRate = totalSignals > 0 ? (wins / totalSignals) * 100 : 55;
  const clampedWinRate = Number(Math.max(30, Math.min(90, rawWinRate)).toFixed(1));

  // 2. Faktor-faktor konfluensi saat ini
  const factors: Array<{ label: string; impact: "positive" | "negative" | "neutral"; detail: string }> = [];
  let confluenceBonus = 0;

  // Faktor Divergensi
  if (divergence.hasDivergence) {
    if (divergence.type === "regular_bullish" || divergence.type === "hidden_bullish") {
      confluenceBonus += 15;
      factors.push({
        label: "Bullish Divergence",
        impact: "positive",
        detail: "Terdeteksi akumulasi tersembunyi (+15% edge).",
      });
    } else {
      confluenceBonus -= 20;
      factors.push({
        label: "Bearish Divergence",
        impact: "negative",
        detail: "Terdeteksi distribusi terselubung (-20% penalti).",
      });
    }
  }

  // Faktor VSA
  if (vsa.hasPattern) {
    if (vsa.actionBias === "Bullish") {
      confluenceBonus += 15;
      factors.push({
        label: vsa.title,
        impact: "positive",
        detail: "Pola VSA mengonfirmasi penyerapan tekanan jual (+15% edge).",
      });
    } else if (vsa.actionBias === "Bearish") {
      confluenceBonus -= 15;
      factors.push({
        label: vsa.title,
        impact: "negative",
        detail: "Pola VSA mendeteksi penolakan harga / jebakan (-15% penalti).",
      });
    }
  }

  // Faktor Market State
  if (marketState === "Strong Buying" || marketState === "Accumulation") {
    confluenceBonus += 10;
    factors.push({
      label: "Fase Pasar: " + marketState,
      impact: "positive",
      detail: "Kondisi pasar didominasi fase akumulasi aktif (+10% edge).",
    });
  } else if (marketState === "Distribution" || marketState === "Strong Selling") {
    confluenceBonus -= 15;
    factors.push({
      label: "Fase Pasar: " + marketState,
      impact: "negative",
      detail: "Kondisi pasar masih dalam fase distribusi (-15% penalti).",
    });
  } else {
    factors.push({
      label: "Fase Pasar: " + marketState,
      impact: "neutral",
      detail: "Kondisi pasar seimbang / konsolidasi.",
    });
  }

  // Faktor Rekam Jejak Historis
  factors.push({
    label: "Win Rate Historis Saham Ini",
    impact: clampedWinRate >= 60 ? "positive" : clampedWinRate <= 45 ? "negative" : "neutral",
    detail: `${wins} dari ${totalSignals} setup sebelumnya berhasil mencapai target profit (+4%).`,
  });

  // Hitung Skor Akhir (0 - 100)
  const baseScore = clampedWinRate * 0.6; // Bobot win rate 60%
  const finalScore = Math.max(10, Math.min(98, Math.round(baseScore + confluenceBonus + 15)));

  let grade: "A+" | "A" | "B" | "C";
  let summary = "";

  if (finalScore >= 80) {
    grade = "A+";
    summary = "Konfluensi Tinggi (Super Edge). Sinyal didukung pola divergensi, volume serap, dan win rate historis kuat.";
  } else if (finalScore >= 68) {
    grade = "A";
    summary = "Peluang Kuat (High Probability). Konfirmasi bandar dominan dengan rasio keberhasilan di atas rata-rata.";
  } else if (finalScore >= 50) {
    grade = "B";
    summary = "Peluang Moderat. Sinyal valid namun belum ada dorongan konfluensi ganda. Gunakan money management ketat.";
  } else {
    grade = "C";
    summary = "Risiko Tinggi / Wait & See. Terdapat divergensi negatif atau fase distribusi aktif pada saham ini.";
  }

  return {
    score: finalScore,
    grade,
    summary,
    winRatePct: clampedWinRate,
    totalHistoricalSignals: totalSignals,
    successfulSignals: wins,
    factors,
  };
}
