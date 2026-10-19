import { clamp } from "@/lib/indicators/normalize";
import type { StrengthLabel, TradePlan } from "@/lib/indicators/types";
import { formatCompact, formatPrice } from "@/lib/utils/format";
import { Panel } from "./Panel";

interface TradePlanPanelProps {
  plan: TradePlan;
  strength: StrengthLabel;
  currency: string;
  /** Label profil trade aktif, mis. "Swing" atau "Cepat 1–3 hari". */
  profileLabel: string;
  /** R:R minimum dari config profil, agar ambang tidak di-hardcode di UI. */
  minRewardRisk: number;
  /** Statistik backtest untuk konteks (opsional — belum tentu sudah dihitung). */
  backtest?: { trades: number; winRate: number; expectancyR: number } | null;
}

function Level({
  label,
  value,
  tone,
  align,
}: {
  label: string;
  value: string;
  tone: string;
  align: "left" | "center" | "right";
}) {
  const alignment = align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center";
  return (
    <div className={`flex flex-col ${alignment}`}>
      <span className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">{label}</span>
      <span className={`text-sm font-semibold tnum ${tone}`}>{value}</span>
    </div>
  );
}

export function TradePlanPanel({ plan, strength, currency, profileLabel, minRewardRisk, backtest }: TradePlanPanelProps) {
  const isLong = plan.direction === "Long";
  const hasLevels = plan.entry !== null && plan.stop !== null && plan.target !== null;
  const entryPct =
    hasLevels && plan.target! > plan.stop!
      ? clamp(((plan.entry! - plan.stop!) / (plan.target! - plan.stop!)) * 100, 0, 100)
      : 50;

  const rr = plan.rewardRisk;
  const rrPass = rr !== null && rr >= minRewardRisk;

  return (
    <Panel
      title="Trade Plan"
      subtitle={`Profil ${profileLabel} · indikatif, bukan rekomendasi`}
      action={
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-widest text-fg-subtle uppercase">Confidence</span>
          <span className="rounded-full border border-line bg-panel-soft px-2.5 py-0.5 text-xs font-semibold text-fg-muted">
            {strength}
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className={`text-2xl font-bold tracking-tight ${isLong ? "text-up" : "text-fg-muted"}`}>
          {plan.direction}
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span className="text-fg-subtle">
            Horizon <span className="font-semibold text-fg tnum">{plan.horizonDays !== null ? `≈${plan.horizonDays} hari` : "–"}</span>
          </span>
          <span className="text-fg-subtle">
            ATR <span className="font-semibold text-fg tnum">{plan.atr.toFixed(1)}</span>
          </span>
          <span className="text-fg-subtle">
            Likuiditas <span className="font-semibold text-fg tnum">{formatCompact(plan.avgValue)}/hari</span>
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Level
          label="Entry"
          value={plan.entry !== null ? formatPrice(plan.entry, currency) : "–"}
          tone="text-fg"
          align="left"
        />
        <Level
          label={`Stop · ${plan.stopBasis ?? "–"}`}
          value={plan.stop !== null ? formatPrice(plan.stop, currency) : "–"}
          tone="text-down"
          align="center"
        />
        <Level
          label={`Target · ${plan.targetBasis ?? "–"}`}
          value={plan.target !== null ? formatPrice(plan.target, currency) : "–"}
          tone="text-up"
          align="center"
        />
        <Level
          label="Reward : Risk"
          value={rr !== null ? `${rr.toFixed(2)}×` : "–"}
          tone={rrPass ? "text-up" : "text-warn"}
          align="right"
        />
      </div>

      {hasLevels && (
        <div className="mt-5">
          <div className="relative h-2">
            <div className="absolute inset-0 flex overflow-hidden rounded-full bg-line">
              <div className="bg-down/70" style={{ width: `${entryPct}%` }} />
              <div className="flex-1 bg-up/70" />
            </div>
            <span
              aria-hidden
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-fg"
              style={{ left: `${entryPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-fg-subtle">
            <span>risiko {((plan.entry! - plan.stop!) / plan.entry! * 100).toFixed(1)}%</span>
            <span>imbal {((plan.target! - plan.entry!) / plan.entry! * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
        {plan.gates.map((gate) => (
          <span
            key={gate.label}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium ${
              gate.passed ? "border-up/35 bg-up/10 text-up" : "border-down/35 bg-down/10 text-down"
            }`}
          >
            <span aria-hidden>{gate.passed ? "✓" : "✕"}</span>
            {gate.label}
          </span>
        ))}
      </div>

      {plan.note && (
        <p className="mt-3 rounded-xl border border-warn/35 bg-warn/10 px-3 py-2 text-sm text-warn">{plan.note}</p>
      )}

      {backtest && backtest.trades > 0 && (
        <p className="mt-3 rounded-xl border border-line bg-panel-soft px-3 py-2 text-xs text-fg-muted">
          Histori walk-forward: <span className="font-semibold text-fg tnum">{backtest.trades}</span> trade,
          win-rate <span className="font-semibold text-fg tnum">{(backtest.winRate * 100).toFixed(0)}%</span>,
          expectancy <span className="font-semibold text-fg tnum">{backtest.expectancyR.toFixed(2)}R</span>{" "}
          <span className="text-fg-subtle">(in-sample pada rentang yang dipilih)</span>
        </p>
      )}

      {plan.basis.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-subtle">
          {plan.basis.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
