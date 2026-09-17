from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="PENDING") # PENDING, ACTIVE, COMPLETED
    total_stops: Mapped[int] = mapped_column(Integer, default=0)
    planned_distance: Mapped[float] = mapped_column(Float, nullable=True) # in kilometers
    estimated_duration: Mapped[int] = mapped_column(Integer, nullable=True) # in minutes
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    stops = relationship("RouteStop", back_populates="route", cascade="all, delete-orphan", order_by="RouteStop.stop_number")
