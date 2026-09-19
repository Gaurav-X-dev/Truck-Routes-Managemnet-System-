import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '../config';
import { Bell, X, CheckCircle, Wifi, WifiOff, Truck, Clock, MapPin } from 'lucide-react';

const TRUCK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
// Use imported API_URL and SOCKET_URL

// Fix Leaflet icon
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: iconRetina, iconUrl: iconMarker, shadowUrl: iconShadow });

const createTruckIcon = (truckId: string, color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:none;">
      <div style="background:#1a1a1a;color:#fff;padding:2px 7px;border-radius:4px;font-weight:700;font-size:11px;white-space:nowrap;border:1px solid ${color};margin-bottom:3px;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${truckId}</div>
      <div style="width:32px;height:32px;background:${color};border:2px solid #fff;border-radius:50%;display:flex;justify-content:center;align-items:center;box-shadow:0 2px 12px ${color}88;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v5c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
      </div>
    </div>`,
    iconSize: [0, 0], iconAnchor: [0, 0]
  });

const createStopIcon = (index: number, color: string, done: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:${done ? '#10b981' : color};border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);font-size:10px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${done ? '✓' : index + 1}</div>`,
    iconSize: [0, 0], iconAnchor: [0, 0]
  });

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

function MapResizer({ showSidebar }: { showSidebar: boolean }) {
  const map = useMap();
  useEffect(() => { 
    // Small timeout to allow the DOM to resize before invalidating map size
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [showSidebar, map]);
  return null;
}

interface Notification {
  id: string; message: string; truckId: string; stopName: string; timestamp: string; read: boolean;
}
interface TruckData {
  id: string; stops: any[]; color: string;
}
interface TruckRoute {
  polyline: [number, number][];
  etas: Record<string, string>;
}

export default function MapTracking() {
  const [searchParams] = useSearchParams();
  const focusTruckId = searchParams.get('truck');

  const [activeTrucks, setActiveTrucks] = useState<Record<string, { lat: number; lng: number }>>({});
  const [truckData, setTruckData] = useState<Record<string, TruckData>>({});
  const [truckRoutes, setTruckRoutes] = useState<Record<string, TruckRoute>>({});
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try { const s = localStorage.getItem('routemaster_notifications'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [connected, setConnected] = useState(false);
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const truckDataRef = useRef<Record<string, TruckData>>({});
  const routeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const unreadCount = notifications.filter(n => !n.read).length;

  // Fetch all trucks on mount
  useEffect(() => {
    fetch(`${API_URL}/trucks`)
      .then(res => res.json())
      .then(trucks => {
        const details: Record<string, TruckData> = {};
        trucks
          .filter((t: any) => t.status === 'transit')
          .forEach((t: any, i: number) => {
            details[t.id] = {
              id: t.id,
              stops: t.currentStops || [],
              color: TRUCK_COLORS[i % TRUCK_COLORS.length]
            };
          });
        setTruckData(details);
        truckDataRef.current = details;
      })
      .catch(console.error);
  }, []);

  // Calculate OSRM route for a truck (debounced)
  const updateRoute = (truckId: string, pos: { lat: number; lng: number }) => {
    if (routeTimers.current[truckId]) clearTimeout(routeTimers.current[truckId]);
    routeTimers.current[truckId] = setTimeout(async () => {
      const data = truckDataRef.current[truckId];
      if (!data) return;
      const pending = data.stops.filter(s => s.status !== 'completed');
      if (pending.length === 0) return;

      const waypoints = [`${pos.lng},${pos.lat}`, ...pending.map(s => `${s.lng},${s.lat}`)].join(';');
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
        );
        const json = await res.json();
        if (!json.routes?.[0]) return;

        const route = json.routes[0];
        const polyline = route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);

        let cumSecs = 0;
        const etas: Record<string, string> = {};
        route.legs.forEach((leg: any, i: number) => {
          cumSecs += leg.duration;
          if (pending[i]) {
            const t = new Date(Date.now() + cumSecs * 1000);
            etas[pending[i].id] = t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          }
        });

        setTruckRoutes(prev => ({ ...prev, [truckId]: { polyline, etas } }));
      } catch (e) { console.error('OSRM error', e); }
    }, 8000); // Recalculate route every 8s max per truck
  };

  // Socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('connect', () => { setConnected(true); console.log('[Admin] Socket connected:', socket.id); });
    socket.on('disconnect', () => setConnected(false));

    socket.on('truckLocationUpdated', (data: { truckId: string; lat: number; lng: number }) => {
      console.log('[Admin] Location received:', data);
      setActiveTrucks(prev => ({ ...prev, [data.truckId]: { lat: data.lat, lng: data.lng } }));

      // Also add to truckData if not present (dynamic discovery)
      if (!truckDataRef.current[data.truckId]) {
        fetch(`${API_URL}/trucks`)
          .then(r => r.json())
          .then(trucks => {
            const t = trucks.find((x: any) => x.id === data.truckId);
            if (t) {
              const existingCount = Object.keys(truckDataRef.current).length;
              const newEntry: TruckData = {
                id: t.id,
                stops: t.currentStops || [],
                color: TRUCK_COLORS[existingCount % TRUCK_COLORS.length]
              };
              truckDataRef.current[data.truckId] = newEntry;
              setTruckData(prev => ({ ...prev, [data.truckId]: newEntry }));
            }
          });
      }

      updateRoute(data.truckId, { lat: data.lat, lng: data.lng });
    });

    socket.on('deliveryNotification', (data: any) => {
      const n: Notification = {
        id: Date.now().toString(), message: data.message,
        truckId: data.truckId, stopName: data.stopName,
        timestamp: new Date().toLocaleTimeString('en-IN'), read: false
      };
      setNotifications(prev => {
        const updated = [n, ...prev];
        localStorage.setItem('routemaster_notifications', JSON.stringify(updated));
        return updated;
      });
      // Also mark stop as completed in truckData
      setTruckData(prev => {
        const truck = prev[data.truckId];
        if (!truck) return prev;
        const updated = {
          ...truck,
          stops: truck.stops.map(s => s.name === data.stopName ? { ...s, status: 'completed' } : s)
        };
        truckDataRef.current[data.truckId] = updated;
        return { ...prev, [data.truckId]: updated };
      });

      setToastNotification(n);
      if (toastRef.current) clearTimeout(toastRef.current);
      toastRef.current = setTimeout(() => setToastNotification(null), 5000);

      // Browser notification (if permission granted)
      if (Notification.permission === 'granted') {
        new Notification('🚛 Delivery Complete!', { body: `${data.stopName} — ${data.truckId}`, icon: '/truck-icon.png' });
      }
    });

    // Request notification permission on connect
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => { socket.disconnect(); };
  }, []);

  // Map center: focus truck > any active > Delhi
  const center: [number, number] = (() => {
    if (focusTruckId && activeTrucks[focusTruckId]) return [activeTrucks[focusTruckId].lat, activeTrucks[focusTruckId].lng];
    const trucks = Object.values(activeTrucks);
    if (trucks.length > 0) return [trucks[0].lat, trucks[0].lng];
    return [28.6139, 77.2090];
  })();

  const markAllRead = () => {
    setNotifications(prev => {
      const u = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('routemaster_notifications', JSON.stringify(u));
      return u;
    });
  };
  const clearAll = () => { setNotifications([]); localStorage.removeItem('routemaster_notifications'); };

  return (
    <div className="map-tracking-root" style={{ height: 'calc(100vh - 8rem)', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Toast */}
      {toastNotification && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: '#10b981', color: '#fff', padding: '1rem 1.25rem',
          borderRadius: '10px', boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          maxWidth: '320px', animation: 'slideIn 0.3s ease'
        }}>
          <CheckCircle size={20} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Delivery Complete!</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{toastNotification.stopName} — {toastNotification.truckId}</div>
          </div>
          <button onClick={() => setToastNotification(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 'auto' }}><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2>Live Tracking Center</h2>
          <p className="text-muted text-sm mt-1">
            {Object.keys(activeTrucks).length > 0
              ? `${Object.keys(activeTrucks).length} vehicle${Object.keys(activeTrucks).length > 1 ? 's' : ''} active`
              : 'Monitoring fleet...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ background: '#111', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {connected
              ? <><Wifi size={14} style={{ color: '#10b981' }} /><span style={{ color: '#10b981' }}>Live</span></>
              : <><WifiOff size={14} style={{ color: '#ef4444' }} /><span style={{ color: '#ef4444' }}>Offline</span></>}
          </div>
          <button onClick={() => setShowSidebar(!showSidebar)} style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
            {showSidebar ? 'Hide' : 'Show'} Fleet Panel
          </button>
          {/* Bell */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setShowNotifications(!showNotifications); markAllRead(); }}
              style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{unreadCount}</span>
              )}
            </button>
            {showNotifications && (
              <div style={{ position: 'absolute', right: 0, top: '110%', width: '320px', zIndex: 1000, background: '#111', border: '1px solid #333', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Delivery Notifications</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {notifications.length > 0 && <button onClick={clearAll} style={{ background: 'none', border: '1px solid #333', color: '#888', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}>Clear</button>}
                    <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={16} /></button>
                  </div>
                </div>
                {notifications.length === 0
                  ? <div style={{ padding: '2rem', textAlign: 'center', color: '#555', fontSize: '0.875rem' }}>No notifications yet</div>
                  : <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #1a1a1a', background: n.read ? 'transparent' : '#0d1f17' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div style={{ width: 32, height: 32, background: '#10b98120', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <CheckCircle size={16} style={{ color: '#10b981' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 500 }}>{n.message}</div>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>Truck: {n.truckId} • {n.timestamp}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map + Sidebar Layout */}
      <div className="map-tracking-layout" style={{ flex: 1, display: 'flex', gap: '1rem', minHeight: 0 }}>
        {/* Map */}
        <div className="map-tracking-map" style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapUpdater center={center} />
            <MapResizer showSidebar={showSidebar} />

            {/* Route polylines */}
            {Object.entries(truckRoutes).map(([truckId, route]) => {
              const color = truckData[truckId]?.color || '#3b82f6';
              return (
                <Polyline key={`route-${truckId}`} positions={route.polyline}
                  pathOptions={{ color, weight: 4, opacity: 0.8, dashArray: undefined }} />
              );
            })}

            {/* Stop markers */}
            {Object.entries(truckData).map(([truckId, data]) =>
              data.stops.map((stop: any, idx: number) => {
                if (!stop.lat || !stop.lng) return null;
                const done = stop.status === 'completed';
                const eta = truckRoutes[truckId]?.etas[stop.id];
                return (
                  <Marker key={`stop-${truckId}-${stop.id}`}
                    position={[stop.lat, stop.lng]}
                    icon={createStopIcon(idx, data.color, done)}>
                    <Popup>
                      <div style={{ color: '#000', minWidth: '140px' }}>
                        <strong style={{ fontSize: '13px' }}>{stop.name}</strong><br />
                        <span style={{ fontSize: '11px', color: done ? '#10b981' : '#666' }}>
                          {done ? '✅ Delivered' : `Stop ${idx + 1}`}
                        </span><br />
                        {eta && !done && <span style={{ fontSize: '11px', color: '#3b82f6' }}>⏱ ETA: {eta}</span>}
                        {stop.bills && <><br /><span style={{ fontSize: '11px', color: '#888' }}>Bills: {stop.bills}</span></>}
                      </div>
                    </Popup>
                  </Marker>
                );
              })
            )}

            {/* Truck position markers */}
            {Object.entries(activeTrucks).map(([id, pos]) => (
              <Marker key={`truck-${id}`} position={[pos.lat, pos.lng]}
                icon={createTruckIcon(id, truckData[id]?.color || '#3b82f6')}>
                <Popup>
                  <div style={{ color: '#000', minWidth: '150px' }}>
                    <strong>{id}</strong><br />
                    <span style={{ fontSize: '11px', color: '#10b981' }}>🟢 Live Tracking</span><br />
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* No vehicles overlay */}
          {Object.keys(activeTrucks).length === 0 && connected && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.85)', color: '#888', padding: '1.5rem 2rem', borderRadius: '12px', textAlign: 'center', pointerEvents: 'none', zIndex: 500 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚛</div>
              <div style={{ fontSize: '0.9rem' }}>No active vehicles right now</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: '#555' }}>Waiting for drivers to start duty...</div>
            </div>
          )}
        </div>

        {/* Fleet Sidebar */}
        {showSidebar && (
          <div className="map-tracking-sidebar" style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Active Fleet</div>

            {Object.keys(activeTrucks).length === 0 ? (
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '1.5rem', textAlign: 'center' }}>
                <Truck size={24} style={{ color: '#333', margin: '0 auto 0.5rem' }} />
                <p style={{ color: '#555', fontSize: '0.8rem' }}>No trucks online</p>
              </div>
            ) : (
              Object.entries(activeTrucks).map(([truckId, pos]) => {
                const data = truckData[truckId];
                const routes = truckRoutes[truckId];
                const pending = data?.stops?.filter((s: any) => s.status !== 'completed') || [];
                const nextStop = pending[0];
                const color = data?.color || '#3b82f6';

                return (
                  <div key={truckId} style={{ background: '#111', border: `1px solid ${color}44`, borderRadius: '10px', padding: '0.875rem', borderLeft: `3px solid ${color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></div>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{truckId}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#555' }}>{pos.lat.toFixed(3)}, {pos.lng.toFixed(3)}</span>
                    </div>

                    {nextStop && (
                      <div style={{ background: '#0a0a0a', borderRadius: '6px', padding: '0.5rem 0.625rem', marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px' }}>Next Stop</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: color }}>{nextStop.name}</div>
                        {routes?.etas[nextStop.id] && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            <Clock size={11} style={{ color: '#888' }} />
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>ETA: {routes.etas[nextStop.id]}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: '0.72rem', color: '#555' }}>
                      {data?.stops?.filter((s: any) => s.status === 'completed').length || 0}/{data?.stops?.length || 0} stops done
                    </div>

                    {/* Stop progress */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '0.5rem' }}>
                      {data?.stops?.map((stop: any, i: number) => {
                        const done = stop.status === 'completed';
                        const isNext = nextStop?.id === stop.id;
                        const eta = routes?.etas[stop.id];
                        return (
                          <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: done ? 0.45 : 1 }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: done ? '#10b981' : (isNext ? color : '#222'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                              {done ? '✓' : i + 1}
                            </div>
                            <span style={{ fontSize: '0.72rem', flex: 1, textDecoration: done ? 'line-through' : 'none', color: isNext ? '#fff' : '#888' }}>{stop.name}</span>
                            {eta && !done && <span style={{ fontSize: '0.65rem', color: '#666' }}>{eta}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
