import { useState, useEffect } from "react";

export interface ReplayControlsProps {
  onStepForward: () => void;
  onPlay: () => void;
  onPause: () => void;
  onClose: () => void;
  isPlaying: boolean;
}

export function ReplayControls(props: ReplayControlsProps) {
  const [speed, setSpeed] = useState<number>(1);

  return (
    <div className="tv-replay-toolbar">
      <div className="tv-replay-title">
        <span>⏪ Bar Replay</span>
      </div>

      <div className="tv-replay-actions">
        <button
          className={`tv-replay-btn ${props.isPlaying ? "active" : ""}`}
          onClick={props.isPlaying ? props.onPause : props.onPlay}
          title={props.isPlaying ? "Pause" : "Play"}
        >
          {props.isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        <button
          className="tv-replay-btn"
          onClick={props.onStepForward}
          title="Step Forward 1 Bar"
        >
          ⏭ Forward
        </button>

        <div className="tv-replay-speed">
          <label>Speed:</label>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1}>1x</option>
            <option value={3}>3x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>

      <button className="tv-replay-close-btn" onClick={props.onClose} title="Exit Replay Mode">
        ✕
      </button>
    </div>
  );
}
