const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', 'data', 'accounts.json');

function loadLog() {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLog(accounts) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(accounts, null, 2), 'utf8');
}

function addToLog(email, passwordHash, displayName, role) {
  const accounts = loadLog();
  const existing = accounts.find(a => a.email === email);
  if (existing) {
    existing.password_hash = passwordHash;
    existing.display_name = displayName;
    if (role) existing.role = role;
    existing.updated_at = new Date().toISOString();
  } else {
    accounts.push({
      email,
      password_hash: passwordHash,
      display_name: displayName,
      role: role || 'user',
      created_at: new Date().toISOString()
    });
  }
  saveLog(accounts);
}

function restoreAccounts(db) {
  const accounts = loadLog();
  let restored = 0;
  for (const acct of accounts) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(acct.email);
    if (!exists) {
      db.prepare(
        'INSERT INTO users (email, password_hash, display_name, coins, total_coins_earned, role) VALUES (?, ?, ?, 50, 50, ?)'
      ).run(acct.email, acct.password_hash, acct.display_name, acct.role || 'user');
      restored++;
    }
  }
  return restored;
}

module.exports = { addToLog, restoreAccounts, loadLog };
