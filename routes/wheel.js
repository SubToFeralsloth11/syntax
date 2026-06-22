const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins } = require('../middleware/currency');
const { awardXP } = require('../middleware/xp');
const { updateQuestProgress } = require('../middleware/quests');
const { checkAchievement } = require('../middleware/achievements');
const fs = require('fs');
const path = require('path');

const SPIN_COST = 2;
const SEGMENT_POOL = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'wheel-segments.json'), 'utf8')
);

function pickSegments(count) {
  const shuffled = [...SEGMENT_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function pickFromDisplayed(displayed) {
  const weights = displayed.map(s => {
    const val = s.value || 0;
    const tier = s.tier || 'low';
    const isWin = s.type === 'coins' && val > 0;
    const isLoss = s.type === 'coins' && val < 0;

    if (isWin) {
      if (tier === 'epic') return 3;
      if (tier === 'high') return 6;
      if (tier === 'mid') return 10;
      return 14;
    }
    if (isLoss) {
      if (tier === 'epic') return 0.5;
      if (tier === 'high') return 1;
      if (tier === 'mid') return 1.5;
      return 2;
    }
    if (tier === 'epic') return 3;
    if (tier === 'high') return 4;
    return 5;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < displayed.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return { ...displayed[i], index: i };
  }
  return { ...displayed[0], index: 0 };
}

function applyEffect(userId, user, seg) {
  const coins = user.coins;
  let change = 0;
  let desc = seg.desc || '';

  switch (seg.type) {
    case 'coins':
      change = seg.value;
      break;
    case 'percent': {
      const raw = Math.floor(coins * Math.abs(seg.value) / 100);
      if (seg.value < 0) {
        change = -Math.max(1, Math.min(raw, coins - 1));
      } else {
        change = Math.max(1, Math.min(raw, 500));
      }
      break;
    }
    case 'multiply': {
      const maxGain = Math.min(coins * seg.value - coins, 1000);
      change = Math.max(0, maxGain);
      break;
    }
    case 'halve':
      change = -Math.floor(coins / 2);
      break;
    case 'nothing':
      change = 0;
      desc = 'Nothing happens...';
      break;
    case 'free_spin':
      change = SPIN_COST;
      desc = 'Spin was free!';
      break;
    case 'mystery_box': {
      const items = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'config', 'mystery-box-items.json'), 'utf8')
      );
      const totalW = items.reduce((s, i) => s + (i.weight || 1), 0);
      let r = Math.random() * totalW;
      let picked = items[0];
      for (const item of items) {
        r -= item.weight || 1;
        if (r <= 0) { picked = item; break; }
      }
      if (picked.type === 'coins') {
        const amt = picked.min_coins + Math.floor(Math.random() * (picked.max_coins - picked.min_coins + 1));
        change = amt;
        seg.label = `+${amt} coins`;
        seg.tier = amt >= 50 ? 'epic' : amt >= 25 ? 'high' : 'mid';
        desc = `Mystery box: ${picked.name}`;
      } else {
        change = 0;
        db.prepare('INSERT INTO inventory_items (user_id, item_name, item_type, rarity) VALUES (?, ?, ?, ?)').run(userId, picked.name, picked.type, 'common');
        seg.label = picked.name;
        seg.tier = 'epic';
        desc = `Mystery box: ${picked.name}!`;
      }
      break;
    }
  }

  if (change !== 0) {
    awardCoins(userId, change, 'wheel');
  }

  const finalCoins = Math.max(0, coins + change);
  return { change, finalCoins, desc, label: seg.label, tier: seg.tier };
}

router.get('/wheel', requireAuth, (req, res) => {
  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(req.user.id);
  req.session.wheelSegments = SEGMENT_POOL;
  res.render('wheel', { spinCost: SPIN_COST, userCoins: user.coins, segments: SEGMENT_POOL });
});

router.post('/wheel/spin', requireAuth, (req, res) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  let displayed = req.session.wheelSegments;
  let freeSpin = false;

  if (!displayed || displayed.length === 0) {
    displayed = SEGMENT_POOL;
  }

  const luckyHour = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('lucky_hour');
  if (luckyHour) freeSpin = true;

  let picked = pickFromDisplayed(displayed);

  const wheelGuarantee = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('wheel_guarantee');
  if (wheelGuarantee) {
    const participant = db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?').get(wheelGuarantee.id, userId);
    const uses = participant ? (JSON.parse(participant.data || '{}').uses || 0) : 0;
    if (uses < 5) {
      const epicSegs = displayed.filter(s => s.tier === 'epic');
      if (epicSegs.length > 0) {
        picked = epicSegs[Math.floor(Math.random() * epicSegs.length)];
        picked.index = displayed.indexOf(picked);
      }
      const newUses = uses + 1;
      if (participant) {
        db.prepare('UPDATE event_participants SET data = ? WHERE id = ?').run(JSON.stringify({ uses: newUses }), participant.id);
      } else {
        db.prepare('INSERT INTO event_participants (event_id, user_id, data) VALUES (?, ?, ?)').run(wheelGuarantee.id, userId, JSON.stringify({ uses: newUses }));
      }
    }
  }

  if (picked.type === 'free_spin') {
    freeSpin = true;
  } else {
    if (user.coins < SPIN_COST) {
      return res.json({ success: false, message: `Need ${SPIN_COST} coins to spin.` });
    }
    awardCoins(userId, -SPIN_COST, 'wheel_cost');
  }

  const result = applyEffect(userId, user, picked);
  const finalBal = freeSpin ? user.coins + result.change : user.coins - SPIN_COST + result.change;

  const totalSpins = db.prepare(
    "SELECT COUNT(*) as cnt FROM coin_transactions WHERE user_id = ? AND reason = 'wheel_cost'"
  ).get(userId).cnt;

  if (totalSpins === 1 && !freeSpin) {
    const coins = checkAchievement(userId, 'Lucky Spinner');
    if (coins) awardCoins(userId, coins, 'achievement');
  }

  awardXP(userId, 15, 'wheel');
  updateQuestProgress(userId, 'wheel');

  res.json({
    success: true,
    index: picked.index,
    balance: Math.max(0, finalBal),
    change: result.change,
    label: result.label,
    desc: result.desc,
    tier: result.tier,
    freeSpin
  });
});

module.exports = router;
