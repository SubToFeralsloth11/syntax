const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const MAX_REFERRALS = 5;

router.get('/refer', requireAuth, (req, res) => {
  const userId = req.user.id;
  const refCode = Buffer.from(userId.toString()).toString('base64').replace(/=/g, '');

  const referrals = db.prepare(`
    SELECT u.display_name, r.created_at
    FROM referrals r
    JOIN users u ON u.id = r.referred_id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
  `).all(userId);

  const referralCount = referrals.length;
  const totalEarned = Math.min(referralCount, MAX_REFERRALS) * 50;

  res.render('refer', { refCode, referrals, referralCount, totalEarned, maxReferrals: MAX_REFERRALS });
});

router.get('/ref/:code', (req, res) => {
  const userId = parseInt(Buffer.from(req.params.code, 'base64').toString('utf8'), 10);

  if (userId) {
    res.cookie('ref', userId, { maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  res.redirect('/signup');
});

module.exports = router;
