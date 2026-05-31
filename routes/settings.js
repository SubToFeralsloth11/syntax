const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, req.user.id + '_' + Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

router.get('/settings', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const msg = (req.flash?.('success') || [])[0] || null;
  const err = (req.flash?.('error') || [])[0] || null;
  res.render('settings', { user, message: msg, error: err });
});

router.post('/settings/profile', requireAuth, upload.single('avatar'), (req, res) => {
  const { display_name, bio } = req.body;

  if (display_name && display_name.trim().length > 0) {
    const clean = display_name.trim().slice(0, 30);
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(clean, req.user.id);
  }

  if (bio !== undefined) {
    const cleanBio = bio.trim().slice(0, 200);
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(cleanBio || null, req.user.id);
  }

  if (req.file) {
    const old = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
    if (old && old.avatar && old.avatar !== 'default.png') {
      const oldPath = path.join(uploadDir, old.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(req.file.filename, req.user.id);
  }

  req.user = db.prepare('SELECT id, email, display_name, avatar, coins, equipped_frame, equipped_badge, equipped_title, role, banned_until FROM users WHERE id = ?').get(req.user.id);
  req.flash('success', 'Profile updated');
  res.redirect('/settings');
});

router.post('/settings/remember', requireAuth, (req, res) => {
  const { remember_me } = req.body;
  const val = remember_me === '1' || remember_me === 'true' ? 1 : 0;
  db.prepare('UPDATE users SET remember_me = ? WHERE id = ?').run(val, req.user.id);
  res.json({ success: true });
});

router.post('/settings/password', requireAuth, (req, res) => {
  const { current, newpass, confirm } = req.body;

  if (!current || !newpass || newpass.length < 4) {
    req.flash('error', 'New password must be at least 4 characters');
    return res.redirect('/settings');
  }
  if (newpass !== confirm) {
    req.flash('error', 'Passwords do not match');
    return res.redirect('/settings');
  }

  const user = db.prepare('SELECT password_hash, password FROM users WHERE id = ?').get(req.user.id);
  if (!user.password_hash) {
    req.flash('error', 'Cannot change password for Google accounts');
    return res.redirect('/settings');
  }

  const valid = bcrypt.compareSync(current, user.password_hash);
  if (!valid) {
    req.flash('error', 'Current password is incorrect');
    return res.redirect('/settings');
  }

  const hash = bcrypt.hashSync(newpass, 10);
  db.prepare('UPDATE users SET password_hash = ?, password = ? WHERE id = ?').run(hash, newpass, req.user.id);

  req.flash('success', 'Password changed');
  res.redirect('/settings');
});

module.exports = router;