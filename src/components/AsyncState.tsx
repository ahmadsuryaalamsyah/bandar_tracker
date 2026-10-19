import type { ReactNode } from "react";

export function LoadingState({ label = "Memuat data saham…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-panel py-16 shadow-panel"
    >
      <span
        aria-hidden
        className="h-7 w-7 animate-spin rounded-full border-2 border-line-strong border-t-accent"
      />
      <p className="text-sm text-fg-muted">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-down/30 bg-down/5 px-4 py-12 text-center"
    >
      <p className="text-sm font-semibold text-down">Gagal memuat data</p>
      <p className="max-w-md text-sm text-fg-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-down/40 bg-down/10 px-4 py-1.5 text-sm font-medium text-down transition hover:bg-down/20"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-panel-soft px-4 py-12 text-center">
      <p className="text-sm text-fg-subtle">{message}</p>
      {action}
    </div>
  );
}
