import React, { useEffect, useState } from 'react';
import { Truck, Map, Activity, Clock, Box, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardHome() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    idle: 0,
    archived: 0
  });
  
  useEffect(() => {
    fetch('/api/v1/trucks')
      .then(res => res.json())
      .then(data => {
        let active = 0;
        let idle = 0;
        let archived = 0;
        data.forEach((t: any) => {
          if (t.is_archived === 1) archived++;
          else if (t.status === 'transit') active++;
          else idle++;
        });
        setStats({
          total: data.length,
          active,
          idle,
          archived
        });
      })
      .catch(console.error);
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Logistics Overview</h2>
          <p className="text-muted text-sm mt-1">Real-time metrics for your fleet operations.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Stat Card 1 */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Fleet</h3>
            <div style={{ padding: '0.5rem', background: 'var(--success-bg)', borderRadius: '8px', color: 'var(--success)' }}>
              <Activity size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#fff' }}>{stats.active}</div>
          <p className="text-sm text-success mt-2">Currently in transit</p>
        </div>

        {/* Stat Card 2 */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Idle Vehicles</h3>
            <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#fff' }}>{stats.idle}</div>
          <p className="text-sm text-muted mt-2">Ready for dispatch</p>
        </div>

        {/* Stat Card 3 */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Archived / Temp Deleted</h3>
            <div style={{ padding: '0.5rem', background: 'var(--error-bg)', borderRadius: '8px', color: 'var(--error)' }}>
              <ShieldAlert size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#fff' }}>{stats.archived}</div>
          <p className="text-sm text-muted mt-2">Removed from active roster</p>
        </div>
      </div>

      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Quick Actions</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <Link to="/dashboard/trucks" style={{ textDecoration: 'none' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', transition: 'all 0.2s ease', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.borderColor = '#555'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
            <div className="flex items-center gap-3 mb-2">
              <Truck className="text-primary" />
              <h4 style={{ color: '#fff', fontSize: '1.1rem' }}>Manage Trucks & Routes</h4>
            </div>
            <p className="text-muted text-sm">Assign new bills, optimize routes, or view vehicle history.</p>
          </div>
        </Link>
        <Link to="/dashboard/map" style={{ textDecoration: 'none' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', transition: 'all 0.2s ease', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.borderColor = '#555'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
            <div className="flex items-center gap-3 mb-2">
              <Map className="text-success" />
              <h4 style={{ color: '#fff', fontSize: '1.1rem' }}>Live Tracking Center</h4>
            </div>
            <p className="text-muted text-sm">Monitor fleet movements and GPS coordinates in real-time.</p>
          </div>
        </Link>
      </div>

    </div>
  );
}
