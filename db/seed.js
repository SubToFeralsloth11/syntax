const db = require('./database');
const achievements = require('../config/achievements.json');
const shopItems = [
  { name: 'Bronze Frame', type: 'frame', price: 50, description: 'A simple bronze frame for your profile' },
  { name: 'Silver Frame', type: 'frame', price: 150, description: 'A shiny silver frame for your profile' },
  { name: 'Gold Frame', type: 'frame', price: 300, description: 'A gleaming gold frame for your profile' },
  { name: 'Diamond Frame', type: 'frame', price: 500, description: 'A sparkling diamond frame for your profile' },
  { name: 'Star Badge', type: 'badge', price: 75, description: 'A star-shaped badge for your profile' },
  { name: 'Heart Badge', type: 'badge', price: 75, description: 'A heart-shaped badge for your profile' },
  { name: 'Skull Badge', type: 'badge', price: 100, description: 'A skull badge for your profile' },
  { name: 'Fire Badge', type: 'badge', price: 150, description: 'A fire badge for your profile' },
  { name: 'Rainbow Badge', type: 'badge', price: 400, description: 'A rainbow badge for your profile' },
  { name: 'Lucky title', type: 'title', price: 100, description: 'Display "Lucky" under your name' },
  { name: 'Gambler title', type: 'title', price: 150, description: 'Display "Gambler" under your name' },
  { name: 'Mystery Master title', type: 'title', price: 350, description: 'Display "Mystery Master" under your name' },
  { name: 'Syntax Lord title', type: 'title', price: 600, description: 'Display "Syntax Lord" under your name' },
  { name: 'Syntax God title', type: 'title', price: 1000, description: 'Display "Syntax God" under your name' }
];

const insertAchievement = db.prepare(
  'INSERT OR IGNORE INTO achievements (name, description, reward_coins, icon) VALUES (?, ?, ?, ?)'
);

const insertShopItem = db.prepare(
  'INSERT OR IGNORE INTO shop_items (name, type, price, description) VALUES (?, ?, ?, ?)'
);

const seed = db.transaction(() => {
  for (const ach of achievements) {
    insertAchievement.run(ach.name, ach.description, ach.reward_coins, ach.icon);
  }
  for (const item of shopItems) {
    insertShopItem.run(item.name, item.type, item.price, item.description);
  }
});

seed();

// Create default test account so there's always a login available
const bcrypt = require('bcryptjs');
const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@test.com');
if (!existingUser) {
  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(
    'INSERT INTO users (email, password_hash, display_name, coins) VALUES (?, ?, ?, ?)'
  ).run('admin@test.com', hash, 'Admin', 500);
}

console.log('Database seeded successfully!');
console.log(`Seeded ${achievements.length} achievements`);
console.log(`Seeded ${shopItems.length} shop items`);
