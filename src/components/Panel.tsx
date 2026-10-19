import type { ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Kontrol di sisi kanan header (tombol, badge, dsb). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Set false bila isi panel mengatur paddingnya sendiri (mis. chart). */
  padded?: boolean;
}

/** Kartu dasar seluruh dashboard — satu sumber untuk border, radius, dan bayangan. */
export function Panel({ title, subtitle, action, children, className = "", padded = true }: PanelProps) {
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <section
      className={`rounded-2xl border border-line bg-panel shadow-panel backdrop-blur-sm ${className}`}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

/** Label kecil di atas blok judul. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-widest text-fg-subtle uppercase">{children}</span>
  );
}
