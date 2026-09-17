import { DrawingType } from "@trading-master/chart-engine";
import {
  IconTrendline,
  IconHLine,
  IconFib,
  IconRectangle,
  IconLongPosition,
  IconBrush,
  IconEraser,
  IconRuler,
} from "./icons";

export interface FavoritesBarProps {
  activeDrawingTool: DrawingType | null;
  onSelectDrawingTool: (tool: DrawingType | null) => void;
  onSelectEraser: () => void;
  onClose: () => void;
}

export function FavoritesBar(props: FavoritesBarProps) {
  const favoriteTools: { type: DrawingType; icon: React.ReactNode; label: string }[] = [
    { type: "trend-line", icon: <IconTrendline />, label: "Trend Line" },
    { type: "horizontal-line", icon: <IconHLine />, label: "Horizontal Line" },
    { type: "fib-retracement", icon: <IconFib />, label: "Fib Retracement" },
    { type: "brush", icon: <IconBrush />, label: "Brush" },
    { type: "rectangle", icon: <IconRectangle />, label: "Rectangle" },
    { type: "long-position", icon: <IconLongPosition />, label: "Long Position" },
    { type: "measure", icon: <IconRuler />, label: "Measure" },
  ];

  return (
    <div className="tv-favorites-bar">
      <div className="tv-fav-drag-handle">⋮⋮</div>
      {favoriteTools.map((t) => (
        <button
          key={t.type}
          className={`tv-fav-tool-btn ${props.activeDrawingTool === t.type ? "active" : ""}`}
          title={t.label}
          onClick={() => props.onSelectDrawingTool(props.activeDrawingTool === t.type ? null : t.type)}
        >
          {t.icon}
        </button>
      ))}
      <button
        className="tv-fav-tool-btn"
        title="Eraser"
        onClick={props.onSelectEraser}
      >
        <IconEraser />
      </button>
      <button className="tv-fav-close-btn" onClick={props.onClose} title="Hide Favorite Toolbar">
        ✕
      </button>
    </div>
  );
}
