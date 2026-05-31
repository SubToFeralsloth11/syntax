const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { awardCoins, getBalance } = require('../middleware/currency');
const { checkAchievement } = require('../middleware/achievements');
const mysteryBoxItems = require('../config/mystery-box-items.json');

router.get('/shop', requireAuth, (req, res) => {
  const userId = req.user.id;

  const shopItems = db.prepare('SELECT * FROM shop_items ORDER BY price ASC').all();

  const purchases = db.prepare(
    'SELECT item_id FROM purchases WHERE user_id = ?'
  ).all(userId);
  const ownedIds = purchases.map(p => p.item_id);

  const userBoxTx = db.prepare(
    "SELECT COUNT(*) as cnt FROM coin_transactions WHERE user_id = ? AND reason = 'mystery_box_buy'"
  ).get(userId);
  const boxesBought = userBoxTx.cnt;

  const inventoryItems = db.prepare(
    "SELECT item_name, item_type FROM inventory_items WHERE user_id = ?"
  ).all(userId);
  const ownedNames = inventoryItems.map(i => i.item_name);

  res.render('shop', {
    shopItems,
    ownedIds,
    ownedNames,
    mysteryBoxItems,
    boxesBought
  });
});

router.post('/shop/mystery-box/buy', requireAuth, (req, res) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

  if (user.coins < 100) {
    return res.json({ success: false, message: 'Not enough coins! You need 100.' });
  }

  awardCoins(userId, -100, 'mystery_box_buy');

  const totalBought = db.prepare(
    "SELECT COUNT(*) as cnt FROM coin_transactions WHERE user_id = ? AND reason = 'mystery_box_buy'"
  ).get(userId).cnt;

  res.json({ success: true, balance: user.coins - 100, boxNumber: totalBought });
});

router.post('/shop/mystery-box/open', requireAuth, (req, res) => {
  const userId = req.user.id;

  const buys = db.prepare(
    "SELECT COUNT(*) as cnt FROM coin_transactions WHERE user_id = ? AND reason = 'mystery_box_buy'"
  ).get(userId).cnt;

  const opens = db.prepare(
    "SELECT COUNT(*) as cnt FROM coin_transactions WHERE user_id = ? AND reason = 'mystery_box_open'"
  ).get(userId).cnt;

  if (buys === 0) {
    return res.json({ success: false, message: 'Buy a mystery box first!' });
  }

  if (opens >= buys) {
    return res.json({ success: false, message: 'No unopened boxes!' });
  }

  const totalWeight = mysteryBoxItems.reduce((sum, item) => sum + item.weight, 0);
  let rand = Math.random() * totalWeight;

  let selected = mysteryBoxItems[0];
  for (const item of mysteryBoxItems) {
    rand -= item.weight;
    if (rand <= 0) {
      selected = item;
      break;
    }
  }

  const coinAmount = selected.min_coins + Math.floor(Math.random() * (selected.max_coins - selected.min_coins + 1));

  if (coinAmount > 0) {
    awardCoins(userId, coinAmount, 'mystery_box_reward');
  }

  awardCoins(userId, 0, 'mystery_box_open');

  if (selected.type !== 'junk' && selected.type !== 'coins') {
    db.prepare(
      'INSERT INTO inventory_items (user_id, item_name, item_type) VALUES (?, ?, ?)'
    ).run(userId, selected.name, selected.type);
  }

  const boxesOpened = db.prepare(
    "SELECT COUNT(*) as cnt FROM coin_transactions WHERE user_id = ? AND reason = 'mystery_box_open'"
  ).get(userId).cnt;

  if (boxesOpened === 1) {
    const coins = checkAchievement(userId, 'Box Opener');
    if (coins) awardCoins(userId, coins, 'achievement');
  }

  if (boxesOpened >= 10) {
    const coins = checkAchievement(userId, 'High Roller');
    if (coins) awardCoins(userId, coins, 'achievement');
  }

  res.json({
    success: true,
    item: selected.name,
    type: selected.type,
    coins: coinAmount,
    balance: getBalance(userId)
  });
});

router.post('/shop/mystery-box/items', requireAuth, (req, res) => {
  const items = mysteryBoxItems.map(i => ({ name: i.name, type: i.type }));
  res.json({ items });
});

router.post('/shop/buy/:itemId', requireAuth, (req, res) => {
  const userId = req.user.id;
  const itemId = parseInt(req.params.itemId);

  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
  if (!item) return res.json({ success: false, message: 'Item not found' });

  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (user.coins < item.price) {
    return res.json({ success: false, message: 'Not enough coins!' });
  }

  const alreadyOwned = db.prepare(
    'SELECT id FROM purchases WHERE user_id = ? AND item_id = ?'
  ).get(userId, itemId);
  if (alreadyOwned) {
    return res.json({ success: false, message: 'You already own this item!' });
  }

  awardCoins(userId, -item.price, 'purchase');
  db.prepare('INSERT INTO purchases (user_id, item_id) VALUES (?, ?)').run(userId, itemId);
  db.prepare('INSERT INTO inventory_items (user_id, item_name, item_type) VALUES (?, ?, ?)').run(userId, item.name, item.type);

  const totalPurchases = db.prepare(
    "SELECT COUNT(*) as cnt FROM coin_transactions WHERE user_id = ? AND reason = 'purchase'"
  ).get(userId).cnt;

  if (totalPurchases === 1) {
    const coins = checkAchievement(userId, 'Shopaholic');
    if (coins) awardCoins(userId, coins, 'achievement');
  }

  res.json({
    success: true,
    name: item.name,
    balance: getBalance(userId)
  });
});

module.exports = router;
