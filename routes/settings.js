const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
  res.render('settings', { user });
});

router.post('/settings/profile', requireAuth, upload.single('avatar'), (req, res) => {
  const { display_name } = req.body;

  if (display_name && display_name.trim().length > 0) {
    const clean = display_name.trim().slice(0, 30);
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(clean, req.user.id);
  }

  if (req.file) {
    const old = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
    if (old && old.avatar && old.avatar !== 'default.png') {
      const oldPath = path.join(uploadDir, old.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(req.file.filename, req.user.id);
  }

  req.user = db.prepare('SELECT id, email, display_name, avatar, coins, equipped_frame, equipped_badge, equipped_title FROM users WHERE id = ?').get(req.user.id);
  res.redirect('/settings');
});

module.exports = router;