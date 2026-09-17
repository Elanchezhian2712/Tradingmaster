import { useState } from "react";

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
  onCreateAlert: (alert: { symbol: string; price: number; condition: string; message: string }) => void;
}

export function AlertModal(props: AlertModalProps) {
  const [price, setPrice] = useState(props.currentPrice ? props.currentPrice.toFixed(2) : "23280.00");
  const [condition, setCondition] = useState("Crossing");
  const [message, setMessage] = useState(`${props.symbol} crossed alert level`);
  const [createdToast, setCreatedToast] = useState(false);

  if (!props.isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    props.onCreateAlert({
      symbol: props.symbol,
      price: parseFloat(price) || props.currentPrice,
      condition,
      message,
    });
    setCreatedToast(true);
    setTimeout(() => {
      setCreatedToast(false);
      props.onClose();
    }, 1200);
  }

  return (
    <div className="tv-modal-backdrop" onClick={props.onClose}>
      <div className="tv-modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tv-modal-header">
          <h3>Create Alert on {props.symbol}</h3>
          <button className="tv-modal-close-btn" onClick={props.onClose}>✕</button>
        </div>

        {createdToast ? (
          <div className="tv-alert-success">
            <span>✓</span> Alert created successfully!
          </div>
        ) : (
          <form className="tv-modal-form" onSubmit={handleSubmit}>
            <div className="tv-form-group">
              <label>Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="Crossing">Crossing</option>
                <option value="Crossing Up">Crossing Up</option>
                <option value="Crossing Down">Crossing Down</option>
                <option value="Greater Than">Greater Than</option>
                <option value="Less Than">Less Than</option>
              </select>
            </div>

            <div className="tv-form-group">
              <label>Trigger Price</label>
              <input
                type="number"
                step="0.05"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>

            <div className="tv-form-group">
              <label>Message</label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="tv-modal-actions">
              <button type="button" className="tv-btn-cancel" onClick={props.onClose}>Cancel</button>
              <button type="submit" className="tv-btn-primary">Create Alert</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
