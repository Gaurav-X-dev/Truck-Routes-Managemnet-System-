from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class RouteStopBase(BaseModel):
    stop_number: int
    location_name: str
    address: Optional[str] = None
    latitude: float
    longitude: float

class RouteStopCreate(RouteStopBase):
    pass

class RouteStopResponse(RouteStopBase):
    id: int
    route_id: int
    status: str
    arrived_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RouteBase(BaseModel):
    truck_id: int
    total_stops: int

class RouteCreate(RouteBase):
    stops: List[RouteStopCreate]

class RouteResponse(RouteBase):
    id: int
    status: str
    planned_distance: Optional[float] = None
    estimated_duration: Optional[int] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    stops: List[RouteStopResponse] = []

    class Config:
        from_attributes = True
