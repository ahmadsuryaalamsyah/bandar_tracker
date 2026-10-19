"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { OhlcvBar } from "@/lib/data/types";
import type { SupportAccumulationResult } from "@/lib/indicators/supportAccumulation";
import { CHART_PALETTES } from "@/lib/utils/chartTheme";
import { useTheme } from "./ThemeProvider";

interface PriceVolumeChartProps {
  bars: OhlcvBar[];
  /** Berubah saat query baru (ticker/timeframe/range) → chart di-fit ulang. Refresh biasa tidak. */
  resetKey: string;
  height?: number;
  supports?: SupportAccumulationResult | null;
}

export function PriceVolumeChart({
  bars,
  resetKey,
  height = 360,
  supports,
}: PriceVolumeChartProps) {
  const { theme } = useTheme();
  const [showSupports, setShowSupports] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastResetRef = useRef<string | null>(null);

  // Inisialisasi Chart Candlestick & Volume
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = CHART_PALETTES[theme];

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: palette.text,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border, timeVisible: false },
    });

    chartRef.current = chart;

    // Series Candlestick
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });

    // Series Volume
    volumeRef.current = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceScaleId: "volume", priceLineVisible: false },
      0,
    );
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });

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
      priceLinesRef.current = [];
      lastResetRef.current = null;
    };
  }, [height, theme]);

  // Set Data Bars
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

  // Gambar Garis Horizontal Support Akumulasi pada Candlestick
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;

    // Bersihkan garis support sebelumnya
    for (const line of priceLinesRef.current) {
      try {
        candle.removePriceLine(line);
      } catch {
        // ignore
      }
    }
    priceLinesRef.current = [];

    if (!showSupports || !supports) return;

    // 1. Garis Support 1 (Swing Low) - Hijau Emerald
    if (supports.support1) {
      const lineS1 = candle.createPriceLine({
        price: supports.support1.price,
        color: "#10b981",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "S1 (Swing)",
      });
      priceLinesRef.current.push(lineS1);
    }

    // 2. Garis Support 2 (Modal Bandar) - Cyan
    if (supports.support2) {
      const lineS2 = candle.createPriceLine({
        price: supports.support2.price,
        color: "#06b6d4",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "S2 (Modal Bandar)",
      });
      priceLinesRef.current.push(lineS2);
    }

    // 3. Garis Stop Loss - Merah Rose
    if (supports.stopLoss) {
      const lineSL = candle.createPriceLine({
        price: supports.stopLoss.price,
        color: "#f43f5e",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "Cut Loss",
      });
      priceLinesRef.current.push(lineSL);
    }
  }, [showSupports, supports]);

  return (
    <div className="w-full">
      {/* Toolbar Status Support di Atas Chart */}
      {supports && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-2 sm:px-3 py-2 text-xs border-b border-line/40">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="font-semibold text-fg-muted">Level Akumulasi:</span>
            <button
              type="button"
              onClick={() => setShowSupports((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                showSupports
                  ? "bg-accent/15 text-accent border-accent/40 shadow-sm"
                  : "bg-surface-elevated text-fg-subtle border-line hover:text-fg"
              }`}
            >
              <span>{showSupports ? "✓ Garis Support Aktif" : "Tampilkan Garis"}</span>
            </button>
          </div>

          {/* Quick Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {supports.support1 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-400 border border-emerald-500/25">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                S1: Rp {supports.support1.price.toLocaleString()}
                <span className="font-mono text-[9px] sm:text-[10px] opacity-80">(-{supports.support1.distancePct}%)</span>
              </span>
            )}
            {supports.support2 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-cyan-400 border border-cyan-500/25">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                S2<span className="hidden sm:inline"> (Modal)</span>: Rp {supports.support2.price.toLocaleString()}
                <span className="font-mono text-[9px] sm:text-[10px] opacity-80">(-{supports.support2.distancePct}%)</span>
              </span>
            )}
            {supports.stopLoss && (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-rose-400 border border-rose-500/25">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                CL: Rp {supports.stopLoss.price.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Canvas Chart */}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
