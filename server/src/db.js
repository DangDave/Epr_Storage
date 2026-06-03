import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data', 'storage.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS unit_sizes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    dimensions TEXT,
    volume TEXT
  );
  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_number TEXT UNIQUE NOT NULL,
    size_id INTEGER REFERENCES unit_sizes(id),
    type TEXT DEFAULT 'box',
    status TEXT DEFAULT 'available',
    door_side TEXT,
    row_label TEXT,
    section TEXT,
    pos_x REAL DEFAULT 0,
    pos_y REAL DEFAULT 0,
    width REAL DEFAULT 90,
    height REAL DEFAULT 60,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, contact TEXT, phone TEXT, notes TEXT
  );
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER REFERENCES units(id),
    job_id INTEGER REFERENCES jobs(id),
    start_date TEXT,
    status TEXT DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS floor_plan_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    walkways TEXT DEFAULT '[]'
  );
  INSERT OR IGNORE INTO floor_plan_config (id, walkways) VALUES (1, '[]');
`);

const sizeCount = db.prepare('SELECT COUNT(*) as c FROM unit_sizes').get().c;
if (sizeCount === 0) {
  db.prepare("INSERT INTO unit_sizes VALUES (1, 'Small Box', '2.4m x 2.2m', '--')").run();
  db.prepare("INSERT INTO unit_sizes VALUES (2, 'Large Box', '2.4m x 2.2m x 2.5m', '8m³')").run();
  db.prepare("INSERT INTO unit_sizes VALUES (3, 'Shipping Container', '--', '--')").run();
}

const unitCount = db.prepare('SELECT COUNT(*) as c FROM units').get().c;
if (unitCount === 0) {
  const boxes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'traced_boxes.json'), 'utf-8'));

  const insert = db.prepare(
    "INSERT INTO units (unit_number, size_id, type, status, door_side, row_label, section, pos_x, pos_y, width, height) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  );

  let counts = { container: 0, small: 0, large: 0 };
  for (const b of boxes) {
    const rowLabel = b.type === 'container' ? 'NE' : (b.size_id === 1 ? 'NW' : 'SW');
    const section = rowLabel.toLowerCase();
    insert.run(b.unit, b.size_id, b.type, b.status || 'available', b.door, rowLabel, section, b.x, b.y, b.w, b.h);
    if (b.type === 'container') counts.container++;
    else if (b.size_id === 1) counts.small++;
    else counts.large++;
  }
  console.log(`Seeded: ${counts.container} containers, ${counts.small} small, ${counts.large} large = ${counts.container+counts.small+counts.large} total`);
}

export function getWalkways() {
  return [];
}

export default db;
