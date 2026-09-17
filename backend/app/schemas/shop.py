from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ShopBase(BaseModel):
    hul_code: Optional[str] = None
    name: str = Field(..., description="The name of the shop or customer")
    beat_name: Optional[str] = None
    latitude: float
    longitude: float

class ShopCreate(ShopBase):
    pass

class ShopUpdate(BaseModel):
    hul_code: Optional[str] = None
    name: Optional[str] = None
    beat_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_archived: Optional[bool] = None

class ShopResponse(ShopBase):
    id: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
