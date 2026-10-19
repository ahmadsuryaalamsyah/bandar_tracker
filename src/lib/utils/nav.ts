import { useSyncExternalStore } from "react";

/**
 * Navigasi tab. Sumber kebenarannya adalah URL hash (bukan state React), sehingga
 * tombol back/forward berpindah tab dan tautan bisa dibagikan — sama seperti
 * halaman-halaman terpisah, tanpa kehilangan state query/tema.
 */
export const TABS = [
  { id: "analysis", label: "Analisis", hint: "Harga, indikator, dan chart histori" },
  { id: "plan", label: "Trade Plan", hint: "Market state, level entry, dan validasi backtest" },
  { id: "screener", label: "Screener", hint: "Kandidat long dan sebaran gate penyaring" },
  { id: "watchlist", label: "Watchlist", hint: "Saham yang Anda pantau" },
  { id: "crasharb", label: "Crash Arb", hint: "Arbitrase crash & forced selling massal (MSCI/panic selling)" },
] as const;

export type AppTab = (typeof TABS)[number]["id"];

const DEFAULT_TAB: AppTab = "analysis";

export function isAppTab(value: string): value is AppTab {
  return TABS.some((tab) => tab.id === value);
}

/**
 * Terima `#/screener`, `#screener`, atau string kosong. Nilai tak dikenal jatuh ke
 * tab default, sehingga hash yang salah ketik tidak membuat halaman kosong.
 * Murni (tanpa akses `window`) agar bisa diuji langsung.
 */
export function tabFromHash(hash: string): AppTab {
  const raw = hash.replace(/^#\/?/, "");
  return isAppTab(raw) ? raw : DEFAULT_TAB;
}

const listeners = new Set<() => void>();
let snapshot: AppTab | null = null;

function readHash(): AppTab {
  return tabFromHash(window.location.hash);
}

function emit(): void {
  for (const listener of listeners) listener();
}

function onHashChange(): void {
  const next = readHash();
  if (next === snapshot) return;
  snapshot = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("hashchange", onHashChange);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("hashchange", onHashChange);
  };
}

function getSnapshot(): AppTab {
  if (snapshot === null) snapshot = readHash();
  return snapshot;
}

function getServerSnapshot(): AppTab {
  return DEFAULT_TAB;
}

export function setTab(tab: AppTab): void {
  if (getSnapshot() === tab) return;
  // Menulis hash akan memicu `hashchange`, yang lalu memperbarui snapshot.
  window.location.hash = `/${tab}`;
}

export function useAppTab(): AppTab {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
