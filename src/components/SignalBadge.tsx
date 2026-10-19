import { signalTone } from "@/lib/indicators/interpret";
import type { SignalLabel } from "@/lib/indicators/types";
import { toneBadge, toneDot } from "./tone";

export function SignalBadge({ signal, size = "md" }: { signal: SignalLabel; size?: "sm" | "md" }) {
  const tone = signalTone(signal);
  const scale = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-bold uppercase tracking-wider whitespace-nowrap shadow-sm backdrop-blur-md transition-all ${scale} ${toneBadge[tone]}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${toneDot[tone]}`}
        />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${toneDot[tone]}`} />
      </span>
      {signal}
    </span>
  );
}
