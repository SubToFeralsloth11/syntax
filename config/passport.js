const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const db = require('../db/database');

passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return done(null, false, { message: 'Invalid email or password' });
  }
  if (!user.password_hash) {
    return done(null, false, { message: 'This account uses Google login' });
  }
  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return done(null, false, { message: 'Invalid email or password' });
  }
  return done(null, user);
}));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.emails[0].value);
      if (user) {
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(profile.id, user.id);
      } else {
        const result = db.prepare(
          'INSERT INTO users (email, google_id, display_name, avatar) VALUES (?, ?, ?, ?)'
        ).run(profile.emails[0].value, profile.id, profile.displayName, profile.photos[0]?.value || 'default.png');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      }
    }
    return done(null, user);
  }));
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT id, email, display_name, avatar, coins, equipped_frame, equipped_badge, equipped_title, role, banned_until FROM users WHERE id = ?').get(id);
  done(null, user);
});

module.exports = passport;
