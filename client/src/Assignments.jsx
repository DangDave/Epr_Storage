import { useState, useEffect } from 'react';
import axios from 'axios';

const C = { orange: '#eab308', green: '#22c55e', red: '#ef4444', amber: '#f59e0b', gray: '#64748b', slate: '#94a3b8' };

export default function Assignments({ token }) {
  const [units, setUnits] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('assign'); // assign | active | jobs | history

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    const [u, a, j] = await Promise.all([
      axios.get('/api/units', { headers }).then(r => r.data),
      axios.get('/api/assignments', { headers }).then(r => r.data),
      axios.get('/api/jobs', { headers }).then(r => r.data.jobs || r.data),
    ]);
    setUnits(u); setAssignments(a); setJobs(Array.isArray(j) ? j : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refresh = () => load();

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.slate }}>Loading...</div>;

  // Group units by group_label
  const groups = {};
  units.forEach(u => {
    const g = u.street || 'Unassigned';
    if (!groups[g]) groups[g] = [];
    groups[g].push(u);
  });

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const availableUnits = units.filter(u => u.status === 'available' || u.status === 'reserved');
  const history = assignments.filter(a => a.status !== 'active');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', gap: 24, height: 'calc(100vh - 108px)' }}>
      {/* LEFT SIDEBAR — Assignment form */}
      <div style={{ width: 340, flexShrink: 0, overflow: 'auto' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
          {[
            { id: 'assign', label: 'Assign' },
            { id: 'active', label: `Active (${activeAssignments.length})` },
            { id: 'jobs', label: `Jobs (${jobs.length})` },
            { id: 'history', label: `History` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#1e293b' : C.gray,
                boxShadow: tab === t.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'assign' && <AssignForm units={availableUnits} jobs={jobs} refresh={refresh} headers={headers} />}
        {tab === 'active' && <ActiveList assignments={activeAssignments} refresh={refresh} headers={headers} />}
        {tab === 'jobs' && <JobsPanel jobs={jobs} refresh={refresh} headers={headers} />}
        {tab === 'history' && <HistoryPanel assignments={history} />}
      </div>

      {/* RIGHT — Storage groups */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: '0 0 12px' }}>
          Storage Units ({units.length} total — {availableUnits.length} available)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(groups).map(([name, grp]) => {
            const avail = grp.filter(u => u.status === 'available' || u.status === 'reserved').length;
            const occ = grp.filter(u => u.status === 'occupied').length;
            return (
              <div key={name} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#334155' }}>{name}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: C.green }}>{avail} avail</span>
                    <span style={{ color: C.red }}>{occ} occupied</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {grp.map(u => {
                    const active = activeAssignments.find(a => a.unit_id === u.id);
                    const bg = u.status === 'occupied' ? '#fef2f2' : u.status === 'reserved' ? '#fff7ed' : '#f0fdf4';
                    const border = u.status === 'occupied' ? '#fecaca' : u.status === 'reserved' ? '#fed7aa' : '#bbf7d0';
                    return (
                      <div key={u.id} title={u.unit_number + ' — ' + u.status + (active ? '\nJob: ' + active.job_name : '')}
                        style={{ padding: '6px 10px', background: bg, border: '1px solid ' + border, borderRadius: 6, fontSize: 11, fontWeight: 600,
                          color: u.status === 'occupied' ? '#991b1b' : u.status === 'reserved' ? '#9a3412' : '#166534',
                          cursor: 'pointer', minWidth: 50, textAlign: 'center' }}>
                        {u.unit_number}
                        {u.street && <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>{u.street}</div>}
                        {active && <div style={{ fontSize: 9, fontWeight: 400, color: '#64748b', marginTop: 1 }}>{active.job_name?.substring(0, 8)}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Assign Form ----
function AssignForm({ units, jobs, refresh, headers }) {
  const [unitId, setUnitId] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobResults, setJobResults] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [msg, setMsg] = useState('');

  const searchJobs = async (q) => {
    setJobSearch(q); setSelectedJob(null);
    if (q.length < 1) { setJobResults([]); return; }
    try { const r = await axios.get('/api/jobs/search', { params: { q }, headers }); setJobResults(r.data); } catch { setJobResults([]); }
  };

  const selectJob = (j) => { setSelectedJob(j); setJobSearch(j.name); setJobResults([]); };

  const assign = async (e, reserve) => {
    e.preventDefault();
    if (!unitId || !selectedJob) return;
    try {
      if (reserve) {
        // Just mark unit as reserved without creating assignment
        await axios.put(`/api/units/${unitId}`, { status: 'reserved' }, { headers });
        setMsg('Unit reserved!');
      } else {
        await axios.post('/api/assignments', { unit_id: parseInt(unitId), job_id: selectedJob.id, start_date: startDate }, { headers });
        setMsg('Assigned!');
      }
      setUnitId(''); setJobSearch(''); setSelectedJob(null);
      refresh();
    } catch (err) { setMsg('Error: ' + (err.response?.data?.error || err.message)); }
  };

  return (
    <form onSubmit={(e) => assign(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={lbl}>Unit</label>
        <select value={unitId} onChange={e => setUnitId(e.target.value)} style={sel} required>
          <option value="">Select unit...</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.unit_number} — {u.size_name} ({u.status})</option>)}
        </select>
      </div>
      <div style={{ position: 'relative' }}>
        <label style={lbl}>Job</label>
        <input type="text" value={jobSearch} onChange={e => searchJobs(e.target.value)} placeholder="Search job name..." style={inp} required />
        {jobResults.length > 0 && !selectedJob && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 160, overflow: 'auto' }}>
            {jobResults.map(j => (
              <div key={j.id} onClick={() => selectJob(j)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => e.target.style.background = '#fff7ed'} onMouseLeave={e => e.target.style.background = '#fff'}>
                <strong>{j.name}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label style={lbl}>Start Date</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} required />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={{ flex: 1, padding: '10px', background: C.orange, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Assign Unit</button>
        <button type="button" onClick={(e) => assign(e, true)} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Reserve</button>
      </div>
      {msg && <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, background: msg.includes('Error') ? '#fef2f2' : '#f0fdf4', color: msg.includes('Error') ? '#dc2626' : '#16a34a' }}>{msg}</div>}
    </form>
  );
}

// ---- Active List ----
function ActiveList({ assignments, refresh, headers }) {
  const endAssignment = async (a) => {
    // Check if this job has other active assignments
    const sameJob = assignments.filter(x => x.job_id === a.job_id && x.id !== a.id);
    let endAll = false;
    if (sameJob.length > 0) {
      endAll = confirm(`This job has ${sameJob.length} other active unit(s).\n\nEnd ALL units for "${a.job_name}"?\n\nOK = End all | Cancel = End just ${a.unit_number}`);
    } else {
      if (!confirm(`End assignment for ${a.unit_number}?\nEnd date: ${new Date().toISOString().split('T')[0]}`)) return;
    }
    await axios.patch(`/api/assignments/${a.id}/end`, { endAll }, { headers });
    refresh();
  };

  if (!assignments.length) return <div style={{ color: C.slate, fontSize: 13, padding: 20, textAlign: 'center' }}>No active assignments</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {assignments.map(a => (
        <div key={a.id} style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{a.unit_number}</div>
              <div style={{ fontSize: 12, color: C.gray }}>{a.job_name} · Since {a.start_date}</div>
            </div>
            <button onClick={() => endAssignment(a)} style={{ padding: '4px 10px', fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>End</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Jobs Panel ----
function JobsPanel({ jobs, refresh, headers }) {
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', contact: '', phone: '', notes: '' });

  const open = (j) => { setEdit(j); setForm(j ? { name: j.name, contact: j.contact||'', phone: j.phone||'', notes: j.notes||'' } : { name: '', contact: '', phone: '', notes: '' }); setShow(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (edit) await axios.put(`/api/jobs/${edit.id}`, form, { headers });
    else await axios.post('/api/jobs', form, { headers });
    setShow(false); refresh();
  };

  const endJob = async (j) => {
    if (!confirm(`End ALL active units for "${j.name}"?`)) return;
    try {
      // Get all active assignments for this job and end them
      const res = await axios.get('/api/assignments', { headers });
      const active = res.data.filter(a => a.job_id === j.id && a.status === 'active');
      if (active.length === 0) { alert('No active assignments for this job.'); return; }
      await axios.patch(`/api/assignments/${active[0].id}/end`, { endAll: true }, { headers });
      refresh();
    } catch (err) { alert(err.response?.data?.error || 'Cannot end'); }
  };

  const del = async (j) => {
    if (!confirm('Delete ' + j.name + '?')) return;
    try { await axios.delete(`/api/jobs/${j.id}`, { headers }); refresh(); }
    catch (err) { alert(err.response?.data?.error || 'Cannot delete'); }
  };

  return (
    <div>
      <button onClick={() => open(null)} style={{ width: '100%', padding: '8px', background: C.orange, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>+ New Job</button>

      {show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShow(false)}>
          <form onSubmit={save} onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: 24, borderRadius: 12, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px' }}>{edit ? 'Edit Job' : 'New Job'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={lbl}>Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inp} required /></div>
              <div><label style={lbl}>Contact</label><input value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} style={inp} /></div>
              <div><label style={lbl}>Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={inp} /></div>
              <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" style={{ flex: 1, padding: 10, background: C.orange, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>{edit ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => setShow(false)} style={{ padding: 10, background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {jobs.map(j => (
          <div key={j.id} style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{j.name}</div>
              <div style={{ fontSize: 11, color: C.gray }}>{j.contact || 'No contact'} · {j.active_assignments || 0} active</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {j.active_assignments > 0 && <button onClick={() => endJob(j)} style={{ ...btnSm, color: '#dc2626' }}>End</button>}
              <button onClick={() => open(j)} style={{ ...btnSm, color: C.orange }}>Edit</button>
              <button onClick={() => del(j)} style={{ ...btnSm, color: '#dc2626' }}>Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- History ----
function HistoryPanel({ assignments }) {
  if (!assignments.length) return <div style={{ color: C.slate, fontSize: 13, padding: 20, textAlign: 'center' }}>No history</div>;
  const [expanded, setExpanded] = useState(null);

  // Group by job_id
  const byJob = {};
  assignments.forEach(a => {
    const key = a.job_id;
    if (!byJob[key]) {
      const start = new Date(a.start_date);
      const end = a.end_date ? new Date(a.end_date) : new Date();
      const diffDays = Math.ceil((end - start) / (1000*60*60*24));
      const weeks = Math.floor(diffDays / 7);
      const days = diffDays % 7;
      byJob[key] = {
        jobName: a.job_name, contact: a.job_contact, phone: a.job_phone, notes: a.job_notes,
        assignments: [], totalBoxes: 0, totalContainers: 0,
        startDate: a.start_date, endDate: a.end_date,
        weeks, days, diffDays,
      };
    }
    byJob[key].assignments.push(a);
    if (a.unit_type === 'container') byJob[key].totalContainers++;
    else byJob[key].totalBoxes++;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Object.entries(byJob).map(([jobId, job]) => {
        const isExpanded = expanded === jobId;
        const boxCost = job.totalBoxes * 50;
        const containerCost = job.totalContainers * 150;
        const totalCost = boxCost + containerCost;
        return (
          <div key={jobId} style={{ background: '#fff', borderRadius: 8, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div onClick={() => setExpanded(isExpanded ? null : jobId)}
              style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{job.jobName}</div>
                <div style={{ fontSize: 11, color: C.gray }}>{job.assignments.length} units · {job.startDate} → {job.endDate || 'active'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>${totalCost}/wk</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</div>
              </div>
            </div>
            {isExpanded && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa', fontSize: 12 }}>
                {(job.contact || job.phone) && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10, color: '#64748b' }}>
                    {job.contact && <div>📞 {job.contact}</div>}
                    {job.phone && <div>{job.phone}</div>}
                  </div>
                )}
                {job.notes && <div style={{ marginBottom: 10, color: '#64748b', fontStyle: 'italic' }}>"{job.notes}"</div>}
                <div style={{ marginBottom: 10 }}>
                  <strong>Duration:</strong> {job.weeks} weeks, {job.days} days ({job.diffDays} days total)
                  {!job.endDate && <span style={{ color: '#eab308', marginLeft: 8 }}>(Active)</span>}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Units:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {job.assignments.map(a => (
                      <span key={a.id} style={{ padding: '3px 8px', background: a.unit_type==='container'?'#fefce8':'#f0fdf4', borderRadius: 4, fontSize: 11, border: '1px solid '+(a.unit_type==='container'?'#fde68a':'#bbf7d0') }}>
                        {a.unit_number} — {a.status}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                  <div>Boxes: {job.totalBoxes} × $50</div>
                  <div>Containers: {job.totalContainers} × $150</div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Weekly: ${totalCost}</div>
                  <div style={{ gridColumn: '1/-1', fontWeight: 700, color: '#1e293b', fontSize: 13, marginTop: 4 }}>
                    Total Cost ({job.weeks}w {job.days}d): ${totalCost * job.weeks + Math.round(totalCost * job.days / 7)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 };
const inp = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' };
const sel = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', background: '#fff' };
const btnSm = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500 };
