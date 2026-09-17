import { useState } from "react";
import { DrawingType } from "@trading-master/chart-engine";
import {
  IconCrosshair,
  IconDot,
  IconArrowCursor,
  IconEraser,
  IconTrendline,
  IconRay,
  IconHLine,
  IconVLine,
  IconChannel,
  IconFib,
  IconBrush,
  IconHighlighter,
  IconRectangle,
  IconCircle,
  IconText,
  IconCallout,
  IconPriceLabel,
  IconLongPosition,
  IconShortPosition,
  IconRuler,
  IconZoomIn,
  IconMagnet,
  IconStayInDrawing,
  IconLock,
  IconEye,
  IconEyeClosed,
  IconTrash,
  IconSmiley,
  IconChevronRight,
  IconStar,
} from "./icons";

export type CursorMode = "crosshair" | "dot" | "arrow" | "eraser";

export interface SideToolbarProps {
  activeDrawingTool: DrawingType | null;
  onSelectDrawingTool: (tool: DrawingType | null) => void;
  cursorMode: CursorMode;
  onSelectCursorMode: (mode: CursorMode) => void;
  magnetMode: boolean;
  onToggleMagnet: () => void;
  stayInDrawingMode: boolean;
  onToggleStayInDrawingMode: () => void;
  lockAllDrawings: boolean;
  onToggleLockAllDrawings: () => void;
  hideDrawings: boolean;
  onToggleHideDrawings: () => void;
  onClearDrawings: () => void;
  onClearIndicators: () => void;
  onClearAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showFavoritesBar: boolean;
  onToggleFavoritesBar: () => void;
}

interface ToolGroupItem {
  type: DrawingType;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

export function SideToolbar(props: SideToolbarProps) {
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const [selectedTrendTool, setSelectedTrendTool] = useState<DrawingType>("trend-line");
  const [selectedFibTool, setSelectedFibTool] = useState<DrawingType>("fib-retracement");
  const [selectedShapeTool, setSelectedShapeTool] = useState<DrawingType>("brush");
  const [selectedTextTool, setSelectedTextTool] = useState<DrawingType>("text");
  const [selectedPredictTool, setSelectedPredictTool] = useState<DrawingType>("long-position");

  const trendTools: ToolGroupItem[] = [
    { type: "trend-line", label: "Trend Line", icon: <IconTrendline />, shortcut: "Alt+T" },
    { type: "ray", label: "Ray", icon: <IconRay /> },
    { type: "horizontal-line", label: "Horizontal Line", icon: <IconHLine />, shortcut: "Alt+H" },
    { type: "horizontal-ray", label: "Horizontal Ray", icon: <IconRay />, shortcut: "Alt+J" },
    { type: "vertical-line", label: "Vertical Line", icon: <IconVLine />, shortcut: "Alt+V" },
    { type: "parallel-channel", label: "Parallel Channel", icon: <IconChannel /> },
    { type: "horizontal-channel", label: "Horizontal Channel", icon: <IconChannel /> },
  ];

  const fibTools: ToolGroupItem[] = [
    { type: "fib-retracement", label: "Fib Retracement", icon: <IconFib />, shortcut: "Alt+F" },
    { type: "fib-extension", label: "Trend-Based Fib Extension", icon: <IconFib /> },
  ];

  const shapeTools: ToolGroupItem[] = [
    { type: "brush", label: "Brush", icon: <IconBrush /> },
    { type: "highlighter", label: "Highlighter", icon: <IconHighlighter /> },
    { type: "rectangle", label: "Rectangle", icon: <IconRectangle /> },
    { type: "circle", label: "Circle", icon: <IconCircle /> },
  ];

  const textTools: ToolGroupItem[] = [
    { type: "text", label: "Text", icon: <IconText /> },
    { type: "callout", label: "Callout", icon: <IconCallout /> },
    { type: "price-label", label: "Price Label", icon: <IconPriceLabel /> },
  ];

  const predictTools: ToolGroupItem[] = [
    { type: "long-position", label: "Long Position", icon: <IconLongPosition /> },
    { type: "short-position", label: "Short Position", icon: <IconShortPosition /> },
    { type: "price-range", label: "Price Range", icon: <IconPriceLabel /> },
    { type: "date-range", label: "Date Range", icon: <IconChannel /> },
  ];

  const emojis = ["🐂", "🐻", "🚀", "🔥", "🎯", "⭐", "✅", "⚠️", "❤️", "👍"];

  function handleSelectTool(tool: DrawingType) {
    if (props.activeDrawingTool === tool) {
      props.onSelectDrawingTool(null);
    } else {
      props.onSelectDrawingTool(tool);
    }
    setOpenFlyout(null);
  }

  return (
    <aside className="tv-sidetoolbar" onMouseLeave={() => setOpenFlyout(null)}>
      {/* 1. Cursor modes */}
      <div className="tv-sidetool-group">
        <div className="tv-tool-btn-wrap">
          <button
            className={`tv-tool-btn ${props.cursorMode !== "crosshair" ? "active" : ""}`}
            title="Cursor / Crosshair Mode"
            onClick={() => setOpenFlyout(openFlyout === "cursor" ? null : "cursor")}
          >
            {props.cursorMode === "crosshair" && <IconCrosshair />}
            {props.cursorMode === "dot" && <IconDot />}
            {props.cursorMode === "arrow" && <IconArrowCursor />}
            {props.cursorMode === "eraser" && <IconEraser />}
            <span className="tv-sub-arrow">▶</span>
          </button>

          {openFlyout === "cursor" && (
            <div className="tv-flyout-menu">
              <div className={`tv-flyout-item ${props.cursorMode === "crosshair" ? "selected" : ""}`} onClick={() => { props.onSelectCursorMode("crosshair"); setOpenFlyout(null); }}>
                <IconCrosshair />
                <span>Crosshair</span>
              </div>
              <div className={`tv-flyout-item ${props.cursorMode === "dot" ? "selected" : ""}`} onClick={() => { props.onSelectCursorMode("dot"); setOpenFlyout(null); }}>
                <IconDot />
                <span>Dot</span>
              </div>
              <div className={`tv-flyout-item ${props.cursorMode === "arrow" ? "selected" : ""}`} onClick={() => { props.onSelectCursorMode("arrow"); setOpenFlyout(null); }}>
                <IconArrowCursor />
                <span>Arrow</span>
              </div>
              <div className={`tv-flyout-item ${props.cursorMode === "eraser" ? "selected" : ""}`} onClick={() => { props.onSelectCursorMode("eraser"); setOpenFlyout(null); }}>
                <IconEraser />
                <span>Eraser (Click drawing to delete)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tv-side-divider" />

      {/* 2. Trendline tools */}
      <div className="tv-sidetool-group">
        <div className="tv-tool-btn-wrap">
          <button
            className={`tv-tool-btn ${props.activeDrawingTool && trendTools.some(t => t.type === props.activeDrawingTool) ? "active" : ""}`}
            title="Trend Line Tools"
            onClick={() => handleSelectTool(selectedTrendTool)}
            onContextMenu={(e) => { e.preventDefault(); setOpenFlyout("trend"); }}
          >
            {selectedTrendTool === "trend-line" && <IconTrendline />}
            {selectedTrendTool === "ray" && <IconRay />}
            {selectedTrendTool === "horizontal-line" && <IconHLine />}
            {selectedTrendTool === "horizontal-ray" && <IconRay />}
            {selectedTrendTool === "vertical-line" && <IconVLine />}
            {selectedTrendTool === "parallel-channel" && <IconChannel />}
            <span className="tv-sub-arrow" onClick={(e) => { e.stopPropagation(); setOpenFlyout(openFlyout === "trend" ? null : "trend"); }}>▶</span>
          </button>

          {openFlyout === "trend" && (
            <div className="tv-flyout-menu">
              <div className="tv-flyout-header">Lines & Channels</div>
              {trendTools.map((t) => (
                <div
                  key={t.type}
                  className={`tv-flyout-item ${props.activeDrawingTool === t.type ? "selected" : ""}`}
                  onClick={() => { setSelectedTrendTool(t.type); handleSelectTool(t.type); }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.shortcut && <kbd className="tv-shortcut">{t.shortcut}</kbd>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Fibonacci & Gann */}
        <div className="tv-tool-btn-wrap">
          <button
            className={`tv-tool-btn ${props.activeDrawingTool && fibTools.some(t => t.type === props.activeDrawingTool) ? "active" : ""}`}
            title="Gann and Fibonacci Tools"
            onClick={() => handleSelectTool(selectedFibTool)}
          >
            <IconFib />
            <span className="tv-sub-arrow" onClick={(e) => { e.stopPropagation(); setOpenFlyout(openFlyout === "fib" ? null : "fib"); }}>▶</span>
          </button>

          {openFlyout === "fib" && (
            <div className="tv-flyout-menu">
              <div className="tv-flyout-header">Fibonacci</div>
              {fibTools.map((t) => (
                <div
                  key={t.type}
                  className={`tv-flyout-item ${props.activeDrawingTool === t.type ? "selected" : ""}`}
                  onClick={() => { setSelectedFibTool(t.type); handleSelectTool(t.type); }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.shortcut && <kbd className="tv-shortcut">{t.shortcut}</kbd>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Geometric Shapes & Brush */}
        <div className="tv-tool-btn-wrap">
          <button
            className={`tv-tool-btn ${props.activeDrawingTool && shapeTools.some(t => t.type === props.activeDrawingTool) ? "active" : ""}`}
            title="Geometric Shapes & Brush"
            onClick={() => handleSelectTool(selectedShapeTool)}
          >
            {selectedShapeTool === "brush" && <IconBrush />}
            {selectedShapeTool === "highlighter" && <IconHighlighter />}
            {selectedShapeTool === "rectangle" && <IconRectangle />}
            {selectedShapeTool === "circle" && <IconCircle />}
            <span className="tv-sub-arrow" onClick={(e) => { e.stopPropagation(); setOpenFlyout(openFlyout === "shape" ? null : "shape"); }}>▶</span>
          </button>

          {openFlyout === "shape" && (
            <div className="tv-flyout-menu">
              <div className="tv-flyout-header">Geometric Shapes</div>
              {shapeTools.map((t) => (
                <div
                  key={t.type}
                  className={`tv-flyout-item ${props.activeDrawingTool === t.type ? "selected" : ""}`}
                  onClick={() => { setSelectedShapeTool(t.type); handleSelectTool(t.type); }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Annotation / Text */}
        <div className="tv-tool-btn-wrap">
          <button
            className={`tv-tool-btn ${props.activeDrawingTool && textTools.some(t => t.type === props.activeDrawingTool) ? "active" : ""}`}
            title="Annotation & Text Tools"
            onClick={() => handleSelectTool(selectedTextTool)}
          >
            {selectedTextTool === "text" && <IconText />}
            {selectedTextTool === "callout" && <IconCallout />}
            {selectedTextTool === "price-label" && <IconPriceLabel />}
            <span className="tv-sub-arrow" onClick={(e) => { e.stopPropagation(); setOpenFlyout(openFlyout === "text" ? null : "text"); }}>▶</span>
          </button>

          {openFlyout === "text" && (
            <div className="tv-flyout-menu">
              <div className="tv-flyout-header">Text & Notes</div>
              {textTools.map((t) => (
                <div
                  key={t.type}
                  className={`tv-flyout-item ${props.activeDrawingTool === t.type ? "selected" : ""}`}
                  onClick={() => { setSelectedTextTool(t.type); handleSelectTool(t.type); }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Patterns & Forecasting / Positions */}
        <div className="tv-tool-btn-wrap">
          <button
            className={`tv-tool-btn ${props.activeDrawingTool && predictTools.some(t => t.type === props.activeDrawingTool) ? "active" : ""}`}
            title="Prediction and Measurement (Risk/Reward, Position)"
            onClick={() => handleSelectTool(selectedPredictTool)}
          >
            {selectedPredictTool === "long-position" && <IconLongPosition />}
            {selectedPredictTool === "short-position" && <IconShortPosition />}
            {selectedPredictTool === "price-range" && <IconPriceLabel />}
            {selectedPredictTool === "date-range" && <IconChannel />}
            <span className="tv-sub-arrow" onClick={(e) => { e.stopPropagation(); setOpenFlyout(openFlyout === "predict" ? null : "predict"); }}>▶</span>
          </button>

          {openFlyout === "predict" && (
            <div className="tv-flyout-menu">
              <div className="tv-flyout-header">Positions & Measurement</div>
              {predictTools.map((t) => (
                <div
                  key={t.type}
                  className={`tv-flyout-item ${props.activeDrawingTool === t.type ? "selected" : ""}`}
                  onClick={() => { setSelectedPredictTool(t.type); handleSelectTool(t.type); }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Stickers / Emojis */}
        <div className="tv-tool-btn-wrap">
          <button
            className={`tv-tool-btn ${props.activeDrawingTool === "icon" ? "active" : ""}`}
            title="Icons and Stickers"
            onClick={() => setOpenFlyout(openFlyout === "emojis" ? null : "emojis")}
          >
            <IconSmiley />
            <span className="tv-sub-arrow">▶</span>
          </button>

          {openFlyout === "emojis" && (
            <div className="tv-flyout-menu emoji-grid">
              <div className="tv-flyout-header">Icons & Stickers</div>
              <div className="tv-emoji-picker">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="tv-emoji-btn"
                    onClick={() => {
                      props.onSelectDrawingTool("icon");
                      setOpenFlyout(null);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tv-side-divider" />

      {/* 8. Measure Tool (Ruler) */}
      <button
        className={`tv-tool-btn ${props.activeDrawingTool === "measure" ? "active" : ""}`}
        title="Measure (Shift + Click)"
        onClick={() => handleSelectTool("measure")}
      >
        <IconRuler />
      </button>

      {/* 9. Zoom In / Zoom Out */}
      <div className="tv-tool-btn-wrap">
        <button
          className="tv-tool-btn"
          title="Zoom In"
          onClick={props.onZoomIn}
        >
          <IconZoomIn />
          <span className="tv-sub-arrow" onClick={(e) => { e.stopPropagation(); setOpenFlyout(openFlyout === "zoom" ? null : "zoom"); }}>▶</span>
        </button>

        {openFlyout === "zoom" && (
          <div className="tv-flyout-menu">
            <div className="tv-flyout-item" onClick={() => { props.onZoomIn(); setOpenFlyout(null); }}>
              <IconZoomIn />
              <span>Zoom In</span>
            </div>
            <div className="tv-flyout-item" onClick={() => { props.onZoomOut(); setOpenFlyout(null); }}>
              <IconZoomIn />
              <span>Zoom Out</span>
            </div>
          </div>
        )}
      </div>

      <div className="tv-side-divider" />

      {/* 10. Magnet Mode */}
      <button
        className={`tv-tool-btn ${props.magnetMode ? "active-magnet" : ""}`}
        title={`Magnet Mode: ${props.magnetMode ? "ON (Snaps to Open, High, Low, Close)" : "OFF"}`}
        onClick={props.onToggleMagnet}
      >
        <IconMagnet />
      </button>

      {/* 11. Stay in Drawing Mode */}
      <button
        className={`tv-tool-btn ${props.stayInDrawingMode ? "active" : ""}`}
        title={`Stay in Drawing Mode: ${props.stayInDrawingMode ? "ON" : "OFF"}`}
        onClick={props.onToggleStayInDrawingMode}
      >
        <IconStayInDrawing />
      </button>

      {/* 12. Lock All Drawing Tools */}
      <button
        className={`tv-tool-btn ${props.lockAllDrawings ? "active-lock" : ""}`}
        title={`Lock All Drawings: ${props.lockAllDrawings ? "LOCKED" : "UNLOCKED"}`}
        onClick={props.onToggleLockAllDrawings}
      >
        <IconLock />
      </button>

      {/* 13. Hide All Drawings */}
      <button
        className={`tv-tool-btn ${props.hideDrawings ? "active-hide" : ""}`}
        title={`Hide Drawings: ${props.hideDrawings ? "HIDDEN" : "VISIBLE"}`}
        onClick={props.onToggleHideDrawings}
      >
        {props.hideDrawings ? <IconEyeClosed /> : <IconEye />}
      </button>

      {/* 14. Remove / Trash */}
      <div className="tv-tool-btn-wrap">
        <button
          className="tv-tool-btn"
          title="Remove Tools & Drawings"
          onClick={() => setOpenFlyout(openFlyout === "trash" ? null : "trash")}
        >
          <IconTrash />
          <span className="tv-sub-arrow">▶</span>
        </button>

        {openFlyout === "trash" && (
          <div className="tv-flyout-menu">
            <div className="tv-flyout-header">Remove Options</div>
            <div className="tv-flyout-item" onClick={() => { props.onClearDrawings(); setOpenFlyout(null); }}>
              <IconTrash />
              <span>Remove Drawings</span>
            </div>
            <div className="tv-flyout-item" onClick={() => { props.onClearIndicators(); setOpenFlyout(null); }}>
              <IconTrash />
              <span>Remove Indicators</span>
            </div>
            <div className="tv-flyout-item danger" onClick={() => { props.onClearAll(); setOpenFlyout(null); }}>
              <IconTrash />
              <span>Remove Drawings & Indicators</span>
            </div>
          </div>
        )}
      </div>

      <div className="tv-sidetool-spacer" />

      {/* 15. Favorite Tools Star Toggle */}
      <button
        className={`tv-tool-btn fav-btn ${props.showFavoritesBar ? "active-star" : ""}`}
        title="Toggle Quick Favorite Drawings Toolbar"
        onClick={props.onToggleFavoritesBar}
      >
        <IconStar />
      </button>
    </aside>
  );
}
