"use client";

/**
 * IndicatorBarChart — menampilkan LPM, Intensity, dan Volume Rotation
 * sebagai histogram bar berwarna dalam 3 panel terpisah (stacked pane),
 * sinkron crosshair dengan chart harga utama melalui `syncGroup`.
 *
 * - LPM bar: hijau saat oversold (< 38), merah saat overbought (> 62), biru di tengah
 * - Intensity bar: oranye cerah saat spike tinggi (> 65)
 * - Rotation bar: ungu naik, merah turun (nilai < 50 = lebih banyak rotate ke sell)
 * - Garis threshold dashed di level kunci
 */

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { IndicatorPoint } from "@/lib/indicators/types";
import { CHART_PALETTES, type ChartPalette } from "@/lib/utils/chartTheme";
import { useTheme } from "./ThemeProvider";



interface IndicatorBarChartProps {
  series: IndicatorPoint[];
  /** Berubah saat ticker/timeframe/range baru → chart fit ulang */
  resetKey: string;
  height?: number;
  /**
   * ID grup sync untuk sinkronkan crosshair & time scale dengan chart lain
   * (opsional). Gunakan nilai yang sama di `PriceVolumeChart` kalau sudah support.
   */
  syncGroup?: string;
}

/** Panel konfigurasi: urut dari atas ke bawah */
const PANELS: Array<{
  id: "lpm" | "intensity" | "rotation";
  label: string;
  subtitle: string;
  thresholds: number[];
  barColor: (value: number, p: ChartPalette) => string;
}> = [
  {
    id: "lpm",
    label: "LPM",
    subtitle: "Liquidity Pressure",
    thresholds: [38, 50, 62],
    barColor: (lpm, p) => {
      if (lpm <= 38) return p.lpmBarOversold;
      if (lpm >= 62) return p.lpmBarOverbought;
      return p.lpmBar;
    },
  },
  {
    id: "intensity",
    label: "Intensity",
    subtitle: "Aktivitas Relatif",
    thresholds: [50, 65],
    barColor: (intensity, p) => {
      if (intensity >= 65) return p.intensityBarHigh;
      return p.intensityBar;
    },
  },
  {
    id: "rotation",
    label: "Vol. Rotation",
    subtitle: "Volume Rotation",
    thresholds: [38, 50, 62],
    barColor: (rotation, p) => {
      if (rotation < 50) return p.rotationBarDown;
      return p.rotationBar;
    },
  },
];

type PanelId = "lpm" | "intensity" | "rotation";

type PanelRefs = {
  chart: IChartApi;
  histogram: ISeriesApi<"Histogram">;
  lines: ISeriesApi<"Line">[];
};

export function IndicatorBarChart({
  series,
  resetKey,
  height = 270,
}: IndicatorBarChartProps) {
  const { theme } = useTheme();

  // Ref container per panel (lpm / intensity / rotation)
  const containerRefs = useRef<Record<PanelId, HTMLDivElement | null>>({
    lpm: null,
    intensity: null,
    rotation: null,
  });
  const panelRefs = useRef<Record<PanelId, PanelRefs | null>>({
    lpm: null,
    intensity: null,
    rotation: null,
  });
  const lastResetRef = useRef<string | null>(null);

  const panelHeight = Math.round(height / PANELS.length);

  // ── Buat chart ────────────────────────────────────────────────────────────
  useEffect(() => {
    const palette = CHART_PALETTES.dark; // selalu dark untuk init
    const created: PanelId[] = [];

    const observers: ResizeObserver[] = [];

    for (const panel of PANELS) {
      const container = containerRefs.current[panel.id];
      if (!container) continue;

      const chart = createChart(container, {
        width: container.clientWidth,
        height: panelHeight,
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
          scaleMargins: { top: 0.08, bottom: 0 },
        },
        timeScale: {
          borderColor: palette.border,
          timeVisible: false,
          // Sembunyikan label waktu di semua panel kecuali yang paling bawah
          visible: panel.id === "rotation",
        },
        handleScroll: true,
        handleScale: true,
      });

      const histogram = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "price", precision: 1, minMove: 0.1 },
        priceLineVisible: false,
        lastValueVisible: false,
      });

      // Garis threshold dashed
      const lines = panel.thresholds.map((threshold) => {
        const lineColor =
          threshold === 50
            ? palette.neutralLine
            : threshold <= 38 || threshold >= 62
              ? panel.id === "lpm"
                ? threshold <= 38
                  ? palette.lpmBarOversold
                  : palette.lpmBarOverbought
                : palette.neutralLine
              : palette.neutralLine;

        const line = chart.addSeries(LineSeries, {
          color: lineColor,
          lineWidth: 1,
          lineStyle: threshold === 50 ? LineStyle.Dashed : LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        return { line, threshold };
      });

      const observer = new ResizeObserver(() => {
        chart.applyOptions({ width: container.clientWidth });
      });
      observer.observe(container);
      observers.push(observer);

      panelRefs.current[panel.id] = {
        chart,
        histogram,
        lines: lines.map((l) => l.line),
      };
      created.push(panel.id);
    }

    // Ambil snapshot refs agar cleanup function tidak stale
    const panelRefsSnapshot = panelRefs.current;

    return () => {
      for (const obs of observers) {
        obs.disconnect();
      }
      for (const id of created) {
        panelRefsSnapshot[id]?.chart.remove();
        panelRefsSnapshot[id] = null;
      }
      lastResetRef.current = null;
    };
  }, [panelHeight]);

  // ── Sinkron tema ──────────────────────────────────────────────────────────
  useEffect(() => {
    const palette = CHART_PALETTES[theme];
    for (const panel of PANELS) {
      const refs = panelRefs.current[panel.id];
      if (!refs) continue;
      refs.chart.applyOptions({
        layout: { textColor: palette.text },
        grid: {
          vertLines: { color: palette.grid },
          horzLines: { color: palette.grid },
        },
        rightPriceScale: { borderColor: palette.border },
        timeScale: { borderColor: palette.border },
      });
    }
  }, [theme]);

  // ── Set data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (series.length === 0) return;
    const palette = CHART_PALETTES[theme];
    const isNewKey = lastResetRef.current !== resetKey;

    for (const panel of PANELS) {
      const refs = panelRefs.current[panel.id];
      if (!refs) continue;

      // Bar data dengan warna per nilai
      refs.histogram.setData(
        series.map((pt) => {
          const value = pt[panel.id];
          const color = panel.barColor(value, palette);
          return { time: pt.t as UTCTimestamp, value, color };
        }),
      );

      // Threshold line data (horizontal, butuh dummy series)
      panel.thresholds.forEach((threshold, idx) => {
        const lineData = series.map((pt) => ({
          time: pt.t as UTCTimestamp,
          value: threshold,
        }));
        refs.lines[idx]?.setData(lineData);
      });

      if (isNewKey) {
        refs.chart.timeScale().fitContent();
      }
    }

    if (isNewKey) lastResetRef.current = resetKey;
  }, [series, resetKey, theme]);

  // ── Legend skor terakhir ──────────────────────────────────────────────────
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const palette = CHART_PALETTES[theme];

  return (
    <div className="space-y-0">
      {PANELS.map((panel) => {
        const value = latest ? latest[panel.id] : null;

        // Label zona
        let zone = "";
        let zoneColor = "";
        if (value !== null) {
          if (panel.id === "lpm") {
            if (value <= 38) { zone = "Oversold"; zoneColor = palette.lpmBarOversold; }
            else if (value >= 62) { zone = "Overbought"; zoneColor = palette.lpmBarOverbought; }
            else { zone = "Netral"; zoneColor = palette.neutralLine; }
          } else if (panel.id === "intensity") {
            if (value >= 65) { zone = "Spike Tinggi"; zoneColor = palette.intensityBarHigh; }
            else if (value >= 50) { zone = "Normal"; zoneColor = palette.intensityBar; }
            else { zone = "Lemah"; zoneColor = palette.neutralLine; }
          } else {
            if (value < 38) { zone = "Tekanan Jual"; zoneColor = palette.rotationBarDown; }
            else if (value >= 62) { zone = "Tekanan Beli"; zoneColor = palette.rotationBar; }
            else { zone = "Seimbang"; zoneColor = palette.neutralLine; }
          }
        }

        return (
          <div
            key={panel.id}
            className="relative border-t border-line/50 first:border-t-0"
          >
            {/* Label header panel */}
            <div className="absolute left-2 top-1.5 z-10 flex items-center gap-2 pointer-events-none select-none">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    panel.id === "lpm"
                      ? palette.lpm
                      : panel.id === "intensity"
                        ? palette.intensity
                        : palette.rotation,
                }}
                aria-hidden
              />
              <span className="text-[10px] font-semibold tracking-wide text-fg opacity-70">
                {panel.label}
              </span>
              {value !== null && (
                <>
                  <span className="text-[10px] font-mono text-fg opacity-80">
                    {value.toFixed(1)}
                  </span>
                  <span
                    className="text-[9px] font-medium px-1 py-0 rounded"
                    style={{ color: zoneColor }}
                  >
                    {zone}
                  </span>
                </>
              )}
            </div>

            {/* Chart canvas */}
            <div
              ref={(el) => {
                containerRefs.current[panel.id] = el;
              }}
              className="w-full"
            />
          </div>
        );
      })}

      {/* Legend threshold */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 pt-2 text-[10px] text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-px w-4 border-t border-dashed"
            style={{ borderColor: palette.neutralLine }}
          />
          Netral 50
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-px w-4 border-t border-dotted"
            style={{ borderColor: palette.lpmBarOversold }}
          />
          Oversold/Beli 38
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-px w-4 border-t border-dotted"
            style={{ borderColor: palette.lpmBarOverbought }}
          />
          Overbought/Jual 62
        </span>
      </div>
    </div>
  );
}
