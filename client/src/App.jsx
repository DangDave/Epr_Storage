import { useState, useEffect } from 'react';
import axios from 'axios';
import Dashboard from './Dashboard.jsx';
import FloorPlan from './FloorPlan.jsx';
import Assignments from './Assignments.jsx';
import Operations from './Operations.jsx';

const BRAND = { orange: '#eab308', darkOrange: '#ca8a04', dark: '#1e293b', gray: '#64748b', lightGray: '#f8fafc', white: '#fff' };

// ---------- Login Page ----------
function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/login', { password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.token);
    } catch {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Left branding panel */}
      <div style={{ flex: 1, background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.darkOrange})`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 48, color: '#fff' }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <img src="/logo.png" alt="Easy Peasy Removals" style={{ width: 80, height: 80, marginBottom: 16, borderRadius: 12 }} />
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.5 }}>Easy Peasy</h1>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', opacity: 0.9 }}>Storage Manager</h2>
          <div style={{ width: 48, height: 3, background: '#fff', borderRadius: 2, margin: '16px auto' }} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16, fontSize: 14, opacity: 0.85 }}>
            <div>Dashboard</div>
            <div>Floor Plan</div>
            <div>Assignments</div>
          </div>
          <p style={{ marginTop: 32, fontSize: 13, opacity: 0.7 }}>
            easypeasyremovals.com.au
          </p>
        </div>
      </div>

      {/* Right login form */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: BRAND.lightGray }}>
        <div style={{ maxWidth: 380, width: '100%', padding: 40 }}>
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: BRAND.dark, margin: '0 0 4px' }}>Welcome back</h3>
            <p style={{ fontSize: 14, color: BRAND.gray, margin: 0 }}>Sign in to manage your storage facility</p>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: BRAND.dark, marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ width: '100%', padding: '14px 16px', fontSize: 15, border: '1px solid #d1d5db', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                autoFocus />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ padding: '14px', fontSize: 16, fontWeight: 600, color: '#fff', background: BRAND.orange, border: 'none', borderRadius: 10, cursor: 'pointer', transition: '0.2s', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Secure login</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Navigation ----------
function Nav({ page, setPage, onLogout }) {
  const links = [
    { id: 'dashboard', label: 'Dashboard', icon: '' },
    { id: 'floorplan', label: 'Floor Plan', icon: '' },
    { id: 'assignments', label: 'Assignments', icon: '' },
    { id: 'operations', label: 'Operations', icon: '' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0 24px', height: 60, borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
        <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: 6 }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: BRAND.dark }}>
          <span style={{ color: '#a16207' }}>Easy Peasy</span> Storage
        </span>
      </div>
      {links.map(l => (
        <button key={l.id} onClick={() => setPage(l.id)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, marginRight: 4,
            background: page === l.id ? '#fefce8' : 'transparent',
            color: page === l.id ? '#a16207' : BRAND.gray,
          }}>
          {l.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 16 }}>EPR Storage Facility</span>
      <button onClick={onLogout} style={{ color: BRAND.gray, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        Logout
      </button>
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    if (token) {
      axios.get('/api/check-auth', { headers: { Authorization: `Bearer ${token}` } })
        .then(() => setChecking(false))
        .catch(() => { localStorage.removeItem('token'); setToken(null); setChecking(false); });
    } else {
      setChecking(false);
    }
  }, []);

  const handleLogin = (newToken) => setToken(newToken);
  const handleLogout = () => {
    axios.post('/api/logout', {}, { headers: { Authorization: `Bearer ${token}` } });
    localStorage.removeItem('token');
    setToken(null);
  };

  if (checking) return null;
  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Nav page={page} setPage={setPage} onLogout={handleLogout} />
      <div style={{ padding: 24 }}>
        {page === 'dashboard' && <Dashboard token={token} />}
        {page === 'floorplan' && <FloorPlan token={token} />}
        {page === 'assignments' && <Assignments token={token} />}
        {page === 'operations' && <Operations token={token} />}
      </div>
    </div>
  );
}
