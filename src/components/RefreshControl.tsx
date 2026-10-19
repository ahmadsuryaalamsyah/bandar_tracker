"use client";

import { formatWibClock, formatWibDateTime } from "@/lib/utils/format";

interface RefreshControlProps {
  quoteTime: number | null;
  updatedAt: number | null;
  delayMs: number | null;
  refreshing: boolean;
  /** Pesan error non-fatal dari refresh senyap (data lama tetap tampil). */
  staleError: string | null;
  autoRefresh: boolean;
  intervalMs: number;
  onToggleAuto: () => void;
  onRefreshNow: () => void;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-fg-subtle">{label} </span>
      <span className="font-medium text-fg-muted tnum">{value}</span>
    </span>
  );
}

export function RefreshControl({
  quoteTime,
  updatedAt,
  delayMs,
  refreshing,
  staleError,
  autoRefresh,
  intervalMs,
  onToggleAuto,
  onRefreshNow,
}: RefreshControlProps) {
  const delayMinutes = delayMs !== null ? Math.round(delayMs / 60_000) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-2.5 text-xs shadow-panel backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-medium text-fg-muted">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-pulse bg-accent" : "bg-fg-subtle"}`}
          />
          {refreshing ? "Memperbarui…" : "Kuotasi delayed"}
        </span>
        {quoteTime !== null && <Meta label="pasar" value={`${formatWibDateTime(quoteTime)} WIB`} />}
        {delayMinutes !== null && <Meta label="delay" value={`±${delayMinutes} mnt`} />}
        {updatedAt !== null && <Meta label="ditarik" value={`${formatWibClock(updatedAt)} WIB`} />}
        {staleError && <span className="font-medium text-warn">refresh gagal: {staleError}</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefreshNow}
          disabled={refreshing}
          className="rounded-lg border border-line bg-panel-soft px-2.5 py-1 font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={onToggleAuto}
          aria-pressed={autoRefresh}
          className={`rounded-lg border px-2.5 py-1 font-medium transition ${
            autoRefresh
              ? "border-up/40 bg-up/10 text-up"
              : "border-line bg-panel-soft text-fg-subtle hover:text-fg-muted"
          }`}
        >
          Auto {autoRefresh ? "On" : "Off"} · {Math.round(intervalMs / 1000)}s
        </button>
      </div>
    </div>
  );
}
