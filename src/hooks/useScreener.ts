"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Interval, Range } from "@/lib/data/types";
import type { TradeProfileId } from "@/lib/indicators/config";
import { MAX_TICKERS_PER_REQUEST, SCAN_CHUNK_GAP_MS } from "@/lib/screener/limits";
import type { ScreenerResponse, ScreenerRow } from "@/lib/screener/types";

export type ScreenerStatus = "idle" | "loading" | "success" | "error";

export interface ScreenerOptions {
  interval?: Interval;
  range?: Range;
  /** Profil trade yang dipakai untuk gate kelayakan. */
  profile?: TradeProfileId;
}

export interface LoadOptions {
  /** Refresh senyap: pertahankan data lama, tampilkan hanya status refreshing. */
  silent?: boolean;
}

export interface ScreenerProgress {
  scanned: number;
  total: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export function useScreener(options: ScreenerOptions = {}) {
  const interval = options.interval ?? "1d";
  const range = options.range ?? "1y";
  const profile = options.profile ?? "swing";

  const [status, setStatus] = useState<ScreenerStatus>("idle");
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<ScreenerProgress | null>(null);

  const hasDataRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef<string>("");

  const load = useCallback(
    async (tickers: string[], opts?: LoadOptions) => {
      const key = [...tickers].sort().join(",");
      lastKeyRef.current = key;

      if (!key) {
        setStatus("idle");
        setRows([]);
        setGeneratedAt(null);
        setError(null);
        setProgress(null);
        return;
      }

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      const keepData = opts?.silent === true && hasDataRef.current;
      if (keepData) {
        setRefreshing(true);
        setError(null);
      } else {
        setStatus("loading");
        setError(null);
        setRows([]);
      }
      setProgress({ scanned: 0, total: tickers.length });

      const groups = chunk(tickers, MAX_TICKERS_PER_REQUEST);
      const collected: ScreenerRow[] = [];
      /** Jumlah ticker yang sudah dikirim ke API (bukan yang berhasil dikembalikan). */
      let sentCount = 0;

      try {
        for (let index = 0; index < groups.length; index += 1) {
          if (controller.signal.aborted) return;

          const group = groups[index];
          sentCount += group.length;

          const params = new URLSearchParams({
            tickers: group.join(","),
            interval,
            range,
            profile,
          });
          const response = await fetch(`/api/screener?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await response.json()) as ScreenerResponse | { error?: string };

          if (!response.ok) {
            const message =
              "error" in payload && payload.error ? payload.error : "Gagal memuat daftar saham.";
            throw new Error(message);
          }

          const data = payload as ScreenerResponse;
          collected.push(...data.rows);

          hasDataRef.current = true;
          // Tampilkan hasil seiring bertambah, bukan menunggu seluruh gelombang selesai.
          setRows([...collected]);
          setProgress({ scanned: sentCount, total: tickers.length });
          setGeneratedAt(data.generatedAt);

          if (index < groups.length - 1) await sleep(SCAN_CHUNK_GAP_MS);
        }

        setStatus("success");
        setError(null);
        setRefreshing(false);
        setProgress(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Tidak dapat menghubungi server.";

        if (collected.length > 0) {
          // Sebagian sudah masuk — pertahankan, dan katakan bahwa sisanya belum terpindai.
          setRows([...collected]);
          setStatus("success");
          setRefreshing(false);
          setProgress(null);
          setError(
            `Pemindaian berhenti di ${collected.length}/${tickers.length} saham: ${message}`,
          );
        } else if (keepData) {
          setRefreshing(false);
          setProgress(null);
          setError(message);
        } else {
          hasDataRef.current = false;
          setRows([]);
          setStatus("error");
          setRefreshing(false);
          setProgress(null);
          setError(message);
        }
      }
    },
    [interval, range, profile],
  );

  const refresh = useCallback(() => {
    const key = lastKeyRef.current;
    if (!key) return;
    void load(key.split(","), { silent: true });
  }, [load]);

  const byTicker = useMemo(() => {
    const map: Record<string, ScreenerRow> = {};
    for (const row of rows) map[row.ticker] = row;
    return map;
  }, [rows]);

  return { status, rows, byTicker, generatedAt, error, refreshing, progress, load, refresh };
}
