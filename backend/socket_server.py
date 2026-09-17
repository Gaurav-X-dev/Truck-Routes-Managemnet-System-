"""
Socket.IO server running on port 8002.
Stores last known truck positions and sends them to new clients on connect.
"""
import asyncio
import socketio
from aiohttp import web

# Create async Socket.IO server
sio = socketio.AsyncServer(
    async_mode='aiohttp',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

aio_app = web.Application()
sio.attach(aio_app)

# Store last known positions for each truck
truck_positions = {}

@sio.event
async def connect(sid, environ):
    print(f"[Socket.IO] Client connected: {sid} (total trucks known: {len(truck_positions)})")
    # Send all currently known truck positions to the newly connected client
    for truckId, pos in truck_positions.items():
        await sio.emit('truckLocationUpdated', {
            'truckId': truckId,
            'lat': pos['lat'],
            'lng': pos['lng']
        }, to=sid)

@sio.event
async def disconnect(sid):
    print(f"[Socket.IO] Client disconnected: {sid}")

@sio.on('driverLocationUpdate')
async def driver_location_update(sid, data):
    truckId = data.get('truckId')
    lat = data.get('lat')
    lng = data.get('lng')
    print(f"[Socket.IO] Location from {truckId}: lat={lat:.4f}, lng={lng:.4f}")
    
    # Store latest position
    truck_positions[truckId] = {'lat': lat, 'lng': lng}
    
    # Broadcast to ALL clients (admin dashboards)
    await sio.emit('truckLocationUpdated', {
        'truckId': truckId,
        'lat': lat,
        'lng': lng
    })

@sio.on('stopDelivered')
async def stop_delivered(sid, data):
    print(f"[Socket.IO] Stop delivered: {data}")
    await sio.emit('deliveryNotification', {
        'type': 'delivered',
        'truckId': data.get('truckId'),
        'stopName': data.get('stopName'),
        'message': f"✅ {data.get('stopName')} - Delivery Complete!",
        'timestamp': data.get('timestamp')
    })

if __name__ == '__main__':
    print("Starting Socket.IO server on port 8002...")
    web.run_app(aio_app, host='0.0.0.0', port=8002)
