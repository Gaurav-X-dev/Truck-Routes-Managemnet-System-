from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class LocationUpdate(BaseModel):
    truck_id: int
    route_id: Optional[int] = None
    latitude: float
    longitude: float
    timestamp: Optional[datetime] = None

class TruckLocationResponse(BaseModel):
    id: int
    truck_id: int
    route_id: Optional[int]
    latitude: float
    longitude: float
    recorded_at: datetime

    class Config:
        from_attributes = True
