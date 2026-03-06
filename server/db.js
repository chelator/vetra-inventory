const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "vetra.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'technician',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'notstarted',
      client TEXT DEFAULT '',
      wind_farm TEXT DEFAULT '',
      location TEXT DEFAULT '',
      project_ref TEXT DEFAULT '',
      turbine_model TEXT DEFAULT '',
      blade_type TEXT DEFAULT '',
      team TEXT DEFAULT '',
      start_date TEXT DEFAULT '',
      mob_date TEXT DEFAULT '',
      planned_end_date TEXT DEFAULT '',
      project_notes TEXT DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS turbines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blades (
      id TEXT PRIMARY KEY,
      turbine_id TEXT NOT NULL REFERENCES turbines(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS damages (
      id TEXT PRIMARY KEY,
      blade_id TEXT NOT NULL REFERENCES blades(id) ON DELETE CASCADE,
      number TEXT DEFAULT '',
      type TEXT DEFAULT '',
      severity TEXT DEFAULT '',
      radius TEXT DEFAULT '',
      locations TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
      estimated_hours REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'notstarted',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT DEFAULT '',
      category TEXT DEFAULT 'Other',
      notes TEXT DEFAULT '',
      min_stock INTEGER NOT NULL DEFAULT 0,
      batch_number TEXT DEFAULT '',
      expiry_date TEXT DEFAULT '',
      stock_alert INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      turbine_id TEXT REFERENCES turbines(id),
      blade_id TEXT REFERENCES blades(id),
      damage_id TEXT REFERENCES damages(id),
      turbine TEXT DEFAULT '',
      blade_ref TEXT DEFAULT '',
      damage_json TEXT NOT NULL DEFAULT '{}',
      date TEXT DEFAULT '',
      technician TEXT DEFAULT '',
      access_method TEXT DEFAULT '',
      weather_json TEXT NOT NULL DEFAULT '{}',
      notes TEXT DEFAULT '',
      operations_json TEXT NOT NULL DEFAULT '[]',
      materials_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS active_project (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      project_id TEXT REFERENCES projects(id)
    );
  `);
}

function uid() {
  return Date.now().toString(36) + "-" + crypto.randomBytes(6).toString("hex");
}

module.exports = { getDb, uid };
