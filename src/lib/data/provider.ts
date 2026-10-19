import type { OhlcvQuery, OhlcvSeries } from "./types";

export type DataErrorCode =
  | "INVALID_TICKER"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "UPSTREAM"
  | "TIMEOUT";

/** Error terstruktur dari lapisan data; dipetakan ke HTTP status oleh API route. */
export class DataProviderError extends Error {
  readonly code: DataErrorCode;
  readonly status: number;

  constructor(code: DataErrorCode, message: string, status: number) {
    super(message);
    this.name = "DataProviderError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Kontrak provider data saham. Implementasi konkret (Yahoo, dsb) cukup
 * memenuhi interface ini agar bisa ditukar tanpa mengubah UI / indikator.
 */
export interface StockDataProvider {
  readonly id: string;
  fetchOhlcv(query: OhlcvQuery): Promise<OhlcvSeries>;
}

const registry = new Map<string, StockDataProvider>();

export function registerProvider(provider: StockDataProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id?: string): StockDataProvider {
  const key = id ?? process.env.STOCK_PROVIDER ?? "yahoo";
  const provider = registry.get(key);
  if (!provider) {
    const available = [...registry.keys()].join(", ") || "(none)";
    throw new Error(`Provider data tidak dikenal: "${key}". Tersedia: ${available}`);
  }
  return provider;
}
