import type { Tone } from "@/lib/indicators/interpret";

/** Kelas warna per nada. Semua mengacu ke token tema, bukan warna hardcoded. */

export const toneText: Record<Tone, string> = {
  bullish: "text-up",
  leanBullish: "text-up-soft",
  neutral: "text-flat",
  leanBearish: "text-down-soft",
  bearish: "text-down",
  elevated: "text-warn",
  calm: "text-info",
};

export const toneBar: Record<Tone, string> = {
  bullish: "bg-up",
  leanBullish: "bg-up-soft",
  neutral: "bg-flat",
  leanBearish: "bg-down-soft",
  bearish: "bg-down",
  elevated: "bg-warn",
  calm: "bg-info",
};

export const toneBadge: Record<Tone, string> = {
  bullish: "border-up/35 bg-up/10 text-up",
  leanBullish: "border-up-soft/35 bg-up-soft/10 text-up-soft",
  neutral: "border-line-strong bg-flat/10 text-flat",
  leanBearish: "border-down-soft/35 bg-down-soft/10 text-down-soft",
  bearish: "border-down/35 bg-down/10 text-down",
  elevated: "border-warn/35 bg-warn/10 text-warn",
  calm: "border-info/35 bg-info/10 text-info",
};

export const toneDot: Record<Tone, string> = {
  bullish: "bg-up",
  leanBullish: "bg-up-soft",
  neutral: "bg-flat",
  leanBearish: "bg-down-soft",
  bearish: "bg-down",
  elevated: "bg-warn",
  calm: "bg-info",
};
