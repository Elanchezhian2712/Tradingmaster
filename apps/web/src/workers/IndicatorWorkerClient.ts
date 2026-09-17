import { GrowableFloat64, IndicatorConfig, IndicatorType, IndicatorWorkerRequest, IndicatorWorkerResponse, OHLCVBar, OHLCVSeriesView } from "@trading-master/indicators";

type OutputsChangedListener = (id: string) => void;

/**
 * Runs the indicator engine in a Web Worker so historical seeding (a full
 * recompute over up to 500k bars) and per-tick updates never block the
 * main thread. Mirrors each indicator's output as growable typed arrays
 * on the main thread so the renderer can read a plain Float64Array
 * without round-tripping the whole series on every tick.
 */
export class IndicatorWorkerClient {
  private worker: Worker;
  private outputs = new Map<string, Record<string, GrowableFloat64>>();
  private listeners = new Set<OutputsChangedListener>();

  constructor() {
    this.worker = new Worker(new URL("./indicatorWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<IndicatorWorkerResponse>) => this.handleMessage(event.data);
    this.worker.onerror = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error("[indicatorWorker] uncaught error", event.message, event.filename, event.lineno);
    };
  }

  private send(req: IndicatorWorkerRequest): void {
    this.worker.postMessage(req);
  }

  private handleMessage(msg: IndicatorWorkerResponse): void {
    if (msg.kind === "seeded") {
      for (const [id, output] of Object.entries(msg.outputs)) {
        const mirrored: Record<string, GrowableFloat64> = {};
        for (const [key, values] of Object.entries(output)) {
          mirrored[key] = new GrowableFloat64(values);
        }
        this.outputs.set(id, mirrored);
        this.notify(id);
      }
    } else if (msg.kind === "updated") {
      for (const [id, values] of Object.entries(msg.outputs)) {
        const mirrored = this.outputs.get(id);
        if (!mirrored) continue;
        for (const [key, value] of Object.entries(values)) {
          if (msg.replacing) mirrored[key]?.replaceLast(value);
          else mirrored[key]?.push(value);
        }
        this.notify(id);
      }
    } else if (msg.kind === "error") {
      // eslint-disable-next-line no-console
      console.error("[indicatorWorker]", msg.message);
    }
  }

  private notify(id: string): void {
    for (const l of this.listeners) l(id);
  }

  onOutputsChanged(listener: OutputsChangedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  seed(series: OHLCVSeriesView): void {
    this.send({ kind: "seed", series });
  }

  add(config: IndicatorConfig): void {
    this.send({ kind: "add", config });
  }

  remove(id: string): void {
    this.outputs.delete(id);
    this.send({ kind: "remove", id });
  }

  setEnabled(id: string, enabled: boolean): void {
    this.send({ kind: "setEnabled", id, enabled });
  }

  updateParams(id: string, type: IndicatorType, params: Record<string, number>): void {
    this.send({ kind: "updateParams", id, type, params });
  }

  onBar(bar: OHLCVBar, replacing: boolean): void {
    this.send({ kind: "bar", bar, replacing });
  }

  getOutput(id: string): Record<string, Float64Array> | null {
    const mirrored = this.outputs.get(id);
    if (!mirrored) return null;
    const out: Record<string, Float64Array> = {};
    for (const [key, growable] of Object.entries(mirrored)) out[key] = growable.view();
    return out;
  }

  dispose(): void {
    this.worker.terminate();
  }
}
