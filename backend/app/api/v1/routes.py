from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.schemas.route import RouteCreate, RouteResponse, RouteStopCreate
from app.services.route_planning_service import RoutePlanningService

router = APIRouter(prefix="/routes", tags=["Routes"])

@router.post("/", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
def create_route(route: RouteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_route = Route(truck_id=route.truck_id, total_stops=route.total_stops, status="PENDING")
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    
    for stop in route.stops:
        db_stop = RouteStop(
            route_id=db_route.id,
            stop_number=stop.stop_number,
            location_name=stop.location_name,
            address=stop.address,
            latitude=stop.latitude,
            longitude=stop.longitude,
            status="PENDING"
        )
        db.add(db_stop)
        
    db.commit()
    db.refresh(db_route)
    return db_route

@router.get("/", response_model=list[RouteResponse])
def get_routes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Route).all()

@router.get("/{route_id}", response_model=RouteResponse)
def get_route(route_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route

@router.post("/{route_id}/plan", response_model=RouteResponse)
def plan_route(route_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    # Dummy start location (e.g. depot). For real app, this should be configurable or passed.
    start_lat = 28.5355
    start_lon = 77.3910
    
    stops_to_plan = [
        RouteStopCreate(
            stop_number=s.stop_number,
            location_name=s.location_name,
            address=s.address,
            latitude=s.latitude,
            longitude=s.longitude
        ) for s in route.stops
    ]
    
    optimized = RoutePlanningService.plan_route(stops_to_plan, start_lat, start_lon)
    
    # Update stops
    for s in route.stops:
        # Find matching optimized stop
        matching = next((x for x in optimized if x.location_name == s.location_name), None)
        if matching:
            s.stop_number = matching.stop_number
            
    db.commit()
    db.refresh(route)
    return route

@router.post("/{route_id}/confirm", response_model=RouteResponse)
def confirm_route(route_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Change status or mark ready
    db.commit()
    return route

@router.post("/{route_id}/start", response_model=RouteResponse)
def start_route(route_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    route.status = "ACTIVE"
    route.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(route)
    return route

@router.post("/{route_id}/complete", response_model=RouteResponse)
def complete_route(route_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    route.status = "COMPLETED"
    route.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(route)
    return route
