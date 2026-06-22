const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { awardCoins } = require('../middleware/currency');

const EVENTS = [
  {
    key: 'red_button',
    name: 'Find the Red Button',
    desc: 'A tiny red button is hidden somewhere on the site. First person to find it gets x2 coins for 1 hour!',
    icon: '🎯',
    type: 'hidden',
    category: 'competitive',
    duration: 3600,
  },
  {
    key: 'defeat_button',
    name: 'Defeat the Button',
    desc: 'Work together! Everyone must click 10,000 times total to defeat the evil button. Reward: 200-450 coins each!',
    icon: '👾',
    type: 'collective',
    category: 'social',
    target: 10000,
    reward_min: 200,
    reward_max: 450,
    duration: 7200,
  },
  {
    key: 'lucky_hour',
    name: 'Lucky Hour',
    desc: 'All wheel spins are FREE for 1 hour!',
    icon: '🎰',
    type: 'global',
    category: 'global',
    duration: 3600,
  },
  {
    key: 'double_xp',
    name: 'Double XP',
    desc: 'All XP gains are doubled for 30 minutes!',
    icon: '⚡',
    type: 'global',
    category: 'global',
    multiplier: 2,
    duration: 1800,
  },
  {
    key: 'coin_rain',
    name: 'Coin Rain',
    desc: 'Every page visit gives 10 coins instead of 2 for 1 hour!',
    icon: '🌧️',
    type: 'global',
    category: 'reward',
    multiplier: 5,
    duration: 3600,
  },
  {
    key: 'shop_sale',
    name: 'Shop Sale',
    desc: 'All shop items are 50% off for 30 minutes!',
    icon: '🏷️',
    type: 'global',
    category: 'global',
    discount: 0.5,
    duration: 1800,
  },
  {
    key: 'mystery_gift',
    name: 'Mystery Gift',
    desc: 'First 10 users to log in get a free Mystery Box!',
    icon: '🎁',
    type: 'first_come',
    category: 'reward',
    max_participants: 10,
    duration: 3600,
  },
  {
    key: 'wheel_guarantee',
    name: 'Wheel Jackpot Guarantee',
    desc: 'Next 5 spins per user are guaranteed epic+ results!',
    icon: '🎡',
    type: 'per_user',
    category: 'reward',
    uses: 5,
    duration: 1800,
  },
  {
    key: 'chat_challenge',
    name: 'Chat Challenge',
    desc: 'First to type the secret phrase gets 500 coins!',
    icon: '💬',
    type: 'chat',
    category: 'competitive',
    secret_phrase: 'SYNTAX LEGEND',
    reward: 500,
    duration: 3600,
  },
  {
    key: 'trivia_time',
    name: 'Trivia Time',
    desc: 'Answer correctly for 300 coins! Check #chat for the question.',
    icon: '🧠',
    type: 'trivia',
    category: 'minigame',
    reward: 300,
    duration: 1800,
  },
  {
    key: 'speed_round',
    name: 'Speed Round',
    desc: 'Complete any game in under 60 seconds for 2x score!',
    icon: '⏱️',
    type: 'global',
    category: 'competitive',
    multiplier: 2,
    duration: 3600,
  },
  {
    key: 'lucky_number',
    name: 'Lucky Number',
    desc: 'Next person to land on exactly +100 coins wins 1000 bonus!',
    icon: '🔢',
    type: 'wheel',
    category: 'competitive',
    target_value: 100,
    reward: 1000,
    duration: 7200,
  },
  {
    key: 'coin_storm',
    name: 'Coin Storm',
    desc: 'All game scores worth double coins for 1 hour!',
    icon: '🌪️',
    type: 'global',
    category: 'global',
    multiplier: 2,
    duration: 3600,
  },
  {
    key: 'friend_bonus',
    name: 'Friend Bonus',
    desc: 'Send a friend request — both you and your friend get 100 coins!',
    icon: '🤝',
    type: 'social',
    category: 'social',
    reward: 100,
    duration: 3600,
  },
  {
    key: 'trade_frenzy',
    name: 'Trade Frenzy',
    desc: 'All trades have 0% tax for 30 minutes!',
    icon: '🔄',
    type: 'global',
    category: 'global',
    duration: 1800,
  },
  {
    key: 'quest_master',
    name: 'Quest Master',
    desc: 'Complete any quest for 3x rewards for 1 hour!',
    icon: '🏆',
    type: 'global',
    category: 'reward',
    multiplier: 3,
    duration: 3600,
  },
  {
    key: 'bank_heist',
    name: 'Bank Heist',
    desc: 'Bank interest rates tripled for 1 hour!',
    icon: '🏦',
    type: 'global',
    category: 'reward',
    multiplier: 3,
    duration: 3600,
  },
  {
    key: 'lottery_mania',
    name: 'Lottery Mania',
    desc: 'Lottery tickets cost half price for 30 minutes!',
    icon: '🎰',
    type: 'global',
    category: 'global',
    discount: 0.5,
    duration: 1800,
  },
  {
    key: 'gift_splash',
    name: 'Gift Splash',
    desc: 'Next gift sent gives double coins to the receiver!',
    icon: '💧',
    type: 'social',
    category: 'social',
    multiplier: 2,
    duration: 3600,
  },
  {
    key: 'admin_giveaway',
    name: 'Admin Giveaway',
    desc: 'Admin is feeling generous! 5 random online users get 500 coins!',
    icon: '💸',
    type: 'instant',
    category: 'reward',
    reward: 500,
    winners: 5,
  },
  {
    key: 'click_frenzy',
    name: 'Click Frenzy',
    desc: 'Click any button 100 times to earn 200 coins!',
    icon: '🖱️',
    type: 'click',
    category: 'minigame',
    target: 100,
    reward: 200,
    duration: 3600,
  },
  {
    key: 'color_match',
    name: 'Color Match',
    desc: 'Match the color shown on screen for 400 coins!',
    icon: '🎨',
    type: 'minigame',
    category: 'minigame',
    reward: 400,
    duration: 1800,
  },
  {
    key: 'rps_tournament',
    name: 'RPS Tournament',
    desc: 'Win 3 rock-paper-scissors in a row for 600 coins!',
    icon: '✊',
    type: 'minigame',
    category: 'minigame',
    streak: 3,
    reward: 600,
    duration: 3600,
  },
  {
    key: 'hide_and_seek',
    name: 'Hide and Seek',
    desc: 'Find the hidden element on the page for 350 coins!',
    icon: '🔍',
    type: 'hidden',
    category: 'competitive',
    reward: 350,
    duration: 1800,
  },
  {
    key: 'password_drop',
    name: 'Password Drop',
    desc: 'Admin reveals a password in chat. First to enter it gets 500 coins!',
    icon: '🔑',
    type: 'first_come',
    category: 'competitive',
    reward: 500,
    max_participants: 1,
    duration: 3600,
  },
  {
    key: 'dice_roll',
    name: 'Dice Roll',
    desc: 'Roll a 6 to win 1000 coins! Try your luck.',
    icon: '🎲',
    type: 'minigame',
    category: 'minigame',
    target_value: 6,
    reward: 1000,
    duration: 3600,
  },
  {
    key: 'simon_says',
    name: 'Simon Says',
    desc: 'Follow the pattern correctly for 250 coins!',
    icon: '🧠',
    type: 'minigame',
    category: 'minigame',
    reward: 250,
    duration: 1800,
  },
  {
    key: 'treasure_hunt',
    name: 'Treasure Hunt',
    desc: 'Hidden coins scattered across 5 pages. Collect them all for 800 coins!',
    icon: '🗺️',
    type: 'scavenger',
    category: 'competitive',
    reward: 800,
    pages: 5,
    duration: 7200,
  },
  {
    key: 'double_trouble',
    name: 'Double Trouble',
    desc: 'All coins earned are doubled for 30 minutes!',
    icon: '✌️',
    type: 'global',
    category: 'global',
    multiplier: 2,
    duration: 1800,
  },
];

function ensureEvents() {
  const existing = db.prepare('SELECT event_key FROM events').all().map(e => e.event_key);
  const insert = db.prepare('INSERT OR IGNORE INTO events (event_key, name, description, data) VALUES (?, ?, ?, ?)');
  EVENTS.forEach(ev => {
    if (!existing.includes(ev.key)) {
      insert.run(ev.key, ev.name, ev.desc, JSON.stringify(ev));
    }
  });
}

function getActiveEvents() {
  return db.prepare("SELECT * FROM events WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))").all();
}

function isEventActive(key) {
  const ev = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get(key);
  if (!ev) return false;
  if (ev.expires_at && new Date(ev.expires_at) < new Date()) {
    db.prepare('UPDATE events SET is_active = 0 WHERE id = ?').run(ev.id);
    return false;
  }
  return true;
}

function getEventBonus(userId, type) {
  const bonus = db.prepare(`SELECT * FROM user_bonuses WHERE user_id = ? AND bonus_type = ? AND expires_at > datetime('now')`).get(userId, type);
  return bonus ? bonus.multiplier : 1;
}

ensureEvents();

// API: get active events (public)
router.get('/api/events', (req, res) => {
  const events = getActiveEvents();
  const data = events.map(e => ({
    key: e.event_key,
    name: e.name,
    description: e.description,
    data: JSON.parse(e.data || '{}'),
  }));
  res.json(data);
});

// API: get latest event announcement (for popups)
let lastAnnouncement = 0;
router.get('/api/events/announcements', (req, res) => {
  const events = db.prepare('SELECT * FROM events WHERE is_active = 1 AND activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 5').all();
  const recent = events.filter(e => {
    const ts = new Date(e.activated_at).getTime();
    return ts > lastAnnouncement;
  });
  if (recent.length > 0) {
    lastAnnouncement = Math.max(...recent.map(e => new Date(e.activated_at).getTime()));
  }
  res.json(recent.map(e => ({
    key: e.event_key,
    name: e.name,
    description: e.description,
    icon: JSON.parse(e.data || '{}').icon || '🎉',
    activated_at: e.activated_at,
  })));
});

// API: click for defeat_button event
router.post('/api/events/click', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('defeat_button');
  if (!event) return res.json({ success: false, message: 'No active event' });

  db.prepare('INSERT INTO event_clicks (event_id, user_id) VALUES (?, ?)').run(event.id, req.user.id);
  const total = db.prepare('SELECT COUNT(*) as c FROM event_clicks WHERE event_id = ?').get(event.id).c;
  const data = JSON.parse(event.data || '{}');
  const target = data.target || 10000;

  if (total >= target) {
    const participants = db.prepare('SELECT DISTINCT user_id FROM event_clicks WHERE event_id = ?').all(event.id);
    participants.forEach(p => {
      const reward = data.reward_min + Math.floor(Math.random() * (data.reward_max - data.reward_min + 1));
      awardCoins(p.user_id, reward, 'defeat_button_reward');
    });
    db.prepare('UPDATE events SET is_active = 0 WHERE id = ?').run(event.id);
    return res.json({ success: true, complete: true, total, target, reward: `${data.reward_min}-${data.reward_max}` });
  }

  res.json({ success: true, total, target, progress: Math.floor(total / target * 100) });
});

// API: click for click_frenzy event
router.post('/api/events/click-frenzy', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('click_frenzy');
  if (!event) return res.json({ success: false });

  const data = JSON.parse(event.data || '{}');
  const existing = db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?').get(event.id, req.user.id);
  if (existing) {
    const clicks = (JSON.parse(existing.data || '{}').clicks || 0) + 1;
    if (clicks >= (data.target || 100)) {
      db.prepare('DELETE FROM event_participants WHERE id = ?').run(existing.id);
      awardCoins(req.user.id, data.reward || 200, 'click_frenzy_reward');
      return res.json({ success: true, complete: true, clicks });
    }
    db.prepare('UPDATE event_participants SET data = ? WHERE id = ?').run(JSON.stringify({ clicks }), existing.id);
    res.json({ success: true, clicks, target: data.target || 100 });
  } else {
    db.prepare('INSERT INTO event_participants (event_id, user_id, data) VALUES (?, ?, ?)').run(event.id, req.user.id, JSON.stringify({ clicks: 1 }));
    res.json({ success: true, clicks: 1, target: data.target || 100 });
  }
});

// API: roll dice
router.post('/api/events/roll-dice', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('dice_roll');
  if (!event) return res.json({ success: false, message: 'Event not active' });

  const roll = Math.floor(Math.random() * 6) + 1;
  const data = JSON.parse(event.data || '{}');
  if (roll === (data.target_value || 6)) {
    awardCoins(req.user.id, data.reward || 1000, 'dice_roll_win');
    return res.json({ success: true, roll, won: true, reward: data.reward || 1000 });
  }
  res.json({ success: true, roll, won: false });
});

// API: rps play
router.post('/api/events/rps', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('rps_tournament');
  if (!event) return res.json({ success: false, message: 'Event not active' });

  const { choice } = req.body;
  const options = ['rock', 'paper', 'scissors'];
  const cpu = options[Math.floor(Math.random() * 3)];
  let result = 'draw';
  if ((choice === 'rock' && cpu === 'scissors') || (choice === 'paper' && cpu === 'rock') || (choice === 'scissors' && cpu === 'paper')) result = 'win';
  if ((cpu === 'rock' && choice === 'scissors') || (cpu === 'paper' && choice === 'rock') || (cpu === 'scissors' && choice === 'paper')) result = 'loss';

  const existing = db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?').get(event.id, req.user.id);
  const data = JSON.parse(existing?.data || '{}');
  let streak = result === 'win' ? (data.streak || 0) + 1 : 0;

  if (streak >= (data.streak || 3)) {
    awardCoins(req.user.id, data.reward || 600, 'rps_tournament_win');
    streak = 0;
  }

  if (existing) {
    db.prepare('UPDATE event_participants SET data = ? WHERE id = ?').run(JSON.stringify({ ...data, streak }), existing.id);
  } else {
    db.prepare('INSERT INTO event_participants (event_id, user_id, data) VALUES (?, ?, ?)').run(event.id, req.user.id, JSON.stringify({ streak }));
  }

  res.json({ success: true, choice, cpu, result, streak, target: data.streak || 3 });
});

// API: check chat challenge
router.post('/api/events/chat-challenge', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('chat_challenge');
  if (!event) return res.json({ success: false });

  const data = JSON.parse(event.data || '{}');
  const { message } = req.body;
  if (message && message.toUpperCase().trim() === (data.secret_phrase || '').toUpperCase()) {
    const existing = db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?').get(event.id, req.user.id);
    if (!existing) {
      awardCoins(req.user.id, data.reward || 500, 'chat_challenge_win');
      db.prepare('INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)').run(event.id, req.user.id);
      db.prepare('UPDATE events SET is_active = 0 WHERE id = ?').run(event.id);
      return res.json({ success: true, won: true, reward: data.reward || 500 });
    }
    return res.json({ success: true, won: false, message: 'Already claimed' });
  }
  res.json({ success: true, won: false });
});

// Admin: activate event
router.post('/api/admin/events/:key/activate', requireAuth, requireAdmin, (req, res) => {
  const { key } = req.params;
  const event = db.prepare('SELECT * FROM events WHERE event_key = ?').get(key);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const data = JSON.parse(event.data || '{}');
  const duration = data.duration || 3600;
  const expires = new Date(Date.now() + duration * 1000).toISOString();

  db.prepare(`UPDATE events SET is_active = 1, activated_by = ?, activated_at = datetime('now'), expires_at = ? WHERE id = ?`)
    .run(req.user.id, expires, event.id);

  if (data.type === 'global' && data.multiplier) {
    const users = db.prepare('SELECT id FROM users').all();
    const insertBonus = db.prepare('INSERT OR REPLACE INTO user_bonuses (user_id, bonus_type, multiplier, expires_at) VALUES (?, ?, ?, ?)');
    users.forEach(u => {
      insertBonus.run(u.id, key, data.multiplier, expires);
    });
  }

  if (key === 'coin_rain') {
    const users = db.prepare('SELECT id FROM users').all();
    const insertBonus = db.prepare('INSERT OR REPLACE INTO user_bonuses (user_id, bonus_type, multiplier, expires_at) VALUES (?, ?, ?, ?)');
    users.forEach(u => {
      insertBonus.run(u.id, 'visit', 5, expires);
    });
  }

  if (key === 'shop_sale') {
    const users = db.prepare('SELECT id FROM users').all();
    const insertBonus = db.prepare('INSERT OR REPLACE INTO user_bonuses (user_id, bonus_type, multiplier, expires_at) VALUES (?, ?, ?, ?)');
    users.forEach(u => {
      insertBonus.run(u.id, 'shop', 0.5, expires);
    });
  }

  res.json({ success: true, message: `${event.name} activated!`, expires });
});

// Admin: deactivate event
router.post('/api/admin/events/:key/deactivate', requireAuth, requireAdmin, (req, res) => {
  const { key } = req.params;
  db.prepare('UPDATE events SET is_active = 0 WHERE event_key = ?').run(key);
  res.json({ success: true });
});

// Admin: get all events
router.get('/api/admin/events', requireAuth, requireAdmin, (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY is_active DESC, name').all();
  res.json(events.map(e => ({
    ...e,
    data: JSON.parse(e.data || '{}'),
    participant_count: db.prepare('SELECT COUNT(*) as c FROM event_participants WHERE event_id = ?').get(e.id).c,
  })));
});

// Admin: instant giveaway
router.post('/api/admin/events/admin_giveaway/run', requireAuth, requireAdmin, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE event_key = ? AND is_active = 1').get('admin_giveaway');
  if (!event) return res.json({ success: false, message: 'Event not active' });

  const data = JSON.parse(event.data || '{}');
  const winners = db.prepare('SELECT id, display_name FROM users ORDER BY RANDOM() LIMIT ?').all(data.winners || 5);
  winners.forEach(w => awardCoins(w.id, data.reward || 500, 'admin_giveaway'));

  db.prepare('UPDATE events SET is_active = 0 WHERE id = ?').run(event.id);
  res.json({ success: true, winners: winners.map(w => w.display_name) });
});

// Middleware: check event bonuses
router.use((req, res, next) => {
  if (req.isAuthenticated()) {
    res.locals.activeEvents = getActiveEvents();
    res.locals.eventBonus = {
      visit: getEventBonus(req.user.id, 'visit'),
      game: getEventBonus(req.user.id, 'game'),
      wheel: getEventBonus(req.user.id, 'wheel'),
    };
  } else {
    res.locals.activeEvents = [];
    res.locals.eventBonus = {};
  }
  next();
});

module.exports = router;
module.exports.EVENTS = EVENTS;
module.exports.getActiveEvents = getActiveEvents;
module.exports.isEventActive = isEventActive;
module.exports.getEventBonus = getEventBonus;
