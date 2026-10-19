import type { Theme } from "./theme";

/**
 * Palet eksplisit untuk lightweight-charts. Chart tidak bisa memakai CSS variable
 * langsung (canvas), jadi warna di-resolve di sini dan diterapkan ulang saat tema
 * berganti.
 */
export interface ChartPalette {
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  up: string;
  down: string;
  upVolume: string;
  downVolume: string;
  neutralLine: string;
  lpm: string;
  intensity: string;
  rotation: string;
}

export const CHART_PALETTES: Record<Theme, ChartPalette> = {
  light: {
    text: "#475569",
    grid: "rgba(100, 116, 139, 0.16)",
    border: "rgba(100, 116, 139, 0.32)",
    crosshair: "rgba(71, 85, 105, 0.6)",
    up: "#059669",
    down: "#e11d48",
    upVolume: "rgba(5, 150, 105, 0.4)",
    downVolume: "rgba(225, 29, 72, 0.4)",
    neutralLine: "rgba(100, 116, 139, 0.5)",
    lpm: "#0284c7",
    intensity: "#d97706",
    rotation: "#7c3aed",
  },
  dark: {
    text: "#94a3b8",
    grid: "rgba(148, 163, 184, 0.08)",
    border: "rgba(148, 163, 184, 0.2)",
    crosshair: "rgba(148, 163, 184, 0.5)",
    up: "#10b981",
    down: "#f43f5e",
    upVolume: "rgba(16, 185, 129, 0.45)",
    downVolume: "rgba(244, 63, 94, 0.45)",
    neutralLine: "rgba(148, 163, 184, 0.35)",
    lpm: "#38bdf8",
    intensity: "#f59e0b",
    rotation: "#a78bfa",
  },
};
