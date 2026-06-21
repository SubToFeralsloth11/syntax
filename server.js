require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml');
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(flash());

const passport = require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  if (req.user) {
    const db = require('./db/database');
    db.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").run(req.user.id);
    const unreadWarnings = db.prepare(
      'SELECT w.id, w.message, w.created_at, a.display_name as admin_name FROM warnings w JOIN users a ON a.id = w.admin_id WHERE w.user_id = ? AND w.read = 0 ORDER BY w.created_at DESC'
    ).all(req.user.id);
    res.locals.unreadWarnings = unreadWarnings;
  } else {
    res.locals.unreadWarnings = [];
  }
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const gamesRoutes = require('./routes/games');
const profileRoutes = require('./routes/profile');
const leaderboardRoutes = require('./routes/leaderboard');
const triviaRoutes = require('./routes/trivia');
const wheelRoutes = require('./routes/wheel');
const shopRoutes = require('./routes/shop');
const referralRoutes = require('./routes/referrals');
const chatRoutes = require('./routes/chat');
const settingsRoutes = require('./routes/settings');
const bankRoutes = require('./routes/bank');
const lotteryRoutes = require('./routes/lottery');
const earnRoutes = require('./routes/earn');
const questRoutes = require('./routes/quests');
const friendRoutes = require('./routes/friends');
const tradeRoutes = require('./routes/trades');
const adminRoutes = require('./routes/admin');

function avatarUrl(avatar) {
  if (!avatar || avatar === 'default.png' || avatar === 'default.svg') return '/images/default-avatar.svg';
  return '/uploads/avatars/' + avatar;
}
app.locals.avatarUrl = avatarUrl;

app.get('/games/echoes', (req, res) => {
  if (req.isAuthenticated()) {
    const db = require('./db/database');
    const { awardCoins } = require('./middleware/currency');
    const today = new Date().toISOString().split('T')[0];
    const already = db.prepare(
      "SELECT id FROM page_visits WHERE user_id = ? AND page_path = '/games/echoes' AND visited_date = ?"
    ).get(req.user.id, today);
    if (!already) {
      db.prepare('INSERT INTO page_visits (user_id, page_path, visited_date) VALUES (?, ?, ?)').run(req.user.id, '/games/echoes', today);
      awardCoins(req.user.id, 2, 'visit');
    }
  }
  const fs = require('fs');
  let html = fs.readFileSync(path.join(__dirname, 'games', 'Echoes of the Forgotten', 'index.html'), 'utf8');
  html = html.replace('<head>', '<head><base href="/games/echoes/">');
  res.type('html').send(html);
});
const echoGameDir = path.join(__dirname, 'games', 'Echoes of the Forgotten');
app.get('/games/echoes/script.js', (req, res) => res.type('js').sendFile(path.join(echoGameDir, 'script.js')));
app.get('/games/echoes/style.css', (req, res) => res.type('css').sendFile(path.join(echoGameDir, 'style.css')));
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', gamesRoutes);
app.use('/', profileRoutes);
app.use('/', leaderboardRoutes);
app.use('/', triviaRoutes);
app.use('/', wheelRoutes);
app.use('/', shopRoutes);
app.use('/', referralRoutes);
app.use('/', chatRoutes);
app.use('/', settingsRoutes);
app.use('/', bankRoutes);
app.use('/', lotteryRoutes);
app.use('/', earnRoutes);
app.use('/', questRoutes);
app.use('/', friendRoutes);
app.use('/', tradeRoutes);
app.use('/', adminRoutes);

// Custom error pages
app.use((req, res) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err.message);
  res.status(err.status || 500).render('500');
});

app.listen(PORT, () => {
  console.log(`Syntax running at http://localhost:${PORT}`);

  // Auto-generate thumbnails for games missing them
  setTimeout(() => {
    const fs = require('fs');
    const path = require('path');
    try {
      const { execFile } = require('child_process');
      const games = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'games.json'), 'utf8'));
      const needsThumbnail = games.filter(g => g.status === 'active' && g.thumbnail.endsWith('.svg'));
      if (needsThumbnail.length > 0) {
        console.log(`Generating thumbnails for ${needsThumbnail.length} game(s)...`);
        execFile('node', ['scripts/generate-thumbnail.js', ...needsThumbnail.map(g => g.id)], {
          cwd: __dirname,
          stdio: 'inherit'
        });
      }
    } catch (e) { /* ignore */ }
  }, 3000);
});
