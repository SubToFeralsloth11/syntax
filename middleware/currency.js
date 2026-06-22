const db = require('../db/database');

function awardCoins(userId, amount, reason) {
  if (amount < 0) {
    const current = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!current || current.coins + amount < 0) {
      amount = -(current ? current.coins : 0);
    }
  }

  if (amount > 0) {
    const eventBonus = db.prepare('SELECT multiplier FROM user_bonuses WHERE user_id = ? AND bonus_type = ? AND expires_at > datetime("now")').get(userId, 'visit');
    if (eventBonus && eventBonus.multiplier > 1) {
      amount = Math.floor(amount * eventBonus.multiplier);
    }
  }

  const insertTx = db.prepare(
    'INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)'
  );
  const updateUser = db.prepare(
    'UPDATE users SET coins = MAX(0, coins + ?), total_coins_earned = total_coins_earned + ? WHERE id = ?'
  );

  const tx = db.transaction(() => {
    insertTx.run(userId, amount, reason);
    updateUser.run(amount, amount > 0 ? amount : 0, userId);

    if (amount > 0) {
      const state = db.prepare('SELECT coins_toward_jackpot FROM lottery_state WHERE id = 1').get();
      if (state) {
        const newAccum = state.coins_toward_jackpot + amount;
        const bumps = Math.floor(newAccum / 10);
        const remainder = newAccum % 10;
        if (bumps > 0) {
          db.prepare('UPDATE lottery_state SET jackpot = jackpot + ?, coins_toward_jackpot = ? WHERE id = 1').run(bumps, remainder);
        } else {
          db.prepare('UPDATE lottery_state SET coins_toward_jackpot = ? WHERE id = 1').run(remainder);
        }
      }
    }
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
