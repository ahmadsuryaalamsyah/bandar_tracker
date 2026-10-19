"use client";

import { useMemo } from "react";
import type { ScreenerProgress, ScreenerStatus } from "@/hooks/useScreener";
import { TRADE_PROFILES, type TradeProfileId } from "@/lib/indicators/config";
import { selectGoodToBuy, selectNearMisses, summarizeBlockers } from "@/lib/screener/select";
import type { ScreenerRow } from "@/lib/screener/types";
import { formatNumber, formatPrice, formatRatio, formatSignedPercent, formatWibClock } from "@/lib/utils/format";
import { ErrorState } from "./AsyncState";
import { Panel } from "./Panel";
import { SignalBadge } from "./SignalBadge";

interface GoodToBuySectionProps {
  rows: ScreenerRow[];
  status: ScreenerStatus;
  profile: TradeProfileId;
  generatedAt: number | null;
  error: string | null;
  refreshing: boolean;
  /** Progres pemindaian bertahap; null bila tidak sedang memindai. */
  progress: ScreenerProgress | null;
  onRefresh: () => void;
  onAddToWatchlist: (ticker: string) => void;
  isWatched: (ticker: string) => boolean;
  onSelectTicker?: (ticker: string) => void;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">{label}</div>
      <div className="text-sm font-semibold text-fg tnum">{children}</div>
    </div>
  );
}

export function GoodToBuySection({
  rows,
  status,
  profile,
  generatedAt,
  error,
  refreshing,
  progress,
  onRefresh,
  onAddToWatchlist,
  isWatched,
  onSelectTicker,
}: GoodToBuySectionProps) {
  const good = useMemo(() => selectGoodToBuy(rows), [rows]);
  const nearMisses = useMemo(() => selectNearMisses(rows, 5), [rows]);
  const blockers = useMemo(() => summarizeBlockers(rows), [rows]);
  const scanned = rows.filter((row) => !row.error).length;
  const failed = rows.filter((row) => row.error).length;

  const scanning = progress !== null;
  const loading = status === "loading" && rows.length === 0;
  // Semua gagal dimuat (mis. rate limit) — jangan bilang "tidak ada yang lolos",
  // karena kita memang belum berhasil memeriksa apa pun.
  const allFailed = !loading && !scanning && rows.length > 0 && scanned === 0 && failed > 0;

  const horizonLabel =
    profile === "fast" ? "1–3 hari" : `${TRADE_PROFILES.swing.tradePlan.minHorizonDays}–30 hari`;

  return (
    <Panel
      title="Kandidat Long"
      subtitle={`Data harian · profil ${TRADE_PROFILES[profile].label} · horizon ${horizonLabel}`}
      action={
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <span className="text-xs text-fg-subtle tnum">
            {progress
              ? `memindai ${progress.scanned}/${progress.total}…`
              : `${scanned} dipindai · ${good.length} lolos${
                  generatedAt ? ` · ${formatWibClock(generatedAt)} WIB` : ""
                }`}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || progress !== null}
            className="rounded-lg border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
          >
            {progress ? "Memindai…" : "Scan ulang"}
          </button>
        </div>
      }
    >
      {progress && progress.total > 0 && (
        <div
          className="mb-4 h-1 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.scanned}
          aria-label="Progres pemindaian"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(progress.scanned / progress.total) * 100}%` }}
          />
        </div>
      )}

      {loading && (
        <p className="py-10 text-center text-sm text-fg-subtle">
          {progress ? `Memindai ${progress.total} saham…` : "Memindai pasar…"}
        </p>
      )}

      {status === "error" && rows.length === 0 && (
        <ErrorState message={error ?? "Gagal memuat daftar saham."} onRetry={onRefresh} />
      )}

      {allFailed && (
        <ErrorState
          message={`Semua ${failed} saham gagal dimuat dari provider (biasanya rate limit Yahoo). Tunggu sebentar lalu scan ulang.`}
          onRetry={onRefresh}
        />
      )}

      {/* Pemindaian berhenti di tengah: sebagian hasil tetap ditampilkan. */}
      {error && rows.length > 0 && !allFailed && (
        <p className="mb-4 rounded-xl border border-warn/35 bg-warn/10 px-3 py-2 text-sm text-warn">{error}</p>
      )}

      {!loading && !allFailed && status !== "error" && (
        <>
          {/* Selalu tampilkan sebaran gate: kalau daftar kosong, ini yang menjelaskan kenapa. */}
          {blockers.length > 0 && (
            <div className="mb-4 rounded-xl border border-line bg-panel-soft px-3 py-2.5">
              <div className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
                Tersaring di gate (penyebab pertama)
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {blockers.map((blocker) => (
                  <li
                    key={blocker.label}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2 py-0.5 text-[11px] font-medium text-fg-muted"
                  >
                    {blocker.label}
                    <span className="rounded bg-panel-hover px-1 font-semibold text-fg tnum">{blocker.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {good.length > 0 && (
            <ul className="divide-y divide-line">
              {good.map((row) => (
                <li
                  key={row.ticker}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {onSelectTicker ? (
                        <button
                          type="button"
                          onClick={() => onSelectTicker(row.ticker)}
                          className="text-sm font-bold tracking-wide text-fg hover:text-accent transition underline-offset-2 hover:underline"
                          title={`Buka chart & analisis ${row.ticker}`}
                        >
                          {row.ticker}
                        </button>
                      ) : (
                        <span className="text-sm font-bold tracking-wide text-fg">{row.ticker}</span>
                      )}
                      {row.state && <SignalBadge signal={row.state} size="sm" />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-subtle">{row.name ?? "—"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="text-right">
                      <div className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">Harga</div>
                      <div className="text-sm font-semibold text-fg tnum">
                        {row.price !== null ? formatPrice(row.price, row.currency) : "—"}
                      </div>
                      <div
                        className={`text-xs font-semibold tnum ${(row.changePct ?? 0) >= 0 ? "text-up" : "text-down"}`}
                      >
                        {row.changePct !== null ? formatSignedPercent(row.changePct) : "—"}
                      </div>
                    </div>

                    <Cell label="R:R">{row.rewardRisk !== null ? formatRatio(row.rewardRisk) : "—"}</Cell>
                    <Cell label="Horizon">{row.horizonDays !== null ? `${row.horizonDays} hari` : "—"}</Cell>

                    <div className="hidden text-right xl:block">
                      <div className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
                        Entry / Stop / Target
                      </div>
                      <div className="text-xs text-fg-muted tnum">
                        {row.entry !== null ? formatNumber(row.entry) : "—"} ·{" "}
                        <span className="text-down">{row.stop !== null ? formatNumber(row.stop) : "—"}</span> ·{" "}
                        <span className="text-up">{row.target !== null ? formatNumber(row.target) : "—"}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isWatched(row.ticker)}
                      onClick={() => onAddToWatchlist(row.ticker)}
                      className="rounded-lg border border-line bg-panel-soft px-2.5 py-1 text-xs font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent disabled:cursor-default disabled:opacity-40"
                    >
                      {isWatched(row.ticker) ? "✓ Dipantau" : "+ Pantau"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {good.length === 0 && !allFailed && (
            <p className="py-4 text-center text-sm text-fg-subtle">
              Tidak ada saham yang lolos seluruh gate. Ini normal saat pasar sedang turun —
              gate tidak menganjurkan long di luar uptrend.
            </p>
          )}

          {good.length === 0 && nearMisses.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
                Hampir lolos (gagal 1 gate)
              </div>
              <ul className="mt-2 divide-y divide-line">
                {nearMisses.map((row) => (
                  <li key={row.ticker} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <div className="flex items-center gap-2">
                      {onSelectTicker ? (
                        <button
                          type="button"
                          onClick={() => onSelectTicker(row.ticker)}
                          className="text-sm font-semibold text-fg hover:text-accent transition underline-offset-2 hover:underline"
                          title={`Buka chart & analisis ${row.ticker}`}
                        >
                          {row.ticker}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-fg">{row.ticker}</span>
                      )}
                      <span className="text-xs text-fg-subtle">{row.name ?? "—"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-warn">{row.blockedBy}</span>
                      <span className="text-fg-subtle tnum">
                        {row.gatesPassed}/{row.gatesTotal} gate
                      </span>
                      <span className="text-fg-muted tnum">
                        R:R {row.rewardRisk !== null ? formatRatio(row.rewardRisk) : "—"}
                      </span>
                      <button
                        type="button"
                        disabled={isWatched(row.ticker)}
                        onClick={() => onAddToWatchlist(row.ticker)}
                        className="rounded-lg border border-line bg-panel-soft px-2 py-0.5 font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent disabled:cursor-default disabled:opacity-40"
                      >
                        {isWatched(row.ticker) ? "✓" : "+ Pantau"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">
        Hasil gate, bukan rekomendasi. Ambang per profil ada di
        <span className="font-mono text-fg-muted"> src/lib/indicators/config.ts</span>.
        {failed > 0 && ` ${failed} saham gagal dimuat.`}
      </p>
    </Panel>
  );
}
