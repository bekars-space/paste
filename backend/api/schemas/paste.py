from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PasteType(str, Enum):
    TEXT = "text"
    FILE = "file"


class PasteTextCreate(BaseModel):
    content: str = Field(min_length=1)


class PasteCreateResponse(BaseModel):
    id: UUID
    expires_at: datetime


class PasteMetadataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: PasteType
    size_bytes: int
    content_type: str | None = None
    filename: str | None = None
    created_at: datetime
    expires_at: datetime
