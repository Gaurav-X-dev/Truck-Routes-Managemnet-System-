import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../api/client';

// Fix Leaflet default icon path issues in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface TruckLoc {
  truck_id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface Truck {
  id: number;
  truck_number: string;
  driver_name: string;
}

const SSE_URL = '/api/v1/tracking/stream';

const LiveTracking = () => {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [locations, setLocations] = useState<{ [key: number]: TruckLoc }>({});
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    // Load truck list and initial locations
    const init = async () => {
      try {
        const tr = await api.get('/trucks/');
        setTrucks(tr.data);
        const locs: { [key: number]: TruckLoc } = {};
        for (const t of tr.data) {
          try {
            const lr = await api.get(`/tracking/trucks/${t.id}/latest`);
            locs[t.id] = lr.data;
          } catch { /* no location yet */ }
        }
        setLocations(locs);
      } catch { /* ignore */ }
    };
    init();

    // SSE stream
    const es = new EventSource(SSE_URL);
    es.onopen = () => setSseStatus('connected');
    es.onmessage = (ev) => {
      const data: TruckLoc = JSON.parse(ev.data);
      setLocations((prev) => ({ ...prev, [data.truck_id]: data }));
    };
    es.onerror = () => {
      setSseStatus('disconnected');
      es.close();
    };
    return () => {
      es.close();
    };
  }, []);

  const truckMap = Object.fromEntries(trucks.map((t) => [t.id, t]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button
        className="btn btn-outline"
        style={{ padding: '8px 16px', width: 'auto', fontSize: '0.95rem' }}
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>🗺️ Live Office Map</h2>
        <div style={{
          padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700,
          background: sseStatus === 'connected' ? '#e8f5e9' : sseStatus === 'connecting' ? '#fff3e0' : '#ffebee',
          color: sseStatus === 'connected' ? '#2e7d32' : sseStatus === 'connecting' ? '#e65100' : '#c62828',
        }}>
          {sseStatus === 'connected' ? '● LIVE' : sseStatus === 'connecting' ? '○ Connecting...' : '✕ Disconnected'}
        </div>
      </div>

      <div style={{ height: '450px', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
        <MapContainer center={[28.5355, 77.3910]} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          />
          {Object.values(locations).map((loc) => (
            <Marker key={loc.truck_id} position={[loc.latitude, loc.longitude]}>
              <Popup>
                <strong>🚚 {truckMap[loc.truck_id]?.truck_number || `Truck #${loc.truck_id}`}</strong><br />
                Driver: {truckMap[loc.truck_id]?.driver_name || 'Unknown'}<br />
                Last update: {new Date(loc.recorded_at).toLocaleTimeString()}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Truck list */}
      {trucks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#57606f' }}>
          No trucks yet. <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 700, textDecoration: 'underline' }} onClick={() => navigate('/create-route')}>Create a route</button> first.
        </div>
      ) : (
        trucks.map((t) => {
          const loc = locations[t.id];
          return (
            <div key={t.id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800 }}>🚛 {t.truck_number}</div>
                <div style={{ color: '#57606f', fontSize: '0.9rem' }}>Driver: {t.driver_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {loc ? (
                  <>
                    <div style={{ fontSize: '0.85rem', color: '#2e7d32', fontWeight: 700 }}>● Located</div>
                    <div style={{ fontSize: '0.8rem', color: '#57606f' }}>{new Date(loc.recorded_at).toLocaleTimeString()}</div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#90a4ae' }}>No location yet</div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default LiveTracking;

