from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["LIVE", "READY", "NOT_READY"]
    components: dict[str, str] = Field(default_factory=dict)
