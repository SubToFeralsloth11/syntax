const db = require('../db/database');

function awardCoins(userId, amount, reason) {
  const insertTx = db.prepare(
    'INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)'
  );
  const updateUser = db.prepare(
    'UPDATE users SET coins = coins + ?, total_coins_earned = total_coins_earned + ? WHERE id = ?'
  );

  const tx = db.transaction(() => {
    insertTx.run(userId, amount, reason);
    updateUser.run(amount, amount > 0 ? amount : 0, userId);
  });

  tx();
}

function getBalance(userId) {
  const row = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  return row ? row.coins : 0;
}

function getRecentTransactions(userId, limit = 10) {
  return db.prepare(
    'SELECT * FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit);
}

module.exports = { awardCoins, getBalance, getRecentTransactions };
