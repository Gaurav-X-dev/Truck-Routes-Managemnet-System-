import { useEffect, useRef, useState } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

const THROTTLE_SECONDS = 5; // send location at most every 5 seconds

const DriverTracking = () => {
  const { truckId } = useParams<{ truckId: string }>();
  const navigate = useNavigate();

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [lastSent, setLastSent] = useState<string>('');
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [sendCount, setSendCount] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const lastSentTimeRef = useRef<number>(0);

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support GPS tracking.');
      return;
    }
    setError('');
    setPermissionDenied(false);
    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLastLocation({ lat, lng });

        // Throttle: only send if at least THROTTLE_SECONDS passed
        const now = Date.now();
        if (now - lastSentTimeRef.current < THROTTLE_SECONDS * 1000) return;
        lastSentTimeRef.current = now;

        try {
          await api.post('/tracking/location', {
            truck_id: Number(truckId),
            latitude: lat,
            longitude: lng,
          });
          setSendCount((c) => c + 1);
          setLastSent(new Date().toLocaleTimeString());
        } catch {
          // Don't stop tracking on a single network error
          setError('Failed to send location update. Will retry.');
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setError('Location permission denied. Please allow location access in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Unable to get your current location. Make sure GPS is enabled.');
        } else {
          setError('Location error: ' + err.message);
        }
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  };

  useEffect(() => {
    return () => {
      stopTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card" style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
      <button
        className="btn btn-outline"
        style={{ padding: '8px 16px', width: 'auto', marginBottom: '16px', fontSize: '0.95rem' }}
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🚚</div>
      <h2 style={{ fontWeight: 800, marginBottom: '4px' }}>Driver Tracking</h2>
      <p style={{ color: '#57606f', marginBottom: '24px' }}>Truck ID: {truckId}</p>

      {permissionDenied ? (
        <div style={{
          background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚫</div>
          <div style={{ fontWeight: 700, color: '#c62828', marginBottom: '8px' }}>Location Permission Denied</div>
          <div style={{ color: '#57606f', fontSize: '0.9rem' }}>
            Please allow location access in your browser settings and refresh the page.
          </div>
        </div>
      ) : (
        <>
          {/* Big status indicator */}
          <div style={{
            padding: '32px 24px',
            background: isTracking ? '#e8f5e9' : '#f5f5f5',
            borderRadius: '16px',
            marginBottom: '24px',
            border: `3px solid ${isTracking ? '#2e7d32' : '#e0e0e0'}`,
            transition: 'all 0.3s ease'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
              {isTracking ? '📡' : '🔴'}
            </div>
            <div style={{
              fontSize: '1.5rem', fontWeight: 800,
              color: isTracking ? '#2e7d32' : '#546e7a'
            }}>
              {isTracking ? 'TRACKING ON' : 'TRACKING OFF'}
            </div>
            {isTracking && lastLocation && (
              <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#57606f' }}>
                📍 {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
              </div>
            )}
          </div>

          <button
            id="btn-toggle-tracking"
            className={isTracking ? 'btn btn-outline' : 'btn btn-primary'}
            style={{ padding: '24px', fontSize: '1.3rem', marginBottom: '16px' }}
            onClick={isTracking ? stopTracking : startTracking}
          >
            {isTracking ? '⏹ STOP TRACKING' : '▶ START TRACKING'}
          </button>

          {error && !permissionDenied && (
            <div style={{
              background: '#fff3e0', border: '1px solid #ffe082', borderRadius: '8px',
              padding: '12px', marginBottom: '16px', color: '#e65100', fontSize: '0.9rem'
            }}>
              ⚠️ {error}
            </div>
          )}

          {lastSent && (
            <div style={{ color: '#57606f', fontSize: '0.9rem' }}>
              ✅ Last update sent: {lastSent} ({sendCount} total)
            </div>
          )}

          <div style={{ marginTop: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '8px', fontSize: '0.85rem', color: '#57606f' }}>
            ℹ️ Location updates every {THROTTLE_SECONDS} seconds while tracking is active.
          </div>
        </>
      )}
    </div>
  );
};

export default DriverTracking;

