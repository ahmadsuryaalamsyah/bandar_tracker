export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "idx.theme";

/**
 * Skrip inline yang dijalankan sebelum paint pertama agar tema tidak berkedip
 * (FOUC). Nilai disimpan di localStorage; bila belum ada, ikuti preferensi OS.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");var e=document.documentElement;e.classList.toggle("dark",t==="dark");e.style.colorScheme=t;}catch(e){document.documentElement.classList.add("dark");}})();`;

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function storeTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage penuh / tidak tersedia — abaikan.
  }
}
