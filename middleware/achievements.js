const db = require('../db/database');

function checkAchievement(userId, achievementName) {
  const ach = db.prepare('SELECT id, reward_coins FROM achievements WHERE name = ?').get(achievementName);
  if (!ach) return false;
  const hasIt = db.prepare('SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?').get(userId, ach.id);
  if (hasIt) return false;
  db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, ach.id);
  return ach.reward_coins;
}

module.exports = { checkAchievement };
