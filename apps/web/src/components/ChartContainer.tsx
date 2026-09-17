import { useEffect, useRef } from "react";
import { CandleSnapshot, Timeframe } from "@trading-master/market-data";
import { ChartEngine, PerfSnapshot, ThemeName } from "@trading-master/chart-engine";

export interface ChartContainerProps {
  themeName: ThemeName;
  symbol: string;
  timeframe: Timeframe;
  onReady: (chart: ChartEngine) => void;
  onDispose: () => void;
  onCrosshairBar: (bar: CandleSnapshot | null) => void;
  onPerf: (perf: PerfSnapshot) => void;
}

/**
 * Mounts one ChartEngine instance imperatively and never re-renders it.
 * All chart mutations after mount (new data, indicator updates, theme
 * changes) go through the ChartEngine's own imperative API, not through
 * React props/state, so React's reconciler stays out of the hot path.
 */
export function ChartContainer(props: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = new ChartEngine(containerRef.current, {
      theme: latest.current.themeName,
      symbol: latest.current.symbol,
      timeframe: latest.current.timeframe,
    });

    const offCrosshair = chart.on("crosshair", (bar) => latest.current.onCrosshairBar(bar));
    const offPerf = chart.on("perf", (perf) => latest.current.onPerf(perf));

    latest.current.onReady(chart);

    return () => {
      offCrosshair();
      offPerf();
      chart.dispose();
      latest.current.onDispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="chart-canvas-host" />;
}
