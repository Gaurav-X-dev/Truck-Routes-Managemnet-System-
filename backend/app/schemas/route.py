from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RouteStopBase(BaseModel):
    stop_number: int
    location_name: str
    address: str | None = None
    latitude: float
    longitude: float

class RouteStopCreate(RouteStopBase):
    pass

class RouteStopResponse(RouteStopBase):
    id: int
    route_id: int
    status: str
    arrived_at: datetime | None = None
    completed_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

class RouteBase(BaseModel):
    truck_id: int
    total_stops: int

class RouteCreate(RouteBase):
    stops: list[RouteStopCreate]

class RouteResponse(RouteBase):
    id: int
    status: str
    planned_distance: float | None = None
    estimated_duration: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    stops: list[RouteStopResponse] = []
    
    model_config = ConfigDict(from_attributes=True)
