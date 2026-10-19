import { NextResponse, type NextRequest } from "next/server";
import { DataProviderError, getProvider, isInterval, isRange } from "@/lib/data";
import { MAX_TICKERS_PER_REQUEST } from "@/lib/screener/limits";
import {
  buildCrashArbRow,
  sortCrashArbRows,
  summarizeCrashMarket,
  type CrashArbResponse,
  type CrashArbRow,
} from "@/lib/screener/crashArb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKER_PATTERN = /^[A-Z0-9]{2,8}$/;
const CONCURRENCY = 5;
const CACHE_TTL_MS = 90_000; // 1.5 menit — crash data bergerak cepat

const cache = new Map<string, { at: number; rows: CrashArbRow[] }>();

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

  if (overflow) {
    return NextResponse.json(
      { error: `Maksimum ${MAX_TICKERS_PER_REQUEST} kode per permintaan.` },
      { status: 400 },
    );
  }
  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada kode saham valid." },
      { status: 400 },
    );
  }
  if (!isInterval(rawInterval)) {
    return NextResponse.json({ error: `Interval tidak didukung: ${rawInterval}` }, { status: 400 });
  }
  if (!isRange(rawRange)) {
    return NextResponse.json({ error: `Range tidak didukung: ${rawRange}` }, { status: 400 });
  }

  const cacheKey = `${[...tickers].sort().join(",")}|${rawInterval}|${rawRange}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    const { marketDrawdown, breadthDown } = summarizeCrashMarket(hit.rows);
    const payload: CrashArbResponse = {
      rows: hit.rows,
      generatedAt: hit.at,
      marketDrawdown,
      breadthDown,
    };
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  }

  const provider = getProvider();
  const rows = await pool(tickers, CONCURRENCY, async (ticker) => {
    try {
      const series = await provider.fetchOhlcv({ ticker, interval: rawInterval, range: rawRange });
      return buildCrashArbRow(series);
    } catch (error) {
      if (error instanceof DataProviderError) {
        return {
          ticker, name: undefined, currency: "IDR",
          price: null, changePct1d: null, changePct5d: null, changePct20d: null,
          lpm: null, intensity: null, rvol: null, marketState: null, trendLabel: null,
          drawdownFromHigh: null, atr: null, potentialToSma20: null,
          arbScore: null, arbLabel: null, reason: null,
          error: error.message,
        } satisfies import("@/lib/screener/crashArb").CrashArbRow;
      }
      const message = error instanceof Error ? error.message : "Gagal memuat data.";
      return {
        ticker, name: undefined, currency: "IDR",
        price: null, changePct1d: null, changePct5d: null, changePct20d: null,
        lpm: null, intensity: null, rvol: null, marketState: null, trendLabel: null,
        drawdownFromHigh: null, atr: null, potentialToSma20: null,
        arbScore: null, arbLabel: null, reason: null, error: message,
      } satisfies import("@/lib/screener/crashArb").CrashArbRow;
    }
  });

  const sorted = sortCrashArbRows(rows);
  const generatedAt = Date.now();
  cache.set(cacheKey, { at: generatedAt, rows: sorted });

  const { marketDrawdown, breadthDown } = summarizeCrashMarket(sorted);
  const payload: CrashArbResponse = { rows: sorted, generatedAt, marketDrawdown, breadthDown };
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
