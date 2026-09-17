import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Alert(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Event-driven: `condition` describes what to watch (price/indicator/candle/scanner/strategy); evaluated by the alert engine, not polled by clients."""

    __tablename__ = "alerts"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    condition_type: Mapped[str] = mapped_column(String(32), nullable=False)
    condition: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False, index=True)
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ScannerRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scanner_rules"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    logic: Mapped[str] = mapped_column(String(8), default="AND", nullable=False)
    conditions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)


class Strategy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Structured entry/confirmation/exit/stop/target/trailing definition, reused by scanner, alerts, backtesting and paper trading."""

    __tablename__ = "strategies"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    definition: Mapped[dict] = mapped_column(JSONB, nullable=False)


class Backtest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "backtests"

    strategy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("strategies.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False)
    from_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    to_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    # trade log, equity curve, drawdown, win rate, profit factor, avg P/L — all computed by the backtest engine.
    results: Mapped[dict | None] = mapped_column(JSONB)


class PaperTrade(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A closed round-trip from the client-side paper-trading engine."""

    __tablename__ = "paper_trades"
    __table_args__ = (
        # The client generates trade ids; this keeps a re-sent batch from
        # inserting the same trade twice without the client tracking what the
        # server already has.
        UniqueConstraint("user_id", "client_trade_id", name="uq_paper_trades_user_client_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    strategy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("strategies.id", ondelete="SET NULL"))
    client_trade_id: Mapped[str | None] = mapped_column(String(64))
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    product: Mapped[str] = mapped_column(String(8), default="MIS", nullable=False)
    side: Mapped[str] = mapped_column(String(4), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    entry_price: Mapped[float] = mapped_column(nullable=False)
    exit_price: Mapped[float | None] = mapped_column()
    entry_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exit_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pnl: Mapped[float | None] = mapped_column()
    charges: Mapped[float] = mapped_column(default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False, index=True)


class PaperBook(TimestampMixin, Base):
    """
    The live paper-trading book for one user: open orders, positions, cash and
    last prices, as the client engine serialises them.

    Kept as a single JSONB snapshot rather than order and position tables
    because nothing server-side evaluates it — the client engine owns the
    matching, and this is where it parks its state so another device can pick
    it up. Closed trades go to `paper_trades` instead, because those are the
    rows worth querying and reporting on.
    """

    __tablename__ = "paper_books"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
