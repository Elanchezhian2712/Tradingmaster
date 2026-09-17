import uuid
from typing import Any

from pydantic import BaseModel, Field


class ChartLayoutCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    layout_type: str = Field(default="single", pattern="^(single|2-chart|4-chart)$")
    config: dict[str, Any] = Field(default_factory=dict)
    is_default: bool = False


class ChartLayoutUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    is_default: bool | None = None


class ChartLayoutOut(BaseModel):
    id: uuid.UUID
    name: str
    layout_type: str
    config: dict[str, Any]
    is_default: bool

    model_config = {"from_attributes": True}
