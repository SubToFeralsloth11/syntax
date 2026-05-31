const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { forwardAuth } = require('../middleware/auth');
const { awardCoins } = require('../middleware/currency');
const { checkAchievement } = require('../middleware/achievements');
const { addToLog } = require('../db/accounts');

router.post('/login', (req, res, next) => {
  const user = db.prepare('SELECT remember_me FROM users WHERE email = ?').get(req.body.email);
  const rememberMe = user ? user.remember_me : 1;
  if (!rememberMe) {
    req.session.cookie.maxAge = undefined;
  } else {
    req.session.cookie.maxAge = req.body.remember
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
  }
  next();
}, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

router.get('/login', (req, res) => {
  res.render('login', {
    googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    messages: (req.flash?.('error') || [])[0] || null
  });
});

router.get('/signup', (req, res) => {
  const refCookie = req.cookies?.ref;
  const referred = !!refCookie;
  res.render('signup', {
    googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    messages: null,
    referred
  });
});

router.post('/signup', (req, res, next) => {
  const { email, password, display_name } = req.body;

  if (!email || !password) {
    const ge = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    return res.render('signup', { googleEnabled: ge, messages: 'Email and password are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    const ge = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    return res.render('signup', { googleEnabled: ge, messages: 'Email already registered' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const name = display_name || email.split('@')[0];

  // Save to persistent log so account survives DB resets
  addToLog(email, hash, name, null, password);

  const result = db.prepare(
    'INSERT INTO users (email, password_hash, display_name, password) VALUES (?, ?, ?, ?)'
  ).run(email, hash, name, password);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

  const refCookie = req.cookies?.ref;
  if (refCookie) {
    const referrerId = parseInt(refCookie, 10);
    if (referrerId !== user.id) {
      const referrer = db.prepare('SELECT id FROM users WHERE id = ?').get(referrerId);
      if (referrer) {
        const totalReferrals = db.prepare(
          "SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?"
        ).get(referrerId).cnt;
        if (totalReferrals < 5) {
          db.prepare(
            'INSERT OR IGNORE INTO referrals (referrer_id, referred_id, reward_given) VALUES (?, ?, 1)'
          ).run(referrerId, user.id);
          awardCoins(referrerId, 100, 'referral');
          if (totalReferrals === 0) {
            const coins = checkAchievement(referrerId, 'Social Butterfly');
            if (coins) awardCoins(referrerId, coins, 'achievement');
          }
        }
      }
    }
  }

  req.login(user, (err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
