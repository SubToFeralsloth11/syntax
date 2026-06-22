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

  .syntax-exit-btn{position:fixed;top:16px;right:16px;z-index:9999;display:inline-flex;align-items:center;gap:8px;padding:10px 18px 10px 14px;background:rgba(10,10,20,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,43,214,0.3);border-radius:10px;color:#ff2bd6;font-family:'Inter',-apple-system,sans-serif;font-size:0.85rem;font-weight:600;cursor:pointer;letter-spacing:0.5px;transition:all 0.2s;box-shadow:0 0 20px rgba(255,43,214,0.15)}
  .syntax-exit-btn:hover{background:rgba(255,43,214,0.12);border-color:#ff2bd6;color:#ff5ce6;box-shadow:0 0 28px rgba(255,43,214,0.4);transform:translateY(-1px)}
  .syntax-exit-btn svg{width:18px;height:18px;flex-shrink:0}

  .syntax-exit-modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);align-items:center;justify-content:center}
  .syntax-exit-modal.open{display:flex}
  .syntax-exit-panel{background:#12121e;border:1px solid rgba(0,240,255,0.3);border-radius:16px;padding:32px;max-width:420px;width:90%;box-shadow:0 0 40px rgba(0,240,255,0.15);font-family:'Inter',-apple-system,sans-serif;color:#e0e0e0}
  .syntax-exit-panel h2{margin:0 0 8px;color:#00f0ff;font-size:1.3rem;font-weight:700}
  .syntax-exit-panel .sub{margin:0 0 24px;color:#888;font-size:0.85rem}
  .syntax-exit-panel label{display:block;margin-bottom:6px;color:#aaa;font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
  .syntax-exit-panel input,.syntax-exit-panel textarea{width:100%;padding:10px 14px;background:#0a0a14;border:1px solid rgba(0,240,255,0.2);border-radius:8px;color:#fff;font-family:inherit;font-size:0.95rem;outline:none;box-sizing:border-box;margin-bottom:16px}
  .syntax-exit-panel input:focus,.syntax-exit-panel textarea:focus{border-color:#00f0ff;box-shadow:0 0 12px rgba(0,240,255,0.2)}
  .syntax-exit-panel textarea{resize:vertical;min-height:60px}
  .syntax-exit-panel .btn-row{display:flex;gap:12px;margin-top:8px}
  .syntax-exit-panel .btn-save{flex:1;padding:12px;background:linear-gradient(135deg,#00f0ff,#b537f2);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:0.95rem;cursor:pointer;transition:all 0.2s}
  .syntax-exit-panel .btn-save:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(0,240,255,0.4)}
  .syntax-exit-panel .btn-save:disabled{opacity:0.5;cursor:not-allowed;transform:none}
  .syntax-exit-panel .btn-quit{flex:1;padding:12px;background:transparent;border:1px solid rgba(255,43,214,0.4);border-radius:8px;color:#ff2bd6;font-weight:700;font-size:0.95rem;cursor:pointer;transition:all 0.2s;text-decoration:none;text-align:center;display:block;box-sizing:border-box}
  .syntax-exit-panel .btn-quit:hover{background:rgba(255,43,214,0.1);border-color:#ff2bd6}
  .syntax-exit-panel .save-status{margin-top:12px;padding:10px;border-radius:8px;font-size:0.85rem;display:none;text-align:center}
  .syntax-exit-panel .save-status.ok{display:block;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:#00ff88}
  .syntax-exit-panel .save-status.err{display:block;background:rgba(255,43,214,0.1);border:1px solid rgba(255,43,214,0.3);color:#ff2bd6}
  .syntax-exit-panel .best-score{margin:0 0 20px;padding:12px;background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.15);border-radius:8px;text-align:center}
  .syntax-exit-panel .best-score span{color:#00f0ff;font-size:1.5rem;font-weight:700}
  .syntax-exit-panel .best-score small{display:block;color:#888;font-size:0.75rem;margin-top:2px}
</style>

<a href="/games" class="syntax-game-nav" title="Back to Games">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
  <span class="sgn-label">Back to Games</span>
  <span class="sgn-divider"></span>
  <svg class="sgn-home" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
</a>

<button class="syntax-exit-btn" id="syntaxExitBtn" onclick="document.getElementById('syntaxExitModal').classList.add('open');if(window.loadExitScores)window.loadExitScores();" title="Exit Game">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
  <span class="sgn-label">Exit Game</span>
</button>

<div id="syntaxExitModal" class="syntax-exit-modal">
  <div class="syntax-exit-panel">
    <h2>Exit Game</h2>
    <p class="sub">Save your progress before leaving?</p>
    <div class="best-score" id="syntaxBestScore" style="display:none">
      <span id="syntaxBestScoreVal">0</span>
      <small>Best Score</small>
    </div>
    <label for="syntaxScoreInput">Your Score</label>
    <input type="number" id="syntaxScoreInput" placeholder="Enter your score" value="0">
    <label for="syntaxNotes">Notes (optional)</label>
    <textarea id="syntaxNotes" placeholder="Any notes about this run..."></textarea>
    <div class="btn-row">
      <button class="btn-save" id="syntaxSaveBtn" onclick="syntaxSaveAndExit()">Save & Exit</button>
      <a href="/games" class="btn-quit">Quit Without Saving</a>
    </div>
    <div class="save-status" id="syntaxSaveStatus"></div>
  </div>
</div>

<script>
(function(){
  var gid = window.SYNTAX_GAME_ID || '';
  var isAuth = !!window.SYNTAX_AUTH;

  window.loadExitScores = function() {
    if (!gid || !window.SYNTAX_AUTH) return;
    var url = window.location.origin + '/api/game-scores/' + encodeURIComponent(gid);
    fetch(url, {credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error();return r.json()}).then(function(d){
      var el = document.getElementById('syntaxBestScore');
      if (d.best > 0) {
        document.getElementById('syntaxBestScoreVal').textContent = d.best;
        el.style.display = 'block';
        document.getElementById('syntaxScoreInput').value = d.best;
      }
    }).catch(function(){});
  };

  window.syntaxSaveAndExit = function() {
    if (!window.SYNTAX_AUTH) {
      window.location.href = '/login';
      return;
    }
    var score = parseInt(document.getElementById('syntaxScoreInput').value) || 0;
    var notes = document.getElementById('syntaxNotes').value;
    var btn = document.getElementById('syntaxSaveBtn');
    var status = document.getElementById('syntaxSaveStatus');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    fetch(window.location.origin + '/api/game-scores', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gid, score: score, extra_data: notes || null })
    }).then(function(r){return r.json()}).then(function(d){
      if (d.ok) {
        status.className = 'save-status ok';
        status.textContent = 'Score saved! Best: ' + d.best;
        setTimeout(function(){ window.location.href = '/games'; }, 800);
      } else {
        throw new Error('Save failed');
      }
    }).catch(function(e){
      status.className = 'save-status err';
      status.textContent = 'Failed to save — try again';
      btn.disabled = false;
      btn.textContent = 'Save & Exit';
    });
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('syntaxExitModal');
      if (modal && modal.classList.contains('open')) {
        modal.classList.remove('open');
      }
    }
  });

  function updateExitAuthUI() {
    var auth = !!window.SYNTAX_AUTH;
    var saveBtn = document.getElementById('syntaxSaveBtn');
    var sub = document.querySelector('.syntax-exit-panel .sub');
    if (!auth) {
      if (saveBtn) { saveBtn.textContent = 'Login to Save'; saveBtn.onclick = function(){ window.location.href = '/login'; }; }
      if (sub) sub.textContent = 'Log in to save your progress';
    } else {
      if (saveBtn) { saveBtn.textContent = 'Save & Exit'; saveBtn.onclick = syntaxSaveAndExit; }
      if (sub) sub.textContent = 'Save your progress before leaving?';
    }
  }
  updateExitAuthUI();
  document.getElementById('syntaxExitBtn').addEventListener('click', updateExitAuthUI);
})();
</script>`;
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
