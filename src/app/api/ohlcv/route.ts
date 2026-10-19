import { NextResponse, type NextRequest } from "next/server";
import { DataProviderError, getProvider, isInterval, isRange } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKER_PATTERN = /^[A-Z0-9]{2,8}$/;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawTicker = (params.get("ticker") ?? "").trim().toUpperCase().replace(/\.JK$/, "");
  const rawInterval = params.get("interval") ?? "1d";
  const rawRange = params.get("range") ?? "1y";

  if (!TICKER_PATTERN.test(rawTicker)) {
    return NextResponse.json(
      { error: "Kode saham tidak valid. Gunakan 2-8 karakter huruf/angka, contoh BBCA.", code: "INVALID_TICKER" },
      { status: 400 },
    );
  }

  if (!isInterval(rawInterval)) {
    return NextResponse.json({ error: `Interval tidak didukung: ${rawInterval}`, code: "INVALID_TICKER" }, { status: 400 });
  }

  if (!isRange(rawRange)) {
    return NextResponse.json({ error: `Range tidak didukung: ${rawRange}`, code: "INVALID_TICKER" }, { status: 400 });
  }

  try {
    const series = await getProvider().fetchOhlcv({
      ticker: rawTicker,
      interval: rawInterval,
      range: rawRange,
    });
    return NextResponse.json(series, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DataProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal.";
    return NextResponse.json({ error: message, code: "UPSTREAM" }, { status: 500 });
  }
}
