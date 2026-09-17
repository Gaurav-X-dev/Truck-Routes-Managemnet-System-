import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react'; // Changed to Truck for a better logistics feel

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="login-bg">
      <div className="glass-panel login-card" style={{ background: '#0a0a0a', border: '1px solid #222', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}>
        <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 48, height: 48, background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            <Truck size={24} strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>RouteMaster OS</h2>
          <p className="text-muted text-sm">Sign in to your dispatcher account</p>
        </div>
        
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="dispatcher@company.com"
            />
          </div>
          
          <div className="input-group" style={{ marginBottom: '2rem' }}>
            <div className="flex justify-between items-center mb-2">
              <label style={{ marginBottom: 0 }}>Password</label>
              <a href="#" className="text-muted text-sm" style={{ textDecoration: 'none' }}>Forgot?</a>
            </div>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ width: '100%', background: '#fff', color: '#000' }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
