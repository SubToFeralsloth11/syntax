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

    const pendingFriends = db.prepare(
      "SELECT COUNT(*) as cnt FROM friends WHERE friend_id = ? AND status = 'pending'"
    ).get(req.user.id).cnt;
    const unreadDMs = db.prepare(
      "SELECT COUNT(*) as cnt FROM friend_dms WHERE to_id = ? AND read = 0"
    ).get(req.user.id).cnt;
    const unreadChat = db.prepare(
      "SELECT COUNT(*) as cnt FROM chat_messages WHERE id > COALESCE((SELECT last_read_chat FROM users WHERE id = ?), 0)"
    ).get(req.user.id).cnt;
    res.locals.notifCounts = { friends: pendingFriends, dms: unreadDMs, chat: unreadChat };
  } else {
    res.locals.unreadWarnings = [];
    res.locals.notifCounts = { friends: 0, dms: 0, chat: 0 };
  }
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Notification counts API
app.get('/api/notifications', (req, res) => {
  if (!req.isAuthenticated()) return res.json({ friends: 0, dms: 0, chat: 0 });
  const db = require('./db/database');
  const pendingFriends = db.prepare(
    "SELECT COUNT(*) as cnt FROM friends WHERE friend_id = ? AND status = 'pending'"
  ).get(req.user.id).cnt;
  const unreadDMs = db.prepare(
    "SELECT COUNT(*) as cnt FROM friend_dms WHERE to_id = ? AND read = 0"
  ).get(req.user.id).cnt;
  const unreadChat = db.prepare(
    "SELECT COUNT(*) as cnt FROM chat_messages WHERE id > COALESCE((SELECT last_read_chat FROM users WHERE id = ?), 0)"
  ).get(req.user.id).cnt;
  res.json({ friends: pendingFriends, dms: unreadDMs, chat: unreadChat });
});

// Mark chat as read
app.post('/api/notifications/read-chat', (req, res) => {
  if (!req.isAuthenticated()) return res.json({ ok: true });
  const db = require('./db/database');
  const last = db.prepare('SELECT MAX(id) as max_id FROM chat_messages').get();
  if (last && last.max_id) {
    db.prepare('UPDATE users SET last_read_chat = ? WHERE id = ?').run(last.max_id, req.user.id);
  }
  res.json({ ok: true });
});

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
  const navHtml = `
<style>
  .syntax-game-nav{position:fixed;top:16px;left:16px;z-index:9999;display:inline-flex;align-items:center;gap:8px;padding:10px 18px 10px 14px;background:rgba(10,10,20,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(0,240,255,0.3);border-radius:10px;color:#00f0ff;font-family:'Inter',-apple-system,sans-serif;font-size:0.85rem;font-weight:600;text-decoration:none;letter-spacing:0.5px;transition:all 0.2s;box-shadow:0 0 20px rgba(0,240,255,0.15)}
  .syntax-game-nav:hover{background:rgba(0,240,255,0.12);border-color:#00f0ff;color:#4ff8ff;box-shadow:0 0 28px rgba(0,240,255,0.4);transform:translateY(-1px)}
  .syntax-game-nav svg{width:18px;height:18px;flex-shrink:0}
  .syntax-game-nav span{white-space:nowrap}
  .syntax-game-nav .sgn-divider{width:1px;height:16px;background:rgba(0,240,255,0.3);margin:0 2px}
  .syntax-game-nav .sgn-home{color:#b537f2}
  .syntax-game-nav:hover .sgn-home{color:#c96bff}
  @media(max-width:480px){.syntax-game-nav span:not(.sgn-label){display:none}.syntax-game-nav .sgn-divider{display:none}.syntax-game-nav .sgn-label{display:inline}}

  .syntax-score-bar{position:fixed;top:16px;right:16px;z-index:9999;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:rgba(10,10,20,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(0,255,136,0.3);border-radius:10px;color:#00ff88;font-family:'Inter',-apple-system,sans-serif;font-size:0.85rem;font-weight:600;box-shadow:0 0 20px rgba(0,255,136,0.15);cursor:pointer;transition:all 0.2s}
  .syntax-score-bar:hover{border-color:#00ff88;box-shadow:0 0 28px rgba(0,255,136,0.4)}
  .syntax-score-bar svg{width:16px;height:16px}
  .syntax-score-bar .ssb-best{color:#888;font-weight:400;margin-left:4px}
  .syntax-score-bar.saved{animation:ssbFlash 0.6s ease}
  @keyframes ssbFlash{0%,100%{border-color:rgba(0,255,136,0.3)}50%{border-color:#00ff88;box-shadow:0 0 30px rgba(0,255,136,0.6)}}

  .syntax-save-toast{position:fixed;bottom:24px;right:24px;z-index:10000;padding:12px 20px;border-radius:10px;font-family:'Inter',-apple-system,sans-serif;font-size:0.85rem;font-weight:600;opacity:0;transform:translateY(10px);transition:all 0.3s;pointer-events:none}
  .syntax-save-toast.show{opacity:1;transform:translateY(0)}
  .syntax-save-toast.ok{background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);color:#00ff88}
</style>

<a href="/games" class="syntax-game-nav" title="Back to Games">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
  <span class="sgn-label">Back to Games</span>
  <span class="sgn-divider"></span>
  <svg class="sgn-home" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
</a>

<div class="syntax-score-bar" id="syntaxScoreBar" style="display:none" title="Auto-saves your score">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
  <span id="syntaxScoreVal">0</span>
  <span class="ssb-best" id="syntaxScoreBest"></span>
</div>

<div class="syntax-save-toast" id="syntaxSaveToast"></div>

<script>
(function(){
  var gid = window.SYNTAX_GAME_ID || '';
  var auth = !!window.SYNTAX_AUTH;
  var _api = window.location.origin + '/api/game-scores';
  var _lastScore = 0;
  var _saved = false;
  var _bestLocal = 0;

  var bar = document.getElementById('syntaxScoreBar');
  var val = document.getElementById('syntaxScoreVal');
  var best = document.getElementById('syntaxScoreBest');
  var toast = document.getElementById('syntaxSaveToast');

  if (auth && bar) bar.style.display = 'inline-flex';

  function showToast(msg) {
    toast.textContent = msg;
    toast.className = 'syntax-save-toast ok show';
    setTimeout(function(){ toast.className = 'syntax-save-toast'; }, 2500);
  }

  function flashBar() {
    if (!bar) return;
    bar.classList.remove('saved');
    void bar.offsetWidth;
    bar.classList.add('saved');
  }

  function updateDisplay(score) {
    if (score > _lastScore) _lastScore = score;
    if (val) val.textContent = _lastScore;
  }

  window.setGameScore = function(score) {
    updateDisplay(score);
    _saved = false;
  };

  function postScore(score, extra) {
    if (!auth || !gid || score <= 0) return Promise.resolve();
    return fetch(_api, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gid, score: score, extra_data: extra || null })
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d.ok) {
        _saved = true;
        _bestLocal = d.best;
        if (best) best.textContent = '/ best: ' + d.best;
        flashBar();
      }
    }).catch(function(){});
  }

  window.saveGameScore = function(score, extra) {
    updateDisplay(score);
    postScore(_lastScore, extra);
  };

  window.getGameScores = function(cb) {
    if (!auth || !gid) return;
    fetch(_api + '/' + encodeURIComponent(gid), {credentials:'same-origin'})
      .then(function(r){return r.json()}).then(cb).catch(function(){});
  };

  // Auto-detect score from DOM (most common game score selectors)
  function scrapeScore() {
    var selectors = [
      '.score-container', '.score', '#score', '#score-value', '#current-score',
      '.game-score', '.points', '#points', '.current', '.value',
      '#game-score', '.score-value', '.score-text', '.myscore',
      'h2.score', 'span.score', 'div.score', '.best-score',
      '[data-score]', '.count', '#count', '.timer'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        var txt = els[j].textContent.replace(/[^0-9]/g, '');
        var n = parseInt(txt, 10);
        if (n > 0 && n > _lastScore) return n;
      }
    }
    return 0;
  }

  // Intercept localStorage.setItem to capture scores
  var _origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, val) {
    _origSetItem.call(this, key, val);
    if (!auth) return;
    var k = key.toLowerCase();
    if (k.indexOf('score') !== -1 || k.indexOf('points') !== -1 || k.indexOf('high') !== -1 || k.indexOf('best') !== -1) {
      var n = parseInt(val, 10);
      if (n > 0 && n > _lastScore) updateDisplay(n);
    }
    // Also check if value is JSON containing score
    try {
      var obj = JSON.parse(val);
      if (obj && typeof obj === 'object') {
        var s = obj.score || obj.points || obj.highScore || obj.bestScore || 0;
        if (s > _lastScore) updateDisplay(s);
      }
    } catch(e){}
  };

  // Intercept common score variables
  var _origDefineProperty = Object.defineProperty;
  var _scoreWatchers = [];
  function watchScore(obj, prop) {
    try {
      var val = obj[prop];
      _origDefineProperty.call(Object, obj, prop, {
        get: function(){ return val; },
        set: function(v){
          val = v;
          if (typeof v === 'number' && v > _lastScore) updateDisplay(v);
        },
        configurable: true
      });
      _scoreWatchers.push(prop);
    } catch(e){}
  }

  // Watch common global score variables after DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){
    ['score','Score','SCORE','points','Points','gameScore','currentScore','playerScore'].forEach(function(p){
      if (window[p] !== undefined) watchScore(window, p);
    });
  });

  // Poll DOM for score changes every 3 seconds
  setInterval(function(){
    if (!auth) return;
    var s = scrapeScore();
    if (s > _lastScore) updateDisplay(s);
  }, 3000);

  // Auto-save every 15 seconds if score changed
  if (auth && gid) {
    fetch(_api + '/' + encodeURIComponent(gid), {credentials:'same-origin'})
      .then(function(r){return r.json()}).then(function(d){
        if (d.best > 0 && best) best.textContent = '/ best: ' + d.best;
      }).catch(function(){});

    setInterval(function(){
      if (_lastScore > 0 && !_saved) {
        postScore(_lastScore);
      }
    }, 15000);

    // Save on page close
    window.addEventListener('beforeunload', function(){
      if (_lastScore > 0 && auth) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', _api, false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.withCredentials = true;
          xhr.send(JSON.stringify({game_id:gid,score:_lastScore}));
        } catch(e){}
      }
    });
  }
})();</script>`;
  if (html.includes('<body>')) {
    return html.replace('<body>', '<body>' + navHtml);
  }
  if (html.includes('<body ')) {
    return html.replace(/<body([^>]*)>/, '<body$1>' + navHtml);
  }
  return navHtml + html;
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
  html = html.replace('<head>', '<head><base href="/games/funny-shooter/">');
  html = injectGameNav(html);
  res.type('html').send(html);
});

// Serve Funny Shooter 2 Unity WebGL assets
const funnyShooterDir = path.join(__dirname, 'games', 'funny-shooter');
app.use('/games/funny-shooter', express.static(funnyShooterDir));

// Helper: serve a single-file game with visit coins + nav injection + save API
function serveGame(route, folder) {
  const gameId = folder;
  app.get(route, (req, res) => {
    if (req.isAuthenticated()) {
      const db = require('./db/database');
      const { awardCoins } = require('./middleware/currency');
      const today = new Date().toISOString().split('T')[0];
      const already = db.prepare(
        "SELECT id FROM page_visits WHERE user_id = ? AND page_path = ? AND visited_date = ?"
      ).get(req.user.id, route, today);
      if (!already) {
        db.prepare('INSERT INTO page_visits (user_id, page_path, visited_date) VALUES (?, ?, ?)').run(req.user.id, route, today);
        awardCoins(req.user.id, 2, 'visit');
      }
    }
    const fs = require('fs');
    let html = fs.readFileSync(path.join(__dirname, 'games', folder, 'index.html'), 'utf8');
    html = html.replace('<head>', '<head><base href="' + route + '/">');
    html = injectGameNav(html);
    html = injectGameSave(html, gameId);
    res.type('html').send(html);
  });
  app.use(route, express.static(path.join(__dirname, 'games', folder)));
}

// Game score API — save/load/highscore
app.post('/api/game-scores', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Login required' });
  const { game_id, score, extra_data } = req.body;
  if (!game_id || score === undefined) return res.status(400).json({ error: 'game_id and score required' });
  const db = require('./db/database');
  db.prepare('INSERT INTO game_scores (user_id, game_id, score, extra_data) VALUES (?, ?, ?, ?)').run(req.user.id, game_id, score, extra_data || null);
  const best = db.prepare('SELECT MAX(score) as best FROM game_scores WHERE user_id = ? AND game_id = ?').get(req.user.id, game_id);
  res.json({ ok: true, best: best.best });
});

app.get('/api/game-scores/:gameId', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Login required' });
  const db = require('./db/database');
  const best = db.prepare('SELECT MAX(score) as best FROM game_scores WHERE user_id = ? AND game_id = ?').get(req.user.id, req.params.gameId);
  const recent = db.prepare('SELECT score, created_at FROM game_scores WHERE user_id = ? AND game_id = ? ORDER BY created_at DESC LIMIT 10').all(req.user.id, req.params.gameId);
  res.json({ best: best?.best || 0, recent });
});

// Inject game save helper into all served game HTML
function injectGameSave(html, gameId) {
  const saveScript = `<script>
(function(){
  window.SYNTAX_GAME_ID = '${gameId}';
  window.SYNTAX_AUTH = true;
  var _apiBase = window.location.origin + '/api/game-scores';
  window.saveGameScore = function(score, extra) {
    fetch(_apiBase, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: '${gameId}', score: score, extra_data: extra ? JSON.stringify(extra) : null })
    }).catch(function(){});
  };
  window.getGameScores = function(cb) {
    fetch(_apiBase + '/${gameId}', {credentials:'same-origin'}).then(function(r){return r.json()}).then(cb).catch(function(){});
  };
})();</script>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', saveScript + '</head>');
  }
  return saveScript + html;
}

serveGame('/games/2048', '2048');
serveGame('/games/tetris', 'tetris');
serveGame('/games/flappy-bird', 'flappy-bird');
serveGame('/games/snake', 'snake');
serveGame('/games/minesweeper', 'minesweeper');
serveGame('/games/tic-tac-toe', 'tic-tac-toe');
serveGame('/games/breakout', 'breakout');
serveGame('/games/pong', 'pong');
serveGame('/games/memory', 'memory');
serveGame('/games/connect-four', 'connect-four');
serveGame('/games/hangman', 'hangman');
serveGame('/games/wordle', 'wordle');
serveGame('/games/sudoku', 'sudoku');
serveGame('/games/space-invaders', 'space-invaders');
serveGame('/games/whack-a-mole', 'whack-a-mole');
serveGame('/games/simon', 'simon');
serveGame('/games/reaction-time', 'reaction-time');
serveGame('/games/typing-speed', 'typing-speed');
serveGame('/games/color-match', 'color-match');
serveGame('/games/solitaire', 'solitaire');
serveGame('/games/chess', 'chess');
serveGame('/games/checkers', 'checkers');
serveGame('/games/bubble-shooter', 'bubble-shooter');
serveGame('/games/platformer', 'platformer');
serveGame('/games/endless-runner', 'endless-runner');

// Static games (no server needed)
app.get('/games/cuber', (req, res) => {
  if (req.isAuthenticated()) {
    const db = require('./db/database');
    const { awardCoins } = require('./middleware/currency');
    const today = new Date().toISOString().split('T')[0];
    const already = db.prepare("SELECT id FROM page_visits WHERE user_id = ? AND page_path = ? AND visited_date = ?").get(req.user.id, '/games/cuber', today);
    if (!already) {
      db.prepare('INSERT INTO page_visits (user_id, page_path, visited_date) VALUES (?, ?, ?)').run(req.user.id, '/games/cuber', today);
      awardCoins(req.user.id, 2, 'visit');
    }
  }
  const fs = require('fs');
  const gameDir = path.join(__dirname, 'games', 'cuber', 'cube2');
  const htmlPath = path.join(gameDir, 'mini.html');
  if (!fs.existsSync(htmlPath)) return res.status(404).render('404');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('<head>', '<head><base href="/games/cuber/cube2/">');
  html = injectGameNav(html);
  res.type('html').send(html);
});
app.use('/games/cuber/cube2', express.static(path.join(__dirname, 'games', 'cuber', 'cube2')));

app.get('/games/arena-fps', (req, res) => {
  if (req.isAuthenticated()) {
    const db = require('./db/database');
    const { awardCoins } = require('./middleware/currency');
    const today = new Date().toISOString().split('T')[0];
    const already = db.prepare("SELECT id FROM page_visits WHERE user_id = ? AND page_path = ? AND visited_date = ?").get(req.user.id, '/games/arena-fps', today);
    if (!already) {
      db.prepare('INSERT INTO page_visits (user_id, page_path, visited_date) VALUES (?, ?, ?)').run(req.user.id, '/games/arena-fps', today);
      awardCoins(req.user.id, 2, 'visit');
    }
  }
  const fs = require('fs');
  const htmlPath = path.join(__dirname, 'games', 'arena-fps', 'public', 'index.html');
  if (!fs.existsSync(htmlPath)) return res.status(404).render('404');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('<head>', '<head><base href="/games/arena-fps/">');
  html = injectGameNav(html);
  res.type('html').send(html);
});
app.use('/games/arena-fps', express.static(path.join(__dirname, 'games', 'arena-fps', 'public')));

app.get('/games/openarena-web', (req, res) => {
  if (req.isAuthenticated()) {
    const db = require('./db/database');
    const { awardCoins } = require('./middleware/currency');
    const today = new Date().toISOString().split('T')[0];
    const already = db.prepare("SELECT id FROM page_visits WHERE user_id = ? AND page_path = ? AND visited_date = ?").get(req.user.id, '/games/openarena-web', today);
    if (!already) {
      db.prepare('INSERT INTO page_visits (user_id, page_path, visited_date) VALUES (?, ?, ?)').run(req.user.id, '/games/openarena-web', today);
      awardCoins(req.user.id, 2, 'visit');
    }
  }
  const fs = require('fs');
  const htmlPath = path.join(__dirname, 'games', 'openarena-web', 'release', 'index.html');
  if (!fs.existsSync(htmlPath)) return res.status(404).render('404');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('<head>', '<head><base href="/games/openarena-web/release/">');
  html = injectGameNav(html);
  res.type('html').send(html);
});
app.use('/games/openarena-web/release', express.static(path.join(__dirname, 'games', 'openarena-web', 'release')));

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
