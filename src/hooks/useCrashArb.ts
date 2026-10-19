"use client";

import { useCallback, useRef, useState } from "react";
import type { Interval, Range } from "@/lib/data/types";
import type { CrashArbResponse } from "@/lib/screener/crashArb";
import { MAX_TICKERS_PER_REQUEST, SCAN_CHUNK_GAP_MS } from "@/lib/screener/limits";

export type CrashArbStatus = "idle" | "loading" | "success" | "error";

export interface CrashArbProgress {
  scanned: number;
  total: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export function useCrashArb() {
  const [status, setStatus] = useState<CrashArbStatus>("idle");
  const [data, setData] = useState<CrashArbResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CrashArbProgress | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hasDataRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const lastTickersRef = useRef<string[]>([]);

  const scan = useCallback(
    async (
      tickers: string[],
      opts: { interval?: Interval; range?: Range; silent?: boolean } = {},
    ) => {
      const { interval = "1d", range = "1y", silent = false } = opts;
      lastTickersRef.current = tickers;

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      const keepData = silent && hasDataRef.current;
      if (keepData) {
        setRefreshing(true);
        setError(null);
      } else {
        setStatus("loading");
        setError(null);
        setData(null);
      }
      setProgress({ scanned: 0, total: tickers.length });

      const groups = chunk(tickers, MAX_TICKERS_PER_REQUEST);
      // Kumpulkan semua baris dari semua chunk lalu gabung di akhir.
      const allRows: CrashArbResponse["rows"] = [];
      let lastMeta: Pick<CrashArbResponse, "generatedAt" | "marketDrawdown" | "breadthDown"> | null = null;
      let sentCount = 0;

      try {
        for (let i = 0; i < groups.length; i++) {
          if (controller.signal.aborted) return;

          const group = groups[i];
          sentCount += group.length;

          const params = new URLSearchParams({
            tickers: group.join(","),
            interval,
            range,
          });
          const response = await fetch(`/api/crash-arb?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await response.json()) as CrashArbResponse | { error?: string };

          if (!response.ok) {
            const message =
              "error" in payload && payload.error ? payload.error : "Gagal memuat data crash arb.";
            throw new Error(message);
          }

          const chunk_data = payload as CrashArbResponse;
          allRows.push(...chunk_data.rows);
          lastMeta = {
            generatedAt: chunk_data.generatedAt,
            marketDrawdown: chunk_data.marketDrawdown,
            breadthDown: chunk_data.breadthDown,
          };

          hasDataRef.current = true;
          setProgress({ scanned: sentCount, total: tickers.length });

          // Update data secara incremental agar terasa responsif.
          setData({
            rows: [...allRows],
            generatedAt: lastMeta.generatedAt,
            marketDrawdown: lastMeta.marketDrawdown,
            breadthDown: lastMeta.breadthDown,
          });

          if (i < groups.length - 1) await sleep(SCAN_CHUNK_GAP_MS);
        }

        setStatus("success");
        setRefreshing(false);
        setProgress(null);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Tidak dapat menghubungi server.";
        if (keepData) {
          setRefreshing(false);
          setProgress(null);
          setError(message);
        } else {
          hasDataRef.current = false;
          setStatus("error");
          setRefreshing(false);
          setProgress(null);
          setError(message);
        }
      }
    },
    [],
  );

  const refresh = useCallback(() => {
    const tickers = lastTickersRef.current;
    if (tickers.length === 0) return;
    void scan(tickers, { silent: true });
  }, [scan]);

  const reset = useCallback(() => {
    requestRef.current?.abort();
    setStatus("idle");
    setData(null);
    setError(null);
    setProgress(null);
    setRefreshing(false);
    hasDataRef.current = false;
    lastTickersRef.current = [];
  }, []);

  return { status, data, error, progress, refreshing, scan, refresh, reset };
}
