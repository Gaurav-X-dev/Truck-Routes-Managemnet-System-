import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface Route {
  id: number;
  truck_id: number;
  status: string;
  total_stops: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  stops: { location_name: string; status: string }[];
}

const RouteHistory = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/routes/')
      .then((res) => setRoutes(res.data))
      .catch(() => setError('Failed to load routes.'))
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) =>
    s === 'COMPLETED' ? '#2e7d32' : s === 'ACTIVE' ? '#e65100' : '#546e7a';

  const statusIcon = (s: string) =>
    s === 'COMPLETED' ? '✅' : s === 'ACTIVE' ? '🚚' : '📋';

  return (
    <div>
      <button
        className="btn btn-outline"
        style={{ padding: '8px 16px', width: 'auto', marginBottom: '16px', fontSize: '0.95rem' }}
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      <h2 className="title">Route History</h2>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#57606f' }}>Loading...</div>}

      {error && (
        <div style={{ color: '#c62828', padding: '16px', background: '#fff0f0', borderRadius: '8px', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && routes.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#57606f' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
          <p>No routes yet. Create your first route!</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/create-route')}>
            ➕ New Route
          </button>
        </div>
      )}

      {routes.map((route) => {
        const done = route.stops.filter((s) => ['COMPLETED', 'SKIPPED'].includes(s.status)).length;
        return (
          <div
            key={route.id}
            className="card"
            style={{ cursor: 'pointer', borderLeft: `4px solid ${statusColor(route.status)}` }}
            onClick={() => navigate(`/route/${route.id}`)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {statusIcon(route.status)} Route #{route.id}
                </div>
                <div style={{ color: '#57606f', fontSize: '0.9rem', marginTop: '4px' }}>
                  {route.total_stops} stops · {done}/{route.total_stops} done
                </div>
                <div style={{ color: '#57606f', fontSize: '0.85rem', marginTop: '2px' }}>
                  {new Date(route.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{
                fontWeight: 700, color: statusColor(route.status), fontSize: '0.9rem',
                background: `${statusColor(route.status)}15`, padding: '4px 12px', borderRadius: '20px'
              }}>
                {route.status}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RouteHistory;

