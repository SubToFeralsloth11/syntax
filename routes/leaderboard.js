const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.get('/leaderboard', requireAuth, (req, res) => {
  const users = db.prepare(`
    SELECT id, display_name, avatar, coins, total_coins_earned,
      equipped_frame, equipped_badge, equipped_title
    FROM users
    ORDER BY total_coins_earned DESC
    LIMIT 100
  `).all();

  const rank = db.prepare(`
    SELECT COUNT(*) + 1 as rank FROM users
    WHERE total_coins_earned > (SELECT total_coins_earned FROM users WHERE id = ?)
  `).get(req.user.id).rank;

  const currentUserData = db.prepare(
    'SELECT total_coins_earned, coins FROM users WHERE id = ?'
  ).get(req.user.id);

  res.render('leaderboard', { users, rank, currentUser: currentUserData });
});

module.exports = router;
