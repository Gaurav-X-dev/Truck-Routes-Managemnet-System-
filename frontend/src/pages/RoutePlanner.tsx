import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Truck, Navigation, Route as RouteIcon, MapPin, Zap, CheckCircle2, RotateCcw, Plus, Trash2, ArrowLeft, Locate, FileDown, CheckCircle, AlertCircle, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: iconMarker,
  shadowUrl: iconShadow,
});

const API_URL = '/api/v1';

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getMatchScore = (name: string, query: string) => {
  if (!name || !query) return 3;
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(` ${q}`)) return 2;
  return 3;
};

const parseCoordinates = (input: string): { lat: number, lng: number } | null => {
  const regex = /(-?\d+\.\d+)(?:,\s*|%2C\s*|\s+)(-?\d+\.\d+)/;
  const match = input.match(regex);
  if (match && match.length >= 3) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
};

function ModalMapUpdater({ stops, startCoords, routeGeometry }: { stops: any[], startCoords: {lat: number, lng: number}, routeGeometry: any[] }) {
  const map = useMap();
  useEffect(() => {
    let boundsPoints = [[startCoords.lat, startCoords.lng]];
    if (routeGeometry.length > 0) {
      boundsPoints = [...boundsPoints, ...routeGeometry];
    } else {
      boundsPoints = [...boundsPoints, ...stops.map(s => [s.lat, s.lng])];
    }
    const bounds = L.latLngBounds(boundsPoints as any);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [stops, startCoords, routeGeometry, map]);
  return null;
}

export default function RoutePlanner() {
  const { truckId } = useParams();
  const navigate = useNavigate();
  const [truck, setTruck] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  
  const [locName, setLocName] = useState('');
  const [locData, setLocData] = useState('');
  const [billNumbers, setBillNumbers] = useState('');
  const [routePlan, setRoutePlan] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRouteSaved, setIsRouteSaved] = useState(true);
  const [routeGeometry, setRouteGeometry] = useState<any[]>([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: () => {}, isDestructive: false });
  
  const [startLocName, setStartLocName] = useState('');
  const [startLocData, setStartLocData] = useState('');
  const [startCoords, setStartCoords] = useState<{lat: number, lng: number}>({lat: 26.4499, lng: 80.3319});

  const [allShops, setAllShops] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'}|null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Fetch truck details
    fetch(`${API_URL}/trucks`)
      .then(res => res.json())
      .then(data => {
        const t = Array.isArray(data) ? data.find((x: any) => x.id === truckId) : null;
        if (t) {
          setTruck(t);
          setStops(t.currentStops || []);
          setRoutePlan(t.currentStops || []);
        } else {
          setErrorMsg('Truck not found!');
        }
      })
      .catch(err => {
        console.error(err);
        setErrorMsg('Failed to load truck details.');
      })
      .finally(() => setLoading(false));
      
    // Fetch active shops for autocomplete
    fetch(`${API_URL}/shops`)
      .then(res => res.json())
      .then(data => setAllShops(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to load shops", err));
  }, [truckId]);

  const addStop = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!locName.trim() || !locData.trim() || !billNumbers.trim()) {
      setErrorMsg('Please fill all fields.');
      return;
    }

    let coords = parseCoordinates(locData);
    
    if (!coords) {
      setOptimizing(true);
      try {
        const query = encodeURIComponent(locData.trim());
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } else {
          const query2 = encodeURIComponent(locName.trim());
          const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query2}&limit=1`);
          const data2 = await res2.json();
          if (data2 && data2.length > 0) {
            coords = { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
          }
        }
      } catch (err) {
        console.error("Geocoding error", err);
      }
      setOptimizing(false);
    }

    if (!coords) {
      setErrorMsg('Could not find location. Please enter a valid address, landmark, or GPS coordinates.');
      return;
    }
    
    setStops([...stops, {
      id: `STOP-${Math.floor(Math.random() * 10000)}`,
      name: locName,
      lat: coords.lat,
      lng: coords.lng,
      bills: billNumbers
    }]);
    
    setLocName(''); setLocData(''); setBillNumbers('');
    setRoutePlan([]);
    setRouteGeometry([]);
    setIsRouteSaved(false);
  };

  const handleUpdateStart = async (e: React.FormEvent) => {
    e.preventDefault();
    let coords = parseCoordinates(startLocData);
    if (!coords) {
      setOptimizing(true);
      try {
        const query = encodeURIComponent(startLocData.trim());
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch(err) {}
      setOptimizing(false);
    }
    if (coords) {
      setStartCoords(coords);
      setRoutePlan([]);
      setRouteGeometry([]);
    } else {
      showToast("Could not find start location", "error");
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStartCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setStartLocData(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
          setStartLocName('My Current Location');
          setRoutePlan([]);
          setRouteGeometry([]);
        },
        (err) => showToast('Could not get location: ' + err.message, 'error')
      );
    } else {
      showToast("Geolocation is not supported by your browser", "error");
    }
  };

  const optimizeRouteOSRM = async () => {
    if (stops.length === 0) return;
    if (!startLocName || !startLocData) {
      showToast("Please update your start location first.", "error");
      return;
    }
    setOptimizing(true);
    setErrorMsg('');
    try {
      const WAREHOUSE_LAT = startCoords.lat; 
      const WAREHOUSE_LNG = startCoords.lng;

      let coordString = `${WAREHOUSE_LNG},${WAREHOUSE_LAT}`;
      stops.forEach(s => {
        coordString += `;${s.lng},${s.lat}`;
      });

      const res = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coordString}?roundtrip=false&source=first&geometries=geojson`);
      const data = await res.json();

      if (data.code !== 'Ok') {
        throw new Error('OSRM API could not calculate route');
      }

      let optimizedSequence: any[] = new Array(stops.length);
      
      data.waypoints.forEach((wp: any, originalIndex: number) => {
        if (originalIndex > 0) {
          const originalStop = stops[originalIndex - 1]; 
          optimizedSequence[wp.waypoint_index - 1] = originalStop;
        }
      });
      
      if (data.trips && data.trips.length > 0) {
         const coords = data.trips[0].geometry.coordinates.map((c: any[]) => [c[1], c[0]]);
         setRouteGeometry(coords);
      }

      setRoutePlan([...optimizedSequence]);
      setIsRouteSaved(false);
    } catch (err: any) {
      setErrorMsg("Failed to optimize road route: " + err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const clearRoute = () => {
    const isDraft = truck?.route_status === 'DRAFT';
    setConfirmModal({
      isOpen: true,
      title: isDraft ? 'Delete Draft' : 'Delete Trip',
      message: 'Are you sure you want to delete this trip/draft? This action will completely remove it.',
      isDestructive: true,
      action: async () => {
        try {
          await fetch(`${API_URL}/trucks/${truckId}/route`, { method: 'DELETE' });
          setRoutePlan([]);
          setRouteGeometry([]);
          setStops([]);
          setIsRouteSaved(false);
          setStartLocName('');
          setStartLocData('');
        } catch (err) {
          console.error("Failed to clear route", err);
        }
        setConfirmModal(prev => ({...prev, isOpen: false}));
      }
    });
  };

  const saveTrip = async (isDraft = false) => {
    if (routePlan.length === 0) return;
    setIsSaving(true);
    try {
      const totalBills = routePlan.reduce((acc, stop) => acc + stop.bills.split(',').length, 0);
      
      const res = await fetch(`${API_URL}/trucks/${truckId}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stops: routePlan, 
          tripDate: getTodayString(),
          assignedBills: totalBills,
          is_draft: isDraft
        })
      });
      
      if (!res.ok) throw new Error('Failed to save route');
      setIsRouteSaved(true);
      if (!isDraft) {
        showToast('Route saved and sent to driver app successfully!');
      } else {
        showToast('Route saved as Draft!');
      }
    } catch (err: any) {
      setErrorMsg("Failed to save trip: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadManifest = () => {
    if (!truck) return;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(`Delivery Route Manifest - OSRM Optimized`, 20, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Truck ID: ${truck.id} | Driver: ${truck.driver} | Generated: ${new Date().toLocaleString()}`, 20, 28);
    doc.line(20, 32, 190, 32);
    
    doc.setFontSize(11); doc.setTextColor(200, 30, 30);
    doc.text('WAREHOUSE NOTE: Load items in REVERSE order (LIFO). Load the last stop first!', 20, 42);
    
    let y = 55;
    routePlan.forEach((step, index) => {
      doc.setTextColor(0); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`Stop #${index + 1}: ${step.name}`, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`Bills: ${step.bills}`, 25, y + 6);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(`GPS: [${step.lat}, ${step.lng}]`, 25, y + 11);
      y += 18;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save(`Manifest_${truck.id}.pdf`);
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading Planner...</div>;
  if (!truck) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2 style={{ color: 'var(--error)' }}>Truck Not Found</h2>
      <p style={{ color: 'var(--text-secondary)' }}>The truck ID you are looking for does not exist.</p>
      <button className="btn-primary" onClick={() => navigate('/dashboard/trucks')} style={{ marginTop: '1rem' }}>Back to Trucks</button>
    </div>
  );

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={() => navigate('/dashboard/trucks')} className="btn-secondary" style={{ marginBottom: '1rem', background: 'transparent', padding: '0.5rem 0', border: 'none' }}>
            <ArrowLeft size={16} /> Back to Fleet
          </button>
          <h2 className="flex items-center gap-2">
            <Zap size={22} className="text-warning" /> Route Planner: {truck.id}
          </h2>
          <p className="text-muted text-sm mt-1">Real traffic-aware routing and manifest generation for driver {truck.driver}.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 450px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Form & Stops */}
        <div style={{ background: '#0a0a0a', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
          
          <div className="flex justify-between items-center mb-4">
            <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              1. Start Location
            </h4>
            <button type="button" onClick={useCurrentLocation} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
              <Locate size={12} style={{ marginRight: '4px' }} /> Current Loc
            </button>
          </div>
          <form onSubmit={handleUpdateStart} className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div className="input-group" style={{ position: 'relative' }}>
              <label>Shop / Start Name (Search Shops)</label>
              <input
                type="text"
                placeholder="Search warehouse or shop..."
                className="input-field"
                value={startLocName}
                onChange={(e) => { setStartLocName(e.target.value); setShowStartSuggestions(true); }}
                onFocus={() => setShowStartSuggestions(true)}
                onBlur={() => setTimeout(() => setShowStartSuggestions(false), 200)}
              />
              {showStartSuggestions && startLocName.length > 0 && allShops.filter(s =>
                s.name.toLowerCase().includes(startLocName.toLowerCase())
              ).length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0d0d0d', border: '1px solid #333', borderRadius: '6px', zIndex: 20, maxHeight: '180px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                  {allShops.filter(s => s.name.toLowerCase().includes(startLocName.toLowerCase()))
                    .sort((a: any, b: any) => {
                      const scoreA = getMatchScore(a.name, startLocName);
                      const scoreB = getMatchScore(b.name, startLocName);
                      if (scoreA !== scoreB) return scoreA - scoreB;
                      return a.name.localeCompare(b.name);
                    })
                    .slice(0, 8).map((shop: any) => (
                    <div
                      key={shop.id}
                      style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid #1a1a1a' }}
                      onMouseDown={() => {
                        setStartLocName(shop.name);
                        setStartLocData(`${shop.latitude}, ${shop.longitude}`);
                        setStartCoords({ lat: shop.latitude, lng: shop.longitude });
                        setShowStartSuggestions(false);
                        setRoutePlan([]); setRouteGeometry([]);
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{shop.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#666' }}>{shop.beat_name || ''} · {shop.latitude.toFixed(4)}, {shop.longitude.toFixed(4)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>Address or Coordinates</label>
              <input type="text" placeholder="e.g. 28.61, 77.20" className="input-field" value={startLocData} onChange={(e) => setStartLocData(e.target.value)} disabled={optimizing} />
            </div>
            <button type="submit" className="btn-secondary" style={{ width: '100%', background: '#111' }} disabled={optimizing}>
              {optimizing ? 'Updating...' : 'Update Start Location'}
            </button>
          </form>

          <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            2. Add Delivery Drops
          </h4>
          
          {errorMsg && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{errorMsg}</div>}
          
          <form onSubmit={addStop} className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', flexShrink: 0 }}>
            <div className="input-group" style={{ position: 'relative' }}>
              <label>Location Name (Search Shops)</label>
              <input 
                type="text" 
                placeholder="Search active shops or type manual name..." 
                className="input-field" 
                value={locName} 
                onChange={(e) => {
                  setLocName(e.target.value);
                  setShowSuggestions(true);
                }} 
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showSuggestions && locName.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: '4px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                  {allShops.filter((s: any) => s.name.toLowerCase().includes(locName.toLowerCase()) || (s.hul_code && s.hul_code.toLowerCase().includes(locName.toLowerCase())))
                    .sort((a: any, b: any) => {
                      const scoreA = getMatchScore(a.name, locName);
                      const scoreB = getMatchScore(b.name, locName);
                      if (scoreA !== scoreB) return scoreA - scoreB;
                      return a.name.localeCompare(b.name);
                    })
                    .map((shop: any) => (
                    <div 
                      key={shop.id} 
                      style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid #222' }}
                      onMouseDown={() => {
                        setLocName(shop.name);
                        setLocData(`${shop.latitude}, ${shop.longitude}`);
                        setShowSuggestions(false);
                      }}
                      className="hover:bg-gray-800"
                    >
                      <div style={{ fontWeight: 500 }}>{shop.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>{shop.hul_code ? `HUL: ${shop.hul_code}` : ''} ({shop.latitude.toFixed(4)}, {shop.longitude.toFixed(4)})</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="input-group">
              <label>Address, Landmark, or Coordinates</label>
              <input type="text" placeholder="e.g. Arya Nagar, Kanpur OR 28.61, 77.20" className="input-field" value={locData} onChange={(e) => setLocData(e.target.value)} disabled={optimizing} />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>Bills for this drop</label>
              <input type="text" placeholder="Bill-1, Bill-2" className="input-field" value={billNumbers} onChange={(e) => setBillNumbers(e.target.value)} disabled={optimizing} />
            </div>
            
            <button type="submit" className="btn-secondary" style={{ width: '100%', background: '#111' }} disabled={optimizing}>
              <Plus size={14} /> {optimizing ? 'Finding Location...' : 'Add Drop'}
            </button>
          </form>

          {stops.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted">{stops.length} Drops pending</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stops.map((s) => (
                  <div key={s.id} className="flex justify-between items-center" style={{ background: '#111', border: '1px solid #222', padding: '0.75rem', borderRadius: '6px', flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Bills: <span style={{ color: 'var(--text-primary)' }}>{s.bills}</span></div>
                    </div>
                    <button onClick={() => setStops(stops.filter(x => x.id !== s.id))} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Map & Manifest */}
        <div style={{ background: '#0a0a0a', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            2. Route Preview & Manifest
          </h4>

          <div style={{ height: '450px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem', border: '1px solid #333' }}>
            <MapContainer center={[startCoords.lat, startCoords.lng]} zoom={10} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
              <ModalMapUpdater stops={stops} startCoords={startCoords} routeGeometry={routeGeometry} />
              
              <Marker position={[startCoords.lat, startCoords.lng]}>
                <Popup>
                  <div style={{ color: '#000' }}>
                    <strong>{startLocName} (START)</strong>
                  </div>
                </Popup>
              </Marker>

              {routeGeometry.length > 0 && (
                <Polyline positions={routeGeometry as [number, number][]} color="#3b82f6" weight={4} opacity={0.7} />
              )}

              {stops.map((s, idx) => (
                <Marker key={s.id} position={[s.lat, s.lng]}>
                  <Popup>
                    <div style={{ color: '#000' }}>
                      <strong>{s.name}</strong><br/>
                      Bills: {s.bills}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          
          <div>
            {routePlan.length === 0 ? (
              <div style={{ padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#050505', borderRadius: '8px', border: '1px solid #222' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                  <RouteIcon size={20} className="text-muted" />
                </div>
                <p className="text-muted text-sm mb-4">Add drops on the left, then optimize to generate the actual shortest-path road sequence.</p>
                <button onClick={optimizeRouteOSRM} className="btn-primary" disabled={stops.length === 0 || optimizing} style={{ opacity: stops.length === 0 ? 0.5 : 1 }}>
                  <Zap size={14} /> {optimizing ? 'Calculating Routes...' : 'Optimize Road Route'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div style={{ background: isRouteSaved ? 'var(--success-bg)' : 'rgba(59, 130, 246, 0.1)', border: `1px solid ${isRouteSaved ? 'rgba(16,185,129,0.2)' : 'rgba(59, 130, 246, 0.3)'}`, padding: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} className={isRouteSaved ? "text-success" : "text-blue-500"} style={{ color: isRouteSaved ? '' : '#3b82f6' }} />
                    <span className="text-sm" style={{ color: isRouteSaved ? 'var(--success)' : '#3b82f6' }}>
                      {isRouteSaved ? "Trip saved and finalized." : "Preview Mode: Review the sequence below and click 'Save Trip'."}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={clearRoute} className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.3)' }} title="Clear & Edit Route">
                      <Trash2 size={16} /> {truck?.route_status === 'DRAFT' ? "Delete Draft" : "Delete Trip"}
                    </button>
                    {!isRouteSaved ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveTrip(true)} className="btn-secondary" disabled={isSaving}>
                          Save as Draft
                        </button>
                        <button onClick={() => saveTrip(false)} className="btn-primary" style={{ background: '#10b981', color: '#fff' }} disabled={isSaving}>
                           {isSaving ? 'Saving...' : 'Save & Finalize Trip'}
                        </button>
                      </div>
                    ) : (
                      <button onClick={downloadManifest} className="btn-primary" style={{ background: '#fff', color: '#000' }}>
                        <FileDown size={16} /> Download Manifest
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="flex gap-4 items-center" style={{ background: '#0a0a0a', border: '1px solid #333', padding: '0.75rem 1rem', borderRadius: '6px' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <MapPin size={12} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{startLocName} (Origin)</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Truck Start Location</div>
                      </div>
                    </div>
                    {routePlan.map((step, index) => (
                      <div key={index} className="flex gap-4 items-center" style={{ background: '#111', border: '1px solid #222', padding: '1rem', borderRadius: '6px', flexShrink: 0 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{step.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Bills: {step.bills}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ color: confirmModal.isDestructive ? 'var(--error)' : 'var(--text-primary)' }}>
                {confirmModal.title}
              </h3>
              <button onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={confirmModal.action}
                style={confirmModal.isDestructive ? { background: 'var(--error-bg)', color: 'var(--error)', borderColor: 'var(--error)' } : {}}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

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
