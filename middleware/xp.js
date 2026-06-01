const db = require('../db/database');

const LEVEL_XP = [
  0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000,
  5200, 6600, 8200, 10000, 12000, 14500, 17500, 21000, 25000, 30000
];

function getLevel(xp) {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return i + 1;
  }
  return 1;
}

function xpForNextLevel(level) {
  return LEVEL_XP[level] || LEVEL_XP[LEVEL_XP.length - 1];
}

function xpForCurrentLevel(level) {
  return LEVEL_XP[level - 1] || 0;
}

function awardXP(userId, amount, reason) {
  const user = db.prepare('SELECT xp, level, coins FROM users WHERE id = ?').get(userId);
  if (!user) return { leveled: false };

  const newXP = user.xp + amount;
  const newLevel = getLevel(newXP);

  db.prepare('UPDATE users SET xp = ?, level = ?, last_active = datetime("now") WHERE id = ?').run(newXP, newLevel, userId);

  if (newLevel > user.level) {
    const bonus = newLevel * 50;
    const { awardCoins } = require('./currency');
    awardCoins(userId, bonus, 'level_up');
    return { leveled: true, newLevel, bonus, oldLevel: user.level };
  }

  return { leveled: false, newXP, newLevel };
}

function getLevelProgress(userId) {
  const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(userId);
  if (!user) return { level: 1, xp: 0, nextXP: 100, progress: 0 };
  const current = xpForCurrentLevel(user.level);
  const next = xpForNextLevel(user.level);
  const progress = Math.floor(((user.xp - current) / (next - current)) * 100);
  return { level: user.level, xp: user.xp, nextXP: next, progress: Math.min(100, Math.max(0, progress)) };
}

module.exports = { awardXP, getLevelProgress, xpForNextLevel, getLevel };
