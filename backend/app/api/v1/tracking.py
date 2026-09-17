import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.truck_location import TruckLocation
from app.models.user import User
from app.schemas.tracking import LocationUpdate, TruckLocationResponse

router = APIRouter(prefix="/tracking", tags=["Tracking"])

# In-memory subscriber list for SSE
subscribers = []

@router.post("/location", response_model=TruckLocationResponse, status_code=status.HTTP_201_CREATED)
async def update_location(
    location: LocationUpdate, 
    db: Session = Depends(get_db)
    # Driver might not use full JWT auth or they might, assuming they do for now
):
    # Save to database
    db_loc = TruckLocation(
        truck_id=location.truck_id,
        route_id=location.route_id,
        latitude=location.latitude,
        longitude=location.longitude,
        recorded_at=location.timestamp or datetime.now(timezone.utc)
    )
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    
    # Notify subscribers
    loc_data = TruckLocationResponse.model_validate(db_loc)
    msg = json.dumps(loc_data.model_dump(mode='json'))
    
    for queue in subscribers:
        await queue.put(msg)
        
    return db_loc

@router.get("/trucks/{truck_id}/latest", response_model=TruckLocationResponse)
def get_latest_location(truck_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    loc = db.query(TruckLocation).filter(TruckLocation.truck_id == truck_id).order_by(TruckLocation.recorded_at.desc()).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc

async def event_generator(request: Request) -> AsyncGenerator[str, None]:
    queue = asyncio.Queue()
    subscribers.append(queue)
    try:
        while True:
            if await request.is_disconnected():
                break
            # Wait for a message
            msg = await queue.get()
            yield f"data: {msg}\n\n"
    finally:
        subscribers.remove(queue)

@router.get("/stream")
async def tracking_stream(request: Request):
    """
    Server-Sent Events endpoint for real-time truck location updates.
    """
    return StreamingResponse(event_generator(request), media_type="text/event-stream")
