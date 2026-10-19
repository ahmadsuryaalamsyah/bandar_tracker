"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBacktest } from "@/hooks/useBacktest";
import { useOhlcv } from "@/hooks/useOhlcv";
import type { Interval, OhlcvQuery, Range } from "@/lib/data/types";
import {
  computeIndicators,
  directionArrow,
  directionFromSlope,
  interpretIntensity,
  interpretLpm,
  interpretRotation,
  calculateAccumulationSupports,
} from "@/lib/indicators";
import { configForProfile, TRADE_PROFILES, type TradeProfileId } from "@/lib/indicators/config";
import { formatCompact, formatDate, formatNumber, formatPrice, formatRatio, formatSignedNumber, formatSignedPercent } from "@/lib/utils/format";
import { INTERVAL_LABELS, RANGE_LABELS } from "@/lib/utils/labels";
import { setTab, TABS, useAppTab } from "@/lib/utils/nav";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";
import { BacktestPanel } from "./BacktestPanel";
import { BandarDetectorSection } from "./BandarDetectorSection";
import { SmartConfluenceSection } from "./SmartConfluenceSection";
import { SupportAccumulationSection } from "./SupportAccumulationSection";
import { CrashArbPanel } from "./CrashArbPanel";
import { ErrorBoundary } from "./ErrorBoundary";
import { IndicatorBarChart } from "./IndicatorBarChart";
import { IndicatorHistoryChart } from "./IndicatorHistoryChart";
import { IndicatorPanel } from "./IndicatorPanel";
import { MarketStatePanel } from "./MarketStatePanel";
import { Panel } from "./Panel";
import { PriceVolumeChart } from "./PriceVolumeChart";
import { ProfileSwitch } from "./ProfileSwitch";
import { RefreshControl } from "./RefreshControl";
import { ScreenerPanel } from "./ScreenerPanel";
import { SignalBadge } from "./SignalBadge";
import { TickerForm } from "./TickerForm";
import { TradePlanPanel } from "./TradePlanPanel";

const DEFAULT_QUERY: OhlcvQuery = { ticker: "BBCA", interval: "1d", range: "1y" };
const REFRESH_MS = 30_000;

export function Dashboard() {
  const tab = useAppTab();
  const [query, setQuery] = useState<OhlcvQuery>(DEFAULT_QUERY);
  const [profile, setProfile] = useState<TradeProfileId>("swing");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { status, data, error, updatedAt, quoteDelayMs, refreshing, load } = useOhlcv();
  const backtest = useBacktest();
  const lastQuery = useRef<OhlcvQuery>(DEFAULT_QUERY);

  const config = useMemo(() => configForProfile(profile), [profile]);
  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0];
  /** Tab yang menampilkan satu saham: butuh form pemilih & data OHLCV. */
  const needsTicker = tab === "analysis" || tab === "plan";
  /** Tab yang bergantung pada profil trade. */
  const usesProfile = tab === "plan" || tab === "screener";
  useEffect(() => {
    lastQuery.current = query;
    void load(query.ticker, query.interval, query.range);
  }, [query, load]);

  // Hasil backtest terikat pada query & profil — buang agar tidak menyesatkan.
  const { reset: resetBacktest } = backtest;
  useEffect(() => {
    resetBacktest();
  }, [query, profile, resetBacktest]);
  useEffect(() => {
    if (!autoRefresh) return;

    const tick = () => {
      // Gunakan lastQuery ref agar tick tidak stale saat ticker berubah.
      // Cukup periksa data !== null untuk menghindari refresh di halaman kosong.
      if (document.visibilityState !== "visible" || data === null) return;
      const current = lastQuery.current;
      void load(current.ticker, current.interval, current.range, { silent: true });
    };

    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [autoRefresh, data, load]);

  const indicators = useMemo(
    () => (data ? computeIndicators(data.bars, config) : null),
    [data, config],
  );

  const supports = useMemo(() => {
    if (!data || !indicators) return null;
    return calculateAccumulationSupports(data.bars, indicators.series, 60);
  }, [data, indicators]);

  const summary = useMemo(() => {
    if (!data || data.bars.length === 0) return null;
    const last = data.bars[data.bars.length - 1];
    const previousClose = data.bars.length > 1 ? data.bars[data.bars.length - 2].c : last.o;
    const change = last.c - previousClose;
    const changePct = previousClose > 0 ? change / previousClose : 0;
    return { last, change, changePct };
  }, [data]);

  const retry = () => void load(query.ticker, query.interval, query.range);
  const refreshNow = () => void load(query.ticker, query.interval, query.range, { silent: true });
  const runBacktest = () => void backtest.run(query.ticker, query.interval, query.range, profile);

  const selectTicker = (ticker: string) => {
    setQuery((prev) => ({ ...prev, ticker }));
    setTab("analysis");
  };

  const resetKey = `${query.ticker}-${query.interval}-${query.range}-${profile}`;

  const latest = indicators?.latest ?? null;
  const analysis = indicators?.analysis ?? null;
  const lpmDirection = analysis ? directionArrow(directionFromSlope(analysis.momentum.lpmSlope)) : "-";
  const changeUp = (summary?.change ?? 0) >= 0;

  return (
    <main className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-fg">{activeTab.label}</h1>
          <p className="text-xs text-fg-subtle">{activeTab.hint}</p>
        </div>
        {usesProfile && <ProfileSwitch value={profile} onChange={setProfile} disabled={status === "loading"} />}
      </div>

      <ErrorBoundary context="Dashboard">
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {needsTicker && (
            <>
              <TickerForm
                ticker={query.ticker}
                interval={query.interval}
                range={query.range}
                busy={status === "loading"}
                onSubmit={(ticker, interval, range) => setQuery({ ticker, interval, range })}
              />

              <div className="mt-4 space-y-4">
                {status === "loading" && <LoadingState />}

                {status === "error" && <ErrorState message={error ?? "Terjadi kesalahan."} onRetry={retry} />}

                {status === "idle" && <EmptyState message="Masukkan kode saham untuk memulai analisis." />}

                {status === "success" && data && summary && indicators && (
                  <>
                    <Panel padded={false} className="overflow-hidden border border-line/80 shadow-panel">
                      <div className="relative p-3.5 sm:p-5">
                        {/* Background glow decoration */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                          {/* Top / Left: Ticker & Metadata */}
                          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent border border-accent/30 text-accent font-black text-base sm:text-lg shadow-sm">
                              {data.ticker.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-fg">{data.ticker}</h2>
                                <span className="rounded-md border border-line bg-surface-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
                                  {data.exchange}
                                </span>
                                {data.name && (
                                  <span className="text-xs sm:text-sm font-medium text-fg-muted truncate max-w-[180px] sm:max-w-none">
                                    · {data.name}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] sm:text-xs text-fg-subtle">
                                {data.currency} · {INTERVAL_LABELS[data.interval as Interval]} ·{" "}
                                {RANGE_LABELS[data.range as Range]} · {formatNumber(data.bars.length)} Bar · Sumber {data.source}
                              </p>
                            </div>
                          </div>

                          {/* Center: Quick Stats Pills for Large Screens */}
                          <div className="hidden lg:flex items-center gap-4 rounded-xl border border-line/60 bg-surface-elevated/40 px-4 py-2 text-xs backdrop-blur-sm">
                            <div>
                              <div className="text-[10px] text-fg-subtle uppercase tracking-wider font-semibold">Open</div>
                              <div className="font-mono font-bold text-fg">{formatPrice(summary.last.o, data.currency)}</div>
                            </div>
                            <div className="h-6 w-px bg-line/60" />
                            <div>
                              <div className="text-[10px] text-fg-subtle uppercase tracking-wider font-semibold">High</div>
                              <div className="font-mono font-bold text-emerald-400">{formatPrice(summary.last.h, data.currency)}</div>
                            </div>
                            <div className="h-6 w-px bg-line/60" />
                            <div>
                              <div className="text-[10px] text-fg-subtle uppercase tracking-wider font-semibold">Low</div>
                              <div className="font-mono font-bold text-rose-400">{formatPrice(summary.last.l, data.currency)}</div>
                            </div>
                            <div className="h-6 w-px bg-line/60" />
                            <div>
                              <div className="text-[10px] text-fg-subtle uppercase tracking-wider font-semibold">Volume</div>
                              <div className="font-mono font-bold text-fg">{formatCompact(summary.last.v)}</div>
                            </div>
                          </div>

                          {/* Right: Big Price & Signal Badge */}
                          <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-5 w-full lg:w-auto pt-3 border-t border-line/40 lg:border-0 lg:pt-0">
                            <div className="text-left lg:text-right">
                              <div className="text-2xl sm:text-3xl font-black text-fg tnum tracking-tight">
                                {formatPrice(summary.last.c, data.currency)}
                              </div>
                              <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold tnum">
                                <span className={changeUp ? "text-emerald-400" : "text-rose-400"}>
                                  {formatSignedNumber(summary.change)} ({formatSignedPercent(summary.changePct)})
                                </span>
                              </div>
                            </div>
                            <SignalBadge signal={indicators.signal} />
                          </div>

                          {/* Mobile / Tablet Quick Stats Strip */}
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full pt-3 border-t border-line/40 text-center lg:hidden">
                            <div className="rounded-lg bg-surface-elevated/40 p-1.5">
                              <div className="text-[9px] text-fg-subtle uppercase tracking-wider font-semibold">Open</div>
                              <div className="font-mono text-xs font-bold text-fg truncate">{formatPrice(summary.last.o, data.currency)}</div>
                            </div>
                            <div className="rounded-lg bg-surface-elevated/40 p-1.5">
                              <div className="text-[9px] text-fg-subtle uppercase tracking-wider font-semibold">High</div>
                              <div className="font-mono text-xs font-bold text-emerald-400 truncate">{formatPrice(summary.last.h, data.currency)}</div>
                            </div>
                            <div className="rounded-lg bg-surface-elevated/40 p-1.5">
                              <div className="text-[9px] text-fg-subtle uppercase tracking-wider font-semibold">Low</div>
                              <div className="font-mono text-xs font-bold text-rose-400 truncate">{formatPrice(summary.last.l, data.currency)}</div>
                            </div>
                            <div className="rounded-lg bg-surface-elevated/40 p-1.5">
                              <div className="text-[9px] text-fg-subtle uppercase tracking-wider font-semibold">Vol</div>
                              <div className="font-mono text-xs font-bold text-fg truncate">{formatCompact(summary.last.v)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Panel>

                    <RefreshControl
                      quoteTime={data.quoteTime}
                      updatedAt={updatedAt}
                      delayMs={quoteDelayMs}
                      refreshing={refreshing}
                      staleError={error}
                      autoRefresh={autoRefresh}
                      intervalMs={REFRESH_MS}
                      onToggleAuto={() => setAutoRefresh((value) => !value)}
                      onRefreshNow={refreshNow}
                    />

                    {tab === "analysis" && (
                      <>
                        <Panel
                          title="Harga & Volume"
                          subtitle="Candlestick dengan histogram volume"
                          padded={false}
                          action={<span className="text-xs text-fg-subtle">Geser & zoom untuk menjelajah</span>}
                        >
                          <div className="p-2">
                            <PriceVolumeChart bars={data.bars} resetKey={resetKey} height={350} supports={supports} />
                          </div>
                          {/* Indikator bar — langsung di bawah chart harga */}
                          <div className="border-t border-line/50">
                            <IndicatorBarChart series={indicators.series} resetKey={resetKey} height={255} />
                          </div>
                        </Panel>

                        {/* Level Support & Zona Akumulasi */}
                        <SupportAccumulationSection supports={supports} />

                        {/* Bandar Detector Matrix & Chartbit Movement (Stockbit Style) */}
                        <BandarDetectorSection
                          bars={data.bars}
                          indicators={indicators.series}
                          resetKey={resetKey}
                        />

                        {/* Smart Confluence Engine (Divergensi, VSA, Win Rate Historis) */}
                        <SmartConfluenceSection
                          bars={data.bars}
                          indicators={indicators.series}
                          marketState={indicators.signal}
                        />

                        <div className="grid gap-4 md:grid-cols-3">
                          <IndicatorPanel
                            title="Liquidity Pressure"
                            description="Tekanan likuiditas dari volume relatif, posisi close, dan perubahan harga."
                            score={latest?.lpm ?? null}
                            interpretation={latest ? interpretLpm(latest.lpm) : null}
                            context={{ label: "Trend", value: lpmDirection }}
                            metrics={[
                              { label: "RVOL", value: latest ? formatRatio(latest.rvol) : "-" },
                              { label: "CLV", value: latest ? latest.clv.toFixed(2) : "-" },
                              { label: "Raw", value: latest ? latest.lpRaw.toFixed(3) : "-" },
                            ]}
                          />
                          <IndicatorPanel
                            title="Intensity"
                            description="Besarnya aktivitas (volume, range, return) relatif terhadap baseline historis."
                            score={latest?.intensity ?? null}
                            interpretation={latest ? interpretIntensity(latest.intensity) : null}
                            context={{ label: "Momentum", value: analysis ? analysis.momentum.label : "-" }}
                            metrics={[
                              { label: "Volume", value: latest ? formatCompact(data.bars[data.bars.length - 1].v) : "-" },
                              { label: "Raw", value: latest ? latest.intensityRaw.toFixed(2) : "-" },
                              { label: "Bar", value: latest ? formatDate(latest.t) : "-" },
                            ]}
                          />
                          <IndicatorPanel
                            title="Volume Rotation"
                            description="Perputaran volume terhadap rata-rata dan periode sebelumnya."
                            score={latest?.rotation ?? null}
                            interpretation={latest ? interpretRotation(latest.rotation) : null}
                            context={{ label: "Volume", value: analysis ? analysis.volume.label : "-" }}
                            metrics={[
                              { label: "vs Avg", value: latest ? formatSignedPercent(latest.rvol - 1) : "-" },
                              { label: "Raw", value: latest ? latest.rotationRaw.toFixed(3) : "-" },
                              { label: "Bar", value: latest ? formatDate(latest.t) : "-" },
                            ]}
                          />
                        </div>

                        <Panel
                          title="Histori Indikator"
                          subtitle="Garis LPM/Intensity/Rotation, skala 0–100"
                          action={
                            <span className="text-xs text-fg-subtle tnum">
                              {formatNumber(indicators.series.length)} titik
                            </span>
                          }
                        >
                          <IndicatorHistoryChart series={indicators.series} resetKey={resetKey} height={220} />
                        </Panel>
                      </>
                    )}

                    {tab === "plan" && (
                      <>
                        {analysis && <MarketStatePanel analysis={analysis} />}

                        {indicators.tradePlan && analysis && (
                          <TradePlanPanel
                            plan={indicators.tradePlan}
                            strength={analysis.strength.label}
                            currency={data.currency}
                            profileLabel={TRADE_PROFILES[profile].label}
                            minRewardRisk={config.tradePlan.minRewardRisk}
                            backtest={backtest.data?.result.stats ?? null}
                          />
                        )}

                        <BacktestPanel
                          status={backtest.status}
                          data={backtest.data}
                          error={backtest.error}
                          onRun={runBacktest}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {(tab === "screener" || tab === "watchlist") && (
            <ScreenerPanel profile={profile} section={tab} onSelectTicker={selectTicker} />
          )}
          {tab === "crasharb" && <CrashArbPanel onSelectTicker={selectTicker} />}
        </div>
      </ErrorBoundary>

      <footer className="mt-8 border-t border-line pt-4 text-xs text-fg-subtle">
        Data harga Yahoo Finance (tidak resmi, delayed ~15 menit) · formula di{" "}
        <span className="font-mono text-fg-muted">docs/FORMULAS.md</span> · untuk penggunaan pribadi/lokal.
      </footer>
    </main>
  );
}
