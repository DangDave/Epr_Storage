import { useState, useEffect } from 'react';
import axios from 'axios';

const Y = '#eab308';

export default function Dashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>Failed to load.</div>;

  const types = [
    { name: 'Modular Storage Unit', price: '$50/wk', dims: '2m × 2m × 2m · 8m³', key: 'Modular Storage Unit' },
    { name: '20ft Container', price: '$150/wk', dims: '6m × 2.4m × 2.3m · 32m³', key: '20ft Container' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top stat bar */}
      <div style={{ background: `linear-gradient(135deg, ${Y}, #ca8a04)`, borderRadius: 16, padding: '28px 36px', marginBottom: 28, color: '#fff', display: 'flex', justifyContent: 'space-around' }}>
        {[
          { v: stats.total, l: 'Total Units' },
          { v: stats.available, l: 'Available' },
          { v: stats.occupied, l: 'Occupied' },
          { v: stats.reserved, l: 'Reserved' },
        ].map(s => (
          <div key={s.l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800 }}>{s.v}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Storage types */}
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>Storage Types & Pricing</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {types.map(t => {
          const s = stats.byType?.find(x => x.name === t.key) || { total: 0, available: 0, occupied: 0 };
          const pct = s.total > 0 ? Math.round((s.occupied / s.total) * 100) : 0;
          return (
            <div key={t.name} style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t.dims}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: Y }}>{t.price}</div>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ background: Y, borderRadius: 8, height: 10, width: `${pct}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                <span>{s.total} units · {s.available} available</span>
                <span>{s.occupied} occupied</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>Pricing Summary</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8 }}>
            Modular Storage Units: <strong>$50/week</strong> each<br />
            20ft Containers: <strong>$150/week</strong> each<br />
            Flexible weekly billing · No lock-in contracts
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>Facility Info</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8 }}>
            EPR Storage Facility<br />
            Total capacity: <strong>{stats.total} units</strong><br />
            Currently available: <strong>{stats.available} units</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
