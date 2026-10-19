"use client";

import { useMemo } from "react";
import type { BacktestResponse, TradeOutcome } from "@/lib/backtest/types";
import type { BacktestStatus } from "@/hooks/useBacktest";
import { configForProfile, TRADE_PROFILES } from "@/lib/indicators/config";
import { formatDate } from "@/lib/utils/format";
import { INTERVAL_LABELS, RANGE_LABELS } from "@/lib/utils/labels";
import { Panel } from "./Panel";

interface BacktestPanelProps {
  status: BacktestStatus;
  data: BacktestResponse | null;
  error: string | null;
  onRun: () => void;
}

const OUTCOME_LABEL: Record<TradeOutcome, string> = {
  target: "Target",
  stop: "Stop",
  timeout: "Timeout",
};

const OUTCOME_CLASS: Record<TradeOutcome, string> = {
  target: "border-up/35 bg-up/10 text-up",
  stop: "border-down/35 bg-down/10 text-down",
  timeout: "border-line-strong bg-flat/10 text-flat",
};

function Stat({
  label,
  value,
  hint,
  tone = "text-fg",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel-soft px-3 py-2.5">
      <div className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tnum ${tone}`}>{value}</div>
      {hint && <div className="text-[11px] text-fg-subtle">{hint}</div>}
    </div>
  );
}

/** Kurva ekuitas ringkas (SVG) — tanpa dependensi chart tambahan. */
function EquityCurve({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="py-6 text-center text-xs text-fg-subtle">Butuh minimal 2 trade untuk menggambar kurva.</p>;
  }

  const width = 100;
  const height = 32;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;

  const toY = (value: number) => height - ((value - min) / span) * height;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${toY(value)}`);
  const zeroY = toY(0);
  const positive = values[values.length - 1] >= 0;

  return (
    <div className={positive ? "text-up" : "text-down"}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-20 w-full"
        role="img"
        aria-label="Kurva ekuitas kumulatif backtest"
      >
        <line
          x1="0"
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="currentColor"
          strokeWidth="0.3"
          strokeDasharray="2 2"
          opacity="0.4"
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-fg-subtle tnum">
        <span>{min.toFixed(1)}R</span>
        <span>final {values[values.length - 1].toFixed(2)}R</span>
        <span>{max.toFixed(1)}R</span>
      </div>
    </div>
  );
}

export function BacktestPanel({ status, data, error, onRun }: BacktestPanelProps) {
  const stats = data?.result.stats ?? null;
  const recent = useMemo(() => (data ? [...data.result.trades].slice(-8).reverse() : []), [data]);

  return (
    <Panel
      title="Validasi Backtest"
      subtitle="Walk-forward in-sample: sinyal hanya memakai bar sebelumnya, entry di open bar berikutnya"
      action={
        <button
          type="button"
          onClick={onRun}
          disabled={status === "loading"}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Menghitung…" : "Jalankan backtest"}
        </button>
      }
    >
      {status === "idle" && (
        <p className="py-6 text-center text-sm text-fg-subtle">
          Belum dijalankan. Klik <span className="text-fg-muted">Jalankan backtest</span> untuk menguji gate trade
          plan pada rentang yang sedang dipilih.
        </p>
      )}

      {status === "loading" && <p className="py-6 text-center text-sm text-fg-subtle">Menghitung walk-forward…</p>}

      {status === "error" && (
        <p className="rounded-xl border border-down/35 bg-down/10 px-3 py-2 text-sm text-down">
          {error ?? "Backtest gagal."}
        </p>
      )}

      {status === "success" && data && stats && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Trade"
              value={String(stats.trades)}
              hint={`${stats.signals} sinyal · ${data.result.testedBars} bar diuji`}
            />
            <Stat
              label="Win rate"
              value={`${(stats.winRate * 100).toFixed(0)}%`}
              hint={`${stats.wins}W / ${stats.losses}L`}
            />
            <Stat
              label="Expectancy"
              value={`${stats.expectancyR.toFixed(2)}R`}
              hint="rata-rata hasil per trade"
              tone={stats.expectancyR >= 0 ? "text-up" : "text-down"}
            />
            <Stat
              label="Profit factor"
              value={stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "∞"}
              hint="profit kotor / loss kotor"
            />
            <Stat
              label="Max drawdown"
              value={`${stats.maxDrawdownR.toFixed(2)}R`}
              hint="penurunan puncak-ke-palung"
              tone={stats.maxDrawdownR > 0 ? "text-down-soft" : "text-fg"}
            />
            <Stat
              label="Rata-rata tahan"
              value={`${stats.avgHoldingBars.toFixed(1)} bar`}
              hint={`MAE ${stats.avgMaeR.toFixed(2)}R · MFE ${stats.avgMfeR.toFixed(2)}R`}
            />
          </div>

          <div className="mt-4 rounded-xl border border-line bg-panel-soft p-3">
            <div className="mb-1 text-[10px] font-medium tracking-widest text-fg-subtle uppercase">
              Kurva ekuitas (R)
            </div>
            <EquityCurve values={stats.equityCurve} />
          </div>

          {recent.length > 0 && (
            <div className="mt-4 overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] tracking-widest text-fg-subtle uppercase">
                    <th className="py-2 font-medium">Keluar</th>
                    <th className="py-2 font-medium">Hasil</th>
                    <th className="py-2 text-right font-medium">R</th>
                    <th className="py-2 text-right font-medium">Tahan</th>
                    <th className="py-2 text-right font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((trade) => (
                    <tr key={`${trade.signalIndex}-${trade.exitIndex}`}>
                      <td className="py-2 text-fg-muted tnum">{formatDate(trade.exitTime)}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${OUTCOME_CLASS[trade.outcome]}`}
                        >
                          {OUTCOME_LABEL[trade.outcome]}
                        </span>
                      </td>
                      <td
                        className={`py-2 text-right font-semibold tnum ${
                          trade.rMultiple >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {trade.rMultiple.toFixed(2)}
                      </td>
                      <td className="py-2 text-right text-fg-muted tnum">{trade.holdingBars}</td>
                      <td className="py-2 text-right text-fg-subtle">{trade.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-fg-subtle">
                Menampilkan {recent.length} trade terakhir dari {stats.trades}.
              </p>
            </div>
          )}

          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-fg-subtle">
            In-sample pada {data.result.testedBars} bar{" "}
            {INTERVAL_LABELS[data.interval].toLowerCase()} ({RANGE_LABELS[data.range]}), profil{" "}
            {TRADE_PROFILES[data.profile].label}, timeout{" "}
            {configForProfile(data.profile).backtest.maxHoldingBars} bar. Belum termasuk fee broker, slippage, tick
            size IDX, maupun dividen; satu posisi pada satu instrumen. Angka ini mengukur perilaku gate apa adanya —
            ambang di <span className="font-mono text-fg-muted">config.ts</span> belum di-tuning terhadap hasil ini.
          </p>
        </>
      )}
    </Panel>
  );
}
