import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ChartLayout(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A saved multi-pane layout (single/2-chart/4-chart). `config` holds each pane's symbol/timeframe/scale settings."""

    __tablename__ = "chart_layouts"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    layout_type: Mapped[str] = mapped_column(String(20), default="single", nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ChartTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A reusable, named bundle of indicators/drawing styles a user can apply to any chart layout."""

    __tablename__ = "chart_templates"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class IndicatorInstance(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A persisted indicator instance attached to one chart layout/pane (mirrors the client-side IndicatorConfig)."""

    __tablename__ = "indicators"

    chart_layout_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_layouts.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    pane: Mapped[str] = mapped_column(String(16), default="overlay", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class DrawingObject(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "drawing_objects"

    chart_layout_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_layouts.id", ondelete="CASCADE"), index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    points: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    color: Mapped[str] = mapped_column(String(32), default="#f0b90b", nullable=False)
    line_width: Mapped[float] = mapped_column(default=1.5, nullable=False)
    text: Mapped[str | None] = mapped_column(String(500))
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
