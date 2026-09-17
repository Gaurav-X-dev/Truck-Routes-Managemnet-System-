from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.route_stop import RouteStop
from app.models.user import User
from app.schemas.route import RouteStopResponse

router = APIRouter(prefix="/routes", tags=["Stops"])

@router.get("/{route_id}/stops", response_model=list[RouteStopResponse])
def get_stops(route_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(RouteStop).filter(RouteStop.route_id == route_id).order_by(RouteStop.stop_number).all()

@router.post("/{route_id}/stops/{stop_id}/arrive", response_model=RouteStopResponse)
def arrive_stop(route_id: int, stop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stop = db.query(RouteStop).filter(RouteStop.id == stop_id, RouteStop.route_id == route_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    stop.status = "CURRENT"
    stop.arrived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(stop)
    return stop

@router.post("/{route_id}/stops/{stop_id}/complete", response_model=RouteStopResponse)
def complete_stop(route_id: int, stop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stop = db.query(RouteStop).filter(RouteStop.id == stop_id, RouteStop.route_id == route_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    stop.status = "COMPLETED"
    stop.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(stop)
    return stop

@router.post("/{route_id}/stops/{stop_id}/skip", response_model=RouteStopResponse)
def skip_stop(route_id: int, stop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stop = db.query(RouteStop).filter(RouteStop.id == stop_id, RouteStop.route_id == route_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    stop.status = "SKIPPED"
    db.commit()
    db.refresh(stop)
    return stop
