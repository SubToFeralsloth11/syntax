const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins, getBalance } = require('../middleware/currency');

router.get('/trades', requireAuth, (req, res) => {
  const userId = req.user.id;

  const activeTrades = db.prepare(`
    SELECT t.*, u.display_name as from_name, u2.display_name as to_name
    FROM trades t
    JOIN users u ON u.id = t.from_id
    JOIN users u2 ON u2.id = t.to_id
    WHERE (t.from_id = ? OR t.to_id = ?) AND t.status = 'pending'
    ORDER BY t.created_at DESC
  `).all(userId, userId);

  const tradeHistory = db.prepare(`
    SELECT t.*, u.display_name as from_name, u2.display_name as to_name
    FROM trades t
    JOIN users u ON u.id = t.from_id
    JOIN users u2 ON u2.id = t.to_id
    WHERE (t.from_id = ? OR t.to_id = ?) AND t.status != 'pending'
    ORDER BY t.created_at DESC LIMIT 20
  `).all(userId, userId);

  const inventory = db.prepare(
    "SELECT * FROM inventory_items WHERE user_id = ? AND equipped = 0 ORDER BY acquired_at DESC"
  ).all(userId);

  res.render('trades', { activeTrades, tradeHistory, inventory });
});

router.post('/trades/propose', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { toId, fromCoins, toCoins, items } = req.body;

  if (!toId || parseInt(toId) === userId) {
    return res.json({ success: false, message: 'Invalid trade target' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(toId);
  if (!target) return res.json({ success: false, message: 'User not found' });

  const offerCoins = Math.max(0, parseInt(fromCoins) || 0);
  const requestCoins = Math.max(0, parseInt(toCoins) || 0);

  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (user.coins < offerCoins) return res.json({ success: false, message: 'Not enough coins to offer' });

  const tradeResult = db.prepare(
    'INSERT INTO trades (from_id, to_id, from_coins, to_coins, status) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, toId, offerCoins, requestCoins, 'pending');

  const tradeId = tradeResult.lastInsertRowid;

  if (items && Array.isArray(items)) {
    for (const itemId of items) {
      const item = db.prepare('SELECT * FROM inventory_items WHERE id = ? AND user_id = ? AND equipped = 0').get(itemId, userId);
      if (item) {
        db.prepare('INSERT INTO trade_items (trade_id, user_id, inventory_item_id) VALUES (?, ?, ?)').run(tradeId, userId, itemId);
      }
    }
  }

  res.json({ success: true, message: 'Trade proposed!', tradeId });
});

router.post('/trades/accept', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { tradeId } = req.body;

  const trade = db.prepare('SELECT * FROM trades WHERE id = ? AND to_id = ? AND status = ?').get(tradeId, userId, 'pending');
  if (!trade) return res.json({ success: false, message: 'Trade not found' });

  const toUser = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (toUser.coins < trade.to_coins) return res.json({ success: false, message: 'You do not have enough coins' });

  const fromUser = db.prepare('SELECT coins FROM users WHERE id = ?').get(trade.from_id);
  if (fromUser.coins < trade.from_coins) return res.json({ success: false, message: 'Offerer no longer has enough coins' });

  // Transfer coins
  if (trade.from_coins > 0) {
    awardCoins(trade.from_id, -trade.from_coins, 'trade_give');
    awardCoins(userId, trade.from_coins, 'trade_receive');
  }
  if (trade.to_coins > 0) {
    awardCoins(userId, -trade.to_coins, 'trade_give');
    awardCoins(trade.from_id, trade.to_coins, 'trade_receive');
  }

  // Transfer items
  const fromItems = db.prepare('SELECT * FROM trade_items WHERE trade_id = ? AND user_id = ?').all(tradeId, trade.from_id);
  for (const ti of fromItems) {
    db.prepare('UPDATE inventory_items SET user_id = ? WHERE id = ? AND user_id = ?').run(userId, ti.inventory_item_id, trade.from_id);
  }

  db.prepare('UPDATE trades SET status = ? WHERE id = ?').run('accepted', tradeId);

  const { updateQuestProgress } = require('../middleware/quests');
  updateQuestProgress(trade.from_id, 'trade');
  updateQuestProgress(userId, 'trade');

  res.json({ success: true, message: 'Trade accepted!' });
});

router.post('/trades/reject', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { tradeId } = req.body;

  const trade = db.prepare('SELECT * FROM trades WHERE id = ? AND (to_id = ? OR from_id = ?) AND status = ?').get(tradeId, userId, userId, 'pending');
  if (!trade) return res.json({ success: false, message: 'Trade not found' });

  db.prepare('DELETE FROM trade_items WHERE trade_id = ?').run(tradeId);
  db.prepare('UPDATE trades SET status = ? WHERE id = ?').run('rejected', tradeId);
  res.json({ success: true, message: 'Trade rejected' });
});

module.exports = router;
