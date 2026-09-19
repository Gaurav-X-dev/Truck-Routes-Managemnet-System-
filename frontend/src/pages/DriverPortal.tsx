import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Truck, Navigation, CheckCircle, MapPin, CheckSquare, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_URL, SOCKET_URL } from '../config';

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, 14);
  }, [center, map]);
  return null;
}

export default function DriverPortal() {
  const { truckId } = useParams();
  const [status, setStatus] = useState('idle');
  const socketRef = useRef<any>(null);   // useRef avoids stale closure
  const [truckDetails, setTruckDetails] = useState<any>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [stopETAs, setStopETAs] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'}|null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3000);
  };

  // Find next pending stop
  const pendingStops = truckDetails?.currentStops?.filter((s: any) => s.status !== 'completed') || [];
  const nextStop = pendingStops[0];

  useEffect(() => {
    if (!currentPosition || pendingStops.length === 0) return;
    // Multi-waypoint OSRM: current pos → all pending stops
    const waypoints = [
      `${currentPosition[1]},${currentPosition[0]}`,
      ...pendingStops.map((s: any) => `${s.lng},${s.lat}`)
    ].join(';');
    fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          // Set polyline to first leg (current → next stop)
          const coords = route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
          setRoutePolyline(coords);
          // Calculate ETA for each pending stop
          let cumSecs = 0;
          const etas: Record<string, string> = {};
          route.legs.forEach((leg: any, i: number) => {
            cumSecs += leg.duration;
            if (pendingStops[i]) {
              const t = new Date(Date.now() + cumSecs * 1000);
              etas[pendingStops[i].id] = t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            }
          });
          setStopETAs(etas);
        }
      })
      .catch(err => console.error('OSRM Route Error', err));
  }, [currentPosition, nextStop?.id]);

  useEffect(() => {
    const s = io(SOCKET_URL);
    socketRef.current = s;

    s.on('connect', () => console.log('[Driver] Socket connected:', s.id));
    s.on('disconnect', () => console.log('[Driver] Socket disconnected'));

    // Fetch route details
    fetch(`${API_URL}/trucks`)
      .then(res => res.json())
      .then(data => {
        const t = data.find((x: any) => x.id === truckId);
        if (t) {
          setTruckDetails(t);
          if (t.status === 'transit') {
            setStatus('tracking');
            startGPS();  // socketRef.current is set above, always safe
          }
        }
      })
      .catch(err => console.error("Error fetching truck details", err));

    return () => { s.disconnect(); socketRef.current = null; };
  }, [truckId]);

  const startGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    
    navigator.geolocation.watchPosition((position) => {
      const pos = [position.coords.latitude, position.coords.longitude] as [number, number];
      setCurrentPosition(pos);
      // Always read from ref — never stale
      if (socketRef.current) {
        console.log('[Driver] Emitting location:', pos);
        socketRef.current.emit('driverLocationUpdate', {
          truckId,
          lat: pos[0],
          lng: pos[1]
        });
      } else {
        console.warn('[Driver] Socket not ready yet');
      }
    }, (error) => {
      console.error(error);
      showToast('Error getting location: ' + error.message, 'error');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
  };

  const startDuty = async () => {
    try {
      await fetch(`${API_URL}/trucks/${truckId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'transit' })
      });
      setStatus('tracking');
      startGPS();  // socketRef.current always available
    } catch(err) {
      console.error(err);
      showToast('Could not update status', 'error');
    }
  };

  const stopDuty = async () => {
    try {
      await fetch(`${API_URL}/trucks/${truckId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      setStatus('idle');
    } catch(err) {
      console.error(err);
    }
  };

  const markDelivered = async (stopId: string) => {
    const stop = truckDetails?.currentStops?.find((s: any) => s.id === stopId);
    try {
      await fetch(`${API_URL}/trucks/${truckId}/stops/${stopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      // Update local state
      setTruckDetails((prev: any) => ({
        ...prev,
        currentStops: prev.currentStops.map((s: any) => s.id === stopId ? { ...s, status: 'completed' } : s)
      }));
      // Notify admin via socket
      if (socketRef.current && stop) {
        socketRef.current.emit('stopDelivered', {
          truckId,
          stopId,
          stopName: stop.name,
          timestamp: new Date().toISOString()
        });
      }
    } catch(err) {
      console.error(err);
      showToast('Could not mark as delivered', 'error');
    }
  };

  return (
    <div className="driver-portal-wrapper" style={{ height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel driver-portal-panel" style={{ background: '#0a0a0a', border: '1px solid #222', padding: '2rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <div style={{ width: 64, height: 64, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#000' }}>
          <Truck size={32} />
        </div>
        
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Driver Portal</h2>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Vehicle: <strong style={{ color: '#fff' }}>{truckId}</strong></p>

        {truckDetails && truckDetails.currentStops && truckDetails.currentStops.length > 0 ? (
          <div style={{ textAlign: 'left', background: '#111', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #333' }}>
            <p className="text-muted text-sm mb-3" style={{ borderBottom: '1px solid #333', paddingBottom: '8px' }}>Delivery Route Sequence</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {truckDetails.currentStops.map((stop: any, idx: number) => {
                const isCompleted = stop.status === 'completed';
                const isNext = nextStop?.id === stop.id;
                
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', opacity: isCompleted ? 0.5 : 1 }}>
                    <div style={{ background: isCompleted ? 'var(--success)' : (isNext ? '#3b82f6' : '#222'), color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 500, textDecoration: isCompleted ? 'line-through' : 'none' }}>{stop.name}</div>
                      {stop.bills && <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>Bills: {stop.bills}</div>}
                      {!isCompleted && stopETAs[stop.id] && (
                        <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          ⏱ ETA: {stopETAs[stop.id]}
                        </div>
                      )}
                    </div>
                    {isNext && status === 'tracking' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn-primary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#3b82f6', color: '#fff', textAlign: 'center', textDecoration: 'none' }}>
                          Navigate
                        </a>
                        <button onClick={() => markDelivered(stop.id)} className="btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#10b981', color: '#fff' }}>
                          <CheckCircle size={12} style={{ display: 'inline', marginRight: '2px' }} /> Delivered
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '1rem', background: '#111', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #333', textAlign: 'center' }}>
            <p className="text-muted text-sm">No active route assigned.</p>
          </div>
        )}

        {status === 'idle' ? (
          <button onClick={startDuty} className="btn-primary" style={{ width: '100%', background: '#fff', color: '#000', padding: '1rem', fontSize: '1.1rem' }}>
            <Navigation size={20} /> Start Duty & Share GPS
          </button>
        ) : (
          <div style={{ background: '#111', border: '1px solid #333', padding: '1rem', borderRadius: '8px' }}>
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--success)', justifyContent: 'center' }}>
              <CheckCircle size={20} /> <span style={{ fontWeight: 600 }}>GPS Active</span>
            </div>
            
            {currentPosition && (
              <div className="driver-portal-map" style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
                <MapContainer center={currentPosition} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <MapUpdater center={currentPosition} />
                  
                  {/* Driver Marker */}
                  <Marker position={currentPosition} icon={driverIcon}>
                    <Popup>Your Location</Popup>
                  </Marker>
                  
                  {/* Next Destination Marker */}
                  {nextStop && (
                    <Marker position={[nextStop.lat, nextStop.lng]} icon={destIcon}>
                      <Popup>Next Stop: {nextStop.name}</Popup>
                    </Marker>
                  )}
                  
                  {/* Route Polyline */}
                  {routePolyline.length > 0 && (
                    <Polyline positions={routePolyline} color="#3b82f6" weight={5} opacity={0.8} />
                  )}
                </MapContainer>
              </div>
            )}
            
            {truckDetails?.currentStops?.length > 0 && pendingStops.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--success)', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', marginBottom: '1rem' }}>
                <CheckCircle size={24} style={{ margin: '0 auto 0.5rem' }} />
                <strong>All Stops Delivered!</strong><br />
                You can now stop duty.
              </div>
            ) : truckDetails?.currentStops?.length > 0 ? (
              <p className="text-muted text-sm mb-4">Driving to: <strong style={{ color: '#fff' }}>{nextStop?.name}</strong></p>
            ) : (
              <p className="text-muted text-sm mb-4">No stops assigned. GPS tracking is active.</p>
            )}
            
            <button onClick={stopDuty} className="btn-secondary" style={{ width: '100%', borderColor: 'var(--border-color)' }}>
              Stop Duty
            </button>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: toast.type === 'success' ? 'var(--success)' : 'var(--error)',
          color: '#fff', padding: '1rem 1.5rem', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10000,
          display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500,
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
