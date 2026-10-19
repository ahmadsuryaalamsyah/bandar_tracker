import { DataProviderError, type StockDataProvider } from "../provider";
import type { Interval, OhlcvBar, OhlcvQuery, OhlcvSeries, Range } from "../types";

const DEFAULT_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const DEFAULT_SUFFIX = ".JK";
const DEFAULT_TIMEOUT_MS = 15_000;

interface YahooQuote {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
  volume?: (number | null)[];
}

interface YahooChartResult {
  meta?: Record<string, unknown>;
  timestamp?: number[];
  indicators?: { quote?: YahooQuote[] };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code?: string; description?: string } | null;
  };
}

function baseUrl(): string {
  return process.env.YAHOO_CHART_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function marketSuffix(): string {
  return process.env.IDX_MARKET_SUFFIX?.trim() || DEFAULT_SUFFIX;
}

function timeoutMs(): number {
  const parsed = Number(process.env.STOCK_REQUEST_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/** " bbca " / "BBCA.JK" / "bbca.jk" -> "BBCA". */
export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\.JK$/, "");
}

function toSymbol(ticker: string): string {
  return `${ticker}${marketSuffix()}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildBars(result: YahooChartResult): OhlcvBar[] {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const bars: OhlcvBar[] = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i];

    if (!isFiniteNumber(o) || !isFiniteNumber(h) || !isFiniteNumber(l) || !isFiniteNumber(c)) {
      continue;
    }

    bars.push({
      t: timestamps[i],
      o,
      h,
      l,
      c,
      v: isFiniteNumber(v) && v > 0 ? v : 0,
    });
  }

  return bars;
}

function mapHttpError(status: number, description?: string): DataProviderError {
  if (status === 404) {
    return new DataProviderError("NOT_FOUND", description ?? "Saham tidak ditemukan.", 404);
  }
  if (status === 429) {
    return new DataProviderError(
      "RATE_LIMIT",
      "Provider membatasi permintaan (rate limit). Coba lagi beberapa saat lagi.",
      429,
    );
  }
  return new DataProviderError("UPSTREAM", description ?? `Provider merespons ${status}.`, 502);
}

export class YahooFinanceProvider implements StockDataProvider {
  readonly id = "yahoo";

  async fetchOhlcv(query: OhlcvQuery): Promise<OhlcvSeries> {
    const ticker = normalizeTicker(query.ticker);
    if (!ticker) {
      throw new DataProviderError("INVALID_TICKER", "Kode saham kosong.", 400);
    }

    const symbol = toSymbol(ticker);
    const url = `${baseUrl()}/${encodeURIComponent(symbol)}?range=${query.range satisfies Range}&interval=${query.interval satisfies Interval}&includePrePost=false`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs());

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; idx-stock-analysis/0.1; local-use)",
        },
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new DataProviderError("TIMEOUT", "Permintaan ke provider melebihi batas waktu.", 504);
      }
      throw new DataProviderError("UPSTREAM", "Gagal menghubungi provider data.", 502);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    let payload: YahooChartResponse;
    try {
      payload = (await response.json()) as YahooChartResponse;
    } catch {
      throw new DataProviderError("UPSTREAM", "Respons provider tidak dapat dibaca.", 502);
    }

    const result = payload.chart?.result?.[0];
    if (!result) {
      const description = payload.chart?.error?.description;
      throw new DataProviderError("NOT_FOUND", description ?? `Saham "${ticker}" tidak ditemukan.`, 404);
    }

    const bars = buildBars(result);
    if (bars.length === 0) {
      throw new DataProviderError("NOT_FOUND", `Tidak ada data harga untuk "${ticker}".`, 404);
    }

    const meta = result.meta ?? {};

    return {
      ticker,
      symbol,
      name: typeof meta.longName === "string" ? meta.longName : undefined,
      currency: typeof meta.currency === "string" ? meta.currency : "IDR",
      exchange: typeof meta.fullExchangeName === "string" ? meta.fullExchangeName : "Jakarta",
      timezone: typeof meta.exchangeTimezoneName === "string" ? meta.exchangeTimezoneName : "Asia/Jakarta",
      interval: query.interval,
      range: query.range,
      quoteTime: typeof meta.regularMarketTime === "number" ? meta.regularMarketTime : null,
      source: this.id,
      bars,
    };
  }
}
