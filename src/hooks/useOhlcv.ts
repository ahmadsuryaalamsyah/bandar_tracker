"use client";

import { useCallback, useRef, useState } from "react";
import type { Interval, OhlcvSeries, Range } from "@/lib/data/types";

export type OhlcvStatus = "idle" | "loading" | "success" | "error";

export interface OhlcvState {
  status: OhlcvStatus;
  data: OhlcvSeries | null;
  error: string | null;
  /** Waktu (epoch ms) tarikan data terakhir yang berhasil. */
  updatedAt: number | null;
  /** Selisih (ms) antara waktu tarik dan waktu kutipan pasar, null bila tak tersedia. */
  quoteDelayMs: number | null;
  /** Sedang refresh di latar belakang (data lama tetap ditampilkan). */
  refreshing: boolean;
}

const initialState: OhlcvState = {
  status: "idle",
  data: null,
  error: null,
  updatedAt: null,
  quoteDelayMs: null,
  refreshing: false,
};

export interface LoadOptions {
  /** Refresh senyap: jangan kosongkan data / tampilkan loading penuh. */
  silent?: boolean;
}

export function useOhlcv() {
  const [state, setState] = useState<OhlcvState>(initialState);
  const hasDataRef = useRef(false);

  const load = useCallback(async (ticker: string, interval: Interval, range: Range, options?: LoadOptions) => {
    const keepData = options?.silent === true && hasDataRef.current;

    if (keepData) {
      setState((prev) => ({ ...prev, refreshing: true, error: null }));
    } else {
      hasDataRef.current = false;
      setState({ status: "loading", data: null, error: null, updatedAt: null, quoteDelayMs: null, refreshing: false });
    }

    try {
      const params = new URLSearchParams({ ticker, interval, range });
      const response = await fetch(`/api/ohlcv?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as OhlcvSeries | { error?: string };

      if (!response.ok) {
        const message = "error" in payload && payload.error ? payload.error : "Gagal memuat data saham.";
        throw new Error(message);
      }

      const series = payload as OhlcvSeries;
      const fetchedAt = Date.now();
      const quoteDelayMs =
        series.quoteTime !== null && series.quoteTime !== undefined
          ? Math.max(0, fetchedAt - series.quoteTime * 1000)
          : null;

      hasDataRef.current = true;
      setState({ status: "success", data: series, error: null, updatedAt: fetchedAt, quoteDelayMs, refreshing: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tidak dapat menghubungi server. Pastikan koneksi internet aktif.";

      if (keepData) {
        // Refresh senyap gagal: pertahankan data lama, tampilkan peringatan.
        setState((prev) => ({ ...prev, refreshing: false, error: message }));
      } else {
        hasDataRef.current = false;
        setState({ status: "error", data: null, error: message, updatedAt: null, quoteDelayMs: null, refreshing: false });
      }
    }
  }, []);

  return { ...state, load };
}
