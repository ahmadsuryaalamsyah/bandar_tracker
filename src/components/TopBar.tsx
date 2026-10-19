import { NavBar } from "./NavBar";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur-xl transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 pt-3 pb-1">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              aria-hidden
              className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-purple-600 shadow-md shadow-sky-500/20"
            >
              <span className="text-xs sm:text-[13px] font-black tracking-tight text-white">IDX</span>
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-bg" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <p className="text-sm font-bold tracking-tight text-fg truncate">Bandar Tracker & Analysis</p>
                <span className="hidden rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-accent sm:inline-block">
                  PRO
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-fg-subtle truncate">
                <span className="hidden sm:inline">Indonesian Stock Exchange Terminal · </span>Smart Money Flow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <span className="hidden items-center gap-1.5 rounded-full border border-line/70 bg-panel/80 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-fg-muted shadow-sm sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              <span>BEI / Yahoo Finance</span>
            </span>
            <ThemeToggle />
          </div>
        </div>

        <NavBar />
      </div>
    </header>
  );
}
