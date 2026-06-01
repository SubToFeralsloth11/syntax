const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.get('/quests', requireAuth, (req, res) => {
  const { getUserQuests } = require('../middleware/quests');
  const { getLevelProgress } = require('../middleware/xp');
  const quests = getUserQuests(req.user.id);
  const lvl = getLevelProgress(req.user.id);
  res.render('quests', { quests, lvl });
});

module.exports = router;
