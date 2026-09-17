import { useEffect, useRef, useState } from "react";
import { CandleSnapshot, Timeframe } from "@trading-master/market-data";
import { ChartEngine, DrawingType, PriceLine, ScaleMode, ThemeName } from "@trading-master/chart-engine";
import { IndicatorType } from "@trading-master/indicators";
import { ChartContainer } from "./components/ChartContainer";
import { TopBar, ChartType } from "./components/TopBar";
import { SideToolbar, CursorMode } from "./components/SideToolbar";
import { ChartOverlayHeader } from "./components/ChartOverlayHeader";
import { RightRail, RightRailTab } from "./components/RightRail";
import { BottomBar, BottomDockTab } from "./components/BottomBar";
import { FavoritesBar } from "./components/FavoritesBar";
import { SymbolSearchModal } from "./components/SymbolSearchModal";
import { IndicatorsModal } from "./components/IndicatorsModal";
import { AlertModal } from "./components/AlertModal";
import { ChartSettingsModal } from "./components/ChartSettingsModal";
import { ReplayControls } from "./components/ReplayControls";
import { DataWindow } from "./components/DataWindow";
import { NewsFeed } from "./components/NewsFeed";
import { PineEditor } from "./components/PineEditor";
import { StockScreener } from "./components/StockScreener";
import { Watchlist } from "./components/Watchlist";
import { IndicatorPanel } from "./components/IndicatorPanel";
import { PerfHUD, PerfHUDHandle } from "./components/PerfHUD";
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
const ORDER_LINE_PREFIX = "order-";
const SQUARE_OFF_CHECK_MS = 30_000;

const DEFAULT_WATCHLISTS: WatchlistDef[] = [
  { id: "my-stocks", name: "My Stocks", symbols: ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"] },
  { id: "intraday", name: "Intraday", symbols: ["NIFTY", "BANKNIFTY", "FINNIFTY"] },
  { id: "breakout", name: "Breakout", symbols: ["ADANIENT", "TATAMOTORS", "SBIN"] },
  { id: "crypto", name: "Crypto", symbols: ["BTCUSDT", "ETHUSDT"] },
];

export interface PriceAlert {
  id: string;
  symbol: string;
  price: number;
  condition: string;
  message: string;
  createdAt: string;
}

export default function App() {
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const [symbol, setSymbol] = useState("NIFTY");
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("linear");
  const [autoScale, setAutoScale] = useState(true);

  // Side Helper Tools state
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingType | null>(null);
  const [cursorMode, setCursorMode] = useState<CursorMode>("crosshair");
  const [magnetMode, setMagnetMode] = useState(false);
  const [stayInDrawingMode, setStayInDrawingMode] = useState(false);
  const [lockAllDrawings, setLockAllDrawings] = useState(false);
  const [hideDrawings, setHideDrawings] = useState(false);
  const [showFavoritesBar, setShowFavoritesBar] = useState(false);

  // Layout & Docking state
  const [activeRightTab, setActiveRightTab] = useState<RightRailTab>("watchlist");
  const [activeDockTab, setActiveDockTab] = useState<BottomDockTab>("trading");
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [dockMaximized, setDockMaximized] = useState(false);
  const [dockHeight, setDockHeight] = useState<number>(260);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(340);
  const [rightPanelCompact, setRightPanelCompact] = useState<boolean>(false);

  const isDraggingRightRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(340);

  function handleRightResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    isDraggingRightRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightPanelCompact ? 56 : rightPanelWidth;

    function onMouseMove(moveEvent: MouseEvent) {
      if (!isDraggingRightRef.current) return;
      const delta = startXRef.current - moveEvent.clientX;
      const newWidth = Math.max(56, Math.min(650, startWidthRef.current + delta));
      if (newWidth <= 120) {
        setRightPanelCompact(true);
      } else {
        setRightPanelCompact(false);
        setRightPanelWidth(newWidth);
      }
    }

    function onMouseUp() {
      isDraggingRightRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleToggleRightPanelCompact() {
    if (rightPanelCompact) {
      setRightPanelCompact(false);
      setRightPanelWidth((w) => (w < 200 ? 340 : w));
    } else {
      setRightPanelCompact(true);
    }
  }

  const isDraggingBottomRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(260);

  function handleBottomResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    isDraggingBottomRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = dockHeight;

    function onMouseMove(moveEvent: MouseEvent) {
      if (!isDraggingBottomRef.current) return;
      const delta = startYRef.current - moveEvent.clientY;
      const newHeight = Math.max(38, Math.min(window.innerHeight - 120, startHeightRef.current + delta));
      if (newHeight <= 60) {
        setDockCollapsed(true);
      } else {
        setDockCollapsed(false);
        setDockHeight(newHeight);
      }
    }

    function onMouseUp() {
      isDraggingBottomRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // Modals state
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [showIndicatorsModal, setShowIndicatorsModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  // Replay mode state
  const [replayActive, setReplayActive] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);

  // Live bar state
  const [currentBar, setCurrentBar] = useState<CandleSnapshot | null>(null);
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
  const lastBarTimeRef = useRef<number | null>(null);
  const lastBarRef = useRef<CandleSnapshot | null>(null);
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
      dataWorkerRef.current?.dispose();
      dataWorkerRef.current = null;
      indicatorWorkerRef.current?.dispose();
      indicatorWorkerRef.current = null;
    };
  }, []);

  // Historical load + reseed whenever symbol or timeframe changes
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
      if (batch.time.length > 0) {
        const lastIdx = batch.time.length - 1;
        lastBarTimeRef.current = batch.time[lastIdx]!;
        const latest: CandleSnapshot = {
          time: batch.time[lastIdx]!,
          open: batch.open[lastIdx]!,
          high: batch.high[lastIdx]!,
          low: batch.low[lastIdx]!,
          close: batch.close[lastIdx]!,
          volume: batch.volume[lastIdx]!,
        };
        lastBarRef.current = latest;
        setCurrentBar(latest);
      }
      indicatorWorker.seed(chart.getSeriesView());
      dataWorker.subscribeLive(symbol, timeframe);
    });

    return () => {
      cancelled = true;
      dataWorker.unsubscribeLive(symbol, timeframe);
    };
  }, [chart, symbol, timeframe]);

  // Load-more-history near left edge
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

  // Live tick stream
  useEffect(() => {
    if (!chart) return;
    const dataWorker = getDataWorker();
    const indicatorWorker = getIndicatorWorker();

    const offTick = dataWorker.onTick((tickSymbol, tickTf, candle) => {
      if (tickSymbol !== symbol || tickTf !== timeframe) return;
      paperEngine.onPrice(tickSymbol, candle.close);
      lastBarRef.current = candle;
      setCurrentBar(candle);

      const isNewBar = candle.time !== lastBarTimeRef.current;
      if (isNewBar) {
        chart.pushBar(candle);
        indicatorWorker.onBar(candle, false);
      } else {
        chart.updateLastBar(candle);
        indicatorWorker.onBar(candle, true);
      }
      lastBarTimeRef.current = candle.time;

      // Check alerts
      setAlerts((prevAlerts) =>
        prevAlerts.map((alt) => {
          if (alt.symbol === tickSymbol && Math.abs(candle.close - alt.price) <= 1.0) {
            // Alert triggered!
          }
          return alt;
        })
      );
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

  // Sync modes to chart engine
  useEffect(() => chart?.setTheme(themeName), [chart, themeName]);
  useEffect(() => chart?.setScaleMode(scaleMode), [chart, scaleMode]);
  useEffect(() => chart?.setAutoScale(autoScale), [chart, autoScale]);
  useEffect(() => chart?.armDrawingTool(activeDrawingTool), [chart, activeDrawingTool]);
  useEffect(() => chart?.setMagnetMode(magnetMode), [chart, magnetMode]);
  useEffect(() => chart?.setStayInDrawingMode(stayInDrawingMode), [chart, stayInDrawingMode]);
  useEffect(() => chart?.setLockAllDrawings(lockAllDrawings), [chart, lockAllDrawings]);
  useEffect(() => chart?.setHideDrawings(hideDrawings), [chart, hideDrawings]);
  useEffect(() => chart?.setCursorMode(cursorMode), [chart, cursorMode]);

  // Disarm tool once shape finishes placing (unless stayInDrawingMode is enabled)
  useEffect(() => {
    if (!chart) return;
    return chart.on("drawingToolDeactivated", () => {
      if (!stayInDrawingMode) setActiveDrawingTool(null);
    });
  }, [chart, stayInDrawingMode]);

  // Position and resting order lines on chart
  useEffect(() => {
    if (!chart) return;
    const lines: PriceLine[] = [];

    for (const position of book.positions) {
      if (position.symbol !== symbol) continue;
      lines.push({
        id: `pos-${position.symbol}-${position.product}`,
        price: position.averagePrice,
        color: position.quantity > 0 ? "#26a69a" : "#ef5350",
        label: `${position.quantity > 0 ? "LONG" : "SHORT"} ${Math.abs(position.quantity)}`,
        style: "solid",
        draggable: false,
      });
    }

    for (const order of book.orders) {
      if (order.symbol !== symbol) continue;
      if (order.status !== "open" && order.status !== "triggered") continue;
      const refPrice = order.triggerPrice ?? order.limitPrice;
      if (refPrice === undefined) continue;

      lines.push({
        id: `${ORDER_LINE_PREFIX}${order.id}`,
        price: refPrice,
        color: legColor(order),
        label: orderLineLabel(order),
        style: "dashed",
        draggable: true,
      });
    }

    // Add alert lines
    for (const alert of alerts) {
      if (alert.symbol === symbol) {
        lines.push({
          id: `alert-${alert.id}`,
          price: alert.price,
          color: "#f0b90b",
          label: `🔔 ${alert.condition}`,
          style: "dashed",
          draggable: true,
        });
      }
    }

    chart.setPriceLines(lines);
  }, [chart, book, symbol, alerts]);

  // Handle price line drag
  useEffect(() => {
    if (!chart) return;
    return chart.on("priceLineMoved", ({ id, price }) => {
      if (!id.startsWith(ORDER_LINE_PREFIX)) return;
      const orderId = id.slice(ORDER_LINE_PREFIX.length);
      const order = book.orders.find((o) => o.id === orderId);
      if (!order) return;
      const step = 0.05;
      const rounded = Math.round(price / step) * step;
      if (order.triggerPrice !== undefined && order.limitPrice !== undefined) {
        const offset = order.limitPrice - order.triggerPrice;
        paperEngine.modifyOrder(orderId, { triggerPrice: rounded, limitPrice: rounded + offset });
      } else if (order.triggerPrice !== undefined) {
        paperEngine.modifyOrder(orderId, { triggerPrice: rounded });
      } else {
        paperEngine.modifyOrder(orderId, { limitPrice: rounded });
      }
    });
  }, [chart, book, paperEngine]);

  // Quotes for watchlist: load initial quotes and subscribe to live ticks for all symbols in the active watchlist
  useEffect(() => {
    const dataWorker = getDataWorker();
    const activeList = watchlists.find((w) => w.id === activeWatchlistId);
    const symbols = activeList ? activeList.symbols : [];

    // 1. Fetch initial quote for every symbol immediately
    symbols.forEach((sym) => {
      dataWorker.getQuote(sym).then((q) => {
        setQuotes((prev) => {
          const next = new Map(prev);
          next.set(sym, {
            symbol: sym,
            ltp: q.ltp,
            change: q.change,
            changePercent: q.changePercent,
            volume: q.volume,
            high: q.high,
            low: q.low,
            open: q.open,
            prevClose: q.prevClose,
          });
          return next;
        });
      });
      // 2. Subscribe to live stream for each symbol
      dataWorker.subscribeLive(sym, timeframe);
    });

    // 3. Listen for incoming ticks
    const offTick = dataWorker.onTick((tickSymbol, _tf, candle) => {
      if (!symbols.includes(tickSymbol)) return;
      setQuotes((prev) => {
        const current = prev.get(tickSymbol);
        const prevClose = current ? current.prevClose : candle.open;
        const change = candle.close - prevClose;
        const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
        const next = new Map(prev);
        next.set(tickSymbol, {
          symbol: tickSymbol,
          ltp: candle.close,
          change,
          changePercent,
          volume: candle.volume,
          high: candle.high,
          low: candle.low,
          open: candle.open,
          prevClose,
        });
        return next;
      });
    });

    return () => {
      offTick();
      symbols.forEach((sym) => {
        if (sym !== symbol) {
          dataWorker.unsubscribeLive(sym, timeframe);
        }
      });
    };
  }, [watchlists, activeWatchlistId, timeframe, symbol]);

  // Replay loop
  useEffect(() => {
    if (!replayActive || !replayPlaying || !chart) return;
    const interval = setInterval(() => {
      handleReplayStep();
    }, 1000);
    return () => clearInterval(interval);
  }, [replayActive, replayPlaying, chart]);

  function handleReplayStep() {
    if (!chart) return;
    const series = chart.getSeriesView();
    if (series.length === 0) return;
    const lastClose = series.close[series.length - 1]!;
    const delta = (Math.random() - 0.49) * 2;
    const newClose = lastClose + delta;
    const newBar: CandleSnapshot = {
      time: (lastBarTimeRef.current || Math.floor(Date.now() / 1000)) + 60,
      open: lastClose,
      high: Math.max(lastClose, newClose) + Math.random(),
      low: Math.min(lastClose, newClose) - Math.random(),
      close: newClose,
      volume: Math.floor(Math.random() * 5000) + 500,
    };
    chart.pushBar(newBar);
    lastBarTimeRef.current = newBar.time;
    lastBarRef.current = newBar;
    setCurrentBar(newBar);
  }

  function handleTakeSnapshot() {
    const canvas = document.querySelector(".chart-canvas-host canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    try {
      const link = document.createElement("a");
      link.download = `${symbol}_${timeframe}_TradingView_Chart.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert("Chart screenshot copied or downloaded!");
    }
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

  async function runBenchmark(count: number): Promise<BenchmarkResult> {
    if (!chart) return { count, loadTimeMs: 0, renderTimeMs: 0, fps: 0, usedJSHeapMB: 0 };
    const dataWorker = getDataWorker();
    const t0 = performance.now();
    const batch = await dataWorker.loadHistory("BENCHMARK", timeframe, count);
    const t1 = performance.now();
    chart.setData(batch);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const t2 = performance.now();
    const perf = chart.getPerfSnapshot();
    dataWorker.loadHistory(symbol, timeframe, INITIAL_CANDLE_COUNT).then((restoreBatch) => chart.setData(restoreBatch));
    return { count, loadTimeMs: t1 - t0, renderTimeMs: t2 - t1, fps: perf.fps, usedJSHeapMB: perf.usedJSHeapMB };
  }

  return (
    <div className={`tv-app theme-${themeName}`}>
      {/* 1. Top Helper Tools Bar */}
      <TopBar
        symbol={symbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        chartType={chartType}
        onChartTypeChange={setChartType}
        themeName={themeName}
        onThemeToggle={() => setThemeName((t) => (t === "dark" ? "light" : "dark"))}
        onOpenSymbolSearch={() => setShowSymbolSearch(true)}
        onOpenIndicators={() => setShowIndicatorsModal(true)}
        onOpenAlerts={() => setShowAlertModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onTakeSnapshot={handleTakeSnapshot}
        onUndo={() => chart?.clearDrawings()}
        onRedo={() => {}}
        replayActive={replayActive}
        onToggleReplay={() => setReplayActive((v) => !v)}
      />

      {/* Replay Controls bar when active */}
      {replayActive && (
        <ReplayControls
          isPlaying={replayPlaying}
          onPlay={() => setReplayPlaying(true)}
          onPause={() => setReplayPlaying(false)}
          onStepForward={handleReplayStep}
          onClose={() => { setReplayActive(false); setReplayPlaying(false); }}
        />
      )}

      {/* 2. Main Middle Workspace */}
      <div className="tv-workspace">
        {/* Left Side Helper Toolbar */}
        <SideToolbar
          activeDrawingTool={activeDrawingTool}
          onSelectDrawingTool={setActiveDrawingTool}
          cursorMode={cursorMode}
          onSelectCursorMode={setCursorMode}
          magnetMode={magnetMode}
          onToggleMagnet={() => setMagnetMode((v) => !v)}
          stayInDrawingMode={stayInDrawingMode}
          onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
          lockAllDrawings={lockAllDrawings}
          onToggleLockAllDrawings={() => setLockAllDrawings((v) => !v)}
          hideDrawings={hideDrawings}
          onToggleHideDrawings={() => setHideDrawings((v) => !v)}
          onClearDrawings={() => chart?.clearDrawings()}
          onClearIndicators={() => activeIndicators.forEach((i) => handleRemoveIndicator(i.id))}
          onClearAll={() => {
            chart?.clearDrawings();
            activeIndicators.forEach((i) => handleRemoveIndicator(i.id));
          }}
          onZoomIn={() => chart?.fitAll()}
          onZoomOut={() => chart?.resetView()}
          showFavoritesBar={showFavoritesBar}
          onToggleFavoritesBar={() => setShowFavoritesBar((v) => !v)}
        />

        {/* Center: Chart Canvas + Overlay + Bottom Dock */}
        <div className="tv-chart-and-dock">
          <div className="tv-chart-viewport">
            <ChartContainer
              themeName={themeName}
              symbol={symbol}
              timeframe={timeframe}
              onReady={setChart}
              onDispose={() => setChart(null)}
              onCrosshairBar={(bar) => {
                if (bar) setCurrentBar(bar);
                else if (lastBarRef.current) setCurrentBar(lastBarRef.current);
              }}
              onPerf={(perf) => perfHudRef.current?.update(perf)}
            />

            {/* Sub-Header Floating Overlay Header with Live OHLC & Buy/Sell Widget */}
            <ChartOverlayHeader
              symbol={symbol}
              timeframe={timeframe}
              activeIndicators={activeIndicators}
              onToggleIndicator={handleToggleIndicator}
              onRemoveIndicator={handleRemoveIndicator}
              onPlaceOrder={(req) => paperEngine.placeOrder(req)}
              lastPrice={currentBar?.close ?? paperEngine.getLastPrice(symbol) ?? 0}
              currentBar={currentBar}
              volumeDisplay={currentBar ? `${(currentBar.volume / 1000).toFixed(2)} K` : "960.28 K"}
            />

            {/* Floating Favorites Toolbar */}
            {showFavoritesBar && (
              <FavoritesBar
                activeDrawingTool={activeDrawingTool}
                onSelectDrawingTool={setActiveDrawingTool}
                onSelectEraser={() => setCursorMode("eraser")}
                onClose={() => setShowFavoritesBar(false)}
              />
            )}

            <PerfHUD ref={perfHudRef} />
          </div>

          {/* Bottom Dock Tabs (Trading Panel, Pine Editor, Stock Screener, Strategy Tester) */}
          {activeDockTab !== null && (
            <div
              className={`tv-bottom-dock-content ${dockCollapsed ? "collapsed" : ""} ${dockMaximized ? "maximized" : ""}`}
              style={{ height: dockCollapsed ? 38 : (dockMaximized ? "65vh" : `${dockHeight}px`) }}
            >
              {/* Draggable Top Border Resizer */}
              <div
                className="tv-dock-resizer-top"
                onMouseDown={handleBottomResizeStart}
                onDoubleClick={() => setDockCollapsed(!dockCollapsed)}
                title="Drag to resize dock height (Double click to collapse/expand)"
              />
              {activeDockTab === "trading" && (
                <TradingDock
                  snapshot={book}
                  onClosePosition={(sym, product) => paperEngine.closePosition(sym, product)}
                  onCancelOrder={(orderId) => paperEngine.cancelOrder(orderId)}
                  onSquareOffAll={() => paperEngine.squareOffAll()}
                  onSelectSymbol={setSymbol}
                  collapsed={dockCollapsed}
                  onToggleCollapse={(c) => {
                    setDockCollapsed(c);
                    if (c) setDockMaximized(false);
                  }}
                  maximized={dockMaximized}
                  onToggleMaximize={() => {
                    setDockMaximized(!dockMaximized);
                    if (dockCollapsed) setDockCollapsed(false);
                  }}
                  onClose={() => setActiveDockTab(null)}
                />
              )}
              {activeDockTab === "pine" && (
                <PineEditor
                  collapsed={dockCollapsed}
                  onToggleCollapse={(c) => {
                    setDockCollapsed(c);
                    if (c) setDockMaximized(false);
                  }}
                  maximized={dockMaximized}
                  onToggleMaximize={() => {
                    setDockMaximized(!dockMaximized);
                    if (dockCollapsed) setDockCollapsed(false);
                  }}
                  onClose={() => setActiveDockTab(null)}
                />
              )}
              {activeDockTab === "screener" && (
                <StockScreener
                  onSelectSymbol={setSymbol}
                  collapsed={dockCollapsed}
                  onToggleCollapse={(c) => {
                    setDockCollapsed(c);
                    if (c) setDockMaximized(false);
                  }}
                  maximized={dockMaximized}
                  onToggleMaximize={() => {
                    setDockMaximized(!dockMaximized);
                    if (dockCollapsed) setDockCollapsed(false);
                  }}
                  onClose={() => setActiveDockTab(null)}
                />
              )}
              {activeDockTab === "strategy" && (
                <div className={`tv-dock-panel ${dockCollapsed ? "collapsed" : ""}`}>
                  <div className="tv-dock-header">
                    <div className="tv-dock-title">
                      <span>Strategy Tester & Benchmark</span>
                    </div>
                    <div className="tv-dock-actions">
                      <button
                        className="tv-dock-icon-btn"
                        onClick={() => {
                          setDockMaximized(!dockMaximized);
                          if (dockCollapsed) setDockCollapsed(false);
                        }}
                        title={dockMaximized ? "Restore Height" : "Maximize Panel"}
                      >
                        {dockMaximized ? "🗗" : "🗖"}
                      </button>
                      <button
                        className="tv-dock-icon-btn tv-dock-toggle-btn"
                        onClick={() => {
                          const next = !dockCollapsed;
                          setDockCollapsed(next);
                          if (next) setDockMaximized(false);
                        }}
                        title={dockCollapsed ? "Expand Panel (▲)" : "Collapse Panel (▼)"}
                      >
                        {dockCollapsed ? "▲" : "▼"}
                      </button>
                      <button className="tv-dock-icon-btn tv-dock-close-btn" onClick={() => setActiveDockTab(null)} title="Close Panel">✕</button>
                    </div>
                  </div>
                  {!dockCollapsed && <BenchmarkPanel onRun={runBenchmark} />}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Right Panel */}
        {activeRightTab !== null && (
          <div
            className={`tv-right-sidebar-panel ${rightPanelCompact ? "compact" : ""}`}
            style={{ width: rightPanelCompact ? 56 : rightPanelWidth }}
          >
            {/* Draggable Left Border Resizer & Floating Toggle Tab */}
            <div
              className="tv-panel-resizer-left"
              onMouseDown={handleRightResizeStart}
              onDoubleClick={handleToggleRightPanelCompact}
              title="Drag to resize panel (Double click to toggle compact mode)"
            >
              <button
                className="tv-panel-toggle-tab"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleRightPanelCompact();
                }}
                title={rightPanelCompact ? "Expand Panel (◀)" : "Collapse to Mini Bar (▶)"}
              >
                {rightPanelCompact ? "◀" : "▶"}
              </button>
            </div>

            <div className="tv-side-panel-header">
              <h3>
                {rightPanelCompact ? (
                  activeRightTab === "watchlist" ? "WL" : activeRightTab.slice(0, 3).toUpperCase()
                ) : (
                  <>
                    {activeRightTab === "watchlist" && "Watchlist & Details"}
                    {activeRightTab === "orders" && "Order Ticket & Account"}
                    {activeRightTab === "alerts" && "Alerts Manager"}
                    {activeRightTab === "datawindow" && "Data Window"}
                    {activeRightTab === "news" && "News Headlines"}
                    {activeRightTab === "hotlist" && "Hotlists"}
                    {activeRightTab === "objecttree" && "Object Tree"}
                  </>
                )}
              </h3>
              <div className="tv-side-panel-header-actions">
                <button
                  className="tv-panel-compact-toggle-btn"
                  onClick={handleToggleRightPanelCompact}
                  title={rightPanelCompact ? "Expand Panel (◀)" : "Collapse Panel (▶)"}
                >
                  {rightPanelCompact ? "◀" : "▶"}
                </button>
                <button className="tv-panel-close-btn" onClick={() => setActiveRightTab(null)} title="Close Panel">✕</button>
              </div>
            </div>

            <div className="tv-side-panel-body">
              {activeRightTab === "watchlist" && (
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
                  compact={rightPanelCompact}
                />
              )}

              {activeRightTab === "orders" && (
                <div className="tv-orders-wrapper">
                  <OrderTicket
                    symbol={symbol}
                    ltp={paperEngine.getLastPrice(symbol)}
                    availableBalance={book.account.availableBalance}
                    onPlace={(req) => paperEngine.placeOrder(req)}
                  />
                  <AccountPanel auth={auth} syncStatus={syncStatus} syncError={syncError} onResetBook={() => void resetBook()} />
                </div>
              )}

              {activeRightTab === "alerts" && (
                <div className="tv-alerts-list">
                  <button className="tv-btn-primary full-width" onClick={() => setShowAlertModal(true)}>
                    + New Alert
                  </button>
                  {alerts.length === 0 ? (
                    <div className="tv-empty-hint">No alerts created yet. Click "+ New Alert" to create one.</div>
                  ) : (
                    alerts.map((a) => (
                      <div key={a.id} className="tv-alert-card">
                        <div className="tv-alert-meta">
                          <b>{a.symbol}</b>
                          <span>{a.condition} {a.price.toFixed(2)}</span>
                        </div>
                        <div className="tv-alert-msg">{a.message}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeRightTab === "datawindow" && (
                <DataWindow symbol={symbol} bar={currentBar} indicators={activeIndicators} />
              )}

              {activeRightTab === "news" && <NewsFeed symbol={symbol} />}

              {activeRightTab === "hotlist" && <StockScreener onSelectSymbol={setSymbol} />}

              {activeRightTab === "objecttree" && (
                <div className="tv-object-tree">
                  <h4>Chart Layers</h4>
                  <div className="tv-tree-section">
                    <span className="tv-tree-cat">Indicators ({activeIndicators.length})</span>
                    {activeIndicators.map((ind) => (
                      <div key={ind.id} className="tv-tree-item">
                        <span>{ind.label}</span>
                        <button onClick={() => handleRemoveIndicator(ind.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="tv-tree-section">
                    <span className="tv-tree-cat">Drawings</span>
                    <button className="tv-btn-small" onClick={() => chart?.clearDrawings()}>Clear All</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Rail Icon Bar */}
        <RightRail activeTab={activeRightTab} onSelectTab={setActiveRightTab} />
      </div>

      {/* 3. Bottom Timeframe & Status Bar */}
      <BottomBar
        scaleMode={scaleMode}
        onScaleModeChange={setScaleMode}
        autoScale={autoScale}
        onToggleAutoScale={() => setAutoScale((v) => !v)}
        onFitAll={() => chart?.fitAll()}
        onReset={() => chart?.resetView()}
        activeDockTab={activeDockTab}
        onSelectDockTab={(tab) => {
          if (activeDockTab === tab) {
            if (dockCollapsed) {
              setDockCollapsed(false);
            } else {
              setActiveDockTab(null);
            }
          } else {
            setActiveDockTab(tab);
            setDockCollapsed(false);
          }
        }}
        onSelectRange={(_range) => chart?.fitAll()}
      />

      {/* Modals */}
      <SymbolSearchModal
        isOpen={showSymbolSearch}
        onClose={() => setShowSymbolSearch(false)}
        onSelectSymbol={setSymbol}
        currentSymbol={symbol}
      />

      <IndicatorsModal
        isOpen={showIndicatorsModal}
        onClose={() => setShowIndicatorsModal(false)}
        activeIndicators={activeIndicators}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
      />

      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        symbol={symbol}
        currentPrice={currentBar?.close ?? paperEngine.getLastPrice(symbol) ?? 0}
        onCreateAlert={(newAlert) => {
          setAlerts((prev) => [...prev, { ...newAlert, id: Date.now().toString(), createdAt: new Date().toLocaleTimeString() }]);
        }}
      />

      <ChartSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        scaleMode={scaleMode}
        onScaleModeChange={setScaleMode}
        autoScale={autoScale}
        onToggleAutoScale={() => setAutoScale((v) => !v)}
      />
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
