# Syntax 🎮

A game portal website with a currency system — earn coins across the site, spend them on mystery boxes and profile cosmetics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite (`better-sqlite3`) |
| Templating | EJS |
| Auth | Passport.js (local email/password + Google OAuth) |
| Session | express-session (SQLite store) |
| Trivia API | [Open Trivia DB](https://opentdb.com/) (free, no key needed) |
| Hosting | Any Node.js host (Render, Railway, Fly.io) — **all free tiers** |

No paid services or API keys required.

---

## Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Home | Hero, daily check-in button, activity feed, quick stats |
| `/login` | Login | Email/password + Google OAuth |
| `/signup` | Signup | Email/password + Google OAuth |
| `/logout` | — | Destroys session |
| `/games` | Games Portal | Grid of game cards (configurable via `config/games.json`) |
| `/shop` | Shop | Buy mystery boxes + profile cosmetics |
| `/shop/mystery-box/buy` | — | POST — buy a mystery box |
| `/shop/mystery-box/open` | — | POST — open a mystery box (returns result) |
| `/profile` | Profile | Stats, inventory (equip frames/badges/titles), achievements |
| `/leaderboard` | Leaderboard | All users ranked by total coins earned |
| `/trivia` | Daily Trivia | One question per day from Open Trivia DB |
| `/wheel` | Spin Wheel | Spin once per day for 1–50 random coins |

---

## Currency System

### Earning Methods

| Method | Coins | Limit |
|---|---|---|
| Daily check-in | 10 | Once per day |
| Daily check-in streak (5+ consecutive days) | 25 bonus | Once per day |
| Visit a game page | 2 | Once per page per day |
| Press "Play" on a game | 5 | Once per game per day |
| Daily trivia (correct answer) | 15 | Once per day |
| Spin the wheel | 1–50 (random) | Once per day |
| Achievement unlocked | 25–100 | One-time per achievement |
| Refer a friend | 50 | Per referred user who signs up |

### Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  display_name TEXT DEFAULT 'Player',
  avatar TEXT DEFAULT 'default.png',
  coins INTEGER DEFAULT 0,
  total_coins_earned INTEGER DEFAULT 0,
  equipped_frame TEXT DEFAULT NULL,
  equipped_badge TEXT DEFAULT NULL,
  equipped_title TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  checkin_date TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE page_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  page_path TEXT NOT NULL,
  visited_date TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE daily_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  current_streak INTEGER DEFAULT 0,
  last_checkin_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT 'default.png'
);

CREATE TABLE user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

CREATE TABLE shop_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'frame', 'badge', 'title'
  price INTEGER NOT NULL,
  image_url TEXT DEFAULT 'default.png',
  description TEXT DEFAULT ''
);

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES shop_items(id)
);

CREATE TABLE coin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,     -- positive = earned, negative = spent
  reason TEXT NOT NULL,        -- 'checkin', 'visit', 'trivia', 'wheel', 'achievement', 'referral', 'mystery_box', 'purchase'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referred_id INTEGER UNIQUE NOT NULL,
  reward_given INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
);

CREATE TABLE wheel_spins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  spin_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE trivia_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_date TEXT NOT NULL,  -- date of the question they answered
  correct INTEGER NOT NULL,    -- 0 or 1
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Mystery Box System

### Cost
100 coins per box.

### Flow
1. User clicks "Buy Mystery Box" on the shop page
2. A **loot table modal** appears showing ALL 50+ possible items with no rarity labels — just a flat list of everything you could get
3. User confirms → 100 coins deducted
4. **Gift box opening animation** plays:
   - Box shakes side to side (CSS)
   - Box glows/pulses
   - Ribbon unties and flies off
   - Lid pops open with a bounce
   - Confetti particles burst from the box (HTML Canvas)
5. Result is revealed with a fanfare

### Reward Table (50 items, pure luck — no visible rarities)

Hidden weight system for balance. Expected value per box: ~70 coins (you lose ~30 on average, but can hit big wins).

| Category | Count | Items | Combined Hidden Weight | Coin Payout |
|---|---|---|---|---|
| Junk | 16 | "A broken pencil", "The box was empty!", "A used napkin", "A single grain of sand", "A mysterious rock", "A coupon for 10% off nothing", "A potato", "A paperclip", "A loose button", "A stale cracker", "A rubber band", "A dead battery", "A crumpled receipt", "A lone sock", "A dandelion", "A bottle cap" | 45% | 0–3 |
| Small coins | 10 | Various coin amounts | 25% | 5–15 |
| Profile items | 10 | Frames (Bronze/Silver/Gold/Diamond), Badges (Star/Heart/Skull/Fire), Titles ("Lucky", "Gambler") | 18% | Cosmetic |
| Good win | 7 | Larger coin amounts | 8% | 25–75 |
| Big win | 4 | "Diamond Frame", "Syntax Lord" title, 200 coins, "Rainbow" badge | 3% | 100–200 |
| Jackpot | 3 | "Syntax God" title + 100 coins, "Jackpot" badge + 150 coins, 500 coins | 1% | 250–500 |

### Equippable Items

Users can equip **one frame**, **one badge**, and **one title** from their inventory on their profile page. These show up on their profile card and on the leaderboard.

---

## Achievements

| Achievement | Description | Reward |
|---|---|---|
| First Steps | Complete your first daily check-in | 25 |
| Streak Starter | Reach a 3-day check-in streak | 50 |
| Week Warrior | Reach a 7-day check-in streak | 100 |
| Explorer | Visit 5 different game pages | 25 |
| Globetrotter | Visit 10 different game pages | 50 |
| Lucky Spinner | Spin the wheel for the first time | 25 |
| Trivia Novice | Answer your first trivia question | 25 |
| Trivia Master | Answer 5 trivia questions correctly | 50 |
| Box Opener | Open your first mystery box | 50 |
| High Roller | Open 10 mystery boxes | 100 |
| Shopaholic | Make your first purchase | 25 |
| Social Butterfly | Refer your first friend | 50 |
| Centurion | Earn a total of 100 coins | 25 |
| Millionaire | Earn a total of 500 coins | 100 |

---

## 3 Build Steps

### Step 1: Project Setup & Auth
- Initialize Node.js project with Express, EJS, SQLite, Passport.js
- Set up project folder structure (routes/, views/, public/, config/, db/, middleware/)
- Create database schema and seed data (shop items, achievements, mystery box items)
- Implement user auth: signup, login, logout, Google OAuth, session management
- Create base layout (header with coin balance + nav, footer)

### Step 2: Core Pages & Currency
- Build Home page with daily check-in, stats, and activity feed
- Build Games Portal page with configurable game cards
- Build Profile page with stats, inventory, and equip system
- Build Leaderboard page
- Implement all coin earning methods (check-in, visits, play button, streak, etc.)
- Implement coin transaction logging
- Build Daily Trivia page (fetches from Open Trivia DB API)
- Build Spin Wheel page with canvas spinner animation

### Step 3: Mystery Box, Shop & Polish
- Build Shop page with mystery box buy flow
- Create loot table modal (shows all 50+ items)
- Implement gift box opening animation (shake → glow → ribbon → lid → confetti)
- Create confetti particle system using HTML Canvas
- Build regular shop item purchases (frames, badges, titles)
- Implement referral system
- Add toast notifications for coin earnings
- Responsive CSS polish, final testing

---

## Game Cards Config

Games are defined in `config/games.json`. When you want to add a real game, just update this file:

```json
[
  {
    "id": "clicker",
    "name": "Clicker",
    "description": "Click as fast as you can in 10 seconds!",
    "thumbnail": "/images/game-covers/clicker.png",
    "url": "/games/clicker",
    "status": "coming-soon"
  },
  {
    "id": "memory",
    "name": "Memory Match",
    "description": "Flip cards and find matching pairs.",
    "thumbnail": "/images/game-covers/memory.png",
    "url": "/games/memory",
    "status": "coming-soon"
  }
]
```

Fields:
- `id` — unique identifier for the game
- `name` — display name
- `description` — short description shown on the card
- `thumbnail` — image path
- `url` — the route or external URL the game lives at
- `status` — `"coming-soon"` (shows a locked/grayed card) or `"active"` (clickable)

---

## Running the Project

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Google OAuth credentials (optional — local auth works without it)

# Seed the database
node db/seed.js

# Start the server
node server.js

# Visit http://localhost:3000
```

---

## Environment Variables

```
PORT=3000
SESSION_SECRET=your-secret-here
DATABASE_PATH=./data/syntax.db
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BASE_URL=http://localhost:3000
```

Google OAuth is optional. The site works with email/password auth without it.
