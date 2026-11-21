import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDb() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('partfit.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS appliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      part_id TEXT,
      part_no TEXT,
      interval_months INTEGER NOT NULL DEFAULT 6,
      last_replaced_at TEXT,
      purchased_at TEXT,
      notes TEXT,
      match_confidence TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appliance_id INTEGER NOT NULL,
      part_no TEXT,
      date TEXT NOT NULL,
      cost REAL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_logs_appliance ON logs(appliance_id);
  `);
  return db;
}

export async function getSetting(key, fallback = null) {
  const d = await getDb();
  const row = await d.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const d = await getDb();
  await d.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)]
  );
}

export async function listAppliances() {
  const d = await getDb();
  return d.getAllAsync('SELECT * FROM appliances ORDER BY id DESC');
}

export async function getAppliance(id) {
  const d = await getDb();
  return d.getFirstAsync('SELECT * FROM appliances WHERE id = ?', [id]);
}

export async function addAppliance(a) {
  const d = await getDb();
  const res = await d.runAsync(
    `INSERT INTO appliances
      (nickname, category, brand, model, part_id, part_no, interval_months, last_replaced_at, purchased_at, notes, match_confidence, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      a.nickname,
      a.category,
      a.brand || null,
      a.model || null,
      a.partId || null,
      a.partNo || null,
      a.intervalMonths || 6,
      a.lastReplacedAt || null,
      a.purchasedAt || null,
      a.notes || null,
      a.matchConfidence || null,
      new Date().toISOString(),
    ]
  );
  return res.lastInsertRowId;
}

export async function updateAppliance(id, patch) {
  const d = await getDb();
  await d.runAsync(
    `UPDATE appliances SET nickname = ?, part_id = ?, part_no = ?, interval_months = ?, last_replaced_at = ?, notes = ?
     WHERE id = ?`,
    [patch.nickname, patch.partId || null, patch.partNo || null, patch.intervalMonths, patch.lastReplacedAt || null, patch.notes || null, id]
  );
}

export async function deleteAppliance(id) {
  const d = await getDb();
  await d.runAsync('DELETE FROM appliances WHERE id = ?', [id]);
  await d.runAsync('DELETE FROM logs WHERE appliance_id = ?', [id]);
}

export async function addLog(applianceId, log) {
  const d = await getDb();
  await d.runAsync('INSERT INTO logs (appliance_id, part_no, date, cost, note, created_at) VALUES (?,?,?,?,?,?)', [
    applianceId,
    log.partNo || null,
    log.date,
    log.cost ?? null,
    log.note || null,
    new Date().toISOString(),
  ]);
  await d.runAsync('UPDATE appliances SET last_replaced_at = ? WHERE id = ?', [log.date, applianceId]);
}

export async function listLogs(applianceId) {
  const d = await getDb();
  return d.getAllAsync('SELECT * FROM logs WHERE appliance_id = ? ORDER BY date DESC, id DESC', [applianceId]);
}

export async function countAll() {
  const d = await getDb();
  const a = await d.getFirstAsync('SELECT COUNT(*) AS n FROM appliances');
  const l = await d.getFirstAsync('SELECT COUNT(*) AS n FROM logs');
  return { appliances: a ? a.n : 0, logs: l ? l.n : 0 };
}
