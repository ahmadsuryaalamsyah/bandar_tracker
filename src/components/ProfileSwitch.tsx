"use client";

import { TRADE_PROFILES, type TradeProfileId } from "@/lib/indicators/config";

const ORDER: TradeProfileId[] = ["swing", "fast"];

interface ProfileSwitchProps {
  value: TradeProfileId;
  onChange: (next: TradeProfileId) => void;
  disabled?: boolean;
}

export function ProfileSwitch({ value, onChange, disabled }: ProfileSwitchProps) {
  return (
    <div className="inline-flex items-center gap-3">
      <div
        role="group"
        aria-label="Profil trade"
        className="inline-flex rounded-xl border border-line bg-panel-soft p-0.5"
      >
        {ORDER.map((id) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              title={TRADE_PROFILES[id].description}
              onClick={() => onChange(id)}
              className={`rounded-[9px] px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${
                active ? "bg-accent text-accent-fg shadow-sm" : "text-fg-muted hover:bg-panel-hover hover:text-fg"
              }`}
            >
              {TRADE_PROFILES[id].label}
            </button>
          );
        })}
      </div>
      <span className="hidden max-w-md text-xs text-fg-subtle xl:inline">{TRADE_PROFILES[value].description}</span>
    </div>
  );
}
