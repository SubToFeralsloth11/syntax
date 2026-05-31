const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins, getBalance } = require('../middleware/currency');

const plans = {
  quick: { label: 'Quick Investment', duration: 15, unit: 'minutes', lockMs: 15 * 60 * 1000, profitPct: 0.05, color: '#3498db' },
  standard: { label: 'Standard Investment', duration: 1, unit: 'hour', lockMs: 60 * 60 * 1000, profitPct: 0.15, color: '#9b59b6' },
  growth: { label: 'Growth Investment', duration: 6, unit: 'hours', lockMs: 6 * 60 * 60 * 1000, profitPct: 0.40, color: '#f39c12' },
  long: { label: 'Long-Term Investment', duration: 7, unit: 'days', lockMs: 7 * 24 * 60 * 60 * 1000, profitPct: 1.00, color: '#e74c3c' },
};

router.get('/bank', requireAuth, (req, res) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  const investments = db.prepare(
    'SELECT * FROM investments WHERE user_id = ? AND claimed = 0 ORDER BY started_at DESC'
  ).all(userId);

  const now = Date.now();
  const active = investments.map(inv => {
    const plan = plans[inv.plan];
    const elapsed = now - new Date(inv.started_at).getTime();
    const remaining = Math.max(0, plan.lockMs - elapsed);
    const progress = Math.min(100, (elapsed / plan.lockMs) * 100);
    const ready = elapsed >= plan.lockMs;
    const remainingLabel = ready ? 'Ready to claim!' : formatRemaining(remaining);
    return { ...inv, planData: plan, remaining, progress, ready, remainingLabel };
  });

function formatRemaining(ms) {
  if (ms <= 0) return 'Ready!';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
  if (m > 0) return m + 'm ' + sec + 's';
  return sec + 's';
}

  res.render('bank', { plans, active, coins: user.coins });
});

router.post('/bank/invest', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { plan: planKey, amount } = req.body;

  if (!planKey || !plans[planKey]) {
    return res.json({ success: false, message: 'Invalid investment plan.' });
  }

  const investAmount = parseInt(amount, 10);
  if (!investAmount || investAmount < 10) {
    return res.json({ success: false, message: 'Minimum investment is 10 coins.' });
  }

  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (user.coins < investAmount) {
    return res.json({ success: false, message: 'Not enough coins.' });
  }

  const plan = plans[planKey];
  const profit = Math.floor(investAmount * plan.profitPct);
  const now = new Date().toISOString();

  awardCoins(userId, -investAmount, 'investment_deposit');
  db.prepare(
    'INSERT INTO investments (user_id, plan, amount, profit, started_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, planKey, investAmount, profit, now);

  const investment = db.prepare(
    'SELECT * FROM investments WHERE id = last_insert_rowid()'
  ).get();

  const elapsed = Date.now() - new Date(investment.started_at).getTime();
  const remaining = plan.lockMs;

  res.json({
    success: true,
    balance: db.prepare('SELECT coins FROM users WHERE id = ?').get(userId).coins,
    investment: { ...investment, planData: plan, remaining, progress: 0, ready: false }
  });
});

router.post('/bank/claim/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const inv = db.prepare(
    'SELECT * FROM investments WHERE id = ? AND user_id = ? AND claimed = 0'
  ).get(req.params.id, userId);

  if (!inv) {
    return res.json({ success: false, message: 'Investment not found or already claimed.' });
  }

  const plan = plans[inv.plan];
  const elapsed = Date.now() - new Date(inv.started_at).getTime();

  if (elapsed < plan.lockMs) {
    return res.json({ success: false, message: 'Investment is still locked.' });
  }

  const total = inv.amount + inv.profit;
  db.prepare('UPDATE investments SET claimed = 1 WHERE id = ?').run(inv.id);
  awardCoins(userId, total, 'investment_payout');

  res.json({
    success: true,
    total,
    profit: inv.profit,
    balance: db.prepare('SELECT coins FROM users WHERE id = ?').get(userId).coins
  });
});

module.exports = router;