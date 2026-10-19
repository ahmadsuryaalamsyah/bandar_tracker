import type { MarketState, MomentumAnalysis, RiskAnalysis, TrendAnalysis, VolumeAnalysis } from "../types";

export interface ExplanationInput {
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  volume: VolumeAnalysis;
  risk: RiskAnalysis;
  state: MarketState;
}

function percent(value: number): string {
  const rounded = Math.round(value * 1000) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/**
 * Merakit penjelasan 2-3 kalimat dari fakta komponen (tanpa hardcode per ticker).
 */
export function buildExplanation({ trend, momentum, volume, risk }: ExplanationInput): string {
  const sentences: string[] = [];

  if (trend.label === "Bullish") {
    const parts: string[] = [];
    if (trend.closeVsSma20 > 0) parts.push(`close ${percent(trend.closeVsSma20)} di atas SMA20`);
    if (trend.closeVsSma50 !== null && trend.closeVsSma50 > 0) {
      parts.push(`${percent(trend.closeVsSma50)} di atas SMA50`);
    }
    if (trend.sma20VsSma50 !== null && trend.sma20VsSma50 > 0) parts.push("dengan SMA20 di atas SMA50");
    sentences.push(
      parts.length > 0
        ? `Trend harga masih bullish karena ${parts.join(", ")}.`
        : "Trend harga masih bullish.",
    );
  } else if (trend.label === "Bearish") {
    const parts: string[] = [];
    if (trend.closeVsSma20 < 0) parts.push(`close ${percent(trend.closeVsSma20)} di bawah SMA20`);
    if (trend.closeVsSma50 !== null && trend.closeVsSma50 < 0) {
      parts.push(`${percent(trend.closeVsSma50)} di bawah SMA50`);
    }
    if (trend.sma20VsSma50 !== null && trend.sma20VsSma50 < 0) parts.push("dengan SMA20 di bawah SMA50");
    sentences.push(
      parts.length > 0
        ? `Trend harga sedang bearish karena ${parts.join(", ")}.`
        : "Trend harga sedang bearish.",
    );
  } else {
    sentences.push("Harga bergerak sideways di sekitar SMA20 tanpa arah yang jelas.");
  }

  switch (momentum.label) {
    case "Cooling":
      sentences.push(
        volume.label === "Contracting"
          ? "Namun momentum dan volume sedang mendingin (kontraksi) setelah pergerakan sebelumnya."
          : "Namun momentum mulai mendingin.",
      );
      break;
    case "Weak":
      sentences.push(
        volume.label === "Expanding"
          ? "Momentum melemah dan volume jual cenderung meningkat."
          : "Momentum melemah.",
      );
      break;
    case "Strengthening":
      sentences.push(
        volume.label === "Expanding"
          ? "Momentum menguat dan didukung ekspansi volume."
          : "Momentum menguat, meski volume belum sepenuhnya mendukung.",
      );
      break;
    default:
      sentences.push("Momentum mulai pulih dari kondisi lemah sebelumnya.");
  }

  if (volume.label === "Contracting" && momentum.label !== "Cooling") {
    sentences.push("Volume sedang berkontraksi.");
  }

  if (risk.label === "High") {
    sentences.push("Risiko tinggi karena harga tertekan dan/atau menjauh dari titik kuat terakhir.");
  } else if (risk.label === "Moderate") {
    sentences.push("Risiko moderat karena harga cukup jauh di atas SMA50 sehingga rentan mean-reversion.");
  } else {
    sentences.push("Risiko relatif rendah.");
  }

  return sentences.join(" ");
}
