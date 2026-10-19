"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { IndicatorPoint } from "@/lib/indicators/types";
import { CHART_PALETTES } from "@/lib/utils/chartTheme";
import { useTheme } from "./ThemeProvider";

const LINES = [
  { key: "lpm", title: "LPM", colorKey: "lpm" },
  { key: "intensity", title: "Intensity", colorKey: "intensity" },
  { key: "rotation", title: "Rotation", colorKey: "rotation" },
] as const satisfies ReadonlyArray<{
  key: keyof IndicatorPoint;
  title: string;
  colorKey: "lpm" | "intensity" | "rotation";
}>;

interface IndicatorHistoryChartProps {
  series: IndicatorPoint[];
  /** Berubah saat query baru → chart di-fit ulang. Refresh biasa tidak. */
  resetKey: string;
  height?: number;
}

export function IndicatorHistoryChart({ series, resetKey, height = 280 }: IndicatorHistoryChartProps) {
  const { theme } = useTheme();
  const palette = CHART_PALETTES[theme];
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
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
      rightPriceScale: { borderColor: CHART_PALETTES.dark.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: CHART_PALETTES.dark.border, timeVisible: false },
    });

    chartRef.current = chart;
    seriesRefs.current = LINES.map((line) => {
      const seriesApi = chart.addSeries(LineSeries, {
        color: CHART_PALETTES.dark[line.colorKey],
        lineWidth: 2,
        title: line.title,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      seriesApi.createPriceLine({
        price: 50,
        color: CHART_PALETTES.dark.neutralLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "",
      });
      return seriesApi;
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = [];
      lastResetRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || seriesRefs.current.length !== LINES.length) return;

    const next = CHART_PALETTES[theme];
    chart.applyOptions({
      layout: { textColor: next.text },
      grid: { vertLines: { color: next.grid }, horzLines: { color: next.grid } },
      rightPriceScale: { borderColor: next.border },
      timeScale: { borderColor: next.border },
    });

    LINES.forEach((line, index) => {
      seriesRefs.current[index].applyOptions({ color: next[line.colorKey] });
    });
  }, [theme]);

  useEffect(() => {
    if (series.length === 0 || seriesRefs.current.length !== LINES.length) return;

    LINES.forEach((line, index) => {
      seriesRefs.current[index].setData(
        series.map((point) => ({
          time: point.t as UTCTimestamp,
          value: point[line.key],
        })),
      );
    });

    if (lastResetRef.current !== resetKey) {
      chartRef.current?.timeScale().fitContent();
      lastResetRef.current = resetKey;
    }
  }, [series, resetKey]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {LINES.map((line) => (
          <span key={line.key} className="inline-flex items-center gap-1.5 text-fg-muted">
            <span
              className="h-1.5 w-4 rounded-full"
              style={{ backgroundColor: palette[line.colorKey] }}
              aria-hidden
            />
            {line.title}
          </span>
        ))}
        <span className="text-fg-subtle">garis putus-putus = netral 50</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
