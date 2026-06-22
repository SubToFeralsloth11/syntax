const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'public', 'images', 'game-covers');

const GAMES = [
  { id: '2048', name: '2048', icon: 'grid', color: '#00f0ff', accent: '#b537f2' },
  { id: 'tetris', name: 'TETRIS', icon: 'box', color: '#00f0ff', accent: '#ff2bd6' },
  { id: 'flappy-bird', name: 'FLAPPY BIRD', icon: 'bird', color: '#44dd88', accent: '#00f0ff' },
  { id: 'snake', name: 'SNAKE', icon: 'bug', color: '#44dd88', accent: '#ffae00' },
  { id: 'minesweeper', name: 'MINESWEEPER', icon: 'bomb', color: '#ff4444', accent: '#ffae00' },
  { id: 'tic-tac-toe', name: 'TIC TAC TOE', icon: 'x', color: '#ff2bd6', accent: '#00f0ff' },
  { id: 'breakout', name: 'BREAKOUT', icon: 'brick-wall', color: '#ffae00', accent: '#ff2bd6' },
  { id: 'pong', name: 'PONG', icon: 'circle-dot', color: '#00f0ff', accent: '#44dd88' },
  { id: 'memory', name: 'MEMORY', icon: 'brain', color: '#b537f2', accent: '#00f0ff' },
  { id: 'chess', name: 'CHESS', icon: 'crown', color: '#ffae00', accent: '#b537f2' },
  { id: 'checkers', name: 'CHECKERS', icon: 'circle', color: '#ff4444', accent: '#ffae00' },
  { id: 'bubble-shooter', name: 'BUBBLE SHOOTER', icon: 'target', color: '#ff2bd6', accent: '#44dd88' },
  { id: 'solitaire', name: 'SOLITAIRE', icon: 'spade', color: '#44dd88', accent: '#ff4444' },
  { id: 'platformer', name: 'PLATFORMER', icon: 'mountain', color: '#ffae00', accent: '#00f0ff' },
  { id: 'endless-runner', name: 'ENDLESS RUNNER', icon: 'zap', color: '#00f0ff', accent: '#ff2bd6' },
  { id: 'wordle', name: 'WORDLE', icon: 'type', color: '#44dd88', accent: '#b537f2' },
  { id: 'hangman', name: 'HANGMAN', icon: 'user', color: '#ff4444', accent: '#b537f2' },
  { id: 'space-invaders', name: 'SPACE INVADERS', icon: 'rocket', color: '#00f0ff', accent: '#ff4444' },
  { id: 'whack-a-mole', name: 'WHACK-A-MOLE', icon: 'hammer', color: '#ffae00', accent: '#44dd88' },
  { id: 'simon', name: 'SIMON', icon: 'radio', color: '#ff2bd6', accent: '#00f0ff' },
  { id: 'reaction-time', name: 'REACTION TIME', icon: 'timer', color: '#ffae00', accent: '#ff2bd6' },
  { id: 'typing-speed', name: 'TYPING SPEED', icon: 'keyboard', color: '#00f0ff', accent: '#44dd88' },
  { id: 'color-match', name: 'COLOR MATCH', icon: 'palette', color: '#b537f2', accent: '#ff2bd6' },
  { id: 'cuber', name: 'CUBE 2', icon: 'box', color: '#00f0ff', accent: '#b537f2' },
  { id: 'arena-fps', name: 'ARENA JS', icon: 'crosshair', color: '#ff2bd6', accent: '#b537f2' },
  { id: 'openarena-web', name: 'OPENARENA', icon: 'swords', color: '#00f0ff', accent: '#ff2bd6' },
];

function makeSVG(g) {
  const fontSize = g.name.length > 14 ? 20 : g.name.length > 10 ? 24 : 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1e"/>
      <stop offset="50%" style="stop-color:#12062e"/>
      <stop offset="100%" style="stop-color:#0a0a1e"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${g.color}"/>
      <stop offset="100%" style="stop-color:${g.accent}"/>
    </linearGradient>
    <filter id="f">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="400" height="300" fill="url(#bg)"/>
  <rect x="1" y="1" width="398" height="298" rx="8" fill="none" stroke="url(#glow)" stroke-width="1.5" opacity="0.4"/>
  <circle cx="200" cy="115" r="45" fill="none" stroke="${g.color}" stroke-width="2" opacity="0.25"/>
  <circle cx="200" cy="115" r="60" fill="none" stroke="${g.accent}" stroke-width="1" opacity="0.12"/>
  <circle cx="200" cy="115" r="75" fill="none" stroke="${g.color}" stroke-width="0.5" opacity="0.08"/>
  <g filter="url(#f)">
    <text x="200" y="125" text-anchor="middle" font-family="'Orbitron',monospace,sans-serif" font-size="${fontSize}" font-weight="900" fill="${g.color}" letter-spacing="3">${g.name}</text>
  </g>
  <line x1="80" y1="170" x2="320" y2="170" stroke="url(#glow)" stroke-width="1" opacity="0.3"/>
  <text x="200" y="195" text-anchor="middle" font-family="'Inter',sans-serif" font-size="11" fill="${g.accent}" opacity="0.5" letter-spacing="6">PLAY NOW</text>
</svg>`;
}

let count = 0;
GAMES.forEach(g => {
  const svg = makeSVG(g);
  fs.writeFileSync(path.join(DIR, g.id + '.svg'), svg);
  count++;
  console.log('Created:', g.id + '.svg');
});

console.log(`\nDone — ${count} thumbnails generated`);
