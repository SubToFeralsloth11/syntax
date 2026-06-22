const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins, getBalance } = require('../middleware/currency');

// Public profile
router.get('/profile/:id', requireAuth, (req, res) => {
  const profile = db.prepare(`
    SELECT id, display_name, avatar, bio, coins, xp, level, role,
           equipped_frame, equipped_badge, equipped_title, created_at, last_active
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!profile) return res.status(404).render('404');

  const inventory = db.prepare(
    "SELECT * FROM inventory_items WHERE user_id = ? AND equipped = 1 ORDER BY item_type"
  ).all(profile.id);

  const achievements = db.prepare(`
    SELECT a.name, a.description, a.icon, ua.earned_at
    FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = ?
    ORDER BY ua.earned_at DESC
  `).all(profile.id);

  const { getLevelProgress } = require('../middleware/xp');
  const lvl = getLevelProgress(profile.id);

  const isFriend = db.prepare(
    'SELECT id FROM friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = ?'
  ).get(req.user.id, profile.id, profile.id, req.user.id, 'accepted');

  const friendRequest = db.prepare(
    'SELECT id, status FROM friends WHERE user_id = ? AND friend_id = ?'
  ).get(req.user.id, profile.id);

  res.render('public-profile', { profile, inventory, achievements, lvl, isFriend: !!isFriend, friendRequest });
});

// Friend requests
router.post('/friends/add', requireAuth, (req, res) => {
  const { friendId } = req.body;
  if (!friendId || parseInt(friendId) === req.user.id) {
    return res.json({ success: false, message: 'Invalid request' });
  }

  const existing = db.prepare(
    'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
  ).get(req.user.id, friendId, friendId, req.user.id);

  if (existing) {
    if (existing.status === 'accepted') return res.json({ success: false, message: 'Already friends' });
    if (existing.status === 'pending' && existing.user_id === req.user.id) return res.json({ success: false, message: 'Request already sent' });
    // Other person sent us a request - accept it
    if (existing.status === 'pending' && existing.friend_id === req.user.id) {
      db.prepare('UPDATE friends SET status = ? WHERE id = ?').run('accepted', existing.id);
      const { updateQuestProgress } = require('../middleware/quests');
      updateQuestProgress(req.user.id, 'friend');
      updateQuestProgress(friendId, 'friend');

      const friendBonus = db.prepare("SELECT * FROM events WHERE event_key = 'friend_bonus' AND is_active = 1").get();
      if (friendBonus) {
        const { awardCoins } = require('../middleware/currency');
        awardCoins(req.user.id, 100, 'friend_bonus');
        awardCoins(friendId, 100, 'friend_bonus');
      }

      return res.json({ success: true, message: 'Friend request accepted!' });
    }
  }

  db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)').run(req.user.id, friendId, 'pending');
  res.json({ success: true, message: 'Friend request sent!' });
});

router.post('/friends/accept', requireAuth, (req, res) => {
  const { requestId } = req.body;
  const request = db.prepare('SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = ?').get(requestId, req.user.id, 'pending');
  if (!request) return res.json({ success: false, message: 'Request not found' });

  db.prepare('UPDATE friends SET status = ? WHERE id = ?').run('accepted', requestId);
  const { updateQuestProgress } = require('../middleware/quests');
  updateQuestProgress(req.user.id, 'friend');
  updateQuestProgress(request.user_id, 'friend');
  res.json({ success: true, message: 'Friend request accepted!' });
});

router.post('/friends/reject', requireAuth, (req, res) => {
  const { requestId } = req.body;
  db.prepare('DELETE FROM friends WHERE id = ? AND friend_id = ? AND status = ?').run(requestId, req.user.id, 'pending');
  res.json({ success: true, message: 'Request rejected' });
});

router.post('/friends/remove', requireAuth, (req, res) => {
  const { friendId } = req.body;
  db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(req.user.id, friendId, friendId, req.user.id);
  res.json({ success: true, message: 'Friend removed' });
});

// Friends list
router.get('/friends', requireAuth, (req, res) => {
  const userId = req.user.id;

  const friends = db.prepare(`
    SELECT u.id, u.display_name, u.avatar, u.level, u.last_active,
           f.id as friendship_id
    FROM friends f
    JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
    WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
    ORDER BY u.last_active DESC
  `).all(userId, userId, userId);

  const pendingSent = db.prepare(`
    SELECT f.id, u.display_name, u.avatar, u.level
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'pending'
  `).all(userId);

  const pendingReceived = db.prepare(`
    SELECT f.id, u.display_name, u.avatar, u.level
    FROM friends f
    JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
  `).all(userId);

  // User's own inventory for gifting
  const myInventory = db.prepare(
    "SELECT id, item_name, item_type, rarity, equipped FROM inventory_items WHERE user_id = ? AND equipped = 0 ORDER BY item_type, item_name"
  ).all(userId);

  // Mark DMs as read
  db.prepare("UPDATE friend_dms SET read = 1 WHERE to_id = ? AND read = 0").run(userId);

  res.render('friends', { friends, pendingSent, pendingReceived, query: req.query, myInventory, myCoins: req.user.coins });
});

// Search users by display name (for friend requests)
router.get('/friends/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 1) return res.json({ users: [] });

  const userId = req.user.id;
  const results = db.prepare(`
    SELECT u.id, u.display_name, u.avatar, u.level,
      CASE
        WHEN f.status = 'accepted' THEN 'friends'
        WHEN f.user_id = ? AND f.status = 'pending' THEN 'sent'
        WHEN f.friend_id = ? AND f.status = 'pending' THEN 'received'
        ELSE 'none'
      END as friend_status
    FROM users u
    LEFT JOIN friends f ON (f.user_id = ? AND f.friend_id = u.id) OR (f.friend_id = ? AND f.user_id = u.id)
    WHERE u.id != ? AND u.display_name LIKE ?
    ORDER BY u.display_name ASC
    LIMIT 10
  `).all(userId, userId, userId, userId, userId, '%' + q + '%');

  res.json({ users: results });
});

// Gift coins to a friend
router.post('/friends/gift-coins', requireAuth, (req, res) => {
  const { friendId, amount } = req.body;
  const amt = parseInt(amount);
  const fid = parseInt(friendId);

  if (!fid || isNaN(amt) || amt <= 0) {
    return res.json({ success: false, message: 'Invalid gift' });
  }

  const areFriends = db.prepare(
    "SELECT id FROM friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'"
  ).get(req.user.id, fid, fid, req.user.id);

  if (!areFriends) return res.json({ success: false, message: 'You can only gift friends' });

  const balance = getBalance(req.user.id);
  if (balance < amt) return res.json({ success: false, message: 'Not enough coins' });

  awardCoins(req.user.id, -amt, 'gift_sent');

  let giftMultiplier = 1;
  const giftSplash = db.prepare("SELECT * FROM events WHERE event_key = 'gift_splash' AND is_active = 1").get();
  if (giftSplash) {
    const data = JSON.parse(giftSplash.data || '{}');
    giftMultiplier = data.multiplier || 2;
  }

  awardCoins(fid, Math.floor(amt * giftMultiplier), 'gift_received');

  res.json({ success: true, message: 'Gifted ' + amt + ' coins!', newBalance: getBalance(req.user.id) });
});

// Gift an inventory item to a friend
router.post('/friends/gift-item', requireAuth, (req, res) => {
  const { friendId, itemId } = req.body;
  const fid = parseInt(friendId);
  const iid = parseInt(itemId);

  if (!fid || !iid) return res.json({ success: false, message: 'Invalid gift' });

  const areFriends = db.prepare(
    "SELECT id FROM friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'"
  ).get(req.user.id, fid, fid, req.user.id);

  if (!areFriends) return res.json({ success: false, message: 'You can only gift friends' });

  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ? AND user_id = ? AND equipped = 0').get(iid, req.user.id);
  if (!item) return res.json({ success: false, message: 'Item not found or equipped' });

  db.prepare('UPDATE inventory_items SET user_id = ? WHERE id = ?').run(fid, iid);

  res.json({ success: true, message: 'Gifted ' + item.item_name + '!' });
});

// DMs
router.post('/friends/dm', requireAuth, (req, res) => {
  const { friendId, message } = req.body;
  if (!friendId || !message || !message.trim()) {
    return res.json({ success: false, message: 'Message required' });
  }

  const areFriends = db.prepare(
    "SELECT id FROM friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'"
  ).get(req.user.id, friendId, friendId, req.user.id);

  if (!areFriends) return res.json({ success: false, message: 'You must be friends to DM' });

  const clean = message.trim().slice(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  db.prepare('INSERT INTO friend_dms (from_id, to_id, message) VALUES (?, ?, ?)').run(req.user.id, friendId, clean);

  const dm = db.prepare(`
    SELECT fd.*, u.display_name as from_name
    FROM friend_dms fd
    JOIN users u ON u.id = fd.from_id
    WHERE fd.id = last_insert_rowid()
  `).get();

  res.json({ success: true, dm });
});

router.get('/friends/dm/:friendId', requireAuth, (req, res) => {
  const friendId = parseInt(req.params.friendId);
  const dms = db.prepare(`
    SELECT fd.*, u.display_name as from_name
    FROM friend_dms fd
    JOIN users u ON u.id = fd.from_id
    WHERE (fd.from_id = ? AND fd.to_id = ?) OR (fd.from_id = ? AND fd.to_id = ?)
    ORDER BY fd.created_at ASC
    LIMIT 100
  `).all(req.user.id, friendId, friendId, req.user.id);

  db.prepare("UPDATE friend_dms SET read = 1 WHERE to_id = ? AND from_id = ? AND read = 0").run(req.user.id, friendId);

  res.json({ dms });
});

// Unread DM count
router.get('/friends/unread', requireAuth, (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM friend_dms WHERE to_id = ? AND read = 0").get(req.user.id).cnt;
  res.json({ count });
});

module.exports = router;
