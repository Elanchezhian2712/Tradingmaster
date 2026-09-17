import { forwardRef, useImperativeHandle, useRef } from "react";
import { CandleSnapshot } from "@trading-master/market-data";

export interface OhlcReadoutHandle {
  update: (bar: CandleSnapshot | null) => void;
}

/** Updated directly from crosshair-move events, bypassing React state so mouse movement never triggers a re-render. */
export const OhlcReadout = forwardRef<OhlcReadoutHandle>(function OhlcReadout(_props, ref) {
  const root = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    update(bar) {
      if (!root.current) return;
      if (!bar) {
        root.current.style.visibility = "hidden";
        return;
      }
      root.current.style.visibility = "visible";
      const up = bar.close >= bar.open;
      root.current.innerHTML = `
        <span class="ohlc-item">O <b>${bar.open.toFixed(2)}</b></span>
        <span class="ohlc-item">H <b>${bar.high.toFixed(2)}</b></span>
        <span class="ohlc-item">L <b>${bar.low.toFixed(2)}</b></span>
        <span class="ohlc-item ${up ? "up" : "down"}">C <b>${bar.close.toFixed(2)}</b></span>
        <span class="ohlc-item">Vol <b>${Math.round(bar.volume).toLocaleString()}</b></span>
      `;
    },
  }));

  return <div ref={root} className="ohlc-readout" style={{ visibility: "hidden" }} />;
});
