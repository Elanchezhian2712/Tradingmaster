import { useState } from "react";
import { INDICATOR_CATALOG } from "../indicatorCatalog";
import { ActiveIndicator } from "../types";

export interface IndicatorPanelProps {
  active: ActiveIndicator[];
  onAdd: (type: (typeof INDICATOR_CATALOG)[number]["type"]) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

export function IndicatorPanel(props: IndicatorPanelProps) {
  const [selected, setSelected] = useState(INDICATOR_CATALOG[0]!.type);

  return (
    <div className="indicator-panel">
      <div className="panel-title">Indicators</div>
      <div className="indicator-add-row">
        <select value={selected} onChange={(e) => setSelected(e.target.value as typeof selected)}>
          {INDICATOR_CATALOG.map((entry) => (
            <option key={entry.type} value={entry.type}>
              {entry.label}
            </option>
          ))}
        </select>
        <button className="icon-btn" onClick={() => props.onAdd(selected)}>
          + Add
        </button>
      </div>
      <ul className="indicator-list">
        {props.active.map((ind) => (
          <li key={ind.id} className="indicator-row">
            <label>
              <input type="checkbox" checked={ind.enabled} onChange={(e) => props.onToggle(ind.id, e.target.checked)} />
              {ind.label}
            </label>
            <button className="icon-btn small" onClick={() => props.onRemove(ind.id)}>
              ✕
            </button>
          </li>
        ))}
        {props.active.length === 0 && <li className="indicator-empty">No indicators added</li>}
      </ul>
    </div>
  );
}
