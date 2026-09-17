export interface InteractionCallbacks {
  /** Left button pressed down. */
  onDragStart: (x: number, y: number) => void;
  /** Mouse moved while the left button is held; `dxPixels` is the delta since the last move. */
  onDragMove: (x: number, y: number, dxPixels: number) => void;
  /** Left button released (always paired with a preceding onDragStart). */
  onDragEnd: (x: number, y: number) => void;
  onZoom: (pixelX: number, factor: number) => void;
  onCrosshairMove: (x: number, y: number) => void;
  onCrosshairLeave: () => void;
  onResize: (width: number, height: number) => void;
  onDoubleClick: (x: number, y: number) => void;
}

const WHEEL_ZOOM_FACTOR = 1.1;

/**
 * Translates raw DOM pointer/wheel/resize events into chart-space
 * intents. Deliberately has no opinion on what a drag *means* (pan vs.
 * placing a drawing point) — that policy lives in ChartEngine, which is
 * the only thing that knows whether a drawing tool is currently armed.
 */
export class InteractionController {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver: ResizeObserver;

  constructor(private container: HTMLElement, private callbacks: InteractionCallbacks) {
    container.addEventListener("pointerdown", this.handlePointerDown);
    container.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    container.addEventListener("pointerleave", this.handlePointerLeave);
    container.addEventListener("wheel", this.handleWheel, { passive: false });
    container.addEventListener("dblclick", this.handleDoubleClick);
    container.addEventListener("contextmenu", this.preventContextMenu);

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      this.callbacks.onResize(width, height);
    });
    this.resizeObserver.observe(container);
  }

  private localXY(e: PointerEvent | MouseEvent): [number, number] {
    const rect = this.container.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private preventContextMenu = (e: Event) => e.preventDefault();

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const [x, y] = this.localXY(e);
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
    this.callbacks.onDragStart(x, y);
  };

  private handlePointerMove = (e: PointerEvent) => {
    const [x, y] = this.localXY(e);
    if (this.dragging && e.buttons === 1) {
      const dx = x - this.lastX;
      this.callbacks.onDragMove(x, y, dx);
      this.lastX = x;
      this.lastY = y;
    }
    this.callbacks.onCrosshairMove(x, y);
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.dragging) return;
    const [x, y] = this.localXY(e);
    this.dragging = false;
    this.callbacks.onDragEnd(x, y);
  };

  private handlePointerLeave = () => {
    this.callbacks.onCrosshairLeave();
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const [x] = this.localXY(e);
    const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    this.callbacks.onZoom(x, factor);
  };

  private handleDoubleClick = (e: MouseEvent) => {
    const [x, y] = this.localXY(e);
    this.callbacks.onDoubleClick(x, y);
  };

  dispose(): void {
    this.container.removeEventListener("pointerdown", this.handlePointerDown);
    this.container.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    this.container.removeEventListener("pointerleave", this.handlePointerLeave);
    this.container.removeEventListener("wheel", this.handleWheel);
    this.container.removeEventListener("dblclick", this.handleDoubleClick);
    this.container.removeEventListener("contextmenu", this.preventContextMenu);
    this.resizeObserver.disconnect();
  }
}
