import type { MarketState } from "./types";

export type Tone = "bullish" | "leanBullish" | "neutral" | "leanBearish" | "bearish" | "elevated" | "calm";

export interface Interpretation {
  label: string;
  tone: Tone;
}

/** Interpretasi skor LPM (0-100, 50 netral). */
export function interpretLpm(score: number): Interpretation {
  if (score >= 62) return { label: "Tekanan beli kuat", tone: "bullish" };
  if (score >= 55) return { label: "Kecenderungan beli", tone: "leanBullish" };
  if (score > 45) return { label: "Netral", tone: "neutral" };
  if (score > 38) return { label: "Kecenderungan jual", tone: "leanBearish" };
  return { label: "Tekanan jual kuat", tone: "bearish" };
}

/** Interpretasi skor Intensity (0-100, 50 = normal). */
export function interpretIntensity(score: number): Interpretation {
  if (score >= 75) return { label: "Aktivitas sangat tinggi", tone: "elevated" };
  if (score >= 60) return { label: "Aktivitas tinggi", tone: "elevated" };
  if (score >= 40) return { label: "Aktivitas normal", tone: "neutral" };
  if (score >= 25) return { label: "Aktivitas rendah", tone: "calm" };
  return { label: "Aktivitas sangat rendah", tone: "calm" };
}

/** Interpretasi skor Volume Rotation (0-100, 50 netral). */
export function interpretRotation(score: number): Interpretation {
  if (score >= 70) return { label: "Volume berputar naik kuat", tone: "elevated" };
  if (score >= 58) return { label: "Volume meningkat", tone: "elevated" };
  if (score > 42) return { label: "Volume stabil", tone: "neutral" };
  if (score > 30) return { label: "Volume menurun", tone: "calm" };
  return { label: "Volume mengering", tone: "calm" };
}

const SIGNAL_TONE: Record<MarketState, Tone> = {
  "Strong Buying": "bullish",
  Accumulation: "bullish",
  "Bullish Consolidation": "leanBullish",
  Neutral: "neutral",
  Distribution: "leanBearish",
  "Bearish Consolidation": "leanBearish",
  "Strong Selling": "bearish",
};

export function signalTone(signal: MarketState): Tone {
  return SIGNAL_TONE[signal] ?? "neutral";
}

export type SlopeDirection = "up" | "down" | "flat";

export function directionFromSlope(slope: number, epsilon = 0.5): SlopeDirection {
  if (slope > epsilon) return "up";
  if (slope < -epsilon) return "down";
  return "flat";
}

const DIRECTION_ARROW: Record<SlopeDirection, string> = { up: "↑", down: "↓", flat: "→" };

export function directionArrow(direction: SlopeDirection): string {
  return DIRECTION_ARROW[direction];
}
