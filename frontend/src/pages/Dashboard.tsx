
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Dashboard = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <h2 className="title" style={{ marginBottom: '8px' }}>Main Menu</h2>
      <p style={{ textAlign: 'center', color: '#57606f', marginBottom: '32px' }}>
        What would you like to do today?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button
          id="btn-new-route"
          className="btn btn-primary"
          onClick={() => navigate('/create-route')}
          style={{ padding: '28px', fontSize: '1.3rem' }}
        >
          ➕ New Truck Route
        </button>

        <button
          id="btn-office-map"
          className="btn btn-secondary"
          onClick={() => navigate('/tracking/office')}
          style={{ padding: '28px', fontSize: '1.3rem' }}
        >
          🗺️ Office Live Map
        </button>

        <button
          id="btn-history"
          className="btn btn-outline"
          onClick={() => navigate('/history')}
          style={{ padding: '28px', fontSize: '1.3rem' }}
        >
          📋 Route History
        </button>
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#57606f', fontSize: '0.95rem', textDecoration: 'underline'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Dashboard;

