"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { OhlcvBar } from "@/lib/data/types";
import { CHART_PALETTES } from "@/lib/utils/chartTheme";
import { useTheme } from "./ThemeProvider";

interface PriceVolumeChartProps {
  bars: OhlcvBar[];
  /** Berubah saat query baru (ticker/timeframe/range) → chart di-fit ulang. Refresh biasa tidak. */
  resetKey: string;
  height?: number;
}

export function PriceVolumeChart({ bars, resetKey, height = 400 }: PriceVolumeChartProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastResetRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: CHART_PALETTES.dark.text,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: CHART_PALETTES.dark.grid },
        horzLines: { color: CHART_PALETTES.dark.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART_PALETTES.dark.border },
      timeScale: { borderColor: CHART_PALETTES.dark.border, timeVisible: false },
    });

    chartRef.current = chart;
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: CHART_PALETTES.dark.up,
      downColor: CHART_PALETTES.dark.down,
      borderUpColor: CHART_PALETTES.dark.up,
      borderDownColor: CHART_PALETTES.dark.down,
      wickUpColor: CHART_PALETTES.dark.up,
      wickDownColor: CHART_PALETTES.dark.down,
    });
    volumeRef.current = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceScaleId: "volume", priceLineVisible: false },
      0,
    );
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      lastResetRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    const palette = CHART_PALETTES[theme];
    chart.applyOptions({
      layout: { textColor: palette.text },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border },
    });
    candle.applyOptions({
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });
  }, [theme]);

  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    if (!candle || !volume || bars.length === 0) return;

    const palette = CHART_PALETTES[theme];

    candle.setData(
      bars.map((bar) => ({
        time: bar.t as UTCTimestamp,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
      })),
    );
    volume.setData(
      bars.map((bar) => ({
        time: bar.t as UTCTimestamp,
        value: bar.v,
        color: bar.c >= bar.o ? palette.upVolume : palette.downVolume,
      })),
    );

    if (lastResetRef.current !== resetKey) {
      chartRef.current?.timeScale().fitContent();
      lastResetRef.current = resetKey;
    }
  }, [bars, resetKey, theme]);

  return <div ref={containerRef} className="w-full" />;
}
