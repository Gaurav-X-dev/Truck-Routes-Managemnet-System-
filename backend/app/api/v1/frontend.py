from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.truck import Truck
from app.models.route import Route
from app.models.route_stop import RouteStop
from datetime import datetime, timedelta, timezone
import uuid

router = APIRouter(tags=["Frontend"])

# 1. GET /api/v1/trucks
@router.get("/trucks")
def get_trucks(db: Session = Depends(get_db)):
    trucks = db.query(Truck).all()
    results = []
    for t in trucks:
        # Find active route for this truck
        active_route = db.query(Route).filter(
            Route.truck_id == t.id, 
            Route.status.in_(["PENDING", "ACTIVE", "DRAFT"])
        ).first()
        
        current_stops = []
        if active_route:
            for s in active_route.stops:
                current_stops.append({
                    "id": str(s.id),
                    "name": s.location_name,
                    "lat": s.latitude,
                    "lng": s.longitude,
                    "bills": s.address,  # We stored bills in address previously
                    "status": s.status.lower() # 'pending' or 'completed'
                })
        history_routes = db.query(Route).filter(
            Route.truck_id == t.id,
            Route.status == "COMPLETED"
        ).order_by(Route.created_at.desc()).all()
        
        history = []
        for hr in history_routes:
            stops_data = [{"name": s.location_name, "bills": s.address} for s in hr.stops]
            date_str = hr.completed_at.strftime("%Y-%m-%d %H:%M") if hr.completed_at else (hr.created_at.strftime("%Y-%m-%d %H:%M") if hr.created_at else "Unknown Date")
            history.append({
                "date": date_str,
                "stops": stops_data,
                "deliveries": hr.total_stops
            })

        results.append({
            "id": t.truck_number, # Frontend uses string ID
            "driver": t.driver_name,
            "status": t.status,
            "route_status": active_route.status if active_route else None,
            "assignedBills": t.assigned_bills,
            "is_archived": t.is_archived,
            "currentStops": current_stops,
            "history": history
        })
    return results

# 2. POST /api/v1/trucks/:id/route (Save route)
from pydantic import BaseModel
class RouteInput(BaseModel):
    stops: list
    assignedBills: int = 0
    is_draft: bool = False
    tripDate: str = None

@router.post("/trucks/{truck_id}/route")
def save_route(truck_id: str, payload: RouteInput, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
        
    # Delete any existing active or draft route for this truck (preserve COMPLETED ones)
    routes_to_delete = db.query(Route).filter(
        Route.truck_id == truck.id,
        Route.status.in_(["PENDING", "ACTIVE", "DRAFT"])
    ).all()
    for r in routes_to_delete:
        db.query(RouteStop).filter(RouteStop.route_id == r.id).delete()
        db.delete(r)
    db.commit()
    
    # Create new route
    new_route = Route(
        truck_id=truck.id, 
        total_stops=len(payload.stops), 
        status="DRAFT" if payload.is_draft else "PENDING"
    )
    db.add(new_route)
    db.commit()
    db.refresh(new_route)
    
    # Add stops
    for idx, stop in enumerate(payload.stops):
        db_stop = RouteStop(
            route_id=new_route.id,
            stop_number=idx,
            location_name=stop.get("name", "Unknown"),
            address=stop.get("bills", ""),
            latitude=stop.get("lat"),
            longitude=stop.get("lng"),
            status="PENDING"
        )
        db.add(db_stop)
        
    if not payload.is_draft:
        truck.status = "loading"
    truck.assigned_bills = payload.assignedBills
    db.commit()
    return {"success": True}

# 3. DELETE /api/v1/trucks/:id/route
@router.delete("/trucks/{truck_id}/route")
def delete_route(truck_id: str, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if truck:
        routes_to_delete = db.query(Route).filter(
            Route.truck_id == truck.id,
            Route.status.in_(["PENDING", "ACTIVE", "DRAFT"])
        ).all()
        for r in routes_to_delete:
            db.query(RouteStop).filter(RouteStop.route_id == r.id).delete()
            db.delete(r)
        truck.status = "idle"
        db.commit()
    return {"success": True}

# 4. PUT /api/v1/trucks/:id/status
class StatusInput(BaseModel):
    status: str

@router.put("/trucks/{truck_id}/status")
def update_status(truck_id: str, payload: StatusInput, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if truck:
        truck.status = payload.status
        db.commit()
    return {"success": True}

# 5. PUT /api/v1/trucks/:id/stops/:stopId
@router.put("/trucks/{truck_id}/stops/{stop_id}")
def update_stop_status(truck_id: str, stop_id: int, payload: StatusInput, db: Session = Depends(get_db)):
    stop = db.query(RouteStop).filter(RouteStop.id == stop_id).first()
    if stop:
        stop.status = payload.status.upper()
        db.commit()
    return {"success": True}

class AddTruckInput(BaseModel):
    id: str
    driver: str

@router.post("/trucks")
def add_truck(payload: AddTruckInput, db: Session = Depends(get_db)):
    t = Truck(truck_number=payload.id, driver_name=payload.driver)
    db.add(t)
    db.commit()
    return {"success": True}

@router.post("/trucks/{truck_id}/complete")
def complete_trip(truck_id: str, db: Session = Depends(get_db)):
    from sqlalchemy.sql import func
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if truck:
        routes_to_complete = db.query(Route).filter(Route.truck_id == truck.id, Route.status.in_(["PENDING", "ACTIVE"])).all()
        for r in routes_to_complete:
            r.status = "COMPLETED"
            r.completed_at = func.now()
            # Mark all pending stops as completed
            db.query(RouteStop).filter(RouteStop.route_id == r.id, RouteStop.status == "PENDING").update({
                "status": "COMPLETED",
                "completed_at": func.now()
            })
        
        truck.status = "idle"
        truck.assigned_bills = 0
        db.commit()
    return {"success": True}

@router.put("/trucks/{truck_id}/archive")
def archive_truck(truck_id: str, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if truck:
        truck.is_archived = True
        db.commit()
    return {"success": True}

@router.put("/trucks/{truck_id}/unarchive")
def unarchive_truck(truck_id: str, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if truck:
        truck.is_archived = False
        db.commit()
    return {"success": True}

@router.delete("/trucks/{truck_id}")
def delete_truck(truck_id: str, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if truck:
        # Delete associated routes
        db.query(Route).filter(Route.truck_id == truck.id).delete()
        # Delete the truck itself
        db.delete(truck)
        db.commit()
    return {"success": True}

@router.get("/trucks/{truck_id}/history")
def get_truck_history(truck_id: str, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.truck_number == truck_id).first()
    if not truck:
        return []
    
    completed_routes = db.query(Route).filter(Route.truck_id == truck.id, Route.status == "COMPLETED").order_by(Route.completed_at.desc()).all()
    history = []
    for r in completed_routes:
        # Fetch stops for this route, ordered by stop_number
        stops = db.query(RouteStop).filter(RouteStop.route_id == r.id).order_by(RouteStop.stop_number).all()
        
        history.append({
            "id": r.id,
            "date": r.completed_at.isoformat() if r.completed_at else (r.created_at.isoformat() if r.created_at else None),
            "stops": [
                {
                    "name": stop.location_name,
                    "address": stop.address,
                    "completed_at": stop.completed_at.isoformat() if stop.completed_at else None,
                    "status": stop.status
                }
                for stop in stops
            ]
        })
    return history

class ResetInput(BaseModel):
    today: str

@router.post("/maintenance/midnight-reset")
def reset_trucks(payload: ResetInput, db: Session = Depends(get_db)):
    """Auto-complete all active/pending routes that are from yesterday or older."""
    count = auto_complete_stale_trips(db)
    return {"success": True, "completed": count, "message": f"{count} stale trip(s) auto-completed."}


def auto_complete_stale_trips(db: Session) -> int:
    """Complete all ACTIVE/PENDING routes whose created_at date is before today.
    Called automatically every hour from the scheduler."""
    now_utc = datetime.utcnow()
    today_ist = now_utc + timedelta(hours=5, minutes=30)
    start_of_today_ist = today_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff_utc = start_of_today_ist - timedelta(hours=5, minutes=30)

    stale_routes = db.query(Route).filter(
        Route.status.in_(["PENDING", "ACTIVE"]),
        Route.created_at < cutoff_utc
    ).all()

    count = 0
    for route in stale_routes:
        route.status = "COMPLETED"
        route.completed_at = datetime.utcnow()
        # Mark all pending stops as completed
        db.query(RouteStop).filter(RouteStop.route_id == route.id, RouteStop.status == "PENDING").update({
            "status": "COMPLETED",
            "completed_at": datetime.utcnow()
        })
        # Also update the truck status
        truck = db.query(Truck).filter(Truck.id == route.truck_id).first()
        if truck:
            # Check no other active route exists
            other_active = db.query(Route).filter(
                Route.truck_id == truck.id,
                Route.status.in_(["PENDING", "ACTIVE"]),
                Route.id != route.id
            ).count()
            if other_active == 0:
                truck.status = "idle"
                truck.assigned_bills = 0
        count += 1

    if count > 0:
        db.commit()
        print(f"[Auto-Reset] {count} stale trip(s) auto-completed at midnight.")
    return count

import io
import csv
from fastapi.responses import StreamingResponse

@router.get("/trucks/export")
def export_trucks(db: Session = Depends(get_db)):
    trucks = db.query(Truck).all()
    
    stream = io.StringIO()
    writer = csv.writer(stream)
    
    writer.writerow(["Truck Number", "Driver Name", "Status", "Assigned Bills", "Total Trips Completed", "Last Active"])
    
    for t in trucks:
        completed_routes = db.query(Route).filter(Route.truck_id == t.id, Route.status == "COMPLETED").count()
        last_route = db.query(Route).filter(Route.truck_id == t.id).order_by(Route.created_at.desc()).first()
        last_active = last_route.created_at.strftime("%Y-%m-%d %H:%M:%S") if last_route else "Never"
        
        writer.writerow([
            t.truck_number,
            t.driver_name,
            t.status,
            t.assigned_bills,
            completed_routes,
            last_active
        ])
        
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=trucks_export.csv"
    return response
