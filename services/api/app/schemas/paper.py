from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PaperTradeIn(BaseModel):
    """One closed round-trip as the client engine records it."""

    client_trade_id: str = Field(max_length=64)
    symbol: str = Field(max_length=32)
    product: str = Field(default="MIS", max_length=8)
    side: str = Field(max_length=4)
    quantity: int = Field(gt=0)
    entry_price: float
    exit_price: float | None = None
    entry_time: datetime
    exit_time: datetime | None = None
    pnl: float | None = None
    charges: float = 0.0


class PaperTradeOut(PaperTradeIn):
    model_config = {"from_attributes": True}


class PaperBookIn(BaseModel):
    """
    A whole-book push from the client: the live snapshot, plus any trades it
    has closed. Trades already stored (matched on `client_trade_id`) are
    ignored, so re-sending the same batch is safe.
    """

    snapshot: dict[str, Any]
    trades: list[PaperTradeIn] = Field(default_factory=list)


class PaperBookOut(BaseModel):
    snapshot: dict[str, Any]
    trades: list[PaperTradeOut]
    updated_at: datetime | None = None
