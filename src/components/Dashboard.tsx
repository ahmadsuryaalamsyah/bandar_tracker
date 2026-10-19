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
} from "@/lib/indicators";
import { configForProfile, TRADE_PROFILES, type TradeProfileId } from "@/lib/indicators/config";
import { formatCompact, formatDate, formatNumber, formatPrice, formatRatio, formatSignedNumber, formatSignedPercent } from "@/lib/utils/format";
import { INTERVAL_LABELS, RANGE_LABELS } from "@/lib/utils/labels";
import { setTab, TABS, useAppTab } from "@/lib/utils/nav";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";
import { BacktestPanel } from "./BacktestPanel";
import { CrashArbPanel } from "./CrashArbPanel";
import { ErrorBoundary } from "./ErrorBoundary";
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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
                    <Panel padded={false}>
                      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold tracking-tight text-fg">{data.ticker}</h2>
                            {data.name && <span className="truncate text-sm text-fg-muted">{data.name}</span>}
                          </div>
                          <p className="mt-1 text-xs text-fg-subtle">
                            {data.exchange} · {data.currency} · {INTERVAL_LABELS[data.interval as Interval]} ·{" "}
                            {RANGE_LABELS[data.range as Range]} · {formatNumber(data.bars.length)} bar · sumber{" "}
                            {data.source}
                          </p>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-fg tnum">
                              {formatPrice(summary.last.c, data.currency)}
                            </div>
                            <div className={`text-sm font-semibold tnum ${changeUp ? "text-up" : "text-down"}`}>
                              {formatSignedNumber(summary.change)} ({formatSignedPercent(summary.changePct)})
                            </div>
                          </div>
                          <SignalBadge signal={indicators.signal} />
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
                            <PriceVolumeChart bars={data.bars} resetKey={resetKey} height={380} />
                          </div>
                        </Panel>

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
                          subtitle="Skala 0–100, netral di 50"
                          action={
                            <span className="text-xs text-fg-subtle tnum">
                              {formatNumber(indicators.series.length)} titik
                            </span>
                          }
                        >
                          <IndicatorHistoryChart series={indicators.series} resetKey={resetKey} height={260} />
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
