const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins } = require('../middleware/currency');
const { awardXP } = require('../middleware/xp');
const { updateQuestProgress } = require('../middleware/quests');
const games = require('../config/games.json');

router.get('/', (req, res) => {
  let user = null;
  let checkedIn = false;
  let streak = 0;
  let questProgress = [];

  if (req.isAuthenticated()) {
    const today = new Date().toISOString().split('T')[0];
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const checkin = db.prepare(
      'SELECT id FROM daily_checkins WHERE user_id = ? AND checkin_date = ?'
    ).get(req.user.id, today);
    checkedIn = !!checkin;

    const streakRow = db.prepare('SELECT current_streak FROM daily_streaks WHERE user_id = ?').get(req.user.id);
    streak = streakRow ? streakRow.current_streak : 0;

    const { getUserQuests } = require('../middleware/quests');
    const { getLevelProgress } = require('../middleware/xp');
    const allQuests = getUserQuests(req.user.id);
    questProgress = allQuests.filter(q => !q.completed).slice(0, 3);
    var lvl = getLevelProgress(req.user.id);
  }

  res.render('index', { user, games, checkedIn, streak, questProgress, lvl });
});

router.post('/checkin', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user.id;

  const existing = db.prepare(
    'SELECT id FROM daily_checkins WHERE user_id = ? AND checkin_date = ?'
  ).get(userId, today);

  if (existing) {
    return res.json({ success: false, message: 'Already checked in today!' });
  }

  db.prepare('INSERT INTO daily_checkins (user_id, checkin_date) VALUES (?, ?)').run(userId, today);

  let streak = 1;
  const streakRow = db.prepare('SELECT current_streak, last_checkin_date FROM daily_streaks WHERE user_id = ?').get(userId);
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streakRow) {
    if (streakRow.last_checkin_date === yesterday) {
      streak = streakRow.current_streak + 1;
      db.prepare('UPDATE daily_streaks SET current_streak = ?, last_checkin_date = ? WHERE user_id = ?').run(streak, today, userId);
    } else if (streakRow.last_checkin_date !== today) {
      streak = 1;
      db.prepare('UPDATE daily_streaks SET current_streak = ?, last_checkin_date = ? WHERE user_id = ?').run(1, today, userId);
    }
  } else {
    db.prepare('INSERT INTO daily_streaks (user_id, current_streak, last_checkin_date) VALUES (?, ?, ?)').run(userId, 1, today);
  }

  let coins = 10;
  if (streak >= 5) {
    coins = 25;
  }

  awardCoins(userId, coins, 'checkin');
  awardXP(userId, 25, 'checkin');
  updateQuestProgress(userId, 'checkin');

  if (streak === 3) {
    const ach = db.prepare('SELECT id FROM achievements WHERE name = ?').get('Streak Starter');
    if (ach) {
      const hasIt = db.prepare('SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?').get(userId, ach.id);
      if (!hasIt) {
        db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, ach.id);
        awardCoins(userId, ach.reward_coins, 'achievement');
      }
    }
  }

  res.json({ success: true, coins, streak });
});

module.exports = router;
