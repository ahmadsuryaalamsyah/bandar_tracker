"use client";

import { useCallback, useRef, useState } from "react";
import type { BacktestResponse } from "@/lib/backtest/types";
import type { Interval, Range } from "@/lib/data/types";
import type { TradeProfileId } from "@/lib/indicators/config";

export type BacktestStatus = "idle" | "loading" | "success" | "error";

export function useBacktest() {
  const [status, setStatus] = useState<BacktestStatus>("idle");
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const run = useCallback(async (ticker: string, interval: Interval, range: Range, profile: TradeProfileId) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const params = new URLSearchParams({ ticker, interval, range, profile });
      const response = await fetch(`/api/backtest?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as BacktestResponse | { error?: string };

      if (!response.ok) {
        const message = "error" in payload && payload.error ? payload.error : "Gagal menjalankan backtest.";
        throw new Error(message);
      }

      setData(payload as BacktestResponse);
      setStatus("success");
    } catch (err) {
      if (controller.signal.aborted) return;
      setData(null);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Tidak dapat menghubungi server.");
    }
  }, []);

  const reset = useCallback(() => {
    requestRef.current?.abort();
    setData(null);
    setStatus("idle");
    setError(null);
  }, []);

  return { status, data, error, run, reset };
}
