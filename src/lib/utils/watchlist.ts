const WATCHLIST_KEY = "idx.watchlist.v1";
const TICKER_PATTERN = /^[A-Z0-9]{2,8}$/;

/** Referensi stabil untuk "watchlist kosong" (dipakai getSnapshot/getServerSnapshot). */
const EMPTY: string[] = [];

function normalize(items: unknown): string[] {
  if (!Array.isArray(items)) return EMPTY;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().toUpperCase().replace(/\.JK$/, "");
    if (!TICKER_PATTERN.test(cleaned) || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

let snapshot: string[] = EMPTY;
let snapshotRaw: string | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(WATCHLIST_KEY);
  } catch {
    return null;
  }
}

function refreshSnapshot(): void {
  const raw = readRaw();
  if (raw === snapshotRaw) return;
  snapshotRaw = raw;
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  snapshot = normalize(parsed);
}

export function subscribeWatchlist(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === WATCHLIST_KEY) {
      refreshSnapshot();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getWatchlistSnapshot(): string[] {
  refreshSnapshot();
  return snapshot;
}

export function getWatchlistServerSnapshot(): string[] {
  return EMPTY;
}

export function setWatchlist(tickers: string[]): void {
  const next = normalize(tickers);
  const raw = JSON.stringify(next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(WATCHLIST_KEY, raw);
    } catch {
      // Storage penuh / tidak tersedia — abaikan.
    }
  }
  snapshotRaw = raw;
  snapshot = next;
  for (const listener of listeners) listener();
}
