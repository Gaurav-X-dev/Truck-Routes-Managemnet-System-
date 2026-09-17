from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime
import pandas as pd
import io
import csv
from fastapi.responses import StreamingResponse

from app.database import get_db
from app.models.shop import Shop
from app.schemas.shop import ShopCreate, ShopUpdate, ShopResponse

router = APIRouter()

@router.get("/", response_model=List[ShopResponse])
def get_shops(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 5000,
    search: Optional[str] = None
):
    query = db.query(Shop).filter(Shop.is_archived == False)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Shop.name.ilike(search_term),
                Shop.hul_code.ilike(search_term),
                Shop.beat_name.ilike(search_term)
            )
        )
        
    return query.offset(skip).limit(limit).all()

@router.post("/", response_model=ShopResponse)
def create_shop(shop: ShopCreate, db: Session = Depends(get_db)):
    db_shop = Shop(**shop.model_dump())
    db.add(db_shop)
    db.commit()
    db.refresh(db_shop)
    return db_shop

@router.put("/{shop_id}", response_model=ShopResponse)
def update_shop(shop_id: int, shop: ShopUpdate, db: Session = Depends(get_db)):
    db_shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not db_shop:
        raise HTTPException(status_code=404, detail="Shop not found")
        
    update_data = shop.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_shop, key, value)
        
    db.commit()
    db.refresh(db_shop)
    return db_shop

@router.delete("/{shop_id}")
def delete_shop(shop_id: int, db: Session = Depends(get_db)):
    db_shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not db_shop:
        raise HTTPException(status_code=404, detail="Shop not found")
        
    db_shop.is_archived = True
    db.commit()
    return {"message": "Shop deleted successfully"}

@router.post("/upload")
async def upload_shops(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are allowed")
        
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Expected columns based on LAT LONG.xlsx
        expected_cols = {
            'Outlet HUL Code': 'hul_code',
            'Outlet Name': 'name',
            'Beat Name': 'beat_name',
            'Outlet Latitude': 'latitude',
            'Outlet Longitude': 'longitude'
        }
        
        # Check if expected columns are present
        for col in expected_cols.keys():
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing column: {col}")
                
        # Insert records
        added_count = 0
        for _, row in df.iterrows():
            if pd.isna(row['Outlet Name']) or pd.isna(row['Outlet Latitude']) or pd.isna(row['Outlet Longitude']):
                continue # Skip invalid rows
                
            new_shop = Shop(
                hul_code=str(row['Outlet HUL Code']) if pd.notna(row['Outlet HUL Code']) else None,
                name=str(row['Outlet Name']),
                beat_name=str(row['Beat Name']) if pd.notna(row['Beat Name']) else None,
                latitude=float(row['Outlet Latitude']),
                longitude=float(row['Outlet Longitude'])
            )
            db.add(new_shop)
            added_count += 1
            
        db.commit()
        return {"message": f"Successfully imported {added_count} shops"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export")
def export_shops(db: Session = Depends(get_db)):
    shops = db.query(Shop).filter(Shop.is_archived == False).all()
    
    # Generate CSV in memory
    stream = io.StringIO()
    writer = csv.writer(stream)
    
    # Write Header
    writer.writerow(["ID", "HUL Code", "Name", "Beat Name", "Latitude", "Longitude", "Created At"])
    
    for s in shops:
        writer.writerow([
            s.id,
            s.hul_code or "",
            s.name,
            s.beat_name or "",
            s.latitude,
            s.longitude,
            s.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
        
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=shops_export.csv"
    return response
