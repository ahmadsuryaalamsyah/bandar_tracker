"use client";

import { useState } from "react";
import { INTERVALS, RANGES, type Interval, type Range } from "@/lib/data/types";
import { INTERVAL_LABELS, RANGE_LABELS, RANGE_SHORT_LABELS } from "@/lib/utils/labels";

const SAMPLE_TICKERS = ["BBCA", "BBRI", "BMRI", "ANTM", "MDKA", "BRMS", "SMDR", "TMAS", "BULL"];

interface TickerFormProps {
  ticker: string;
  interval: Interval;
  range: Range;
  busy: boolean;
  onSubmit: (ticker: string, interval: Interval, range: Range) => void;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string; title?: string }>;
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-panel-soft p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-[9px] px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${
              active
                ? "bg-accent text-accent-fg shadow-sm"
                : "text-fg-muted hover:bg-panel-hover hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function TickerForm({ ticker, interval, range, busy, onSubmit }: TickerFormProps) {
  const [draft, setDraft] = useState(ticker);
  const [draftInterval, setDraftInterval] = useState<Interval>(interval);
  const [draftRange, setDraftRange] = useState<Range>(range);

  const submit = (value: string, nextInterval: Interval, nextRange: Range) => {
    const cleaned = value.trim().toUpperCase().replace(/\.JK$/, "");
    if (!cleaned) return;
    setDraft(cleaned);
    onSubmit(cleaned, nextInterval, nextRange);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(draft, draftInterval, draftRange);
      }}
      className="rounded-2xl border border-line bg-panel p-4 shadow-panel backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="block lg:w-64">
          <span className="mb-1.5 block text-[11px] font-semibold tracking-widest text-fg-subtle uppercase">
            Kode Saham
          </span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.toUpperCase())}
            placeholder="BBCA"
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-line bg-panel-soft px-3 py-2 text-sm font-semibold tracking-[0.12em] text-fg outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-fg-subtle focus:border-accent"
          />
        </label>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold tracking-widest text-fg-subtle uppercase">
              Timeframe
            </span>
            <Segmented
              label="Timeframe"
              disabled={busy}
              value={draftInterval}
              onChange={setDraftInterval}
              options={INTERVALS.map((value) => ({ value, label: INTERVAL_LABELS[value] }))}
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold tracking-widest text-fg-subtle uppercase">
              Rentang
            </span>
            <Segmented
              label="Rentang data"
              disabled={busy}
              value={draftRange}
              onChange={setDraftRange}
              options={RANGES.map((value) => ({
                value,
                label: RANGE_SHORT_LABELS[value],
                title: RANGE_LABELS[value],
              }))}
            />
          </div>

          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="h-9 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Memuat…" : "Analisis"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <span className="mr-1 text-xs text-fg-subtle">Contoh:</span>
        {SAMPLE_TICKERS.map((sample) => (
          <button
            key={sample}
            type="button"
            disabled={busy}
            onClick={() => submit(sample, draftInterval, draftRange)}
            className="rounded-lg border border-line bg-panel-soft px-2.5 py-1 text-xs font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
          >
            {sample}
          </button>
        ))}
      </div>
    </form>
  );
}
