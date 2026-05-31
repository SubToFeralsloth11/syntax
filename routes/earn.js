const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins, getBalance } = require('../middleware/currency');
const { checkAchievement } = require('../middleware/achievements');
const mysteryBoxItems = require('../config/mystery-box-items.json');
const wheelSegments = require('../config/wheel-segments.json');

const SPIN_COST = 2;

router.get('/earn', requireAuth, (req, res) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

  // Shop data
  const shopItems = db.prepare('SELECT * FROM shop_items ORDER BY price ASC').all();
  const purchases = db.prepare('SELECT item_id FROM purchases WHERE user_id = ?').all(userId);
  const ownedIds = purchases.map(p => p.item_id);

  // Bank data
  const investments = db.prepare(
    "SELECT * FROM investments WHERE user_id = ? ORDER BY started_at DESC LIMIT 5"
  ).all(userId);

  // Trivia data
  const triviaKey = Math.floor(Date.now() / (20 * 60 * 1000));
  const triviaDone = db.prepare(
    "SELECT correct FROM trivia_answers WHERE user_id = ? AND question_date = ?"
  ).get(userId, String(triviaKey));

  // Lottery data
  const lotteryState = db.prepare('SELECT * FROM lottery_state WHERE id = 1').get();
  const myTickets = db.prepare(
    "SELECT SUM(count) as total FROM lottery_tickets WHERE user_id = ? AND won = 0"
  ).get(userId);

  res.render('earn', {
    userCoins: user.coins,
    shopItems,
    ownedIds,
    mysteryBoxItems,
    investments,
    triviaDone: !!triviaDone,
    spinCost: SPIN_COST,
    wheelSegments: wheelSegments.slice(0, 12),
    lotteryJackpot: lotteryState ? lotteryState.jackpot : 500,
    myTickets: myTickets ? myTickets.total : 0,
    ticketCost: 50
  });
});

module.exports = router;
