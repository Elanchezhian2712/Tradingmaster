import { CandleStore } from "../../data/CandleStore";
import { ChartTheme } from "../../theme";
import { Viewport } from "../../viewport/Viewport";
import { InstancedRectProgram } from "./InstancedRectProgram";

function pixelRectToClip(px: number, py: number, pw: number, ph: number, planeW: number, planeH: number): [number, number, number, number] {
  const x0 = (px / planeW) * 2 - 1;
  const x1 = ((px + pw) / planeW) * 2 - 1;
  const yTop = 1 - (py / planeH) * 2;
  const yBottom = 1 - ((py + ph) / planeH) * 2;
  return [x0, yBottom, x1 - x0, yTop - yBottom];
}

const WICK_WIDTH_PX = 1;

export class WebGLCandleRenderer {
  private gl: WebGL2RenderingContext;
  private program: InstancedRectProgram;
  private planeWidth = 0;
  private planeHeight = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not supported in this browser");
    this.gl = gl;
    this.program = new InstancedRectProgram(gl);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.planeWidth = cssWidth;
    this.planeHeight = cssHeight;
    this.gl.viewport(0, 0, w, h);
  }

  clear(bg: [number, number, number]): void {
    const gl = this.gl;
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Renders candle wicks + bodies for the visible range, and volume bars if a volume pane rect is given. */
  renderCandles(store: CandleStore, viewport: Viewport, theme: ChartTheme, volumePaneId: string | null): void {
    const { start, end } = viewport.visibleIndexRange();
    const firstIdx = Math.max(0, Math.floor(start));
    const lastIdx = Math.min(store.length - 1, Math.ceil(end));
    if (firstIdx > lastIdx) return;

    const view = store.toSeriesView();
    const candleWidthPx = viewport.getCandleWidth();
    const bodyWidthPx = Math.max(1, candleWidthPx * 0.7);

    const count = lastIdx - firstIdx + 1;
    const wickData = new Float32Array(count * 5);
    const bodyData = new Float32Array(count * 5);

    const mainRect = viewport.getPaneRect("main");
    if (!mainRect) return;

    for (let i = firstIdx, w = 0, b = 0; i <= lastIdx; i++) {
      const o = view.open[i]!;
      const h = view.high[i]!;
      const l = view.low[i]!;
      const c = view.close[i]!;
      const up = c >= o;
      const colorFlag = up ? 1 : 0;

      const centerX = viewport.indexToX(i) + candleWidthPx / 2;
      const yHigh = viewport.priceToY(h, "main");
      const yLow = viewport.priceToY(l, "main");
      const yOpen = viewport.priceToY(o, "main");
      const yClose = viewport.priceToY(c, "main");

      const [wx, wy, ww, wh] = pixelRectToClip(centerX - WICK_WIDTH_PX / 2, yHigh, WICK_WIDTH_PX, Math.max(1, yLow - yHigh), this.planeWidth, this.planeHeight);
      wickData[w++] = wx;
      wickData[w++] = wy;
      wickData[w++] = ww;
      wickData[w++] = wh;
      wickData[w++] = colorFlag;

      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
      const [bx, by, bw, bh] = pixelRectToClip(
        centerX - bodyWidthPx / 2,
        bodyTop,
        bodyWidthPx,
        bodyHeight,
        this.planeWidth,
        this.planeHeight
      );
      bodyData[b++] = bx;
      bodyData[b++] = by;
      bodyData[b++] = bw;
      bodyData[b++] = bh;
      bodyData[b++] = colorFlag;
    }

    if (volumePaneId) {
      const volRect = viewport.getPaneRect(volumePaneId);
      if (volRect) {
        const volData = new Float32Array(count * 5);
        const maxVol = store.maxVolume(firstIdx, lastIdx) || 1;
        viewport.setPaneRange(volumePaneId, { min: 0, max: maxVol });
        for (let i = firstIdx, v = 0; i <= lastIdx; i++) {
          const o = view.open[i]!;
          const c = view.close[i]!;
          const colorFlag = c >= o ? 1 : 0;
          const centerX = viewport.indexToX(i) + candleWidthPx / 2;
          const yTop = viewport.priceToY(view.volume[i]!, volumePaneId);
          const yBase = volRect.top + volRect.height;
          const [vx, vy, vw, vh] = pixelRectToClip(centerX - bodyWidthPx / 2, yTop, bodyWidthPx, Math.max(1, yBase - yTop), this.planeWidth, this.planeHeight);
          volData[v++] = vx;
          volData[v++] = vy;
          volData[v++] = vw;
          volData[v++] = vh;
          volData[v++] = colorFlag;
        }
        this.program.draw(volData, count, hexToTuple(theme.volumeUpColor), hexToTuple(theme.volumeDownColor), 0.55);
      }
    }

    this.program.draw(wickData, count, theme.wickUpColor, theme.wickDownColor, 1);
    this.program.draw(bodyData, count, theme.upColor, theme.downColor, 1);
  }

  dispose(): void {
    this.program.dispose();
  }
}

function hexToTuple(_rgbaString: string): [number, number, number] {
  // Volume colors are defined as rgba() strings for the canvas2d overlay;
  // for the WebGL pass we only need the RGB component with a fixed alpha.
  const match = /rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(_rgbaString);
  if (!match) return [0.5, 0.5, 0.5];
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}
