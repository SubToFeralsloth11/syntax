const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'game-covers');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateThumbnail(gameId, gameName) {
  console.log(`Generating thumbnail for "${gameName}"...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 500 });

    // Navigate to the game page
    const url = `${BASE_URL}/games/${gameId}`;
    console.log(`  Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
      console.log('  (page may require auth, trying raw game URL)');
    });

    // Wait a moment for content to render
    await new Promise(r => setTimeout(r, 2000));

    // Take screenshot
    const outputPath = path.join(OUTPUT_DIR, `${gameId}.png`);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`  Saved to ${outputPath}`);

    // Update games.json to use the new thumbnail
    const gamesPath = path.join(__dirname, '..', 'config', 'games.json');
    const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
    const game = games.find(g => g.id === gameId);
    if (game) {
      game.thumbnail = `/images/game-covers/${gameId}.png`;
      fs.writeFileSync(gamesPath, JSON.stringify(games, null, 2));
      console.log(`  Updated games.json thumbnail for "${gameName}"`);
    }

    return outputPath;
  } finally {
    await browser.close();
  }
}

// Main - generate thumbnails for active games without real thumbnails
async function main() {
  const gamesPath = path.join(__dirname, '..', 'config', 'games.json');
  const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Generate for specific game IDs
    for (const id of args) {
      const game = games.find(g => g.id === id);
      if (game) {
        await generateThumbnail(game.id, game.name);
      } else {
        console.log(`Game "${id}" not found in games.json`);
      }
    }
  } else {
    // Auto: generate for all active games that still use SVG thumbnails
    for (const game of games) {
      if (game.status === 'active' && game.thumbnail.endsWith('.svg')) {
        await generateThumbnail(game.id, game.name);
      }
    }
  }

  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
