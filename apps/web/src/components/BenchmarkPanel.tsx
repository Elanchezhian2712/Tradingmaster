import { useState } from "react";

export interface BenchmarkResult {
  count: number;
  loadTimeMs: number;
  renderTimeMs: number;
  fps: number;
  usedJSHeapMB: number | null;
}

export interface BenchmarkPanelProps {
  onRun: (count: number) => Promise<BenchmarkResult>;
}

const SCENARIOS = [10_000, 50_000, 100_000, 500_000];

export function BenchmarkPanel(props: BenchmarkPanelProps) {
  const [results, setResults] = useState<Record<number, BenchmarkResult>>({});
  const [running, setRunning] = useState<number | null>(null);

  async function runOne(count: number) {
    setRunning(count);
    try {
      const result = await props.onRun(count);
      setResults((prev) => ({ ...prev, [count]: result }));
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    for (const count of SCENARIOS) {
      // eslint-disable-next-line no-await-in-loop
      await runOne(count);
    }
  }

  return (
    <div className="benchmark-panel">
      <div className="panel-title">Performance Benchmark</div>
      <div className="benchmark-actions">
        <button className="icon-btn" onClick={runAll} disabled={running !== null}>
          Run all scenarios
        </button>
      </div>
      <table className="benchmark-table">
        <thead>
          <tr>
            <th>Candles</th>
            <th>Load (ms)</th>
            <th>Render (ms)</th>
            <th>FPS</th>
            <th>Heap</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {SCENARIOS.map((count) => {
            const r = results[count];
            return (
              <tr key={count}>
                <td>{count.toLocaleString()}</td>
                <td>{r ? r.loadTimeMs.toFixed(1) : "—"}</td>
                <td>{r ? r.renderTimeMs.toFixed(1) : "—"}</td>
                <td>{r ? r.fps.toFixed(1) : "—"}</td>
                <td>{r?.usedJSHeapMB != null ? `${r.usedJSHeapMB.toFixed(1)}MB` : "—"}</td>
                <td>
                  <button className="icon-btn small" disabled={running !== null} onClick={() => runOne(count)}>
                    {running === count ? "…" : "Run"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
