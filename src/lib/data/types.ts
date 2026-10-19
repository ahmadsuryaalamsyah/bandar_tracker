export const INTERVALS = ["1d", "1wk", "1mo"] as const;
export type Interval = (typeof INTERVALS)[number];

export const RANGES = ["3mo", "6mo", "1y", "2y", "5y", "max"] as const;
export type Range = (typeof RANGES)[number];

export interface OhlcvBar {
  /** Unix timestamp (detik) untuk waktu buka bar. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface OhlcvSeries {
  /** Kode tanpa suffix, uppercase. Contoh: "BBCA". */
  ticker: string;
  /** Simbol provider, contoh: "BBCA.JK". */
  symbol: string;
  name?: string;
  currency: string;
  exchange: string;
  timezone: string;
  interval: Interval;
  range: Range;
  /** Waktu kutipan pasar terakhir dari provider (unix detik), null bila tidak tersedia. */
  quoteTime: number | null;
  /** Id provider yang dipakai, mis. "yahoo". */
  source: string;
  bars: OhlcvBar[];
}

export interface OhlcvQuery {
  ticker: string;
  interval: Interval;
  range: Range;
}

export function isInterval(value: string): value is Interval {
  return (INTERVALS as readonly string[]).includes(value);
}

export function isRange(value: string): value is Range {
  return (RANGES as readonly string[]).includes(value);
}
