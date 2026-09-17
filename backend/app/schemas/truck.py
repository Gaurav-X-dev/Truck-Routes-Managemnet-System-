from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TruckBase(BaseModel):
    truck_number: str
    driver_name: str
    status: str = "idle"
    assigned_bills: int = 0
    is_archived: bool = False

class TruckCreate(TruckBase):
    pass

class TruckResponse(TruckBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
