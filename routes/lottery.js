const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins } = require('../middleware/currency');

const WIN_CHANCE_PER_TICKET = 0.0005; // 0.05%
const JACKPOT_GROWTH_PER_SECOND = 0.033; // ~2 coins per minute
const TICKET_COST = 50;
const HOUSE_CUT = 0.3; // 30% of ticket price goes to house, 70% to jackpot

function getLiveJackpot(state) {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - state.last_tick;
  const growth = Math.floor(elapsed * JACKPOT_GROWTH_PER_SECOND);
  const live = state.jackpot + growth;
  // Cap at 100,000 to prevent insane numbers
  return Math.min(live, 100000);
}

function updateJackpotTick() {
  const state = db.prepare('SELECT * FROM lottery_state WHERE id = 1').get();
  const live = getLiveJackpot(state);
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE lottery_state SET jackpot = ?, last_tick = ? WHERE id = 1').run(live, now);
  return { ...state, jackpot: live, last_tick: now };
}

router.get('/lottery', requireAuth, (req, res) => {
  const state = updateJackpotTick();
  const userId = req.user.id;

  const myTickets = db.prepare(
    "SELECT SUM(count) as total FROM lottery_tickets WHERE user_id = ? AND won = 0"
  ).get(userId);

  const recentWinners = db.prepare(`
    SELECT lt.won_amount, lt.created_at, u.display_name
    FROM lottery_tickets lt
    JOIN users u ON u.id = lt.user_id
    WHERE lt.won = 1
    ORDER BY lt.created_at DESC
    LIMIT 5
  `).all();

  res.render('lottery', {
    jackpot: state.jackpot,
    ticketCost: TICKET_COST,
    myTickets: myTickets ? myTickets.total : 0,
    totalTickets: state.total_tickets,
    recentWinners
  });
});

router.post('/lottery/buy', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { count } = req.body;
  const ticketCount = Math.max(1, Math.min(parseInt(count) || 1, 500));

  const state = updateJackpotTick();
  const totalCost = ticketCount * TICKET_COST;

  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (user.coins < totalCost) {
    return res.json({ success: false, message: `Need ${totalCost} coins for ${ticketCount} ticket(s).` });
  }

  awardCoins(userId, -totalCost, 'lottery_buy');

  // 70% goes to jackpot
  const jackpotContribution = Math.floor(totalCost * (1 - HOUSE_CUT));
  db.prepare('UPDATE lottery_state SET jackpot = jackpot + ?, total_tickets = total_tickets + ? WHERE id = 1').run(jackpotContribution, ticketCount);

  // Roll the dice - 0.05% per ticket
  const winChance = ticketCount * WIN_CHANCE_PER_TICKET;
  const roll = Math.random();
  const won = roll < winChance;

  let wonAmount = 0;
  if (won) {
    const currentState = db.prepare('SELECT * FROM lottery_state WHERE id = 1').get();
    wonAmount = currentState.jackpot;

    // Reset jackpot
    db.prepare('UPDATE lottery_state SET jackpot = base_jackpot, total_tickets = 0 WHERE id = 1').run();
    awardCoins(userId, wonAmount, 'lottery_win');
  }

  db.prepare(
    'INSERT INTO lottery_tickets (user_id, count, won, won_amount) VALUES (?, ?, ?, ?)'
  ).run(userId, ticketCount, won ? 1 : 0, wonAmount);

  const updatedState = db.prepare('SELECT * FROM lottery_state WHERE id = 1').get();

  const myTickets = db.prepare(
    "SELECT SUM(count) as total FROM lottery_tickets WHERE user_id = ? AND won = 0"
  ).get(userId);

  res.json({
    success: true,
    won,
    wonAmount,
    jackpot: updatedState.jackpot,
    totalTickets: updatedState.total_tickets,
    myTickets: myTickets ? myTickets.total : 0,
    ticketsBought: ticketCount,
    chance: (winChance * 100).toFixed(3)
  });
});

module.exports = router;
