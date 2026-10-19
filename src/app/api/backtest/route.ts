import { NextResponse, type NextRequest } from "next/server";
import { runBacktest } from "@/lib/backtest/engine";
import type { BacktestResponse } from "@/lib/backtest/types";
import { DataProviderError, getProvider, isInterval, isRange } from "@/lib/data";
import { configForProfile, isTradeProfileId } from "@/lib/indicators/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKER_PATTERN = /^[A-Z0-9]{2,8}$/;
const CACHE_TTL_MS = 120_000;

const cache = new Map<string, { at: number; payload: BacktestResponse }>();

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ticker = (params.get("ticker") ?? "").trim().toUpperCase().replace(/\.JK$/, "");
  const rawInterval = params.get("interval") ?? "1d";
  const rawRange = params.get("range") ?? "1y";
  const rawProfile = params.get("profile") ?? "swing";

  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json(
      { error: "Kode saham tidak valid. Gunakan 2-8 karakter huruf/angka, contoh BBCA.", code: "INVALID_TICKER" },
      { status: 400 },
    );
  }

  if (!isInterval(rawInterval)) {
    return NextResponse.json(
      { error: `Interval tidak didukung: ${rawInterval}`, code: "INVALID_TICKER" },
      { status: 400 },
    );
  }

  if (!isRange(rawRange)) {
    return NextResponse.json({ error: `Range tidak didukung: ${rawRange}`, code: "INVALID_TICKER" }, { status: 400 });
  }

  if (!isTradeProfileId(rawProfile)) {
    return NextResponse.json(
      { error: `Profil trade tidak dikenal: ${rawProfile}. Gunakan "swing" atau "fast".`, code: "INVALID_PROFILE" },
      { status: 400 },
    );
  }

  const profile = rawProfile;
  const cacheKey = `${ticker}|${rawInterval}|${rawRange}|${profile}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.payload, { headers: { "cache-control": "no-store" } });
  }

  try {
    const series = await getProvider().fetchOhlcv({ ticker, interval: rawInterval, range: rawRange });
    const result = runBacktest({ candles: series.bars, config: configForProfile(profile) });

    const payload: BacktestResponse = {
      ticker: series.ticker,
      name: series.name,
      currency: series.currency,
      interval: series.interval,
      range: series.range,
      quoteTime: series.quoteTime,
      source: series.source,
      profile,
      generatedAt: Date.now(),
      result,
    };

    cache.set(cacheKey, { at: Date.now(), payload });
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof DataProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal.";
    return NextResponse.json({ error: message, code: "UPSTREAM" }, { status: 500 });
  }
}
