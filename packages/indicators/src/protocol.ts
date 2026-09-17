import { IndicatorConfig } from "./engine";
import { IndicatorType, OHLCVBar, OHLCVSeriesView } from "./types";

/**
 * Message protocol between the main thread and the indicator Web Worker.
 * Kept as plain, structured-cloneable/transferable data only (no class
 * instances) so it works unchanged across the postMessage boundary.
 */
export type IndicatorWorkerRequest =
  | { kind: "seed"; series: OHLCVSeriesView }
  | { kind: "add"; config: IndicatorConfig }
  | { kind: "remove"; id: string }
  | { kind: "setEnabled"; id: string; enabled: boolean }
  | { kind: "updateParams"; id: string; type: IndicatorType; params: Record<string, number> }
  | { kind: "bar"; bar: OHLCVBar; replacing: boolean };

export type IndicatorWorkerResponse =
  | { kind: "seeded"; outputs: Record<string, Record<string, Float64Array>> }
  | { kind: "updated"; outputs: Record<string, Record<string, number>>; replacing: boolean }
  | { kind: "error"; message: string };
