
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.truck import Truck
from app.models.user import User
from app.schemas.truck import TruckCreate, TruckResponse

router = APIRouter(prefix="/trucks", tags=["Trucks"])

@router.post("/", response_model=TruckResponse, status_code=status.HTTP_201_CREATED)
def create_truck(truck: TruckCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_truck = Truck(**truck.model_dump())
    db.add(db_truck)
    db.commit()
    db.refresh(db_truck)
    return db_truck

@router.get("/", response_model=list[TruckResponse])
def get_trucks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Truck).all()

@router.get("/{truck_id}", response_model=TruckResponse)
def get_truck(truck_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    return truck
