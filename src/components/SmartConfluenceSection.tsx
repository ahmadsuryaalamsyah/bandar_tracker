"use client";

import { useMemo } from "react";
import type { OhlcvBar } from "@/lib/data/types";
import {
  detectDivergence,
  analyzeVsa,
  evaluateSignalConfidence,
  type MarketState,
  type IndicatorPoint,
} from "@/lib/indicators";

interface SmartConfluenceSectionProps {
  bars: OhlcvBar[];
  indicators: IndicatorPoint[];
  marketState: MarketState;
}

export function SmartConfluenceSection({
  bars,
  indicators,
  marketState,
}: SmartConfluenceSectionProps) {
  // 1. Deteksi Divergensi
  const divergence = useMemo(() => {
    return detectDivergence(bars, indicators, 30);
  }, [bars, indicators]);

  // 2. Analisis Volume Spread Analysis (VSA)
  const vsa = useMemo(() => {
    return analyzeVsa(bars, 20);
  }, [bars]);

  // 3. Evaluasi Win Rate & Signal Confidence
  const confidence = useMemo(() => {
    return evaluateSignalConfidence(bars, indicators, divergence, vsa, marketState);
  }, [bars, indicators, divergence, vsa, marketState]);

  const gradeColors = {
    "A+": "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    A: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    B: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    C: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-panel backdrop-blur-md p-5 transition-all">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-fg">Konfluensi & Akurasi Prediksi (Smart Confluence)</h3>
            <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              Pro Engine
            </span>
          </div>
          <p className="text-xs text-fg-subtle">
            Penggabungan Divergensi Smart Money, Volume Spread Analysis (VSA), dan Win Rate Historis
          </p>
        </div>

        {/* Skor Keyakinan & Grade */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-fg-subtle">Akurasi / Confidence:</div>
            <div className="font-mono text-base font-bold text-fg tnum">
              {confidence.score}%
            </div>
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-black shadow-sm ${gradeColors[confidence.grade]}`}
          >
            {confidence.grade}
          </div>
        </div>
      </div>

      {/* 3 Kartu Pilar Analisis */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Pilar 1: Deteksi Divergensi */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-3.5 transition-all ${
            divergence.hasDivergence
              ? divergence.type?.includes("bullish")
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-rose-500/40 bg-rose-500/10"
              : "border-line bg-surface-elevated/40"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                1. Divergence Engine
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  divergence.hasDivergence
                    ? divergence.type?.includes("bullish")
                      ? "bg-emerald-500/25 text-emerald-300"
                      : "bg-rose-500/25 text-rose-300"
                    : "bg-surface-elevated text-fg-subtle border border-line"
                }`}
              >
                {divergence.hasDivergence ? divergence.severity : "None"}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-fg">
              {divergence.title}
            </div>

            <p className="mt-1 text-xs text-fg-muted leading-relaxed">
              {divergence.description}
            </p>
          </div>

          {divergence.hasDivergence && divergence.pricePivots && (
            <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-[11px] text-fg-subtle font-mono">
              <span>Swing Harga: {divergence.pricePivots[0]} → {divergence.pricePivots[1]}</span>
              <span>{divergence.divergenceAgeBars} bar lalu</span>
            </div>
          )}
        </div>

        {/* Pilar 2: Volume Spread Analysis (VSA) */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-3.5 transition-all ${
            vsa.hasPattern
              ? vsa.actionBias === "Bullish"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-rose-500/40 bg-rose-500/10"
              : "border-line bg-surface-elevated/40"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                2. Volume Spread (VSA)
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  vsa.hasPattern
                    ? vsa.actionBias === "Bullish"
                      ? "bg-emerald-500/25 text-emerald-300"
                      : "bg-rose-500/25 text-rose-300"
                    : "bg-surface-elevated text-fg-subtle border border-line"
                }`}
              >
                {vsa.actionBias}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-fg">
              {vsa.title}
            </div>

            <p className="mt-1 text-xs text-fg-muted leading-relaxed">
              {vsa.description}
            </p>
          </div>

          <div className="mt-3 border-t border-line/40 pt-2 text-[11px] text-fg-subtle">
            {vsa.hasPattern ? "Signifikansi: " + vsa.significance.toUpperCase() : "Volume & spread berjalan normal"}
          </div>
        </div>

        {/* Pilar 3: Win Rate Historis Saham Ini */}
        <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-elevated/40 p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                3. Historical Edge
              </span>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                Win Rate {confidence.winRatePct}%
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-fg">
              Rekam Jejak Sinyal Serupa
            </div>

            <p className="mt-1 text-xs text-fg-muted leading-relaxed">
              {confidence.summary}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-[11px] text-fg-subtle font-mono">
            <span>Sukses: {confidence.successfulSignals}/{confidence.totalHistoricalSignals} Setup</span>
            <span>Target: +4.0%</span>
          </div>
        </div>
      </div>

      {/* Rincian Faktor Konfluensi */}
      {confidence.factors.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/50 pt-2 text-xs">
          <span className="font-semibold text-fg-subtle">Faktor Pendukung:</span>
          {confidence.factors.map((f, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                f.impact === "positive"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                  : f.impact === "negative"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                    : "bg-surface-elevated text-fg-muted border-line"
              }`}
            >
              <span>{f.impact === "positive" ? "✓" : f.impact === "negative" ? "✕" : "•"}</span>
              <span>{f.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
