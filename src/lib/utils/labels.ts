import type { Interval, Range } from "@/lib/data/types";

export const INTERVAL_LABELS: Record<Interval, string> = {
  "1d": "Harian",
  "1wk": "Mingguan",
  "1mo": "Bulanan",
};

export const RANGE_LABELS: Record<Range, string> = {
  "3mo": "3 Bulan",
  "6mo": "6 Bulan",
  "1y": "1 Tahun",
  "2y": "2 Tahun",
  "5y": "5 Tahun",
  max: "Maksimum",
};

/** Label ringkas untuk kontrol segmented. */
export const RANGE_SHORT_LABELS: Record<Range, string> = {
  "3mo": "3B",
  "6mo": "6B",
  "1y": "1T",
  "2y": "2T",
  "5y": "5T",
  max: "Maks",
};
