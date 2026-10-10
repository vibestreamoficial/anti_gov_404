const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'anti_gov_404.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'pending',
    ban_reason TEXT,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    nick TEXT,
    text TEXT,
    image_url TEXT,
    flagged INTEGER DEFAULT 0,
    flag_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    target TEXT,
    by_nick TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function ensureAdmin() {
  const row = db.prepare('SELECT id FROM users WHERE nick = ?').get('admin');
  if (!row) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      `INSERT INTO users (nick, email, password_hash, role, status) VALUES (?, ?, ?, 'owner', 'approved')`
    ).run('admin', 'admin@local', hash);
    console.log('[db] Owner criado: admin / admin123');
  }
}

ensureAdmin();

module.exports = db;
