"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useScreener } from "@/hooks/useScreener";
import type { TradeProfileId } from "@/lib/indicators/config";
import { DEFAULT_UNIVERSE } from "@/lib/screener/universe";
import {
  getWatchlistServerSnapshot,
  getWatchlistSnapshot,
  setWatchlist,
  subscribeWatchlist,
} from "@/lib/utils/watchlist";
import { GoodToBuySection } from "./GoodToBuySection";
import { WatchlistSection } from "./WatchlistSection";

export function ScreenerPanel({
  profile,
  section,
  onSelectTicker,
}: {
  profile: TradeProfileId;
  section: "screener" | "watchlist";
  onSelectTicker?: (ticker: string) => void;
}) {
  const watchlist = useSyncExternalStore(subscribeWatchlist, getWatchlistSnapshot, getWatchlistServerSnapshot);

  const { status, rows, byTicker, generatedAt, error, refreshing, progress, load, refresh } = useScreener({
    interval: "1d",
    range: "1y",
    profile,
  });

  const scanTickers = useMemo(() => {
    const set = new Set<string>(DEFAULT_UNIVERSE);
    for (const ticker of watchlist) set.add(ticker);
    return [...set];
  }, [watchlist]);

  useEffect(() => {
    void load(scanTickers);
  }, [load, scanTickers]);

  const add = useCallback(
    (ticker: string) => {
      if (watchlist.includes(ticker)) return;
      setWatchlist([...watchlist, ticker]);
    },
    [watchlist],
  );

  const remove = useCallback(
    (ticker: string) => {
      setWatchlist(watchlist.filter((t) => t !== ticker));
    },
    [watchlist],
  );

  const isWatched = useCallback((ticker: string) => watchlist.includes(ticker), [watchlist]);

  return (
    <div className="mt-5 space-y-4">
      {section === "screener" && (
        <GoodToBuySection
          rows={rows}
          status={status}
          profile={profile}
          generatedAt={generatedAt}
          error={error}
          refreshing={refreshing}
          progress={progress}
          onRefresh={refresh}
          onAddToWatchlist={add}
          isWatched={isWatched}
          onSelectTicker={onSelectTicker}
        />
      )}
      {section === "watchlist" && (
        <WatchlistSection
          tickers={watchlist}
          byTicker={byTicker}
          status={status}
          onAdd={add}
          onRemove={remove}
          onSelectTicker={onSelectTicker}
        />
      )}
    </div>
  );
}
