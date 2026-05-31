const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins } = require('../middleware/currency');
const { checkAchievement } = require('../middleware/achievements');
const games = require('../config/games.json');

router.get('/games', requireAuth, (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const visitedToday = db.prepare(
    "SELECT page_path FROM page_visits WHERE user_id = ? AND visited_date = ?"
  ).all(userId, today);
  const visitedPaths = visitedToday.map(v => v.page_path);

  const playedToday = db.prepare(
    "SELECT game_id FROM game_plays WHERE user_id = ? AND play_date = ?"
  ).all(userId, today);
  const playedIds = playedToday.map(p => p.game_id);

  res.render('games', { games, visitedPaths, playedIds });
});

router.get('/games/:id', requireAuth, (req, res) => {
  const game = games.find(g => g.id === req.params.id);
  if (!game) return res.redirect('/games');

  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const pagePath = `/games/${game.id}`;

  const alreadyVisited = db.prepare(
    'SELECT id FROM page_visits WHERE user_id = ? AND page_path = ? AND visited_date = ?'
  ).get(userId, pagePath, today);

  if (!alreadyVisited) {
    db.prepare('INSERT INTO page_visits (user_id, page_path, visited_date) VALUES (?, ?, ?)').run(userId, pagePath, today);
    awardCoins(userId, 2, 'visit');

    const visitedPages = db.prepare(
      "SELECT COUNT(DISTINCT page_path) as cnt FROM page_visits WHERE user_id = ? AND page_path LIKE '/games/%'"
    ).get(userId);
    if (visitedPages.cnt >= 5) {
      const coins = checkAchievement(userId, 'Explorer');
      if (coins) awardCoins(userId, coins, 'achievement');
    }
    if (visitedPages.cnt >= 10) {
      const coins = checkAchievement(userId, 'Globetrotter');
      if (coins) awardCoins(userId, coins, 'achievement');
    }
  }

  const playedToday = db.prepare(
    "SELECT id FROM game_plays WHERE user_id = ? AND game_id = ? AND play_date = ?"
  ).get(userId, game.id, today);

  res.render('game-detail', { game, playedToday: !!playedToday });
});

router.post('/games/:id/play', requireAuth, (req, res) => {
  const game = games.find(g => g.id === req.params.id);
  if (!game || game.status !== 'active') {
    return res.json({ success: false, message: 'Game not available' });
  }

  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const alreadyPlayed = db.prepare(
    "SELECT id FROM game_plays WHERE user_id = ? AND game_id = ? AND play_date = ?"
  ).get(userId, game.id, today);

  if (alreadyPlayed) {
    return res.json({ success: false, message: 'Already played this game today!' });
  }

  db.prepare('INSERT INTO game_plays (user_id, game_id, play_date) VALUES (?, ?, ?)').run(userId, game.id, today);
  awardCoins(userId, 5, 'play');
  res.json({ success: true, coins: 5 });
});

module.exports = router;
