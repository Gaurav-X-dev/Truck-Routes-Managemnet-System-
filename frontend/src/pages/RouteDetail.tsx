import { useEffect, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';

interface Stop {
  id: number;
  stop_number: number;
  location_name: string;
  latitude: number;
  longitude: number;
  status: 'PENDING' | 'CURRENT' | 'COMPLETED' | 'SKIPPED';
  arrived_at: string | null;
  completed_at: string | null;
}

interface Route {
  id: number;
  truck_id: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  total_stops: number;
  planned_distance: number | null;
  estimated_duration: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  stops: Stop[];
}

const statusColors: Record<string, string> = {
  PENDING: '#90a4ae',
  CURRENT: '#ff6b81',
  COMPLETED: '#7bed9f',
  SKIPPED: '#ffd32a',
};

const RouteDetail = () => {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchRoute = async () => {
    try {
      const res = await api.get(`/routes/${routeId}`);
      setRoute(res.data);
    } catch {
      setError('Failed to load route.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const doAction = async (action: string) => {
    setActionLoading(action);
    try {
      await api.post(`/routes/${routeId}/${action}`);
      await fetchRoute();
    } catch (e: any) {
      setError(`Failed to ${action} route.`);
    } finally {
      setActionLoading(null);
    }
  };

  const doStopAction = async (stopId: number, action: string) => {
    setActionLoading(`stop-${stopId}-${action}`);
    try {
      await api.post(`/routes/${routeId}/stops/${stopId}/${action}`);
      await fetchRoute();
    } catch {
      setError(`Failed to mark stop as ${action}.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: '40px' }}>Loading route...</div>;
  if (error && !route) return (
    <div className="card">
      <div style={{ color: '#c62828', fontWeight: 600 }}>⚠️ {error}</div>
      <button className="btn btn-outline" style={{ marginTop: '16px', width: 'auto', padding: '8px 16px' }} onClick={() => navigate('/')}>← Home</button>
    </div>
  );
  if (!route) return null;

  const completedCount = route.stops.filter((s) => s.status === 'COMPLETED').length;
  const skippedCount = route.stops.filter((s) => s.status === 'SKIPPED').length;
  const currentStop = route.stops.find((s) => s.status === 'CURRENT');

  const statusLabel = {
    PENDING: '📋 Planned — Not Started',
    ACTIVE: '🚚 Route In Progress',
    COMPLETED: '✅ Route Completed',
  }[route.status];

  return (
    <div>
      <button
        className="btn btn-outline"
        style={{ padding: '8px 16px', width: 'auto', marginBottom: '16px', fontSize: '0.95rem' }}
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      {error && (
        <div style={{
          background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '8px',
          padding: '12px 16px', marginBottom: '16px', color: '#c62828', fontWeight: 600
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '2rem' }}>🚛</div>
          <h2 style={{ fontWeight: 800, fontSize: '1.5rem' }}>Route #{route.id}</h2>
          <div style={{
            display: 'inline-block', marginTop: '8px', padding: '6px 16px',
            borderRadius: '20px', fontWeight: 700, fontSize: '0.95rem',
            background: route.status === 'COMPLETED' ? '#e8f5e9' : route.status === 'ACTIVE' ? '#fff3e0' : '#f5f5f5',
            color: route.status === 'COMPLETED' ? '#2e7d32' : route.status === 'ACTIVE' ? '#e65100' : '#546e7a',
          }}>
            {statusLabel}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-color)' }}>{completedCount + skippedCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#57606f' }}>Done</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{route.total_stops}</div>
            <div style={{ fontSize: '0.85rem', color: '#57606f' }}>Total</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#57606f' }}>{route.total_stops - completedCount - skippedCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#57606f' }}>Remaining</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
          {route.status === 'PENDING' && (
            <>
              <button
                id="btn-start-route"
                className="btn btn-primary"
                onClick={() => doAction('start')}
                disabled={!!actionLoading}
                style={{ padding: '20px', fontSize: '1.1rem' }}
              >
                {actionLoading === 'start' ? 'Starting...' : '🚀 Start Route'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/tracking/driver/${route.truck_id}`)}
                style={{ padding: '14px' }}
              >
                📡 Open Driver Tracking
              </button>
            </>
          )}

          {route.status === 'ACTIVE' && (
            <>
              {currentStop && (
                <div style={{ background: '#fff3e0', borderRadius: '12px', padding: '16px', marginBottom: '8px', border: '2px solid var(--primary-color)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px', color: '#e65100' }}>🔴 Current Stop</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currentStop.location_name}</div>
                  <div style={{ color: '#57606f', fontSize: '0.9rem', marginBottom: '12px' }}>Stop #{currentStop.stop_number}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => doStopAction(currentStop.id, 'complete')}
                      disabled={!!actionLoading}
                      style={{ padding: '12px', fontSize: '1rem' }}
                    >
                      ✅ Delivered
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => doStopAction(currentStop.id, 'skip')}
                      disabled={!!actionLoading}
                      style={{ padding: '12px', fontSize: '1rem' }}
                    >
                      ⏭️ Skip
                    </button>
                  </div>
                </div>
              )}

              {!currentStop && route.stops.some((s) => s.status === 'PENDING') && (
                // All current done, pick next pending
                <div style={{ color: '#57606f', textAlign: 'center', padding: '8px' }}>Select a stop below to mark it as current.</div>
              )}

              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/tracking/driver/${route.truck_id}`)}
                style={{ padding: '14px' }}
              >
                📡 Open Driver Tracking
              </button>

              {(completedCount + skippedCount) === route.total_stops && (
                <button
                  id="btn-complete-route"
                  className="btn btn-primary"
                  onClick={() => doAction('complete')}
                  disabled={!!actionLoading}
                  style={{ padding: '20px', fontSize: '1.1rem', background: '#2e7d32' }}
                >
                  {actionLoading === 'complete' ? 'Finishing...' : '🏁 Complete Route'}
                </button>
              )}
            </>
          )}

          {route.status === 'COMPLETED' && (
            <div style={{ textAlign: 'center', padding: '16px', color: '#2e7d32', fontWeight: 700, fontSize: '1.1rem' }}>
              🎉 Route successfully completed!
            </div>
          )}
        </div>
      </div>

      {/* Stops list */}
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>All Stops</h3>
        {route.stops.map((stop) => (
          <div key={stop.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px', borderRadius: '8px', marginBottom: '8px',
            background: stop.status === 'CURRENT' ? '#fff3e0' : '#f8f9fa',
            border: `2px solid ${statusColors[stop.status]}`,
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: statusColors[stop.status], display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, color: 'white', flexShrink: 0,
            }}>
              {stop.stop_number}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{stop.location_name}</div>
              <div style={{ fontSize: '0.85rem', color: '#57606f' }}>{stop.status}</div>
            </div>
            {/* Pending stop in active route — allow marking as current */}
            {route.status === 'ACTIVE' && stop.status === 'PENDING' && !currentStop && (
              <button
                style={{
                  background: '#ff6b81', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.85rem'
                }}
                onClick={() => doStopAction(stop.id, 'arrive')}
                disabled={!!actionLoading}
              >
                Go Here
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteDetail;

