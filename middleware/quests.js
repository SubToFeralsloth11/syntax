const db = require('../db/database');

function getQuestDate(resetType) {
  const now = new Date();
  if (resetType === 'weekly') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    return monday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

function getUserQuests(userId) {
  const today = getQuestDate('daily');
  const weekStart = getQuestDate('weekly');

  const quests = db.prepare(`
    SELECT q.*, COALESCE(uq.progress, 0) as progress, COALESCE(uq.completed, 0) as completed,
           CASE WHEN q.reset_type = 'daily' THEN ? ELSE ? END as quest_date
    FROM quests q
    LEFT JOIN user_quests uq ON uq.quest_id = q.id AND uq.user_id = ? AND uq.quest_date = CASE WHEN q.reset_type = 'daily' THEN ? ELSE ? END
    ORDER BY q.reset_type, q.id
  `).all(today, weekStart, userId, today, weekStart);

  return quests;
}

function updateQuestProgress(userId, requirementType, increment = 1) {
  const today = getQuestDate('daily');
  const weekStart = getQuestDate('weekly');

  const quests = db.prepare(
    'SELECT * FROM quests WHERE requirement_type = ?'
  ).all(requirementType);

  const results = [];

  for (const quest of quests) {
    const questDate = quest.reset_type === 'weekly' ? weekStart : today;

    let userQuest = db.prepare(
      'SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ? AND quest_date = ?'
    ).get(userId, quest.id, questDate);

    if (!userQuest) {
      db.prepare(
        'INSERT INTO user_quests (user_id, quest_id, progress, quest_date) VALUES (?, ?, ?, ?)'
      ).run(userId, quest.id, Math.min(increment, quest.requirement_count), questDate);
      userQuest = { progress: Math.min(increment, quest.requirement_count), completed: 0 };
    } else if (!userQuest.completed) {
      const newProgress = Math.min(userQuest.progress + increment, quest.requirement_count);
      const completed = newProgress >= quest.requirement_count ? 1 : 0;
      db.prepare(
        'UPDATE user_quests SET progress = ?, completed = ? WHERE id = ?'
      ).run(newProgress, completed, userQuest.id);

      if (completed) {
        const { awardCoins } = require('./currency');
        const { awardXP } = require('./xp');
        if (quest.reward_coins > 0) awardCoins(userId, quest.reward_coins, 'quest');
        if (quest.reward_xp > 0) awardXP(userId, quest.reward_xp, 'quest');
        results.push({ name: quest.name, coins: quest.reward_coins, xp: quest.reward_xp });
      }
    }
  }

  return results;
}

module.exports = { getUserQuests, updateQuestProgress, getQuestDate };
