/// <reference lib="webworker" />
import { IndicatorEngine, IndicatorWorkerRequest, IndicatorWorkerResponse } from "@trading-master/indicators";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const engine = new IndicatorEngine();

function collectOutputs(): Record<string, Record<string, Float64Array>> {
  const out: Record<string, Record<string, Float64Array>> = {};
  for (const info of engine.list()) {
    const output = engine.getOutput(info.id);
    if (output) out[info.id] = output;
  }
  return out;
}

function post(msg: IndicatorWorkerResponse): void {
  ctx.postMessage(msg);
}

ctx.onmessage = (event: MessageEvent<IndicatorWorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.kind) {
      case "seed":
        engine.seedAll(req.series);
        post({ kind: "seeded", outputs: collectOutputs() });
        break;
      case "add":
        engine.add(req.config);
        post({ kind: "seeded", outputs: collectOutputs() });
        break;
      case "remove":
        engine.remove(req.id);
        break;
      case "setEnabled":
        engine.setEnabled(req.id, req.enabled);
        break;
      case "updateParams":
        engine.updateParams(req.id, req.type, req.params);
        post({ kind: "seeded", outputs: collectOutputs() });
        break;
      case "bar": {
        engine.onBar(req.bar, req.replacing);
        const outputs: Record<string, Record<string, number>> = {};
        for (const info of engine.list()) {
          const output = engine.getOutput(info.id);
          if (!output) continue;
          const last: Record<string, number> = {};
          for (const key of Object.keys(output)) {
            const arr = output[key]!;
            last[key] = arr[arr.length - 1] ?? NaN;
          }
          outputs[info.id] = last;
        }
        post({ kind: "updated", outputs, replacing: req.replacing });
        break;
      }
    }
  } catch (err) {
    post({ kind: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
