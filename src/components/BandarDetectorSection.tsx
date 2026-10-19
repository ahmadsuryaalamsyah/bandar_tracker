"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { OhlcvBar } from "@/lib/data/types";
import {
  computeBandarMatrix,
  computeBandarMovementSeries,
  getBandarStatusStyle,
} from "@/lib/indicators/bandarMatrix";
import type { IndicatorPoint } from "@/lib/indicators/types";
import { CHART_PALETTES } from "@/lib/utils/chartTheme";
import { useTheme } from "./ThemeProvider";

interface BandarDetectorSectionProps {
  bars: OhlcvBar[];
  indicators: IndicatorPoint[];
  resetKey: string;
}

export function BandarDetectorSection({
  bars,
  indicators,
  resetKey,
}: BandarDetectorSectionProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineMovementRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lineSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const histNetRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastResetRef = useRef<string | null>(null);

  // Hitung matriks horizon waktu (1D, 3D, 5D, 10D, 20D)
  const matrix = useMemo(() => {
    return computeBandarMatrix(bars, indicators);
  }, [bars, indicators]);

  // Hitung deret pergerakan bandar & MA 10
  const series = useMemo(() => {
    return computeBandarMovementSeries(indicators, 10);
  }, [indicators]);

  const latest = series.length > 0 ? series[series.length - 1] : null;
  const isAboveMa = latest ? latest.movement >= latest.signalMa : true;

  // Inisialisasi Chart Bandar Movement
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = CHART_PALETTES[theme];

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: palette.text,
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: palette.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: palette.border,
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // 1. Histogram Net Flow Harian (Bar Hijau/Merah)
    const histNet = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      priceScaleId: "net",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("net").applyOptions({
      scaleMargins: { top: 0.65, bottom: 0 },
      visible: false,
    });
    histNetRef.current = histNet;

    // 2. Garis Bandar Movement (Kumulatif Flow)
    const lineMovement = chart.addSeries(LineSeries, {
      color: theme === "dark" ? "#38bdf8" : "#0284c7",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      priceLineVisible: false,
      lastValueVisible: true,
      title: "Bandar Movement",
    });
    lineMovementRef.current = lineMovement;

    // 3. Garis Sinyal MA 10 (Turning Point)
    const lineSignal = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      priceLineVisible: false,
      lastValueVisible: true,
      title: "MA 10",
    });
    lineSignalRef.current = lineSignal;

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      lineMovementRef.current = null;
      lineSignalRef.current = null;
      histNetRef.current = null;
      lastResetRef.current = null;
    };
  }, [theme]);

  // Update Data
  useEffect(() => {
    const lineMovement = lineMovementRef.current;
    const lineSignal = lineSignalRef.current;
    const histNet = histNetRef.current;
    if (!lineMovement || !lineSignal || !histNet || series.length === 0) return;

    const palette = CHART_PALETTES[theme];

    // Data Garis Bandar Movement
    lineMovement.setData(
      series.map((pt) => ({
        time: pt.t as UTCTimestamp,
        value: pt.movement,
      })),
    );

    // Data Garis MA 10
    lineSignal.setData(
      series.map((pt) => ({
        time: pt.t as UTCTimestamp,
        value: pt.signalMa,
      })),
    );

    // Data Histogram Net Flow Harian
    histNet.setData(
      series.map((pt) => ({
        time: pt.t as UTCTimestamp,
        value: pt.dailyNet,
        color: pt.dailyNet >= 0 ? palette.upVolume : palette.downVolume,
      })),
    );

    if (lastResetRef.current !== resetKey) {
      chartRef.current?.timeScale().fitContent();
      lastResetRef.current = resetKey;
    }
  }, [resetKey, series, theme]);

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-panel backdrop-blur-md p-5 transition-all">
      {/* Header Panel */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-fg">Bandar Detector Matrix</h3>
            <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              Stockbit Style
            </span>
          </div>
          <p className="text-xs text-fg-subtle">
            Deteksi jejak akumulasi & distribusi Smart Money berdasarkan konsentrasi likuiditas
          </p>
        </div>

        {latest && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-subtle">Tren Smart Money:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isAboveMa
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isAboveMa ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              {isAboveMa ? "Akumulasi Di Atas MA10" : "Distribusi Di Bawah MA10"}
            </span>
          </div>
        )}
      </div>

      {/* Bandar Matrix Grid (1D, 3D, 5D, 10D, 20D) */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {matrix.map((item) => {
          const style = getBandarStatusStyle(item.status);
          const isUp = item.priceChangePct >= 0;

          return (
            <div
              key={item.label}
              className={`flex flex-col justify-between rounded-lg border p-2.5 transition-all ${style.bg} ${style.border}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fg-muted">{item.label}</span>
                <span
                  className={`text-[11px] font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {isUp ? "+" : ""}
                  {item.priceChangePct}%
                </span>
              </div>

              <div className="my-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold tracking-wide uppercase ${style.text}`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {item.status}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[11px] text-fg-subtle">
                <span>LPM {item.avgLpm}</span>
                <span className="font-mono tnum">
                  {item.netFlow >= 0 ? "+" : ""}
                  {item.netFlow}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chartbit Subchart: Bandar Movement & MA 10 */}
      <div className="rounded-lg border border-line/70 bg-surface-elevated/40 p-2">
        <div className="mb-1 flex items-center justify-between px-2 text-xs">
          <div className="flex items-center gap-4">
            <span className="font-medium text-fg">Bandar Movement & Volume</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-sky-400">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                Movement Line
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                Signal MA 10
              </span>
              <span className="flex items-center gap-1 text-fg-subtle">
                <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" />
                Net Buy
              </span>
              <span className="flex items-center gap-1 text-fg-subtle">
                <span className="inline-block h-2 w-2 rounded-sm bg-rose-500/60" />
                Net Sell
              </span>
            </div>
          </div>
          <span className="text-[10px] text-fg-subtle italic">
            Garis memotong ke atas MA10 = Titik Balik Akumulasi
          </span>
        </div>

        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
}
