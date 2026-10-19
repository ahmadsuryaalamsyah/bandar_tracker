import type { Interpretation } from "@/lib/indicators/interpret";
import { clamp } from "@/lib/indicators/normalize";
import { Panel } from "./Panel";
import { toneBar, toneText } from "./tone";

export interface Metric {
  label: string;
  value: string;
}

export interface PanelContext {
  label: string;
  value: string;
}

interface IndicatorPanelProps {
  title: string;
  description: string;
  score: number | null;
  interpretation: Interpretation | null;
  metrics: Metric[];
  context?: PanelContext;
}

export function IndicatorPanel({ title, description, score, interpretation, metrics, context }: IndicatorPanelProps) {
  const hasScore = score !== null && Number.isFinite(score);
  const width = hasScore ? clamp(score, 0, 100) : 0;
  const tone = interpretation?.tone ?? "neutral";

  return (
    <Panel className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{description}</p>
        </div>
        <span className={`text-2xl font-bold tnum ${toneText[tone]}`}>{hasScore ? score.toFixed(1) : "–"}</span>
      </div>

      <div className="mt-4">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${toneBar[tone]}`}
            style={{ width: `${width}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-fg-subtle tnum">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      <p className={`mt-2 text-sm font-medium ${toneText[tone]}`}>{interpretation?.label ?? "–"}</p>

      {context && (
        <p className="mt-1 text-xs text-fg-muted">
          <span className="text-fg-subtle">{context.label}:</span>{" "}
          <span className="font-medium text-fg">{context.value}</span>
        </p>
      )}

      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0">
            <dt className="truncate text-[10px] tracking-wide text-fg-subtle uppercase">{metric.label}</dt>
            <dd className="truncate text-sm font-semibold text-fg tnum">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
