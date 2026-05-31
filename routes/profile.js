const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { getRecentTransactions } = require('../middleware/currency');

router.get('/profile', requireAuth, (req, res) => {
  const userId = req.user.id;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  const transactions = getRecentTransactions(userId, 20);

  const inventory = db.prepare(
    "SELECT * FROM inventory_items WHERE user_id = ? ORDER BY acquired_at DESC"
  ).all(userId);

  const achievements = db.prepare(`
    SELECT a.name, a.description, a.icon, ua.earned_at
    FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = ?
    ORDER BY ua.earned_at DESC
  `).all(userId);

  const totalCheckins = db.prepare(
    "SELECT COUNT(*) as cnt FROM daily_checkins WHERE user_id = ?"
  ).get(userId).cnt;

  const totalVisits = db.prepare(
    "SELECT COUNT(DISTINCT page_path) as cnt FROM page_visits WHERE user_id = ?"
  ).get(userId).cnt;

  const totalPlays = db.prepare(
    "SELECT COUNT(DISTINCT game_id) as cnt FROM game_plays WHERE user_id = ?"
  ).get(userId).cnt;

  res.render('profile', {
    user,
    transactions,
    inventory,
    achievements,
    totalCheckins,
    totalVisits,
    totalPlays
  });
});

router.post('/profile/equip', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { itemId } = req.body;

  const item = db.prepare(
    "SELECT * FROM inventory_items WHERE id = ? AND user_id = ?"
  ).get(itemId, userId);

  if (!item) return res.json({ success: false, message: 'Item not found' });

  db.prepare(
    "UPDATE inventory_items SET equipped = 0 WHERE user_id = ? AND item_type = ?"
  ).run(userId, item.item_type);

  db.prepare(
    "UPDATE inventory_items SET equipped = 1 WHERE id = ?"
  ).run(itemId);

  const updateField = item.item_type === 'frame' ? 'equipped_frame'
    : item.item_type === 'badge' ? 'equipped_badge'
    : 'equipped_title';

  db.prepare(`UPDATE users SET ${updateField} = ? WHERE id = ?`).run(item.item_name, userId);

  res.json({ success: true });
});

router.post('/profile/unequip', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { itemType } = req.body;

  db.prepare(
    "UPDATE inventory_items SET equipped = 0 WHERE user_id = ? AND item_type = ?"
  ).run(userId, itemType);

  const updateField = itemType === 'frame' ? 'equipped_frame'
    : itemType === 'badge' ? 'equipped_badge'
    : 'equipped_title';

  db.prepare(`UPDATE users SET ${updateField} = NULL WHERE id = ?`).run(userId);

  res.json({ success: true });
});

module.exports = router;
