import { computeIndicators } from "@/lib/indicators";
import { analyzeSignal } from "@/lib/indicators/signal";
import { buildTradePlan } from "@/lib/indicators/tradePlan";
import type { IndicatorConfig } from "@/lib/indicators/config";
import type { Candle, TradePlan } from "@/lib/indicators/types";
import type { BacktestResult, BacktestStats, BacktestTrade, TradeOutcome } from "./types";

export interface BacktestInput {
  candles: Candle[];
  config: IndicatorConfig;
}

const EMPTY_STATS: BacktestStats = {
  signals: 0,
  trades: 0,
  wins: 0,
  losses: 0,
  timeouts: 0,
  winRate: 0,
  expectancyR: 0,
  avgWinR: null,
  avgLossR: null,
  profitFactor: null,
  totalR: 0,
  maxDrawdownR: 0,
  avgHoldingBars: 0,
  avgMaeR: 0,
  avgMfeR: 0,
  equityCurve: [],
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Hanya sinyal Long dengan level yang masuk akal (stop < entry < target) yang dapat dieksekusi. */
function isTradeable(plan: TradePlan | null): plan is TradePlan & {
  entry: number;
  stop: number;
  target: number;
  rewardRisk: number;
} {
  if (!plan || plan.direction !== "Long" || !plan.valid) return false;
  const { entry, stop, target } = plan;
  if (entry === null || stop === null || target === null) return false;
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return false;
  return stop < entry && entry < target;
}

/**
 * Simulasikan satu posisi sejak `entryIndex`. Mengembalikan trade yang sudah
 * ditutup, atau null bila harga eksekusi tidak valid (mis. gap di bawah stop).
 * Diekspor agar aturan eksekusi (stop-first, MAE/MFE) bisa diuji langsung.
 */
export function simulatePosition(
  candles: Candle[],
  entryIndex: number,
  plan: TradePlan & { stop: number; target: number; rewardRisk: number },
  config: IndicatorConfig,
  signalIndex: number,
  state: BacktestTrade["state"],
  strength: number,
): BacktestTrade | null {
  const entry = candles[entryIndex].o;
  const stop = plan.stop;
  const target = plan.target;
  const risk = entry - stop;

  if (!(entry > 0) || !(target > entry) || !(risk > 0)) return null;

  const lastIndex = candles.length - 1;
  const endIndex = Math.min(entryIndex + config.backtest.maxHoldingBars - 1, lastIndex);

  let exitIndex = endIndex;
  let exitPrice = candles[endIndex].c;
  let outcome: TradeOutcome = "timeout";
  let maeR = 0;
  let mfeR = 0;

  for (let j = entryIndex; j <= endIndex; j += 1) {
    const bar = candles[j];
    mfeR = Math.max(mfeR, (bar.h - entry) / risk);
    maeR = Math.max(maeR, (entry - bar.l) / risk);

    const hitStop = bar.l <= stop;
    const hitTarget = bar.h >= target;

    if (hitStop && hitTarget) {
      // Ambigu: dalam satu bar kita tak tahu mana yang tersentuh lebih dulu.
      if (config.backtest.stopFirstOnAmbiguous) {
        exitIndex = j;
        exitPrice = stop;
        outcome = "stop";
      } else {
        exitIndex = j;
        exitPrice = target;
        outcome = "target";
      }
      break;
    }

    if (hitStop) {
      exitIndex = j;
      exitPrice = stop;
      outcome = "stop";
      break;
    }

    if (hitTarget) {
      exitIndex = j;
      exitPrice = target;
      outcome = "target";
      break;
    }
  }

  return {
    signalIndex,
    signalTime: candles[signalIndex].t,
    entryIndex,
    entryTime: candles[entryIndex].t,
    exitIndex,
    exitTime: candles[exitIndex].t,
    entry,
    stop,
    target,
    exitPrice,
    outcome,
    rMultiple: (exitPrice - entry) / risk,
    maeR,
    mfeR,
    holdingBars: exitIndex - entryIndex + 1,
    state,
    strength,
    plannedRewardRisk: plan.rewardRisk,
  };
}

/** Ringkas daftar trade menjadi statistik. Diekspor agar bisa diuji terpisah. */
export function summarizeTrades(trades: BacktestTrade[], signals = trades.length): BacktestStats {
  if (trades.length === 0) {
    return { ...EMPTY_STATS, signals, equityCurve: [] };
  }

  const rMultiples = trades.map((trade) => trade.rMultiple);
  const wins = trades.filter((trade) => trade.rMultiple > 0);
  const losses = trades.filter((trade) => trade.rMultiple <= 0);
  const timeouts = trades.filter((trade) => trade.outcome === "timeout").length;

  const grossProfit = wins.reduce((sum, trade) => sum + trade.rMultiple, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.rMultiple, 0));

  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;
  const equityCurve: number[] = [];
  for (const rMultiple of rMultiples) {
    equity += rMultiple;
    equityCurve.push(equity);
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
  }

  return {
    signals,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    timeouts,
    winRate: wins.length / trades.length,
    expectancyR: mean(rMultiples),
    avgWinR: wins.length > 0 ? mean(wins.map((trade) => trade.rMultiple)) : null,
    avgLossR: losses.length > 0 ? mean(losses.map((trade) => trade.rMultiple)) : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    totalR: equity,
    maxDrawdownR,
    avgHoldingBars: mean(trades.map((trade) => trade.holdingBars)),
    avgMaeR: mean(trades.map((trade) => trade.maeR)),
    avgMfeR: mean(trades.map((trade) => trade.mfeR)),
    equityCurve,
  };
}

/**
 * Backtest walk-forward tanpa look-ahead.
 *
 * Pada setiap bar `i` (mulai `warmupBars`), indikator dihitung ulang hanya dari
 * candle `0..i` — persis seperti yang terlihat oleh trader pada saat itu. Bila
 * trade plan berstatus `Long`, posisi dibuka pada **open bar berikutnya**
 * (`entryDelayBars`) agar tidak memakai harga yang belum terjadi.
 *
 * Satu instrumen hanya menahan satu posisi: sinyal yang muncul saat posisi masih
 * terbuka tetap dihitung sebagai `signals` tetapi tidak dieksekusi.
 *
 * Optimasi O(n) vs O(n²):
 *   Alih-alih memanggil `computeIndicators(candles.slice(0, i+1))` di setiap
 *   iterasi (yang menghitung ulang semua seri dari bar 0), kita pre-compute
 *   seluruh seri indikator SEKALI (LPM, intensity, rotation) dalam O(n).
 *   Untuk setiap bar `i`, kita hanya memanggil `analyzeSignal` dan
 *   `buildTradePlan` dengan slice seri yang sudah tersedia — jauh lebih ringan.
 */
export function runBacktest({ candles, config }: BacktestInput): BacktestResult {
  const totalBars = candles.length;
  const { warmupBars, entryDelayBars, maxTestBars } = config.backtest;

  const lastSignalIndex = totalBars - 1 - entryDelayBars;
  const firstCandidate = Math.max(0, warmupBars);
  const testStart = Math.max(firstCandidate, lastSignalIndex - maxTestBars + 1);

  if (lastSignalIndex < testStart) {
    return {
      trades: [],
      stats: { ...EMPTY_STATS },
      warmupBars,
      testedBars: 0,
      totalBars,
    };
  }

  // Pre-compute seri indikator penuh sekali — O(n).
  const fullResult = computeIndicators(candles, config);
  const fullSeries = fullResult.series;

  const trades: BacktestTrade[] = [];
  let signals = 0;
  let openUntil = -1;

  for (let i = testStart; i <= lastSignalIndex; i += 1) {
    // Slice seri & candle hingga bar i untuk no-lookahead.
    const candleWindow = candles.slice(0, i + 1);
    const seriesWindow = fullSeries.slice(0, i + 1);

    // analyzeSignal dan buildTradePlan sudah jauh lebih ringan dari computeIndicators penuh
    // karena seri LPM/intensity/rotation sudah tersedia — tidak perlu hitung ulang dari raw.
    const analysis = analyzeSignal({ candles: candleWindow, series: seriesWindow, config });
    const tradePlan = buildTradePlan({ candles: candleWindow, analysis, config });

    if (!isTradeable(tradePlan)) continue;
    signals += 1;

    if (i <= openUntil) continue;

    const trade = simulatePosition(
      candles,
      i + entryDelayBars,
      tradePlan,
      config,
      i,
      analysis.state,
      analysis.strength.score,
    );

    if (!trade) continue;
    trades.push(trade);
    openUntil = trade.exitIndex;
  }

  return {
    trades,
    stats: summarizeTrades(trades, signals),
    warmupBars,
    testedBars: lastSignalIndex - testStart + 1,
    totalBars,
  };
}

