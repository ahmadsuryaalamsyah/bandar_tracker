import { signalTone } from "@/lib/indicators/interpret";
import type { SignalLabel } from "@/lib/indicators/types";
import { toneBadge, toneDot } from "./tone";

export function SignalBadge({ signal, size = "md" }: { signal: SignalLabel; size?: "sm" | "md" }) {
  const tone = signalTone(signal);
  const scale = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold whitespace-nowrap ${scale} ${toneBadge[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${toneDot[tone]}`} aria-hidden />
      {signal}
    </span>
  );
}
