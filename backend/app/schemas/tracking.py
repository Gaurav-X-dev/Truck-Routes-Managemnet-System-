from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LocationUpdate(BaseModel):
    truck_id: int
    route_id: int | None = None
    latitude: float
    longitude: float
    timestamp: datetime | None = None

class TruckLocationResponse(BaseModel):
    id: int
    truck_id: int
    route_id: int | None
    latitude: float
    longitude: float
    recorded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
