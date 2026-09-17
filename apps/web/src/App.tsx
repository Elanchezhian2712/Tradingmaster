import { useEffect, useRef, useState } from "react";
import { CandleSnapshot, Timeframe } from "@trading-master/market-data";
import { ChartEngine, DrawingType, PriceLine, ScaleMode, ThemeName } from "@trading-master/chart-engine";
import { IndicatorType } from "@trading-master/indicators";
import { ChartContainer } from "./components/ChartContainer";
import { Toolbar } from "./components/Toolbar";
import { Watchlist } from "./components/Watchlist";
import { IndicatorPanel } from "./components/IndicatorPanel";
import { PerfHUD, PerfHUDHandle } from "./components/PerfHUD";
import { OhlcReadout, OhlcReadoutHandle } from "./components/OhlcReadout";
import { BenchmarkPanel, BenchmarkResult } from "./components/BenchmarkPanel";
import { DataWorkerClient } from "./workers/DataWorkerClient";
import { IndicatorWorkerClient } from "./workers/IndicatorWorkerClient";
import { catalogEntry } from "./indicatorCatalog";
import { OrderTicket } from "./components/OrderTicket";
import { TradingDock } from "./components/TradingDock";
import { usePaperTrading } from "./usePaperTrading";
import { useAuth } from "./useAuth";
import { AccountPanel } from "./components/AccountPanel";
import { Order, shouldSquareOffIntraday, istDayKey } from "@trading-master/paper-trading";
import { ActiveIndicator, WatchlistDef, WatchlistQuoteRow } from "./types";

const INITIAL_CANDLE_COUNT = 5000;
/** Chart price-line ids for resting orders carry this prefix so a drag can be mapped back to an order. */
const ORDER_LINE_PREFIX = "order-";
const SQUARE_OFF_CHECK_MS = 30_000;

const DEFAULT_WATCHLISTS: WatchlistDef[] = [
  { id: "my-stocks", name: "My Stocks", symbols: ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"] },
  { id: "intraday", name: "Intraday", symbols: ["NIFTY", "BANKNIFTY", "FINNIFTY"] },
  { id: "breakout", name: "Breakout", symbols: ["ADANIENT", "TATAMOTORS", "SBIN"] },
  { id: "fo", name: "F&O", symbols: ["NIFTY", "BANKNIFTY", "RELIANCE", "HDFCBANK"] },
  { id: "banking", name: "Banking", symbols: ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK"] },
];

export default function App() {
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const [symbol, setSymbol] = useState("RELIANCE");
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("linear");
  const [autoScale, setAutoScale] = useState(true);
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingType | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistDef[]>(DEFAULT_WATCHLISTS);
  const [activeWatchlistId, setActiveWatchlistId] = useState(DEFAULT_WATCHLISTS[0]!.id);
  const [quotes, setQuotes] = useState<Map<string, WatchlistQuoteRow>>(new Map());
  const [chart, setChart] = useState<ChartEngine | null>(null);
  const auth = useAuth();
  const { engine: paperEngine, snapshot: book, syncStatus, syncError, resetBook } = usePaperTrading(auth.token);

  const dataWorkerRef = useRef<DataWorkerClient | null>(null);
  const indicatorWorkerRef = useRef<IndicatorWorkerClient | null>(null);
  const perfHudRef = useRef<PerfHUDHandle>(null);
  const ohlcRef = useRef<OhlcReadoutHandle>(null);
  const lastBarTimeRef = useRef<number | null>(null);
  const lastSquareOffDayRef = useRef<string | null>(null);
  const seededIndicatorIds = useRef<Set<string>>(new Set());
  const activeIndicatorsRef = useRef<ActiveIndicator[]>(activeIndicators);
  activeIndicatorsRef.current = activeIndicators;

  function getDataWorker(): DataWorkerClient {
    if (!dataWorkerRef.current) dataWorkerRef.current = new DataWorkerClient();
    return dataWorkerRef.current;
  }
  function getIndicatorWorker(): IndicatorWorkerClient {
    if (!indicatorWorkerRef.current) indicatorWorkerRef.current = new IndicatorWorkerClient();
    return indicatorWorkerRef.current;
  }

  useEffect(() => {
    return () => {
      // Cleared alongside disposal (not just disposed) so that React 18 StrictMode's
      // dev-only mount->cleanup->remount cycle creates a fresh worker on remount
      // instead of reusing a reference to one that was just terminated.
      dataWorkerRef.current?.dispose();
      dataWorkerRef.current = null;
      indicatorWorkerRef.current?.dispose();
      indicatorWorkerRef.current = null;
    };
  }, []);

  // Historical load + reseed whenever the chart mounts or the symbol/timeframe changes.
  useEffect(() => {
    if (!chart) return;
    const dataWorker = getDataWorker();
    const indicatorWorker = getIndicatorWorker();
    let cancelled = false;

    chart.setHistoryLoading(true);
    chart.setTimeframe(timeframe);
    seededIndicatorIds.current.clear();

    dataWorker.loadHistory(symbol, timeframe, INITIAL_CANDLE_COUNT).then((batch) => {
      if (cancelled) return;
      chart.setData(batch);
      chart.setHistoryLoading(false);
      lastBarTimeRef.current = batch.time.length > 0 ? batch.time[batch.time.length - 1]! : null;
      indicatorWorker.seed(chart.getSeriesView());
      dataWorker.subscribeLive(symbol, timeframe);
    });

    return () => {
      cancelled = true;
      dataWorker.unsubscribeLive(symbol, timeframe);
    };
  }, [chart, symbol, timeframe]);

  // Load-more-history near the left edge.
  useEffect(() => {
    if (!chart) return;
    return chart.on("needMoreHistory", () => {
      const dataWorker = getDataWorker();
      const series = chart.getSeriesView();
      if (series.length === 0) return;
      chart.setHistoryLoading(true);
      const oldestTime = series.time[0]!;
      dataWorker.loadMore(symbol, timeframe, oldestTime - 1, 2000, series.open[0]!).then((batch) => {
        chart.prependData(batch);
        chart.setHistoryLoading(false);
      });
    });
  }, [chart, symbol, timeframe]);

  // Live tick stream -> chart + indicator worker.
  useEffect(() => {
    if (!chart) return;
    const dataWorker = getDataWorker();
    const indicatorWorker = getIndicatorWorker();

    const offTick = dataWorker.onTick((tickSymbol, tickTf, candle) => {
      if (tickSymbol !== symbol || tickTf !== timeframe) return;
      paperEngine.onPrice(tickSymbol, candle.close);
      const isNewBar = candle.time !== lastBarTimeRef.current;
      if (isNewBar) {
        chart.pushBar(candle);
        indicatorWorker.onBar(candle, false);
      } else {
        chart.updateLastBar(candle);
        indicatorWorker.onBar(candle, true);
      }
      lastBarTimeRef.current = candle.time;
    });

    const offOutputs = indicatorWorker.onOutputsChanged((id) => {
      const output = indicatorWorker.getOutput(id);
      const active = activeIndicatorsRef.current.find((a) => a.id === id);
      if (!output || !active) return;
      const entry = catalogEntry(active.type);
      if (!seededIndicatorIds.current.has(id)) {
        seededIndicatorIds.current.add(id);
        chart.setIndicatorPane({ id, pane: entry.pane, lines: entry.lines, fixedRange: entry.fixedRange }, output);
      } else {
        chart.updateIndicatorOutput(id, output);
      }
    });

    return () => {
      offTick();
      offOutputs();
    };
  }, [chart, symbol, timeframe, paperEngine]);

  useEffect(() => chart?.setTheme(themeName), [chart, themeName]);
  useEffect(() => chart?.setScaleMode(scaleMode), [chart, scaleMode]);
  useEffect(() => chart?.setAutoScale(autoScale), [chart, autoScale]);
  useEffect(() => chart?.armDrawingTool(activeDrawingTool), [chart, activeDrawingTool]);

  // Un-highlight the toolbar button once a drawing finishes placing and the tool auto-disarms.
  useEffect(() => {
    if (!chart) return;
    return chart.on("drawingToolDeactivated", () => setActiveDrawingTool(null));
  }, [chart]);

  // Position entries and resting order levels, drawn on the chart for the
  // charted symbol only.
  useEffect(() => {
    if (!chart) return;
    const lines: PriceLine[] = [];

    for (const position of book.positions) {
      if (position.symbol !== symbol) continue;
      const long = position.quantity > 0;
      lines.push({
        id: `position-${position.symbol}-${position.product}`,
        price: position.averagePrice,
        color: long ? "#26a69a" : "#ef5350",
        label: `${long ? "LONG" : "SHORT"} ${Math.abs(position.quantity)}`,
      });
    }

    for (const order of book.orders) {
      if (order.symbol !== symbol) continue;
      if (order.status !== "open" && order.status !== "triggered") continue;
      const price = order.limitPrice ?? order.triggerPrice;
      if (price === undefined) continue;
      lines.push({
        id: `${ORDER_LINE_PREFIX}${order.id}`,
        price,
        color: legColor(order),
        label: orderLineLabel(order),
        style: "dashed",
        // Position lines are a record of a fill and cannot be moved; a resting
        // order is just a price, so dragging it modifies the order.
        draggable: true,
      });
    }

    chart.setPriceLines(lines);
  }, [chart, book, symbol]);

  // Dragging a resting order's line on the chart modifies that order.
  useEffect(() => {
    if (!chart) return;
    return chart.on("priceLineMoved", ({ id, price }) => {
      if (!id.startsWith(ORDER_LINE_PREFIX)) return;
      const orderId = id.slice(ORDER_LINE_PREFIX.length);
      const order = paperEngine.getOrder(orderId);
      if (!order) return;
      const rounded = Math.round(price * 20) / 20; // NSE tick size is 5 paise.
      // Which field a line represents depends on the order type: an SL-M has
      // only a trigger, everything else rests on its limit price.
      const changes = order.type === "SL-M" ? { triggerPrice: rounded } : { limitPrice: rounded };
      paperEngine.modifyOrder(orderId, changes);
    });
  }, [chart, paperEngine]);

  // Intraday (MIS) auto-square-off at the session close.
  useEffect(() => {
    function check() {
      const now = Date.now();
      if (!shouldSquareOffIntraday({ now, lastRunDayKey: lastSquareOffDayRef.current })) return;
      lastSquareOffDayRef.current = istDayKey(now);
      paperEngine.squareOffProduct("MIS");
    }
    check();
    const interval = setInterval(check, SQUARE_OFF_CHECK_MS);
    return () => clearInterval(interval);
  }, [paperEngine]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.altKey) {
        const map: Record<string, Timeframe> = { "1": "1m", "5": "5m", m: "15m", d: "1D" };
        const tf = map[e.key.toLowerCase()];
        if (tf) {
          e.preventDefault();
          setTimeframe(tf);
          return;
        }
      }
      if (e.key === "r" || e.key === "R") chart?.resetView();
      if (e.key === "f" || e.key === "F") chart?.fitAll();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chart]);

  // Watchlist quote polling (not the chart hot path, safe to live in React state).
  useEffect(() => {
    const dataWorker = getDataWorker();
    const symbols = Array.from(new Set(watchlists.flatMap((w) => w.symbols)));
    let cancelled = false;

    async function poll() {
      const rows = await Promise.all(
        symbols.map(async (sym) => {
          const q = await dataWorker.getQuote(sym);
          // Symbols other than the charted one have no tick subscription, so the
          // quote poll is what values their positions and matches their orders.
          paperEngine.onPrice(sym, q.ltp, q.timestamp);
          const row: WatchlistQuoteRow = {
            symbol: sym,
            ltp: q.ltp,
            change: q.change,
            changePercent: q.changePercent,
            volume: q.volume,
            high: q.high,
            low: q.low,
            open: q.open,
            prevClose: q.prevClose,
          };
          return [sym, row] as const;
        })
      );
      if (!cancelled) setQuotes(new Map(rows));
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [watchlists, paperEngine]);

  async function runBenchmark(count: number): Promise<BenchmarkResult> {
    if (!chart) throw new Error("Chart not ready");
    const dataWorker = getDataWorker();
    const t0 = performance.now();
    const batch = await dataWorker.loadHistory("BENCHMARK", timeframe, count);
    const t1 = performance.now();
    chart.setData(batch);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const t2 = performance.now();
    const perf = chart.getPerfSnapshot();

    // Restore the user's actual symbol view after measuring.
    dataWorker.loadHistory(symbol, timeframe, INITIAL_CANDLE_COUNT).then((restoreBatch) => chart.setData(restoreBatch));

    return { count, loadTimeMs: t1 - t0, renderTimeMs: t2 - t1, fps: perf.fps, usedJSHeapMB: perf.usedJSHeapMB };
  }

  function handleAddIndicator(type: IndicatorType) {
    const entry = catalogEntry(type);
    const id = `${type.toLowerCase()}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const params = { ...entry.defaultParams };
    setActiveIndicators((prev) => [...prev, { id, type, label: entry.label, params, enabled: true }]);
    getIndicatorWorker().add({ id, type, params, enabled: true });
  }

  function handleRemoveIndicator(id: string) {
    setActiveIndicators((prev) => prev.filter((i) => i.id !== id));
    getIndicatorWorker().remove(id);
    chart?.removeIndicator(id);
    seededIndicatorIds.current.delete(id);
  }

  function handleToggleIndicator(id: string, enabled: boolean) {
    setActiveIndicators((prev) => prev.map((i) => (i.id === id ? { ...i, enabled } : i)));
    getIndicatorWorker().setEnabled(id, enabled);
    chart?.setIndicatorEnabled(id, enabled);
  }

  function handleAddSymbol(listId: string, symbolToAdd: string) {
    setWatchlists((prev) => prev.map((w) => (w.id === listId && !w.symbols.includes(symbolToAdd) ? { ...w, symbols: [...w.symbols, symbolToAdd] } : w)));
  }
  function handleRemoveSymbol(listId: string, symbolToRemove: string) {
    setWatchlists((prev) => prev.map((w) => (w.id === listId ? { ...w, symbols: w.symbols.filter((s) => s !== symbolToRemove) } : w)));
  }
  function handleReorderSymbol(listId: string, symbolToMove: string, direction: -1 | 1) {
    setWatchlists((prev) =>
      prev.map((w) => {
        if (w.id !== listId) return w;
        const idx = w.symbols.indexOf(symbolToMove);
        const swapWith = idx + direction;
        if (idx < 0 || swapWith < 0 || swapWith >= w.symbols.length) return w;
        const symbols = [...w.symbols];
        [symbols[idx], symbols[swapWith]] = [symbols[swapWith]!, symbols[idx]!];
        return { ...w, symbols };
      })
    );
  }

  return (
    <div className={`app theme-${themeName}`}>
      <Toolbar
        symbol={symbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        themeName={themeName}
        onThemeToggle={() => setThemeName((t) => (t === "dark" ? "light" : "dark"))}
        scaleMode={scaleMode}
        onScaleModeChange={setScaleMode}
        autoScale={autoScale}
        onAutoScaleToggle={() => setAutoScale((v) => !v)}
        onReset={() => chart?.resetView()}
        onFitAll={() => chart?.fitAll()}
        activeDrawingTool={activeDrawingTool}
        onSelectDrawingTool={setActiveDrawingTool}
        onClearDrawings={() => chart?.clearDrawings()}
      />

      <div className="main-layout">
        <div className="chart-column">
          <div className="chart-area">
            <ChartContainer
              themeName={themeName}
              symbol={symbol}
              timeframe={timeframe}
              onReady={setChart}
              onDispose={() => setChart(null)}
              onCrosshairBar={(bar: CandleSnapshot | null) => ohlcRef.current?.update(bar)}
              onPerf={(perf) => perfHudRef.current?.update(perf)}
            />
            <OhlcReadout ref={ohlcRef} />
            <PerfHUD ref={perfHudRef} />
          </div>

          <TradingDock
            snapshot={book}
            onClosePosition={(sym, product) => paperEngine.closePosition(sym, product)}
            onCancelOrder={(orderId) => paperEngine.cancelOrder(orderId)}
            onSquareOffAll={() => paperEngine.squareOffAll()}
            onSelectSymbol={setSymbol}
          />
        </div>

        <div className="side-panel">
          <Watchlist
            lists={watchlists}
            activeListId={activeWatchlistId}
            onSelectList={setActiveWatchlistId}
            quotes={quotes}
            onSelectSymbol={setSymbol}
            selectedSymbol={symbol}
            onAddSymbol={handleAddSymbol}
            onRemoveSymbol={handleRemoveSymbol}
            onReorder={handleReorderSymbol}
          />
          <AccountPanel auth={auth} syncStatus={syncStatus} syncError={syncError} onResetBook={() => void resetBook()} />
          <OrderTicket
            symbol={symbol}
            ltp={paperEngine.getLastPrice(symbol)}
            availableBalance={book.account.availableBalance}
            onPlace={(req) => paperEngine.placeOrder(req)}
          />
          <IndicatorPanel active={activeIndicators} onAdd={handleAddIndicator} onRemove={handleRemoveIndicator} onToggle={handleToggleIndicator} />
          <BenchmarkPanel onRun={runBenchmark} />
        </div>
      </div>
    </div>
  );
}

function orderLineLabel(order: Order): string {
  if (order.legType === "stop-loss") return "SL";
  if (order.legType === "target") return "TARGET";
  return `${order.side === "BUY" ? "B" : "S"} ${order.type}`;
}

function legColor(order: Order): string {
  if (order.legType === "stop-loss") return "#ef5350";
  if (order.legType === "target") return "#26a69a";
  return order.side === "BUY" ? "#2962ff" : "#f0b90b";
}
