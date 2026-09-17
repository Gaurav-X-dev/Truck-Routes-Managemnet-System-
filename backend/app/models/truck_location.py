from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class TruckLocation(Base):
    __tablename__ = "truck_locations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), index=True, nullable=False)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True, nullable=True)
    
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("idx_truck_locations_truck_time", "truck_id", "recorded_at"),
    )
