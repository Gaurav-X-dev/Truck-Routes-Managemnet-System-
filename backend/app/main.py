import socketio
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.api.v1.frontend import auto_complete_stale_trips
from app.database import SessionLocal


async def midnight_reset_scheduler():
    """Background task: every hour check if any trips need auto-completion."""
    while True:
        await asyncio.sleep(3600)  # Run every 1 hour
        try:
            db = SessionLocal()
            count = auto_complete_stale_trips(db)
            db.close()
            if count:
                print(f"[Scheduler] Auto-reset ran: {count} trip(s) completed.")
        except Exception as e:
            print(f"[Scheduler] Error in auto-reset: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background scheduler on startup
    task = asyncio.create_task(midnight_reset_scheduler())
    # Also run once immediately to catch any stale trips on restart
    try:
        db = SessionLocal()
        count = auto_complete_stale_trips(db)
        db.close()
        if count:
            print(f"[Startup] Auto-reset on startup: {count} stale trip(s) completed.")
    except Exception as e:
        print(f"[Startup] Error in startup reset: {e}")
    yield
    task.cancel()


# Create FastAPI app
app = FastAPI(
    title="Truck Route Management API",
    description="API for managing truck routes, loads, and deliveries.",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Create Socket.IO server AFTER FastAPI routes
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Wrap: Socket.IO sits in front of FastAPI
# Requests to /socket.io/ go to sio, everything else to app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

@sio.event
async def connect(sid, environ):
    print(f"[Socket.IO] Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"[Socket.IO] Client disconnected: {sid}")

@sio.on('driverLocationUpdate')
async def driver_location_update(sid, data):
    print(f"[Socket.IO] Location update from {sid}: {data}")
    # Broadcast to all other clients (admin dashboard)
    await sio.emit('truckLocationUpdated', data)

@sio.on('stopDelivered')
async def stop_delivered(sid, data):
    """Driver ne delivery complete ki - admin ko notification"""
    print(f"[Socket.IO] Stop delivered from {sid}: {data}")
    await sio.emit('deliveryNotification', {
        'type': 'delivered',
        'truckId': data.get('truckId'),
        'stopName': data.get('stopName'),
        'message': f"✅ {data.get('stopName')} - Delivery Complete!",
        'timestamp': data.get('timestamp')
    })
