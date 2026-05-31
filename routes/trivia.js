const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins } = require('../middleware/currency');
const { checkAchievement } = require('../middleware/achievements');

const TRIVIA_CACHE = {};

async function fetchTrivia() {
  try {
    const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
    const data = await res.json();
    if (data.response_code === 0 && data.results.length > 0) {
      const q = data.results[0];
      const answers = [...q.incorrect_answers, q.correct_answer];
      for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
      }
      return {
        question: q.question,
        correctAnswer: q.correct_answer,
        answers,
        category: q.category,
        difficulty: q.difficulty
      };
    }
  } catch (e) {
    return null;
  }
}

router.get('/trivia', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const alreadyAnswered = db.prepare(
    "SELECT correct FROM trivia_answers WHERE user_id = ? AND question_date = ?"
  ).get(userId, today);

  if (alreadyAnswered) {
    return res.render('trivia', {
      answered: true,
      correct: alreadyAnswered.correct === 1,
      question: null
    });
  }

  let trivia = TRIVIA_CACHE[today];
  if (!trivia) {
    trivia = await fetchTrivia();
    if (trivia) TRIVIA_CACHE[today] = trivia;
  }

  res.render('trivia', {
    answered: false,
    correct: null,
    question: trivia
  });
});

router.post('/trivia/answer', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const { answer } = req.body;

  const alreadyAnswered = db.prepare(
    "SELECT id FROM trivia_answers WHERE user_id = ? AND question_date = ?"
  ).get(userId, today);

  if (alreadyAnswered) {
    return res.json({ success: false, message: 'Already answered today!' });
  }

  const trivia = TRIVIA_CACHE[today];
  if (!trivia) {
    return res.json({ success: false, message: 'No question loaded. Try refreshing.' });
  }

  const correct = answer === trivia.correctAnswer ? 1 : 0;
  db.prepare(
    "INSERT INTO trivia_answers (user_id, question_date, correct) VALUES (?, ?, ?)"
  ).run(userId, today, correct);

  if (correct) {
    awardCoins(userId, 15, 'trivia');

    const totalQuestions = db.prepare(
      "SELECT COUNT(*) as cnt FROM trivia_answers WHERE user_id = ?"
    ).get(userId);
    const correctAnswers = db.prepare(
      "SELECT COUNT(*) as cnt FROM trivia_answers WHERE user_id = ? AND correct = 1"
    ).get(userId);

    if (correctAnswers.cnt === 1) {
      const coins = checkAchievement(userId, 'Trivia Novice');
      if (coins) awardCoins(userId, coins, 'achievement');
    }
    if (correctAnswers.cnt >= 5) {
      const coins = checkAchievement(userId, 'Trivia Master');
      if (coins) awardCoins(userId, coins, 'achievement');
    }
  }

  res.json({ success: true, correct: !!correct, correctAnswer: trivia.correctAnswer });
});

module.exports = router;
