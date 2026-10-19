"use client";

import type { SupportAccumulationResult } from "@/lib/indicators/supportAccumulation";

interface SupportAccumulationSectionProps {
  supports: SupportAccumulationResult | null;
}

export function SupportAccumulationSection({ supports }: SupportAccumulationSectionProps) {
  if (!supports) return null;

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-panel backdrop-blur-md p-3.5 sm:p-5 transition-all">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-fg">Level Support & Zona Akumulasi</h3>
            <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              Buy Zone Map
            </span>
          </div>
          <p className="text-xs text-fg-subtle">
            Area strategis untuk antre beli bertahap (*buy on weakness*) berdasarkan ayunan harga dan modal bandar
          </p>
        </div>

        {/* Status Entry Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${supports.statusBadge}`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {supports.statusText}
          </span>
        </div>
      </div>

      {/* Grid Kartu Support */}
      <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        {/* Kartu 1: Zona Akumulasi Ideal */}
        <div className="flex flex-col justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            Zona Beli Akumulasi
          </span>
          <div className="my-2 font-mono text-base font-black text-fg">
            {supports.accumulationZone.label}
          </div>
          <span className="text-[11px] text-fg-subtle">
            Area cicil terbaik (S2 ke S1)
          </span>
        </div>

        {/* Kartu 2: Support 1 (Swing Low) */}
        {supports.support1 && (
          <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-elevated/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-fg-muted uppercase tracking-wider">
                Support 1 (Swing)
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                -{supports.support1.distancePct}%
              </span>
            </div>
            <div className="my-2 font-mono text-lg font-bold text-emerald-400">
              Rp {supports.support1.price.toLocaleString()}
            </div>
            <span className="text-[11px] text-fg-subtle">
              {supports.support1.description}
            </span>
          </div>
        )}

        {/* Kartu 3: Support 2 (Modal Bandar) */}
        {supports.support2 && (
          <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-elevated/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-fg-muted uppercase tracking-wider">
                Support 2 (Modal Bandar)
              </span>
              <span className="font-mono text-[10px] text-cyan-400">
                -{supports.support2.distancePct}%
              </span>
            </div>
            <div className="my-2 font-mono text-lg font-bold text-cyan-400">
              Rp {supports.support2.price.toLocaleString()}
            </div>
            <span className="text-[11px] text-fg-subtle">
              {supports.support2.description}
            </span>
          </div>
        )}

        {/* Kartu 4: Cut Loss / Proteksi */}
        {supports.stopLoss && (
          <div className="flex flex-col justify-between rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                Cut Loss / Pengaman
              </span>
              <span className="font-mono text-[10px] text-rose-400">
                -{supports.stopLoss.distancePct}%
              </span>
            </div>
            <div className="my-2 font-mono text-lg font-bold text-rose-400">
              Rp {supports.stopLoss.price.toLocaleString()}
            </div>
            <span className="text-[11px] text-fg-subtle">
              {supports.stopLoss.description}
            </span>
          </div>
        )}
      </div>

      {/* Rekomendasi Tindakan */}
      <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-line/60 bg-surface-elevated/20 p-2.5 text-xs text-fg-muted">
        <span className="text-base">💡</span>
        <div className="leading-relaxed">
          <strong className="text-fg font-medium">Panduan Eksekusi: </strong>
          {supports.recommendation}
        </div>
      </div>
    </div>
  );
}
