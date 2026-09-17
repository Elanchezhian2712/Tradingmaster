import uuid

from pydantic import BaseModel, Field


class WatchlistSymbolOut(BaseModel):
    id: uuid.UUID
    symbol: str
    exchange: str
    position: int

    model_config = {"from_attributes": True}


class WatchlistOut(BaseModel):
    id: uuid.UUID
    name: str
    symbols: list[WatchlistSymbolOut]

    model_config = {"from_attributes": True}


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class WatchlistSymbolCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    exchange: str = Field(default="NSE", max_length=8)


class WatchlistSymbolReorder(BaseModel):
    symbol_id: uuid.UUID
    position: int
