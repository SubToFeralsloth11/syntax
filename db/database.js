const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DATABASE_PATH || './data/syntax.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migrations: add coins_toward_jackpot column to lottery_state if missing
try {
  db.prepare('SELECT coins_toward_jackpot FROM lottery_state LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE lottery_state ADD COLUMN coins_toward_jackpot INTEGER DEFAULT 0');
}

// Migrations: add last_read_chat column to users if missing
try {
  db.prepare('SELECT last_read_chat FROM users LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE users ADD COLUMN last_read_chat INTEGER DEFAULT 0');
}

const { restoreAccounts } = require('./accounts');
const restored = restoreAccounts(db);
if (restored > 0) console.log(`Restored ${restored} account(s) from accounts.json`);

module.exports = db;
