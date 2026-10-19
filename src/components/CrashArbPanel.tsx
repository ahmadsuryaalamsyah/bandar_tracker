"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useCrashArb } from "@/hooks/useCrashArb";
import type { CrashArbRow } from "@/lib/screener/crashArb";
import { DEFAULT_UNIVERSE } from "@/lib/screener/universe";
import {
  getWatchlistServerSnapshot,
  getWatchlistSnapshot,
  setWatchlist,
  subscribeWatchlist,
} from "@/lib/utils/watchlist";
import { formatPrice, formatSignedPercent, formatWibClock } from "@/lib/utils/format";
import { Panel } from "./Panel";
import { ErrorState } from "./AsyncState";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function ScoreBadge({ score, label }: { score: number | null; label: CrashArbRow["arbLabel"] }) {
  if (score === null || label === null) return <span className="text-fg-subtle">—</span>;

  const colors = {
    Prime: "bg-up/15 text-up border border-up/30",
    Watchlist: "bg-warn/15 text-warn border border-warn/30",
    "Terlalu Rusak": "bg-down/10 text-down/70 border border-down/20",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${colors[label]}`}
    >
      {label === "Prime" && <span aria-hidden>🎯</span>}
      {label === "Watchlist" && <span aria-hidden>👀</span>}
      {label === "Terlalu Rusak" && <span aria-hidden>⚠️</span>}
      {label}
      <span className="font-mono opacity-70">{score.toFixed(0)}</span>
    </span>
  );
}

function PctCell({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-fg-subtle">—</span>;
  const isGood = invert ? value <= 0 : value >= 0;
  return (
    <span className={`font-semibold tnum ${isGood ? "text-up" : "text-down"}`}>
      {formatSignedPercent(value)}
    </span>
  );
}

function LpmBar({ lpm }: { lpm: number | null }) {
  if (lpm === null) return <span className="text-fg-subtle">—</span>;
  const color =
    lpm <= 38 ? "bg-up" : lpm >= 62 ? "bg-down" : "bg-accent";
  const label = lpm <= 38 ? "Oversold" : lpm >= 62 ? "Overbought" : "Netral";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${color}`}
          style={{ width: `${lpm}%` }}
        />
      </div>
      <span className="text-[10px] text-fg-subtle">{label}</span>
    </div>
  );
}

/* ─── Market breadth gauge ─────────────────────────────────────────────────── */

function MarketBreadthCard({
  marketDrawdown,
  breadthDown,
}: {
  marketDrawdown: number | null;
  breadthDown: number | null;
}) {
  const severity =
    breadthDown === null
      ? "unknown"
      : breadthDown >= 0.6
        ? "severe"
        : breadthDown >= 0.35
          ? "moderate"
          : "mild";

  const severityLabel = {
    unknown: "Belum ada data",
    severe: "Crash Massal 🔴",
    moderate: "Koreksi Signifikan 🟡",
    mild: "Penurunan Ringan 🟢",
  }[severity];

  const severityColor = {
    unknown: "border-line bg-panel-soft",
    severe: "border-down/40 bg-down/8",
    moderate: "border-warn/40 bg-warn/8",
    mild: "border-up/30 bg-up/8",
  }[severity];

  return (
    <div className={`rounded-2xl border p-5 ${severityColor}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
            Kondisi Pasar Saat Ini
          </p>
          <p className="mt-1 text-lg font-bold text-fg">{severityLabel}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {breadthDown !== null
              ? `${(breadthDown * 100).toFixed(0)}% saham turun >3% dalam 5 hari`
              : "Sedang memindai pasar…"}
          </p>
        </div>

        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
              Avg Drawdown
            </p>
            <p className="text-xl font-bold text-down tnum">
              {marketDrawdown !== null
                ? `${(marketDrawdown * 100).toFixed(1)}%`
                : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
              Breadth Turun
            </p>
            <p className="text-xl font-bold text-warn tnum">
              {breadthDown !== null ? `${(breadthDown * 100).toFixed(0)}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Severity bar */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] text-fg-subtle">
          <span>Ringan</span>
          <span>Parah</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${
              severity === "severe"
                ? "bg-down"
                : severity === "moderate"
                  ? "bg-warn"
                  : "bg-up"
            }`}
            style={{ width: `${Math.min((breadthDown ?? 0) * 100 * 1.5, 100)}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-fg-subtle">
        💡 Crash massal karena MSCI/rebalancing cenderung rebound dalam 3–10 hari bursa.
        Filter Prime menandai kandidat yang ikut jatuh karena <em>forced selling</em>, bukan karena fundamental rusak.
      </p>
    </div>
  );
}

/* ─── Row card ─────────────────────────────────────────────────────────────── */

function ArbCard({
  row,
  onSelectTicker,
  isWatched,
  onToggleWatchlist,
}: {
  row: CrashArbRow;
  onSelectTicker?: (ticker: string) => void;
  isWatched: boolean;
  onToggleWatchlist: (ticker: string) => void;
}) {
  if (row.error) {
    return (
      <li className="flex items-center gap-3 rounded-xl border border-line bg-panel-soft px-4 py-3 opacity-50">
        <span className="text-sm font-bold text-fg">{row.ticker}</span>
        <span className="text-xs text-fg-subtle">{row.error}</span>
      </li>
    );
  }

  const isPrime = row.arbLabel === "Prime";
  const isWatchlist = row.arbLabel === "Watchlist";

  return (
    <li
      className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${
        isPrime
          ? "border-up/30 bg-up/5"
          : isWatchlist
            ? "border-warn/25 bg-warn/5"
            : "border-line bg-panel-soft opacity-60"
      }`}
    >
      {/* Header baris */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {onSelectTicker ? (
              <button
                type="button"
                onClick={() => onSelectTicker(row.ticker)}
                className="text-base font-bold tracking-wide text-fg hover:text-accent transition underline-offset-2 hover:underline"
                title={`Buka analisis & chart ${row.ticker}`}
              >
                {row.ticker}
              </button>
            ) : (
              <span className="text-base font-bold tracking-wide text-fg">{row.ticker}</span>
            )}
            {row.name && (
              <span className="truncate text-xs text-fg-muted max-w-[160px]">{row.name}</span>
            )}
          </div>
          {row.reason && (
            <p className="mt-0.5 text-[11px] text-fg-subtle leading-relaxed">{row.reason}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleWatchlist(row.ticker)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              isWatched
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-line bg-panel-soft text-fg-muted hover:border-accent/50 hover:text-accent"
            }`}
          >
            {isWatched ? "✓ Dipantau" : "+ Pantau"}
          </button>
          {onSelectTicker && (
            <button
              type="button"
              onClick={() => onSelectTicker(row.ticker)}
              className="rounded-lg border border-line bg-panel-soft px-2.5 py-1 text-xs font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent"
            >
              Analisis →
            </button>
          )}
          <ScoreBadge score={row.arbScore} label={row.arbLabel} />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">Harga</p>
          <p className="text-sm font-semibold text-fg tnum">
            {row.price !== null ? formatPrice(row.price, row.currency) : "—"}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">1 Hari</p>
          <PctCell value={row.changePct1d} />
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">5 Hari</p>
          <PctCell value={row.changePct5d} />
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">Drawdown</p>
          <PctCell value={row.drawdownFromHigh} />
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">LPM</p>
          <LpmBar lpm={row.lpm} />
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
            RVOL
          </p>
          <span
            className={`text-sm font-semibold tnum ${
              (row.rvol ?? 1) >= 2 ? "text-warn" : "text-fg-muted"
            }`}
          >
            {row.rvol !== null ? `${row.rvol.toFixed(1)}×` : "—"}
          </span>
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">Trend</p>
          <span
            className={`text-xs font-medium ${
              row.trendLabel === "Bullish"
                ? "text-up"
                : row.trendLabel === "Bearish"
                  ? "text-down"
                  : "text-fg-muted"
            }`}
          >
            {row.trendLabel ?? "—"}
          </span>
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
            Pot. ke SMA20
          </p>
          <span className="text-xs font-medium text-fg-muted tnum">
            {row.potentialToSma20 !== null
              ? `${row.potentialToSma20 > 0 ? "+" : ""}${row.potentialToSma20.toFixed(1)} ATR`
              : "—"}
          </span>
        </div>
      </div>
    </li>
  );
}

/* ─── Main panel ───────────────────────────────────────────────────────────── */

export function CrashArbPanel({
  onSelectTicker,
}: {
  onSelectTicker?: (ticker: string) => void;
} = {}) {
  const watchlist = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getWatchlistServerSnapshot,
  );

  const toggleWatchlist = (ticker: string) => {
    if (watchlist.includes(ticker)) {
      setWatchlist(watchlist.filter((item) => item !== ticker));
    } else {
      setWatchlist([...watchlist, ticker]);
    }
  };

  const { status, data, error, progress, refreshing, scan, refresh } = useCrashArb();

  // Scan universe + watchlist.
  const tickers = useMemo(() => {
    const set = new Set<string>(DEFAULT_UNIVERSE);
    for (const t of watchlist) set.add(t);
    return [...set];
  }, [watchlist]);

  useEffect(() => {
    void scan(tickers);
  }, [scan, tickers]);

  const primeRows = useMemo(
    () => (data?.rows ?? []).filter((r) => !r.error && r.arbLabel === "Prime"),
    [data],
  );
  const watchlistRows = useMemo(
    () => (data?.rows ?? []).filter((r) => !r.error && r.arbLabel === "Watchlist"),
    [data],
  );
  const errorCount = (data?.rows ?? []).filter((r) => r.error).length;
  const scannedCount = (data?.rows ?? []).filter((r) => !r.error).length;

  const isLoading = status === "loading" && !data;

  return (
    <div className="mt-5 space-y-5">
      {/* Header info */}
      <Panel
        title="Crash Arb Scanner"
        subtitle="Identifikasi saham yang jatuh karena forced selling — bukan karena fundamental rusak"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-fg-subtle tnum">
              {progress
                ? `memindai ${progress.scanned}/${progress.total}…`
                : data
                  ? `${scannedCount} dipindai · ${primeRows.length} Prime · ${formatWibClock(data.generatedAt)} WIB`
                  : ""}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || progress !== null || isLoading}
              className="rounded-lg border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
            >
              {progress ? "Memindai…" : "Scan ulang"}
            </button>
          </div>
        }
      >
        {/* Progress bar */}
        {progress && progress.total > 0 && (
          <div
            className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.scanned}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${(progress.scanned / progress.total) * 100}%` }}
            />
          </div>
        )}

        {isLoading && (
          <p className="py-10 text-center text-sm text-fg-subtle animate-pulse">
            Memindai {tickers.length} saham untuk sinyal crash arb…
          </p>
        )}

        {status === "error" && !data && (
          <ErrorState message={error ?? "Gagal memuat data."} onRetry={refresh} />
        )}

        {/* Market breadth card — muncul saat ada data */}
        {data && (
          <MarketBreadthCard
            marketDrawdown={data.marketDrawdown}
            breadthDown={data.breadthDown}
          />
        )}

        {/* Stale error */}
        {error && data && (
          <p className="mt-3 rounded-xl border border-warn/35 bg-warn/10 px-3 py-2 text-sm text-warn">
            {error}
          </p>
        )}
      </Panel>

      {/* Prime candidates */}
      {(primeRows.length > 0 || (!isLoading && data)) && (
        <Panel
          title={`🎯 Kandidat Prime (${primeRows.length})`}
          subtitle="Drawdown tajam + volume spike + LPM oversold + struktur masih intact"
        >
          {primeRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-subtle">
              Belum ada kandidat Prime.{" "}
              {(data?.breadthDown ?? 0) < 0.35
                ? "Pasar belum dalam kondisi crash massal — coba saat koreksi lebih dalam."
                : "Semua saham yang jatuh kemungkinan memang sudah rusak strukturnya."}
            </p>
          ) : (
            <ul className="space-y-3">
              {primeRows.map((row) => (
                <ArbCard
                  key={row.ticker}
                  row={row}
                  onSelectTicker={onSelectTicker}
                  isWatched={watchlist.includes(row.ticker)}
                  onToggleWatchlist={toggleWatchlist}
                />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* Watchlist candidates */}
      {watchlistRows.length > 0 && (
        <Panel
          title={`👀 Pantau (${watchlistRows.length})`}
          subtitle="Drawdown moderat — belum cukup oversold, tapi layak dimonitor"
        >
          <ul className="space-y-3">
            {watchlistRows.map((row) => (
              <ArbCard
                key={row.ticker}
                row={row}
                onSelectTicker={onSelectTicker}
                isWatched={watchlist.includes(row.ticker)}
                onToggleWatchlist={toggleWatchlist}
              />
            ))}
          </ul>
        </Panel>
      )}

      {/* Footer */}
      <p className="text-xs text-fg-subtle">
        Skor arb = drawdown depth (30) + LPM oversold (25) + volume spike/RVOL (20) + struktur trend (15) + intensity (10).
        Ambang &quot;Prime&quot; ≥ 50. Ini analisis teknikal otomatis, bukan rekomendasi investasi. Selalu lakukan due diligence.
        {errorCount > 0 && ` · ${errorCount} saham gagal dimuat.`}
      </p>
    </div>
  );
}
