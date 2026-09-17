import { useImperativeHandle, forwardRef, useRef } from "react";
import { PerfSnapshot } from "@trading-master/chart-engine";

export interface PerfHUDHandle {
  update: (perf: PerfSnapshot) => void;
}

/**
 * Perf counters update many times per second while panning/zooming. Piping
 * that through useState would re-render this whole subtree every frame,
 * so instead the parent calls `update()` on this ref and we write straight
 * into the DOM text nodes, bypassing React entirely for this hot path.
 */
export const PerfHUD = forwardRef<PerfHUDHandle>(function PerfHUD(_props, ref) {
  const fps = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const render = useRef<HTMLSpanElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const visible = useRef<HTMLSpanElement>(null);
  const total = useRef<HTMLSpanElement>(null);
  const heap = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    update(perf: PerfSnapshot) {
      if (fps.current) fps.current.textContent = perf.fps.toFixed(1);
      if (frame.current) frame.current.textContent = `${perf.avgFrameTimeMs.toFixed(2)}ms`;
      if (render.current) render.current.textContent = `${perf.renderTimeMs.toFixed(2)}ms`;
      if (indicator.current) indicator.current.textContent = `${perf.indicatorTimeMs.toFixed(2)}ms`;
      if (visible.current) visible.current.textContent = String(perf.visibleCandles);
      if (total.current) total.current.textContent = String(perf.totalCandles);
      if (heap.current) heap.current.textContent = perf.usedJSHeapMB !== null ? `${perf.usedJSHeapMB.toFixed(1)}MB` : "n/a";
    },
  }));

  return (
    <div className="perf-hud">
      <div className="perf-row">
        <span className="perf-label">FPS</span>
        <span ref={fps} className="perf-value">
          0
        </span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Frame</span>
        <span ref={frame} className="perf-value">
          0ms
        </span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Render</span>
        <span ref={render} className="perf-value">
          0ms
        </span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Indicators</span>
        <span ref={indicator} className="perf-value">
          0ms
        </span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Visible</span>
        <span ref={visible} className="perf-value">
          0
        </span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Total</span>
        <span ref={total} className="perf-value">
          0
        </span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Heap</span>
        <span ref={heap} className="perf-value">
          n/a
        </span>
      </div>
    </div>
  );
});
