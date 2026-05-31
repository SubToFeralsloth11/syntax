const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAdmin } = require('../middleware/admin');
const { requireAuth } = require('../middleware/auth');
const { loadLog, saveLog } = require('../db/accounts');

router.get('/admin', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, email, display_name, avatar, coins, total_coins_earned, role, banned_until, created_at, password
    FROM users ORDER BY id ASC
  `).all();

  const chatMessages = db.prepare(`
    SELECT cm.id, cm.message, cm.created_at, u.display_name, u.id as user_id
    FROM chat_messages cm
    JOIN users u ON u.id = cm.user_id
    ORDER BY cm.id DESC
    LIMIT 100
  `).all().reverse();

  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const msgCount = db.prepare('SELECT COUNT(*) as cnt FROM chat_messages').get().cnt;
  const bannedCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE banned_until > datetime('now')").get().cnt;

  res.render('admin', { users, chatMessages, userCount, msgCount, bannedCount });
});

router.post('/admin/ban', requireAdmin, (req, res) => {
  const { userId, hours } = req.body;
  if (!userId || !hours) {
    return res.json({ success: false, message: 'User ID and hours required' });
  }
  if (parseInt(userId) === req.user.id) {
    return res.json({ success: false, message: 'You cannot ban yourself' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!target) {
    return res.json({ success: false, message: 'User not found' });
  }
  if (target.role === 'admin') {
    return res.json({ success: false, message: 'You cannot ban another admin' });
  }

  const banUntil = new Date(Date.now() + parseInt(hours) * 3600000).toISOString().replace('T', ' ').split('.')[0];
  db.prepare('UPDATE users SET banned_until = ? WHERE id = ?').run(banUntil, userId);

  res.json({ success: true, message: `User banned for ${hours} hour(s)`, banned_until: banUntil });
});

router.post('/admin/unban', requireAdmin, (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.json({ success: false, message: 'User ID required' });
  }

  db.prepare('UPDATE users SET banned_until = NULL WHERE id = ?').run(userId);
  res.json({ success: true, message: 'User unbanned' });
});

router.post('/admin/warn', requireAdmin, (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message || message.trim().length === 0) {
    return res.json({ success: false, message: 'User ID and message required' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!target) {
    return res.json({ success: false, message: 'User not found' });
  }

  db.prepare('INSERT INTO warnings (user_id, admin_id, message) VALUES (?, ?, ?)').run(userId, req.user.id, message.trim());

  res.json({ success: true, message: 'Warning issued' });
});

router.post('/admin/delete-message', requireAdmin, (req, res) => {
  const { messageId } = req.body;
  if (!messageId) {
    return res.json({ success: false, message: 'Message ID required' });
  }

  const msg = db.prepare('SELECT id FROM chat_messages WHERE id = ?').get(messageId);
  if (!msg) {
    return res.json({ success: false, message: 'Message not found' });
  }

  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);
  res.json({ success: true, message: 'Message deleted' });
});

router.post('/admin/delete-user', requireAdmin, (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.json({ success: false, message: 'User ID required' });
  }
  if (parseInt(userId) === req.user.id) {
    return res.json({ success: false, message: 'You cannot delete yourself' });
  }

  const target = db.prepare('SELECT id, role, email FROM users WHERE id = ?').get(userId);
  if (!target) {
    return res.json({ success: false, message: 'User not found' });
  }
  if (target.role === 'admin') {
    return res.json({ success: false, message: 'You cannot delete another admin' });
  }

  const email = target.email;

  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM warnings WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM coin_transactions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM daily_checkins WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM daily_streaks WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM page_visits WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM game_plays WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM wheel_spins WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM trivia_answers WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM inventory_items WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM purchases WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM referrals WHERE referrer_id = ? OR referred_id = ?').run(userId, userId);
  db.prepare('DELETE FROM user_achievements WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM investments WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  const accounts = loadLog();
  const filtered = accounts.filter(a => a.email !== email);
  if (filtered.length < accounts.length) {
    saveLog(filtered);
  }

  res.json({ success: true, message: 'User and all associated data deleted' });
});

router.get('/admin/user/:id', requireAdmin, (req, res) => {
  const user = db.prepare(`
    SELECT id, email, display_name, avatar, coins, total_coins_earned,
           equipped_frame, equipped_badge, equipped_title, role, banned_until, created_at, password
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).render('404');
  }

  const warnings = db.prepare(`
    SELECT w.id, w.message, w.created_at, a.display_name as admin_name
    FROM warnings w
    JOIN users a ON a.id = w.admin_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(user.id);

  const transactions = db.prepare(`
    SELECT amount, reason, created_at
    FROM coin_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(user.id);

  const messages = db.prepare(`
    SELECT id, message, created_at
    FROM chat_messages
    WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(user.id);

  res.render('admin-user', { profile: user, warnings, transactions, messages });
});

const crypto = require('crypto');

const impersonationTokens = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of impersonationTokens) {
    if (now > data.expires) impersonationTokens.delete(token);
  }
}, 60000);

router.post('/admin/impersonate-token/:id', requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) {
    return res.json({ success: false, message: 'Cannot impersonate yourself' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.json({ success: false, message: 'User not found' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  impersonationTokens.set(token, { userId: targetId, expires: Date.now() + 300000 });

  res.json({ success: true, token });
});

router.get('/auth/impersonate', (req, res, next) => {
  const { token } = req.query;
  if (!token || !impersonationTokens.has(token)) {
    return res.status(403).render('403');
  }

  const data = impersonationTokens.get(token);
  if (Date.now() > data.expires) {
    impersonationTokens.delete(token);
    return res.status(403).render('403');
  }

  impersonationTokens.delete(token);

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(data.userId);
  if (!target) {
    return res.status(404).render('404');
  }

  req.login(target, (err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

router.post('/dismiss-warning', requireAuth, (req, res) => {
  const { warningId } = req.body;
  if (!warningId) return res.json({ success: false, message: 'Warning ID required' });

  const warning = db.prepare('SELECT id FROM warnings WHERE id = ? AND user_id = ?').get(warningId, req.user.id);
  if (!warning) return res.json({ success: false, message: 'Warning not found' });

  db.prepare('UPDATE warnings SET read = 1 WHERE id = ?').run(warningId);
  res.json({ success: true });
});

module.exports = router;
