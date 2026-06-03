import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { getWalkways } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Serve built frontend in production
const distPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(distPath));

const ADMIN_PASSWORD = 'admin123';
const tokens = new Set();

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && tokens.has(token)) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// Auth
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    tokens.add(token);
    res.json({ token });
  } else res.status(401).json({ error: 'Invalid password' });
});
app.get('/api/check-auth', requireAuth, (req, res) => res.json({ authenticated: true }));
app.post('/api/logout', (req, res) => {
  const t = req.headers.authorization?.replace('Bearer ', '');
  if (t) tokens.delete(t);
  res.json({ ok: true });
});

// Stats
app.get('/api/stats', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM units').get().c;
  const available = db.prepare("SELECT COUNT(*) as c FROM units WHERE status='available'").get().c;
  const occupied = db.prepare("SELECT COUNT(*) as c FROM units WHERE status='occupied'").get().c;
  const reserved = db.prepare("SELECT COUNT(*) as c FROM units WHERE status='reserved'").get().c;
  const byType = db.prepare(`SELECT us.name, u.type, COUNT(*) as total, SUM(CASE WHEN u.status='available' THEN 1 ELSE 0 END) as available, SUM(CASE WHEN u.status='occupied' THEN 1 ELSE 0 END) as occupied FROM units u JOIN unit_sizes us ON u.size_id=us.id GROUP BY us.name, u.type`).all();
  res.json({ total, available, occupied, reserved, maintenance: 0, byType });
});

// Units
app.get('/api/units', requireAuth, (req, res) => {
  const units = db.prepare(`SELECT u.*, us.name as size_name, us.dimensions, us.volume FROM units u JOIN unit_sizes us ON u.size_id=us.id ORDER BY u.row_label, u.unit_number`).all();
  // Add streets
  const walkways = loadWalkways();
  const named = walkways.filter(w => w.label?.trim());
  units.forEach(u => { u.street = getStreet(u, named); });
  res.json(units);
});

app.put('/api/units/:id', requireAuth, (req, res) => {
  const fields = [], params = [];
  ['unit_number','size_id','type','status','pos_x','pos_y','width','height','door_side','row_label','section','notes'].forEach(f => { if (req.body[f] !== undefined) { fields.push(f+'=?'); params.push(req.body[f]); } });
  if (!fields.length) return res.json({ error: 'no fields' });
  params.push(req.params.id);
  db.prepare(`UPDATE units SET ${fields.join(',')} WHERE id=?`).run(...params);
  res.json({ updated: true });
});

app.post('/api/units/batch-positions', requireAuth, (req, res) => {
  const stmt = db.prepare('UPDATE units SET pos_x=?, pos_y=?, width=?, height=? WHERE id=?');
  db.transaction(items => items.forEach(i => stmt.run(i.position_x, i.position_y, i.width, i.height, i.id)))(req.body.updates || []);
  res.json({ updated: (req.body.updates||[]).length });
});

// Floor plan
app.get('/api/floor-plan', requireAuth, (req, res) => {
  const units = db.prepare(`SELECT u.*, us.name as size_name, us.dimensions, us.volume, a.id as assignment_id, a.job_id, a.start_date, j.name as job_name, j.contact as job_contact, j.phone as job_phone, j.notes as job_notes FROM units u JOIN unit_sizes us ON u.size_id=us.id LEFT JOIN assignments a ON u.id=a.unit_id AND a.status='active' LEFT JOIN jobs j ON a.job_id=j.id ORDER BY u.row_label, u.unit_number`).all();
  let walkways = loadWalkways();
  if (!walkways.length) walkways = getWalkways();
  const named = walkways.filter(w => w.label?.trim());
  units.forEach(u => { u.street = getStreet(u, named); });
  let texts = [];
  try { const cfg = db.prepare('SELECT texts FROM floor_plan_config WHERE id=1').get(); if (cfg?.texts) texts = JSON.parse(cfg.texts); } catch {}
  res.json({ units, walkways, texts });
});

app.put('/api/floor-plan', requireAuth, (req, res) => {
  if (req.body.walkways) {
    db.prepare('UPDATE floor_plan_config SET walkways=? WHERE id=1').run(JSON.stringify(req.body.walkways));
  }
  if (req.body.texts) {
    db.prepare("UPDATE floor_plan_config SET texts=? WHERE id=1").run(JSON.stringify(req.body.texts));
  }
  res.json({ saved: true });
});

// Jobs
app.get('/api/jobs', requireAuth, (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY name').all();
  const withCounts = jobs.map(j => ({ ...j, active_assignments: db.prepare("SELECT COUNT(*) as c FROM assignments WHERE job_id=? AND status='active'").get(j.id).c }));
  res.json({ jobs: withCounts, total: withCounts.length });
});
app.get('/api/jobs/search', requireAuth, (req, res) => {
  const q = `%${req.query.q||''}%`;
  res.json(db.prepare('SELECT * FROM jobs WHERE name LIKE ? OR contact LIKE ? LIMIT 10').all(q,q));
});
app.post('/api/jobs', requireAuth, (req, res) => {
  const { name, contact, phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO jobs (name,contact,phone,notes) VALUES (?,?,?,?)').run(name, contact||null, phone||null, notes||null);
  res.status(201).json({ id: r.lastInsertRowid, ...req.body });
});
app.put('/api/jobs/:id', requireAuth, (req, res) => {
  const fields = [], params = [];
  ['name','contact','phone','notes'].forEach(f => { if (req.body[f] !== undefined) { fields.push(f+'=?'); params.push(req.body[f]); } });
  if (!fields.length) return res.json({ error: 'no fields' });
  params.push(req.params.id);
  db.prepare(`UPDATE jobs SET ${fields.join(',')} WHERE id=?`).run(...params);
  res.json({ updated: true });
});
app.delete('/api/jobs/:id', requireAuth, (req, res) => {
  const active = db.prepare("SELECT COUNT(*) as c FROM assignments WHERE job_id=? AND status='active'").get(req.params.id);
  if (active.c > 0) return res.status(400).json({ error: 'Cannot delete job with active assignments. End them first.' });
  db.prepare('DELETE FROM assignments WHERE job_id=?').run(req.params.id);
  db.prepare('DELETE FROM jobs WHERE id=?').run(req.params.id);
  res.json({ deleted: true });
});

// Assignments
app.get('/api/assignments', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT a.*, u.unit_number, u.type as unit_type, us.name as size_name, j.name as job_name, j.contact as job_contact, j.phone as job_phone, j.notes as job_notes FROM assignments a JOIN units u ON a.unit_id=u.id JOIN unit_sizes us ON u.size_id=us.id JOIN jobs j ON a.job_id=j.id ORDER BY a.start_date DESC`).all());
});
app.post('/api/assignments', requireAuth, (req, res) => {
  const { unit_id, job_id, start_date } = req.body;
  const unit = db.prepare('SELECT status FROM units WHERE id=?').get(unit_id);
  if (!unit) return res.status(400).json({ error: 'Unit not found' });
  if (unit.status !== 'available' && unit.status !== 'reserved') return res.status(400).json({ error: 'Unit is ' + unit.status });
  if (db.prepare("SELECT id FROM assignments WHERE unit_id=? AND status='active'").get(unit_id)) return res.status(400).json({ error: 'Unit already assigned' });
  const r = db.prepare('INSERT INTO assignments (unit_id,job_id,start_date,status) VALUES (?,?,?,?)').run(unit_id, job_id, start_date, 'active');
  db.prepare("UPDATE units SET status='occupied' WHERE id=?").run(unit_id);
  res.status(201).json({ id: r.lastInsertRowid });
});
app.patch('/api/assignments/:id/end', requireAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.status !== 'active') return res.status(400).json({ error: 'Not active' });
  const today = new Date().toISOString().split('T')[0];
  if (req.body.endAll) {
    const all = db.prepare("SELECT * FROM assignments WHERE job_id=? AND status='active'").all(a.job_id);
    all.forEach(x => { db.prepare("UPDATE assignments SET status='ended', end_date=? WHERE id=?").run(today, x.id); db.prepare("UPDATE units SET status='available' WHERE id=?").run(x.unit_id); });
    res.json({ ended: all.length, endDate: today });
  } else {
    db.prepare("UPDATE assignments SET status='ended', end_date=? WHERE id=?").run(today, req.params.id);
    db.prepare("UPDATE units SET status='available' WHERE id=?").run(a.unit_id);
    res.json({ ended: 1, endDate: today });
  }
});

// Operations
app.get('/api/operations/recommend', requireAuth, (req, res) => {
  const truckVolumes = { '4': 20, '6': 30, '8': 45, '10': 60, '12': 75 };
  const truck = req.query.truck, fillPct = parseInt(req.query.fill) || 100;
  if (!truckVolumes[truck]) return res.status(400).json({ error: 'Invalid truck' });
  if (fillPct < 50 || fillPct > 100) return res.status(400).json({ error: 'Fill must be 50-100%' });

  const cargoM3 = truckVolumes[truck] * (fillPct / 100);
  const boxM3 = 8, containerM3 = 32;
  const boxesOnly = Math.ceil(cargoM3 / boxM3);
  const containersOnly = Math.ceil(cargoM3 / containerM3);
  const mixContainers = Math.floor(cargoM3 / containerM3);
  const mixBoxes = Math.ceil((cargoM3 - mixContainers * containerM3) / boxM3);
  let choice = req.query.choice || 'boxes';

  const availBoxes = db.prepare("SELECT * FROM units WHERE status='available' AND type='box'").all();
  const availContainers = db.prepare("SELECT * FROM units WHERE status='available' AND type='container'").all();

  // If not enough containers for the chosen option, fall back to boxes
  let fallbackNote = '';
  if ((choice === 'containers' || choice === 'mix') && containersOnly > availContainers.length) {
    fallbackNote = `Only ${availContainers.length} container(s) available — using boxes instead.`;
    choice = 'boxes';
  }
  if (choice === 'mix' && mixContainers > availContainers.length) {
    fallbackNote = `Only ${availContainers.length} container(s) available — adjusted.`;
  }
  const walkways = loadWalkways();
  const named = walkways.filter(w => w.label?.trim());

  function pickClosest(available, count) {
    if (!available.length || !count) return [];
    const all = available.map(u => ({ id: u.id, unit_number: u.unit_number, street: getStreet(u, named), x: u.pos_x+u.width/2, y: u.pos_y+u.height/2 }));
    const rec = [], picked = new Set();
    let first = all[0], mostN = 0;
    all.forEach(b => { const n = all.filter(o => o.id!==b.id && Math.abs(o.x-b.x)<150 && Math.abs(o.y-b.y)<150).length; if (n>mostN) { mostN=n; first=b; } });
    picked.add(first.id); rec.push(first);
    while (rec.length < count && picked.size < all.length) {
      let closest = null, cd = Infinity;
      rec.forEach(rb => { const r = all.find(a=>a.id===rb.id); all.forEach(c => { if (!picked.has(c.id)) { const d = Math.sqrt((r.x-c.x)**2+(r.y-c.y)**2); if (d<cd) { cd=d; closest=c; } } }); });
      if (closest) { picked.add(closest.id); rec.push(closest); } else break;
    }
    return rec;
  }

  const neededBoxes = choice === 'containers' ? 0 : (choice === 'mix' ? mixBoxes : boxesOnly);
  const neededContainers = choice === 'boxes' ? 0 : (choice === 'mix' ? mixContainers : containersOnly);
  const recBoxes = pickClosest(availBoxes, neededBoxes).map(b => ({ id: b.id, unit_number: b.unit_number, street: b.street }));
  const recContainers = pickClosest(availContainers, neededContainers).map(c => ({ id: c.id, unit_number: c.unit_number, street: c.street }));

  res.json({
    truck: { tons: parseInt(truck), fillPct },
    cargoM3: Math.round(cargoM3*10)/10,
    options: {
      boxes: { boxes: boxesOnly, containers: 0, cost: boxesOnly*50, label: boxesOnly + ' Modular Units ($'+(boxesOnly*50)+'/wk)' },
      containers: { boxes: 0, containers: containersOnly, cost: containersOnly*150, label: containersOnly + ' Container(s) ($'+(containersOnly*150)+'/wk)' },
      mix: mixContainers>0 ? { boxes: mixBoxes, containers: mixContainers, cost: mixContainers*150+mixBoxes*50, label: mixContainers+' Container(s) + '+mixBoxes+' Units ($'+(mixContainers*150+mixBoxes*50)+'/wk)' } : null,
    },
    choice, fallbackNote, recBoxes, recContainers,
    totalAvailBoxes: availBoxes.length, totalAvailContainers: availContainers.length,
  });
});

// ---- Helpers ----
function loadWalkways() {
  try { const cfg = db.prepare('SELECT walkways FROM floor_plan_config WHERE id=1').get(); if (cfg?.walkways) return JSON.parse(cfg.walkways); } catch {}
  return [];
}

function getStreet(u, namedWalkways) {
  const overrides = { 'S-11': 'Sydney Street', 'S-12': 'Sydney Street' };
  if (overrides[u.unit_number]) return overrides[u.unit_number];
  const z = u.zone || '';
  let ds;
  if (u.unit_number === 'L-41') ds = 'west';
  else if (z === 'NW Row 1') ds = 'south'; else if (z === 'NW Row 2') ds = 'north'; else if (z === 'NW Row 3') ds = 'south';
  else if (z === 'NW Left') ds = 'east'; else if (z === 'Containers') ds = 'west';
  else if (z === 'SW Col 1') ds = 'east'; else if (z === 'SW Col 2' || z === 'SW Col 4' || z === 'SW Col 6') ds = 'west';
  else if (z === 'SW Col 3' || z === 'SW Col 5') ds = 'east'; else if (z === 'SE Top') ds = 'south'; else if (z === 'SE Bottom') ds = 'north';
  if (!ds) return null;
  const cx = u.pos_x+u.width/2, cy = u.pos_y+u.height/2;
  let best = null, bestDist = Infinity;
  namedWalkways.forEach(w => {
    const wx = (w.x1+w.x2)/2, wy = (w.y1+w.y2)/2, isH = Math.abs(w.y2-w.y1) < Math.abs(w.x2-w.x1);
    let ok = false;
    if (ds==='north' && isH && wy<cy) ok=true; if (ds==='south' && isH && wy>cy) ok=true;
    if (ds==='east' && !isH && wx>cx) ok=true; if (ds==='west' && !isH && wx<cx) ok=true;
    if (ok) { const d = Math.sqrt((cx-wx)**2+(cy-wy)**2); if (d<bestDist) { bestDist=d; best=w; } }
  });
  return best ? best.label + ' Street' : null;
}

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
