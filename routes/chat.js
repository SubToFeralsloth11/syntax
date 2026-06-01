const express = require('express');
const router = express.Router();
const db = require('../db/database');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { awardXP } = require('../middleware/xp');
const { updateQuestProgress } = require('../middleware/quests');

const BANNED = require(path.join(__dirname, '..', 'config', 'banned-words.json'));

function normalizeForFilter(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function checkBanned(message) {
  const raw = message.toLowerCase().trim();
  const words = raw.split(/\s+/);
  const compressed = normalizeForFilter(message);

  for (const word of BANNED) {
    const cleanWord = normalizeForFilter(word);
    if (!cleanWord) continue;
    const lower = word.toLowerCase();

    // Emoji/symbol: check raw message directly
    if (/^[^a-zA-Z0-9]+$/.test(word) && message.includes(word)) return word;

    // Multi-word phrase: check raw contains it
    if (lower.includes(' ') && raw.includes(lower)) return word;

    // Obfuscated variant in banned list (has symbols/spaces): compress both
    // Require cleanWord >= 3 chars to avoid false positives (e.g. "@ss" -> "ss" in "message")
    if (/[^a-zA-Z]/.test(lower) && cleanWord.length >= 3 && compressed.includes(cleanWord)) return word;

    // Clean single word: exact word match OR compressed word match
    if (words.some(w => {
      if (w === lower) return true;
      if (/[^a-zA-Z]/.test(w) && normalizeForFilter(w) === cleanWord) return true;
      return false;
    })) return word;
  }

  return null;
}

router.get('/chat', requireAuth, (req, res) => {
  const messages = db.prepare(`
    SELECT cm.id, cm.message, cm.created_at, u.display_name, u.id as user_id, u.role
    FROM chat_messages cm
    JOIN users u ON u.id = cm.user_id
    ORDER BY cm.id DESC
    LIMIT 50
  `).all().reverse();

  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;

  res.render('chat', { messages, userCount });
});

router.post('/chat/send', requireAuth, (req, res) => {
  const { message } = req.body;
  if (!message || message.trim().length === 0) {
    return res.json({ success: false, message: 'Message cannot be empty' });
  }
  if (message.length > 500) {
    return res.json({ success: false, message: 'Message too long (max 500 chars)' });
  }

  const banned = checkBanned(message);
  if (banned) {
    return res.json({ success: false, message: `Blocked word: "${banned}"` });
  }

  const clean = message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  db.prepare('INSERT INTO chat_messages (user_id, message) VALUES (?, ?)').run(req.user.id, clean);
  awardXP(req.user.id, 5, 'chat');
  updateQuestProgress(req.user.id, 'chat');

  const msg = db.prepare(`
    SELECT cm.id, cm.message, cm.created_at, u.display_name, u.id as user_id, u.role
    FROM chat_messages cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.id = last_insert_rowid()
  `).get();

  res.json({ success: true, message: msg });
});

router.get('/chat/messages', requireAuth, (req, res) => {
  const after = parseInt(req.query.after) || 0;
  const messages = db.prepare(`
    SELECT cm.id, cm.message, cm.created_at, u.display_name, u.id as user_id, u.role
    FROM chat_messages cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.id > ?
    ORDER BY cm.id ASC
  `).all(after);

  res.json({ messages });
});

router.get('/chat/users', requireAuth, (req, res) => {
  const q = req.query.q || '';
  const users = db.prepare(`
    SELECT id, display_name FROM users
    WHERE display_name LIKE ? AND id != ?
    ORDER BY display_name ASC
    LIMIT 10
  `).all('%' + q + '%', req.user.id);

  res.json({ users });
});

module.exports = router;