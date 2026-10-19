"use client";

import { useState } from "react";
import type { ScreenerStatus } from "@/hooks/useScreener";
import type { ScreenerRow } from "@/lib/screener/types";
import { formatPrice, formatSignedPercent } from "@/lib/utils/format";
import { EmptyState } from "./AsyncState";
import { Panel } from "./Panel";
import { SignalBadge } from "./SignalBadge";

interface WatchlistSectionProps {
  tickers: string[];
  byTicker: Record<string, ScreenerRow>;
  status: ScreenerStatus;
  onAdd: (ticker: string) => void;
  onRemove: (ticker: string) => void;
  onSelectTicker?: (ticker: string) => void;
}

const TICKER_PATTERN = /^[A-Z0-9]{2,8}$/;

function cleanTicker(value: string): string {
  return value.trim().toUpperCase().replace(/\.JK$/, "");
}

export function WatchlistSection({ tickers, byTicker, status, onAdd, onRemove, onSelectTicker }: WatchlistSectionProps) {
  const [draft, setDraft] = useState("");
  const valid = TICKER_PATTERN.test(cleanTicker(draft));

  const submit = () => {
    const cleaned = cleanTicker(draft);
    if (!TICKER_PATTERN.test(cleaned)) return;
    onAdd(cleaned);
    setDraft("");
  };

  return (
    <Panel
      title="Watchlist"
      subtitle={`${tickers.length} saham dipantau`}
      action={
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.toUpperCase())}
            placeholder="Tambah kode…"
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
            aria-label="Kode saham untuk watchlist"
            className="w-36 rounded-lg border border-line bg-panel-soft px-2.5 py-1 text-xs font-semibold tracking-[0.12em] text-fg outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-fg-subtle focus:border-accent"
          />
          <button
            type="submit"
            disabled={!valid}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tambah
          </button>
        </form>
      }
    >
      {tickers.length === 0 ? (
        <EmptyState message="Belum ada saham dipantau. Tambahkan kode di kanan atas." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {tickers.map((ticker) => {
            const row = byTicker[ticker];
            const loading = status === "loading" && !row;

            return (
              <li
                key={ticker}
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-panel-soft px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {onSelectTicker ? (
                      <button
                        type="button"
                        onClick={() => onSelectTicker(ticker)}
                        className="text-sm font-bold tracking-wide text-fg hover:text-accent transition underline-offset-2 hover:underline"
                        title={`Buka chart & analisis ${ticker}`}
                      >
                        {ticker}
                      </button>
                    ) : (
                      <span className="text-sm font-bold tracking-wide text-fg">{ticker}</span>
                    )}
                    {row?.state && <SignalBadge signal={row.state} size="sm" />}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{row?.name ?? "—"}</p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {loading && <span className="text-xs text-fg-subtle">Memuat…</span>}
                  {!loading && row?.error && <span className="text-xs text-fg-subtle">gagal</span>}
                  {!loading && !row?.error && (
                    <div className="text-right">
                      <div className="text-sm font-semibold text-fg tnum">
                        {row?.price != null ? formatPrice(row.price, row.currency) : "—"}
                      </div>
                      <div
                        className={`text-xs font-semibold tnum ${
                          (row?.changePct ?? 0) >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {row?.changePct != null ? formatSignedPercent(row.changePct) : "—"}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemove(ticker)}
                    aria-label={`Hapus ${ticker} dari watchlist`}
                    className="rounded-lg border border-transparent px-2 py-1 text-sm leading-none text-fg-subtle transition hover:border-down/40 hover:text-down"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
