import { useState } from 'react';

import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface StopData {
  stop_number: number;
  location_name: string;
  latitude: string;  // keep as string for input, parse on submit
  longitude: string;
}

const DELHI_LOCATIONS = [
  { name: 'Connaught Place', lat: 28.6328, lon: 77.2197 },
  { name: 'Karol Bagh', lat: 28.6514, lon: 77.1906 },
  { name: 'Lajpat Nagar', lat: 28.5677, lon: 77.2433 },
  { name: 'Saket', lat: 28.5244, lon: 77.2090 },
  { name: 'Rohini', lat: 28.7499, lon: 77.0728 },
];

const CreateRoute = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Truck Info
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');

  // Step 2: Number of bills
  const [numBills, setNumBills] = useState('5');

  // Step 3: Location forms
  const [stops, setStops] = useState<StopData[]>([]);

  // Created IDs
  const [createdTruckId, setCreatedTruckId] = useState<number | null>(null);

  // ─── Step 1 ───────────────────────────────────────────────────────────────
  const handleStep1 = async () => {
    const tn = truckNumber.trim();
    const dn = driverName.trim();
    if (!tn || !dn) {
      setError('Please fill in both Truck Number and Driver Name.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/trucks/', { truck_number: tn, driver_name: dn });
      setCreatedTruckId(res.data.id);
      setStep(2);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to save truck. It may already exist.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2 ───────────────────────────────────────────────────────────────
  const handleStep2 = () => {
    const n = parseInt(numBills, 10);
    if (isNaN(n) || n <= 0) {
      setError('Please enter a valid number of bills (at least 1).');
      return;
    }
    if (n > 50) {
      setError('Maximum 50 bills allowed per route.');
      return;
    }
    setError('');
    const initialStops: StopData[] = Array.from({ length: n }, (_, i) => ({
      stop_number: i + 1,
      location_name: '',
      latitude: '',
      longitude: '',
    }));
    setStops(initialStops);
    setStep(3);
  };

  // ─── Step 3 helpers ───────────────────────────────────────────────────────
  const updateStop = (index: number, field: keyof StopData, value: string) => {
    setStops((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const fillSampleData = () => {
    setStops((prev) =>
      prev.map((stop, i) => ({
        ...stop,
        location_name: `Location ${String.fromCharCode(65 + i)}`,
        latitude: String(DELHI_LOCATIONS[i % DELHI_LOCATIONS.length].lat),
        longitude: String(DELHI_LOCATIONS[i % DELHI_LOCATIONS.length].lon),
      }))
    );
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Validate all stops
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (!s.location_name.trim()) {
        setError(`Stop ${i + 1}: Please enter a location name.`);
        return;
      }
      const lat = parseFloat(s.latitude);
      const lon = parseFloat(s.longitude);
      if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
        setError(`Stop ${i + 1}: Please enter valid latitude and longitude.`);
        return;
      }
      if (lat < -90 || lat > 90) {
        setError(`Stop ${i + 1}: Latitude must be between -90 and 90.`);
        return;
      }
      if (lon < -180 || lon > 180) {
        setError(`Stop ${i + 1}: Longitude must be between -180 and 180.`);
        return;
      }
    }

    setError('');
    setLoading(true);
    try {
      const payload = {
        truck_id: createdTruckId,
        total_stops: stops.length,
        stops: stops.map((s) => ({
          stop_number: s.stop_number,
          location_name: s.location_name.trim(),
          latitude: parseFloat(s.latitude),
          longitude: parseFloat(s.longitude),
        })),
      };

      const routeRes = await api.post('/routes/', payload);
      const routeId = routeRes.data.id;

      // Plan route (nearest-neighbor optimization)
      await api.post(`/routes/${routeId}/plan`);

      navigate(`/route/${routeId}`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to create/plan route. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="card">
      {/* Back button */}
      <button
        className="btn btn-outline"
        style={{ padding: '8px 16px', width: 'auto', marginBottom: '16px', fontSize: '0.95rem' }}
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{
            flex: 1, height: '6px', borderRadius: '3px',
            background: step >= s ? 'var(--primary-color)' : '#e0e0e0',
            transition: 'background 0.3s'
          }} />
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '8px',
          padding: '12px 16px', marginBottom: '16px', color: '#c62828', fontWeight: 600
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── STEP 1: Truck Info ── */}
      {step === 1 && (
        <>
          <h2 className="title">Step 1 of 3: Truck Info</h2>
          <label className="form-label">Truck Number</label>
          <input
            id="truck-number"
            className="input-field"
            value={truckNumber}
            onChange={(e) => setTruckNumber(e.target.value)}
            placeholder="e.g. UP16TEST001"
          />

          <label className="form-label">Driver Name</label>
          <input
            id="driver-name"
            className="input-field"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="e.g. Rahul Kumar"
          />

          <button
            id="btn-step1-next"
            className="btn btn-primary"
            onClick={handleStep1}
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Saving...' : 'Next →'}
          </button>
        </>
      )}

      {/* ── STEP 2: Bill Count ── */}
      {step === 2 && (
        <>
          <h2 className="title">Step 2 of 3: How Many Bills?</h2>
          <p style={{ textAlign: 'center', color: '#57606f', marginBottom: '24px' }}>
            Enter the number of delivery stops for this truck today.
          </p>
          <label className="form-label">Number of Bills / Stops</label>
          <input
            id="num-bills"
            className="input-field"
            type="number"
            min="1"
            max="50"
            value={numBills}
            onChange={(e) => setNumBills(e.target.value)}
            style={{ fontSize: '2rem', textAlign: 'center', padding: '20px' }}
          />
          <p style={{ color: '#57606f', fontSize: '0.9rem', textAlign: 'center', marginBottom: '16px' }}>
            (Enter 1–50)
          </p>
          <button id="btn-step2-next" className="btn btn-primary" onClick={handleStep2}>
            Generate Forms →
          </button>
        </>
      )}

      {/* ── STEP 3: Location Entry ── */}
      {step === 3 && (
        <>
          <h2 className="title">Step 3 of 3: Enter Locations</h2>
          <p style={{ textAlign: 'center', color: '#57606f', marginBottom: '8px' }}>
            Enter details for all {stops.length} delivery stops.
          </p>

          <button
            style={{
              background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px',
              padding: '8px 16px', cursor: 'pointer', width: '100%', marginBottom: '16px',
              color: '#1565c0', fontWeight: 600
            }}
            onClick={fillSampleData}
          >
            📍 Fill Sample Delhi/NCR Locations (for testing)
          </button>

          {stops.map((stop, i) => (
            <div key={i} style={{
              marginBottom: '16px', padding: '16px',
              background: '#f8f9fa', borderRadius: '12px',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '1.05rem' }}>
                📍 Stop {i + 1}
              </div>
              <label className="form-label">Location / Customer Name</label>
              <input
                className="input-field"
                value={stop.location_name}
                onChange={(e) => updateStop(i, 'location_name', e.target.value)}
                placeholder="e.g. Sharma Ice Cream Parlour"
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    value={stop.latitude}
                    onChange={(e) => updateStop(i, 'latitude', e.target.value)}
                    placeholder="28.6139"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    value={stop.longitude}
                    onChange={(e) => updateStop(i, 'longitude', e.target.value)}
                    placeholder="77.2090"
                    style={{ marginBottom: 0 }}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            id="btn-plan-route"
            className="btn btn-secondary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ marginTop: '8px', fontSize: '1.1rem', padding: '20px' }}
          >
            {loading ? 'Planning Route...' : '🗺️ Plan & Optimize Route'}
          </button>
        </>
      )}
    </div>
  );
};

export default CreateRoute;

