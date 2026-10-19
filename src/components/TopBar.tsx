import { NavBar } from "./NavBar";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-xl border border-accent/25 bg-accent-soft text-[13px] font-bold tracking-tight text-accent"
            >
              IDX
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-fg">Stock Analysis</p>
              <p className="text-[11px] text-fg-subtle">Dashboard lokal · kuotasi delayed</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-[11px] font-medium text-fg-muted sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden />
              Yahoo Finance
            </span>
            <ThemeToggle />
          </div>
        </div>

        <NavBar />
      </div>
    </header>
  );
}
