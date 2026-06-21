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
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('image/png');
  res.sendFile(path.join(__dirname, 'public', 'images', 'logo.png'));
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

function frameTier(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('diamond')) return 'diamond';
  if (n.includes('gold')) return 'gold';
  if (n.includes('silver')) return 'silver';
  if (n.includes('bronze')) return 'bronze';
  return null;
}
app.locals.frameTier = frameTier;

function injectGameNav(html) {
  const backBtn = `
<style>
  .syntax-game-nav{position:fixed;top:16px;left:16px;z-index:9999;display:inline-flex;align-items:center;gap:8px;padding:10px 18px 10px 14px;background:rgba(10,10,20,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(0,240,255,0.3);border-radius:10px;color:#00f0ff;font-family:'Inter',-apple-system,sans-serif;font-size:0.85rem;font-weight:600;text-decoration:none;letter-spacing:0.5px;transition:all 0.2s;box-shadow:0 0 20px rgba(0,240,255,0.15)}
  .syntax-game-nav:hover{background:rgba(0,240,255,0.12);border-color:#00f0ff;color:#4ff8ff;box-shadow:0 0 28px rgba(0,240,255,0.4);transform:translateY(-1px)}
  .syntax-game-nav svg{width:18px;height:18px;flex-shrink:0}
  .syntax-game-nav span{white-space:nowrap}
  .syntax-game-nav .sgn-divider{width:1px;height:16px;background:rgba(0,240,255,0.3);margin:0 2px}
  .syntax-game-nav .sgn-home{color:#b537f2}
  .syntax-game-nav:hover .sgn-home{color:#c96bff}
  @media(max-width:480px){.syntax-game-nav span:not(.sgn-label){display:none}.syntax-game-nav .sgn-divider{display:none}.syntax-game-nav .sgn-label{display:inline}}
</style>
<a href="/games" class="syntax-game-nav" title="Back to Games">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
  <span class="sgn-label">Back to Games</span>
  <span class="sgn-divider"></span>
  <svg class="sgn-home" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
</a>`;
  if (html.includes('<body>')) {
    return html.replace('<body>', '<body>' + backBtn);
  }
  if (html.includes('<body ')) {
    return html.replace(/<body([^>]*)>/, '<body$1>' + backBtn);
  }
  return backBtn + html;
}

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
  html = injectGameNav(html);
  res.type('html').send(html);
});
const echoGameDir = path.join(__dirname, 'games', 'Echoes of the Forgotten');
app.get('/games/echoes/script.js', (req, res) => res.type('js').sendFile(path.join(echoGameDir, 'script.js')));
app.get('/games/echoes/style.css', (req, res) => res.type('css').sendFile(path.join(echoGameDir, 'style.css')));

app.get('/games/funny-shooter', (req, res) => {
  if (req.isAuthenticated()) {
    const db = require('./db/database');
    const { awardCoins } = require('./middleware/currency');
    const today = new Date().toISOString().split('T')[0];
    const already = db.prepare(
      "SELECT id FROM page_visits WHERE user_id = ? AND page_path = '/games/funny-shooter' AND visited_date = ?"
    ).get(req.user.id, today);
    if (!already) {
      db.prepare('INSERT INTO page_visits (user_id, page_path, visited_date) VALUES (?, ?, ?)').run(req.user.id, '/games/funny-shooter', today);
      awardCoins(req.user.id, 2, 'visit');
    }
  }
  const fs = require('fs');
  let html = fs.readFileSync(path.join(__dirname, 'games', 'funny-shooter', 'index.html'), 'utf8');
  html = injectGameNav(html);
  res.type('html').send(html);
});

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
