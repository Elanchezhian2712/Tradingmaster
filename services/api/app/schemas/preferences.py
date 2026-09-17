from typing import Any

from pydantic import BaseModel


class UserPreferenceOut(BaseModel):
    theme: str
    default_timeframe: str
    keyboard_shortcuts: dict[str, Any]

    model_config = {"from_attributes": True}


class UserPreferenceUpdate(BaseModel):
    theme: str | None = None
    default_timeframe: str | None = None
    keyboard_shortcuts: dict[str, Any] | None = None
