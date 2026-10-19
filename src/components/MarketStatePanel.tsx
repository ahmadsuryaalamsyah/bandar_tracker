import { signalTone, type Tone } from "@/lib/indicators/interpret";
import type {
  MomentumLabel,
  RiskLabel,
  SignalAnalysis,
  StrengthLabel,
  TrendLabel,
  VolumeLabel,
} from "@/lib/indicators/types";
import { Panel } from "./Panel";
import { toneBadge, toneDot, toneText } from "./tone";

const TREND_TONE: Record<TrendLabel, Tone> = {
  Bullish: "bullish",
  Sideways: "neutral",
  Bearish: "bearish",
};

const MOMENTUM_TONE: Record<MomentumLabel, Tone> = {
  Strengthening: "bullish",
  Recovering: "leanBullish",
  Cooling: "leanBearish",
  Weak: "bearish",
};

const VOLUME_TONE: Record<VolumeLabel, Tone> = {
  Expanding: "elevated",
  Normal: "neutral",
  Contracting: "calm",
};

const RISK_TONE: Record<RiskLabel, Tone> = {
  Low: "bullish",
  Moderate: "elevated",
  High: "bearish",
};

const STRENGTH_TONE: Record<StrengthLabel, Tone> = {
  Weak: "calm",
  Moderate: "neutral",
  Strong: "elevated",
};

function Component({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="rounded-xl border border-line bg-panel-soft px-3 py-2">
      <dt className="text-[10px] font-medium tracking-widest text-fg-subtle uppercase">{label}</dt>
      <dd className={`mt-0.5 flex items-center gap-1.5 text-sm font-semibold ${toneText[tone]}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`} aria-hidden />
        {value}
      </dd>
    </div>
  );
}

export function MarketStatePanel({ analysis }: { analysis: SignalAnalysis }) {
  const { state, strength, trend, momentum, volume, risk, explanation } = analysis;
  const stateTone = signalTone(state);
  const strengthTone = STRENGTH_TONE[strength.label];

  return (
    <Panel
      title="Market State"
      subtitle="Turunan trend, momentum, volume, dan risiko"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-widest text-fg-subtle uppercase">Strength</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneBadge[strengthTone]}`}>
            {strength.label} · {strength.score.toFixed(0)}
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className={`text-2xl font-bold tracking-tight ${toneText[stateTone]}`}>{state}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Component label="Trend" value={trend.label} tone={TREND_TONE[trend.label]} />
        <Component label="Momentum" value={momentum.label} tone={MOMENTUM_TONE[momentum.label]} />
        <Component label="Volume" value={volume.label} tone={VOLUME_TONE[volume.label]} />
        <Component label="Risk" value={risk.label} tone={RISK_TONE[risk.label]} />
      </dl>

      <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-fg-muted">{explanation}</p>
    </Panel>
  );
}
