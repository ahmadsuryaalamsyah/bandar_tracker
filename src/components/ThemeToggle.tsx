"use client";

import { useTheme } from "./ThemeProvider";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "terang" : "gelap";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Ganti ke tema ${next}`}
      title={`Ganti ke tema ${next}`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel text-fg-muted transition hover:border-line-strong hover:bg-panel-hover hover:text-fg"
    >
      <span className="hidden dark:block">
        <SunIcon />
      </span>
      <span className="block dark:hidden">
        <MoonIcon />
      </span>
    </button>
  );
}
