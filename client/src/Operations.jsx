import { useState } from 'react';
import axios from 'axios';

const TRUCKS = [
  { tons: 4, label: '4 Ton Truck (20m³)' },
  { tons: 6, label: '6 Ton Truck (30m³)' },
  { tons: 8, label: '8 Ton Truck (45m³)' },
  { tons: 10, label: '10 Ton Truck (60m³)' },
  { tons: 12, label: '12 Ton Truck (75m³)' },
];

export default function Operations({ token }) {
  const [step, setStep] = useState(1);
  const [truck, setTruck] = useState(null);
  const [fillPct, setFillPct] = useState(100);
  const [choice, setChoice] = useState('boxes');
  const [job, setJob] = useState({ name: '', contact: '', phone: '', notes: '' });
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const getRecommendation = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/operations/recommend', {
        params: { truck: String(truck.tons), fill: fillPct, choice }, headers
      });
      setResult(res.data);
      setStep(4);
    } catch { setMsg('Failed to get recommendation'); }
    finally { setLoading(false); }
  };

  const createJobAndAssign = async (reserve) => {
    if (!job.name.trim()) { setMsg('Please enter a job name'); return; }
    setLoading(true);
    try {
      const jRes = await axios.post('/api/jobs', {
        name: job.name, contact: job.contact, phone: job.phone, notes: job.notes
      }, { headers });
      const jobId = jRes.data.id;
      let assigned = 0;

      for (const b of result.recBoxes) {
        await axios.post('/api/assignments', { unit_id: b.id, job_id: jobId, start_date: startDate }, { headers });
        assigned++;
      }
      for (const c of result.recContainers) {
        if (reserve) {
          await axios.put(`/api/units/${c.id}`, { status: 'reserved' }, { headers });
        } else {
          await axios.post('/api/assignments', { unit_id: c.id, job_id: jobId, start_date: startDate }, { headers });
        }
        assigned++;
      }
      setMsg(`Done! ${assigned} units ${reserve ? 'reserved' : 'assigned'} to ${job.name}.`);
      setStep(5);
    } catch (err) { setMsg('Error: ' + (err.response?.data?.error || err.message)); }
    finally { setLoading(false); }
  };

  const reset = () => { setStep(1); setTruck(null); setFillPct(100); setChoice('boxes'); setJob({ name:'', contact:'', phone:'', notes:'' }); setResult(null); setMsg(''); };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 24 }}>Operations</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {['Truck','Load','Options','Assign'].map((s,i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, background: step>i+1?'#eab308':step===i+1?'#fde68a':'#e2e8f0', marginBottom: 6 }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: step>=i+1?'#1e293b':'#94a3b8' }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Step 1: Select truck */}
      {step === 1 && (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>Select Truck Size</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TRUCKS.map(t => (
              <button key={t.tons} onClick={() => { setTruck(t); setStep(2); }}
                style={{ padding: '16px 20px', borderRadius: 10, cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff', textAlign: 'left', fontSize: 16, fontWeight: 600, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                <span>🚛 {t.label}</span>
                <span style={{ color: '#94a3b8' }}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Load percentage */}
      {step === 2 && (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>How Full Is The Truck?</h3>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>{truck?.label} selected</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <input type="range" min={50} max={100} value={fillPct} onChange={e => setFillPct(parseInt(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', width: 60, textAlign: 'right' }}>{fillPct}%</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Back</button>
            <button onClick={() => setStep(3)} style={{ padding: '10px 24px', background: '#eab308', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Continue</button>
          </div>
        </div>
      )}

      {/* Step 3: Choose option + Job details */}
      {step === 3 && (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Storage Option & Job</h3>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>{truck?.label} · {fillPct}% full</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setChoice('boxes')} style={{ padding: '12px 16px', borderRadius: 8, border: '2px solid ' + (choice==='boxes'?'#eab308':'#e2e8f0'), background: choice==='boxes'?'#fefce8':'#fff', textAlign: 'left', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              📦 Modular Units Only
            </button>
            <button onClick={() => setChoice('containers')} style={{ padding: '12px 16px', borderRadius: 8, border: '2px solid ' + (choice==='containers'?'#eab308':'#e2e8f0'), background: choice==='containers'?'#fefce8':'#fff', textAlign: 'left', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              🚢 Containers Only
            </button>
            <button onClick={() => setChoice('mix')} style={{ padding: '12px 16px', borderRadius: 8, border: '2px solid ' + (choice==='mix'?'#eab308':'#e2e8f0'), background: choice==='mix'?'#fefce8':'#fff', textAlign: 'left', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              🔄 Mix (Containers + Units)
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><label style={lbl}>Job Name *</label><input value={job.name} onChange={e => setJob({...job, name: e.target.value})} placeholder="e.g. Smith Residence Move" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Contact</label><input value={job.contact} onChange={e => setJob({...job, contact: e.target.value})} placeholder="Name" style={inp} /></div>
              <div><label style={lbl}>Phone</label><input value={job.phone} onChange={e => setJob({...job, phone: e.target.value})} placeholder="04..." style={inp} /></div>
            </div>
            <div><label style={lbl}>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Notes</label><textarea value={job.notes} onChange={e => setJob({...job, notes: e.target.value})} rows={2} placeholder="Any special instructions..." style={inp} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setStep(2)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Back</button>
            <button onClick={getRecommendation} disabled={loading}
              style={{ padding: '10px 24px', background: '#eab308', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              {loading ? 'Loading...' : 'Get Recommendation'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Recommendation */}
      {step === 4 && result && (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Recommendation</h3>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            {result.truck.tons} Ton Truck · {result.truck.fillPct}% full · {result.cargoM3}m³ cargo
          </p>

          {/* Options display */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 12 }}>
            {result.options.boxes && (
              <div style={{ flex:1, padding: 10, borderRadius: 8, border: '1px solid '+(result.choice==='boxes'?'#eab308':'#e2e8f0'), background: result.choice==='boxes'?'#fefce8':'#fff', textAlign: 'center' }}>
                <div style={{ fontWeight: 600 }}>{result.options.boxes.label}</div>
              </div>
            )}
            {result.options.containers && (
              <div style={{ flex:1, padding: 10, borderRadius: 8, border: '1px solid '+(result.choice==='containers'?'#eab308':'#e2e8f0'), background: result.choice==='containers'?'#fefce8':'#fff', textAlign: 'center' }}>
                <div style={{ fontWeight: 600 }}>{result.options.containers.label}</div>
              </div>
            )}
            {result.options.mix && (
              <div style={{ flex:1, padding: 10, borderRadius: 8, border: '1px solid '+(result.choice==='mix'?'#eab308':'#e2e8f0'), background: result.choice==='mix'?'#fefce8':'#fff', textAlign: 'center' }}>
                <div style={{ fontWeight: 600 }}>{result.options.mix.label}</div>
              </div>
            )}
          </div>

          {result.recBoxes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Modular Units — {result.recBoxes.length} × $50/wk = ${result.recBoxes.length*50}/wk</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.recBoxes.map(b => (
                  <div key={b.id} style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, fontWeight: 600 }}>
                    {b.unit_number}
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>{b.street}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.recContainers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Containers — {result.recContainers.length} × $150/wk = ${result.recContainers.length*150}/wk</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.recContainers.map(c => (
                  <div key={c.id} style={{ padding: '8px 12px', background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a', fontSize: 13, fontWeight: 600 }}>
                    {c.unit_number}
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>{c.street}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Total: ${result.recBoxes.length*50 + result.recContainers.length*150}/week
          </div>

          {msg && <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12, background: msg.includes('Error')?'#fef2f2':'#f0fdf4', color: msg.includes('Error')?'#dc2626':'#16a34a' }}>{msg}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(3)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Back</button>
            <button onClick={() => createJobAndAssign(false)} disabled={loading}
              style={{ flex: 1, padding: '12px', background: '#eab308', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Assign</button>
            <button onClick={() => createJobAndAssign(true)} disabled={loading}
              style={{ flex: 1, padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Reserve</button>
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 5 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>All Done!</h3>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>{msg}</p>
          <button onClick={reset} style={{ padding: '12px 32px', background: '#eab308', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>New Operation</button>
        </div>
      )}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 };
const inp = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' };
