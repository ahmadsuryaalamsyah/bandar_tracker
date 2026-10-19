import { NextResponse, type NextRequest } from "next/server";
import { DataProviderError, getProvider, isInterval, isRange } from "@/lib/data";
import { configForProfile, isTradeProfileId } from "@/lib/indicators/config";
import { MAX_TICKERS_PER_REQUEST } from "@/lib/screener/limits";
import { buildScreenerErrorRow, buildScreenerRow } from "@/lib/screener/select";
import type { ScreenerResponse, ScreenerRow } from "@/lib/screener/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKER_PATTERN = /^[A-Z0-9]{2,8}$/;
const CONCURRENCY = 5;
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { at: number; rows: ScreenerRow[] }>();

/**
 * Kumpulkan kode valid. `overflow` menandai bila permintaan melebihi batas —
 * pemanggil harus menolaknya, bukan memotong diam-diam, karena pemotongan
 * diam-diam menghasilkan daftar yang tampak lengkap padahal kurang.
 */
function parseTickers(raw: string | null): { tickers: string[]; overflow: boolean } {
  const seen = new Set<string>();
  const tickers: string[] = [];
  for (const token of (raw ?? "").split(",")) {
    const cleaned = token.trim().toUpperCase().replace(/\.JK$/, "");
    if (!TICKER_PATTERN.test(cleaned) || seen.has(cleaned)) continue;
    seen.add(cleaned);
    tickers.push(cleaned);
    if (tickers.length > MAX_TICKERS_PER_REQUEST) return { tickers, overflow: true };
  }
  return { tickers, overflow: false };
}

async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { tickers, overflow } = parseTickers(params.get("tickers"));
  const rawInterval = params.get("interval") ?? "1d";
  const rawRange = params.get("range") ?? "1y";
  const rawProfile = params.get("profile") ?? "swing";

  if (overflow) {
    return NextResponse.json(
      {
        error: `Maksimum ${MAX_TICKERS_PER_REQUEST} kode per permintaan. Pecah menjadi beberapa gelombang.`,
        code: "TOO_MANY_TICKERS",
      },
      { status: 400 },
    );
  }

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada kode saham valid. Gunakan 2-8 karakter huruf/angka, contoh BBCA.", code: "INVALID_TICKER" },
      { status: 400 },
    );
  }

  if (!isInterval(rawInterval)) {
    return NextResponse.json({ error: `Interval tidak didukung: ${rawInterval}`, code: "INVALID_TICKER" }, { status: 400 });
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
  const cacheKey = `${[...tickers].sort().join(",")}|${rawInterval}|${rawRange}|${profile}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    const payload: ScreenerResponse = { rows: hit.rows, generatedAt: hit.at, profile };
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  }

  const provider = getProvider();
  const config = configForProfile(profile);
  const rows = await pool(tickers, CONCURRENCY, async (ticker) => {
    try {
      const series = await provider.fetchOhlcv({ ticker, interval: rawInterval, range: rawRange });
      return buildScreenerRow(series, config);
    } catch (error) {
      if (error instanceof DataProviderError) return buildScreenerErrorRow(ticker, error.message);
      const message = error instanceof Error ? error.message : "Gagal memuat data saham.";
      return buildScreenerErrorRow(ticker, message);
    }
  });

  const generatedAt = Date.now();
  cache.set(cacheKey, { at: generatedAt, rows });

  const payload: ScreenerResponse = { rows, generatedAt, profile };
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
