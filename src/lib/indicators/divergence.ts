import type { OhlcvBar } from "@/lib/data/types";
import type { Candle, IndicatorPoint } from "./types";

export type DivergenceType =
  | "regular_bullish" // Silent Accumulation (Harga Lower Low, Bandar Higher Low)
  | "regular_bearish" // Distribution Trap (Harga Higher High, Bandar Lower High)
  | "hidden_bullish"  // Akumulasi Lanjutan (Harga Higher Low, Bandar Lower Low)
  | "hidden_bearish"  // Distribusi Lanjutan (Harga Lower High, Bandar Higher High)
  | null;

export interface DivergenceResult {
  hasDivergence: boolean;
  type: DivergenceType;
  title: string;
  description: string;
  severity: "high" | "medium" | "low" | "none";
  pricePivots: [number, number] | null; // [harga swing 1, harga swing 2]
  bandarPivots: [number, number] | null; // [bandar flow 1, bandar flow 2]
  divergenceAgeBars: number; // berapa bar lalu terdeteksi
}

/**
 * Mencari titik-titik swing low dan swing high lokal pada array numerik.
 */
function findPivots(
  data: number[],
  lookback = 3,
): { lows: Array<{ index: number; value: number }>; highs: Array<{ index: number; value: number }> } {
  const lows: Array<{ index: number; value: number }> = [];
  const highs: Array<{ index: number; value: number }> = [];

  for (let i = lookback; i < data.length - lookback; i += 1) {
    let isLow = true;
    let isHigh = true;

    for (let j = 1; j <= lookback; j += 1) {
      if (data[i] >= data[i - j] || data[i] >= data[i + j]) isLow = false;
      if (data[i] <= data[i - j] || data[i] <= data[i + j]) isHigh = false;
    }

    if (isLow) lows.push({ index: i, value: data[i] });
    if (isHigh) highs.push({ index: i, value: data[i] });
  }

  return { lows, highs };
}

/**
 * Mendeteksi divergensi antara pergerakan harga saham dan pergerakan akumulasi Smart Money (Bandar).
 */
export function detectDivergence(
  bars: Array<{ c: number; l: number; h: number } | OhlcvBar | Candle>,
  indicators: IndicatorPoint[],
  lookback = 30,
): DivergenceResult {
  const emptyResult: DivergenceResult = {
    hasDivergence: false,
    type: null,
    title: "Tidak Ada Divergensi",
    description: "Pergerakan harga dan aliran dana bandar berjalan seirama.",
    severity: "none",
    pricePivots: null,
    bandarPivots: null,
    divergenceAgeBars: 0,
  };

  if (bars.length < 15 || indicators.length < 15) return emptyResult;

  const startIdx = Math.max(0, bars.length - lookback);
  const recentBars = bars.slice(startIdx);
  const recentIndicators = indicators.slice(startIdx);

  // Hitung kumulatif flow bandar untuk jendela ini
  let cumFlow = 0;
  const flowSeries: number[] = [];
  for (let i = 0; i < recentIndicators.length; i += 1) {
    cumFlow += recentIndicators[i].lpRaw;
    flowSeries.push(cumFlow);
  }

  const closePrices = recentBars.map((b) => b.c);

  const pricePivots = findPivots(closePrices, 2);
  const flowPivots = findPivots(flowSeries, 2);

  // 1. Cek Regular Bullish Divergence (Silent Accumulation)
  // Harga membuat Lower Low (harga turun), tapi Bandar Flow membuat Higher Low (dana masuk)
  if (pricePivots.lows.length >= 2 && flowPivots.lows.length >= 2) {
    const pLow2 = pricePivots.lows[pricePivots.lows.length - 1];
    const pLow1 = pricePivots.lows[pricePivots.lows.length - 2];

    // Cari flow pivot yang posisinya berdekatan (+- 3 bar) dengan price pivot
    const fLow2 = flowPivots.lows.find((f) => Math.abs(f.index - pLow2.index) <= 3) ?? flowPivots.lows[flowPivots.lows.length - 1];
    const fLow1 = flowPivots.lows.find((f) => Math.abs(f.index - pLow1.index) <= 3) ?? flowPivots.lows[flowPivots.lows.length - 2];

    const age = recentBars.length - 1 - pLow2.index;

    if (age <= 10 && pLow2.value < pLow1.value && fLow2.value > fLow1.value) {
      return {
        hasDivergence: true,
        type: "regular_bullish",
        title: "Bullish Divergence (Silent Accumulation)",
        description: "Harga saham mencetak titik terendah baru, namun aliran dana Smart Money justru menanjak naik. Tanda bandar sedang menyerap barang di harga diskon.",
        severity: "high",
        pricePivots: [pLow1.value, pLow2.value],
        bandarPivots: [Number(fLow1.value.toFixed(2)), Number(fLow2.value.toFixed(2))],
        divergenceAgeBars: age,
      };
    }
  }

  // 2. Cek Regular Bearish Divergence (Distribution Trap)
  // Harga membuat Higher High (harga dipompa naik), tapi Bandar Flow membuat Lower High (dana keluar)
  if (pricePivots.highs.length >= 2 && flowPivots.highs.length >= 2) {
    const pHigh2 = pricePivots.highs[pricePivots.highs.length - 1];
    const pHigh1 = pricePivots.highs[pricePivots.highs.length - 2];

    const fHigh2 = flowPivots.highs.find((f) => Math.abs(f.index - pHigh2.index) <= 3) ?? flowPivots.highs[flowPivots.highs.length - 1];
    const fHigh1 = flowPivots.highs.find((f) => Math.abs(f.index - pHigh1.index) <= 3) ?? flowPivots.highs[flowPivots.highs.length - 2];

    const age = recentBars.length - 1 - pHigh2.index;

    if (age <= 10 && pHigh2.value > pHigh1.value && fHigh2.value < fHigh1.value) {
      return {
        hasDivergence: true,
        type: "regular_bearish",
        title: "Bearish Divergence (Distribution Trap)",
        description: "Harga saham dipompa membuat level tertinggi baru, namun akumulasi bandar justru menyusut turun. Waspada jebakan beli (bull trap) dan aksi guyur.",
        severity: "high",
        pricePivots: [pHigh1.value, pHigh2.value],
        bandarPivots: [Number(fHigh1.value.toFixed(2)), Number(fHigh2.value.toFixed(2))],
        divergenceAgeBars: age,
      };
    }
  }

  // 3. Fallback Heuristik Jendela Sederhana (Slope divergence 10-bar terakhir)
  const window10 = Math.min(10, recentBars.length);
  const pStart = closePrices[recentBars.length - window10];
  const pEnd = closePrices[recentBars.length - 1];
  const fStart = flowSeries[recentBars.length - window10];
  const fEnd = flowSeries[recentBars.length - 1];

  const priceDrop = (pEnd - pStart) / pStart < -0.02; // harga turun > 2%
  const flowRise = fEnd - fStart > 1.2;              // tapi flow bandar naik kuat
  if (priceDrop && flowRise) {
    return {
      hasDivergence: true,
      type: "regular_bullish",
      title: "Bullish Divergence Terdeteksi (Akumulasi Aktif)",
      description: "Dalam 10 candle terakhir, harga melemah namun akumulasi Smart Money konsisten bertambah.",
      severity: "medium",
      pricePivots: [pStart, pEnd],
      bandarPivots: [Number(fStart.toFixed(2)), Number(fEnd.toFixed(2))],
      divergenceAgeBars: 1,
    };
  }

  const priceRise = (pEnd - pStart) / pStart > 0.03; // harga naik > 3%
  const flowDrop = fEnd - fStart < -1.5;             // tapi flow bandar anjlok
  if (priceRise && flowDrop) {
    return {
      hasDivergence: true,
      type: "regular_bearish",
      title: "Bearish Divergence Terdeteksi (Distribusi Tersembunyi)",
      description: "Dalam 10 candle terakhir, harga naik namun aliran dana bandar keluar tajam.",
      severity: "medium",
      pricePivots: [pStart, pEnd],
      bandarPivots: [Number(fStart.toFixed(2)), Number(fEnd.toFixed(2))],
      divergenceAgeBars: 1,
    };
  }

  return emptyResult;
}
