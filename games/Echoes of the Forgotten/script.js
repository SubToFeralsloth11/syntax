const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 64;
const RECORD_MAX_FRAMES = 180;
const LINGER_MAX = 5;

const T = {
  EMPTY: 0, WALL: 1, PLATE: 2, DOOR: 3, EXIT: 4, SPIKE: 5, ANTI_ECHO: 6, KEY: 7, LOCKED_DOOR: 8,
};

const LEVELS = [
  {
    name: 'Awakening',
    desc: 'Walk to the golden exit',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWW',
      'W....................W',
      'W....................W',
      'W.........E..........W',
      'W....................W',
      'W....................W',
      'W....................W',
      'W....................W',
      'W.........P..........W',
      'WWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Gate',
    desc: 'Record echo on the plate to hold the door',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWW',
      'W....................W',
      'W........E...........W',
      'WWWWWWWWWWDWWWWWWWWWWW',
      'W....................W',
      'W.........O..........W',
      'W....................W',
      'W....................W',
      'W.........P..........W',
      'WWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Long Corridor',
    desc: 'The door is far from the plate — echo is mandatory',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWW',
      'W....................W',
      'W...........E........W',
      'WWWWDWWWWWWWWWWWWWWWWW',
      'W....................W',
      'W....O...............W',
      'W....................W',
      'W....................W',
      'W....P...............W',
      'WWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Crate',
    desc: 'Push the crate onto the pressure plate',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWW',
      'W....................W',
      'W.........E..........W',
      'WWWWWWWWWWWDWWWWWWWWWW',
      'W....................W',
      'W..........O.........W',
      'W..........B.........W',
      'W....................W',
      'W..........P.........W',
      'WWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Two Keys',
    desc: 'Crate on one plate, echo on the other',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWW',
      'W....................W',
      'W.........E..........W',
      'WWWWWDWWWWWWWWWDWWWWWW',
      'W....................W',
      'W....O....B....O.....W',
      'W....................W',
      'W....................W',
      'W.........P..........W',
      'WWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Lock and Key',
    desc: 'A locked gate bars the way — find the key to open it',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWW',
      'W....................W',
      'W.........E..........W',
      'WWWWWDWWWWWWWWWDWWWWWW',
      'W....................W',
      'W....O....B....O.....W',
      'W....................W',
      'WWWWWWWWWWLWWWWWWWWWWW',
      'W.........K..........W',
      'W....................W',
      'W....................W',
      'W.........P..........W',
      'WWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Two Locks',
    desc: 'Two locked gates — find both keys before you can pass',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWW',
      'W......................W',
      'W..........E...........W',
      'WWWWDWWWWWWWWWWWWWDWWWWW',
      'W......................W',
      'W...O......B......O....W',
      'W......................W',
      'WWWWLWWWWWWWWWWWWWLWWWWW',
      'W...K.............K....W',
      'W......................W',
      'W......................W',
      'W..........P...........W',
      'WWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Key Chase',
    desc: 'The key is beyond the locked gate — find another way through',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWW',
      'W......................W',
      'W..........E...........W',
      'WWWWDWWWWWWWWWWWWWDWWWWW',
      'W......................W',
      'W...O.............O....W',
      'W......................W',
      'W..........K......B....W',
      'W......................W',
      'WWWWWWWWWWWLWWWWWWWWWWWW',
      'W......................W',
      'W..........B...........W',
      'W......................W',
      'W......................W',
      'W..........P...........W',
      'WWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Two Box Shuffle',
    desc: 'Two crates, two plates, one locked gate — plan every push',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W........................W',
      'W...........E............W',
      'WWWWWDWWWWWWWWWWWWWWDWWWWW',
      'W........................W',
      'W....O......B.......O....W',
      'W........................W',
      'W....B..............K....W',
      'W........................W',
      'WWWWWWWWWWWWLWWWWWWWWWWWWW',
      'W........................W',
      'W........................W',
      'W........................W',
      'W...........P............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Vault',
    desc: 'Two locked gates, keys scattered — use every tool',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W........................W',
      'W...........E............W',
      'WWWWWDWWWWWWWWWWWWWWDWWWWW',
      'W........................W',
      'W....O......B.......O....W',
      'W........................W',
      'WWWWWWWWWWWWLWWWWWWWWWWWWW',
      'W....K..............K....W',
      'W........................W',
      'WWWWWWWWWWWWWWWWWWWWLWWWWW',
      'W........................W',
      'W........................W',
      'W........................W',
      'W...........P............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Maze',
    desc: 'A twisting labyrinth — find the key before you can advance',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W........................W',
      'W...........E............W',
      'WWWWWDWWWWWWWWWWWWWWDWWWWW',
      'W........................W',
      'W....W..O...W...W...O....W',
      'W....W..W...B...W...W....W',
      'WWWWWWWWWWWWLWWWWWWWWWWWWW',
      'W....W......O.......K....W',
      'W........................W',
      'W........................W',
      'W........................W',
      'W...........P............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Dead Echo',
    desc: 'Anti-echo zones surround the plates — push crates instead',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W........................W',
      'W...........E............W',
      'WWWWWDWWWWWWWWWWWWWWDWWWWW',
      'W........................W',
      'W....A......B.......A....W',
      'W....O..............O....W',
      'W........................W',
      'WWWWWWWWWWWWLWWWWWWWWWWWWW',
      'W...........K............W',
      'W........................W',
      'W........................W',
      'W...........P............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Gauntlet',
    desc: 'Spikes line the path — find the safe route and the key',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W........................W',
      'W...........E............W',
      'WWWWWDWWWWWWWWWWWWWWDWWWWW',
      'W........................W',
      'W....O......B.......O....W',
      'W....S..S...S...S...S....W',
      'WWWWWWWWWWWWLWWWWWWWWWWWWW',
      'W....O......K.......B....W',
      'W........................W',
      'W........................W',
      'W...........P............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Overgrowth',
    desc: 'Anti-echo fields and walls choke the path forward',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W..........................W',
      'W............E.............W',
      'WWWWWDWWWWWWWWWWWWWWWWDWWWWW',
      'W..........................W',
      'W....W..O....W....W...O....W',
      'W....A..W....W....A...W....W',
      'W....W.......B........W....W',
      'WWWWWWWWWWWWWLWWWWWWWWWWWWWW',
      'W....K.......O........A....W',
      'W..........................W',
      'W..........................W',
      'W............P.............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Fortress',
    desc: 'Three plates, two crates, one locked gate',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W..........................W',
      'W............E.............W',
      'WWWWWDWWWWWWWDWWWWWWWWDWWWWW',
      'W..........................W',
      'W....O.......B........O....W',
      'W..........................W',
      'WWWWWWWWWWWWWLWWWWWWWWWWWWWW',
      'W............O........B....W',
      'W..........................W',
      'W....K.....................W',
      'W..........................W',
      'W............P.............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Depths',
    desc: 'Chamber after chamber, gate after gate — push deeper',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W..........................W',
      'W............E.............W',
      'WWWWWDWWWWWWWDWWWWWWWWDWWWWW',
      'W..........................W',
      'W....O.......B........O....W',
      'W..........................W',
      'WWWWWWWWWWWWWLWWWWWWWWWWWWWW',
      'W....O................K....W',
      'W..........................W',
      'WWWWWLWWWWWWWWWWWWWWWWWWWWWW',
      'W............K........O....W',
      'W..........................W',
      'W..........................W',
      'W............P.............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Sieve',
    desc: 'So many plates — only two matter. Find the truth.',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W..........................W',
      'W............E.............W',
      'WWWWWDWWWWWWWWWWWWWWWWDWWWWW',
      'W..........................W',
      'W....O..O....B...O....O....W',
      'W..........................W',
      'WWWWWWWWWWWWWLWWWWWWWWWWWWWW',
      'W............K.............W',
      'W..........................W',
      'W..........................W',
      'W............P.............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'Grand Vault',
    desc: 'Anti-echo, spikes, locks, crates — the temple's final test',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W..........................W',
      'W............E.............W',
      'WWWWWDWWWWWWWDWWWWWWWWDWWWWW',
      'W..........................W',
      'W....O.......B........A....W',
      'W....S.......W........A....W',
      'W............W........O....W',
      'WWWWWWWWWWWWWLWWWWWWWWWWWWWW',
      'W....K.......A........O....W',
      'W..........................W',
      'W....O.....................W',
      'W..........................W',
      'W............P.............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Labyrinth',
    desc: 'Walls upon walls. Find the key. Open the gate. Escape.',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W..........................W',
      'W............E.............W',
      'WWWWWDWWWWWWWWWWWWWWWWDWWWWW',
      'W..........................W',
      'W....W..W.O...W..W..W.O....W',
      'W....W..W...W.W..W..W.W....W',
      'W....O....B...W..W....K....W',
      'WWWWWWWWWWWWWLWWWWWWWWWWWWWW',
      'W....K..W...O....W..W......W',
      'W..........................W',
      'WWWWWLWWWWWWWWWWWWWWWWWWWWWW',
      'W.......B....K...W..O......W',
      'W..........................W',
      'W..........................W',
      'W..........................W',
      'W............P.............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
  {
    name: 'The Final Echo',
    desc: 'Every lesson, every death, led to this. One last echo.',
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'W..........................W',
      'W............E.............W',
      'WWWWWDWWWWWWWWWWWWWWWWDWWWWW',
      'W..........................W',
      'W....W..W.O..B...W..W.O....W',
      'W....S..W....W...A.........W',
      'W............W........O....W',
      'WWWWWWWWWWWWWLWWWWWWWWWWWWWW',
      'W..........................W',
      'W....O.......S......O......W',
      'W..........................W',
      'W.......K..................W',
      'W..........................W',
      'W............A........O....W',
      'W....O.......K........W....W',
      'W..........................W',
      'W..........................W',
      'W............P.............W',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
  },
];  

const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
  a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
  W: { x: 0, y: -1 }, S: { x: 0, y: 1 },
  A: { x: -1, y: 0 }, D: { x: 1, y: 0 },
};

let state = {};

function parseLevel(levelIndex) {
  const data = LEVELS[levelIndex];
  const rows = data.map.length;
  const cols = data.map[0].length;
  const tiles = [];
  let playerStart = null, exitPos = null;
  const plateList = [], doorList = [], boxList = [];

  for (let y = 0; y < rows; y++) {
    tiles[y] = [];
    for (let x = 0; x < cols; x++) {
      const ch = data.map[y][x];
      if (ch === 'W') tiles[y][x] = T.WALL;
      else if (ch === '.' || ch === 'P' || ch === 'E') {
        tiles[y][x] = T.EMPTY;
        if (ch === 'P') playerStart = { x, y };
        if (ch === 'E') exitPos = { x, y };
      } else if (ch === 'O') { tiles[y][x] = T.PLATE; plateList.push({ x, y, pressed: false }); }
      else if (ch === 'D') { tiles[y][x] = T.DOOR; doorList.push({ x, y, open: false, linger: 0 }); }
      else if (ch === 'B') { tiles[y][x] = T.EMPTY; boxList.push({ x, y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2 }); }
      else if (ch === 'S') { tiles[y][x] = T.SPIKE; }
      else if (ch === 'A') { tiles[y][x] = T.ANTI_ECHO; }
      else if (ch === 'K') { tiles[y][x] = T.KEY; }
      else if (ch === 'L') { tiles[y][x] = T.LOCKED_DOOR; }
    }
  }

  const plates = {};
  plateList.forEach((p, i) => { plates[i] = p; });
  const doors = {};
  doorList.forEach((d, i) => {
    doors[i] = { ...d, plateId: i < plateList.length ? i : -1 };
  });

  canvas.width = cols * TILE;
  canvas.height = rows * TILE;

  return { tiles, cols, rows, playerStart, exitPos, plates, doors, boxes: boxList, name: data.name, desc: data.desc };
}

function resetGame() {
  const levelData = parseLevel(state.currentLevel);
  state.tiles = levelData.tiles;
  state.cols = levelData.cols;
  state.rows = levelData.rows;
  state.player = {
    x: levelData.playerStart.x, y: levelData.playerStart.y,
    px: levelData.playerStart.x * TILE + TILE / 2,
    py: levelData.playerStart.y * TILE + TILE / 2,
    moving: false, targetX: levelData.playerStart.x, targetY: levelData.playerStart.y,
    moveProgress: 0,
  };
  state.exitPos = levelData.exitPos;
  state.plates = levelData.plates;
  state.doors = levelData.doors;
  state.boxes = levelData.boxes;
  state.recording = null;
  state.echo = null;
  state.done = false;
  state.dead = false;
  state.keys = 0;
  state.inputQueue = [];
  state.frame = 0;

  document.getElementById('level-name').textContent = `L${state.currentLevel + 1}: ${levelData.name}`;
  document.getElementById('level-desc').textContent = levelData.desc;
  hideOverlay('victory-overlay');
  hideOverlay('death-overlay');
  document.getElementById('recording-bar-container').classList.remove('active');
  document.getElementById('recording-bar-fill').style.width = '0%';
  document.getElementById('message').classList.remove('visible');
  document.getElementById('key-counter').textContent = '';

  setTimeout(() => {
    if (state.currentLevel === 0) showMessage('Use Arrow Keys or WASD to move');
    else if (state.currentLevel === 1) showMessage('The door closes fast! Record an echo to hold it open.');
    else if (state.currentLevel === 5) showMessage('Walk into the crate to push it');
  }, 200);
}

function showMessage(text) {
  const el = document.getElementById('message');
  el.innerHTML = text.replace(/\n/g, '<br>');
  el.classList.add('visible');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('visible'), 3500);
}

function hideOverlay(id) { document.getElementById(id).classList.add('hidden'); }
function showOverlay(id) { document.getElementById(id).classList.remove('hidden'); }

function isSolid(x, y) {
  if (x < 0 || x >= state.cols || y < 0 || y >= state.rows) return true;
  const t = state.tiles[y][x];
  if (t === T.WALL) return true;
  if (t === T.LOCKED_DOOR) return true;
  if (t === T.DOOR) {
    const door = Object.values(state.doors).find(d => d.x === x && d.y === y);
    if (door && !door.open) return true;
  }
  return false;
}

function isSpike(x, y) {
  return state.tiles[y] && state.tiles[y][x] === T.SPIKE;
}

function canPushBox(box, dx, dy) {
  const nx = box.x + dx;
  const ny = box.y + dy;
  if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) return false;
  if (isSolid(nx, ny)) return false;
  if (getBox(nx, ny)) return false;
  return true;
}

function tryMove(dx, dy) {
  if (state.done || state.dead) return;
  const p = state.player;
  if (p.moving) return;

  const nx = p.x + dx;
  const ny = p.y + dy;

  if (state.tiles[ny] && state.tiles[ny][nx] === T.KEY) {
    state.keys++;
    state.tiles[ny][nx] = T.EMPTY;
    showMessage('Key collected!');
  }

  const box = getBox(nx, ny);
  if (box) {
    if (!canPushBox(box, dx, dy)) return;
    box.x += dx;
    box.y += dy;
    box.px = box.x * TILE + TILE / 2;
    box.py = box.y * TILE + TILE / 2;
  } else {
    if (isSolid(nx, ny)) {
      if (state.tiles[ny] && state.tiles[ny][nx] === T.LOCKED_DOOR) {
        if (state.keys > 0) {
          state.keys--;
          state.tiles[ny][nx] = T.EMPTY;
          showMessage('Lock opened!');
        } else {
          showMessage('The door is locked — find a key');
          return;
        }
      } else {
        return;
      }
    }
  }

  if (isSpike(nx, ny)) {
    if (!box) { die(); return; }
  }

  p.moving = true;
  p.targetX = nx;
  p.targetY = ny;
  p.moveProgress = 0;
  p.startX = p.x;
  p.startY = p.y;
}

function updatePlayer() {
  const p = state.player;
  if (p.moving) {
    p.moveProgress += 0.08;
    if (p.moveProgress >= 1) {
      p.moveProgress = 1;
      p.x = p.targetX;
      p.y = p.targetY;
      if (isSpike(p.x, p.y)) { die(); return; }
      if (state.exitPos && p.x === state.exitPos.x && p.y === state.exitPos.y) { completeLevel(); return; }
      p.moving = false;
      while (state.inputQueue.length > 0) {
        const dir = state.inputQueue.shift();
        tryMove(dir.x, dir.y);
        if (p.moving) break;
      }
    }
    const t = easeInOutQuad(p.moveProgress);
    p.px = (p.startX + (p.targetX - p.startX) * t) * TILE + TILE / 2;
    p.py = (p.startY + (p.targetY - p.startY) * t) * TILE + TILE / 2;
  } else {
    p.px = p.x * TILE + TILE / 2;
    p.py = p.y * TILE + TILE / 2;
  }
}

function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function die() { state.dead = true; showOverlay('death-overlay'); }

function completeLevel() {
  state.done = true;
  if (state.currentLevel === LEVELS.length - 1) {
    document.getElementById('victory-stats').textContent = 'You escaped the echoes.\nThe forgotten temple remembers you no more.';
    document.getElementById('next-btn').textContent = 'Play Again';
  } else {
    document.getElementById('victory-stats').textContent = `Level ${state.currentLevel + 1} — ${LEVELS[state.currentLevel].name}`;
    document.getElementById('next-btn').textContent = 'Next Level \u2192';
  }
  showOverlay('victory-overlay');
}

function startRecording() {
  if (state.tiles[state.player.y][state.player.x] === T.ANTI_ECHO) {
    showMessage('Cannot record here — anti-echo field blocks resonance');
    return;
  }
  state.recording = { active: true, frames: [], startX: state.player.x, startY: state.player.y };
  document.getElementById('recording-bar-container').classList.add('active');
}

function stopRecording() {
  if (!state.recording || !state.recording.active) return;
  state.recording.active = false;
  document.getElementById('recording-bar-container').classList.remove('active');
  const frames = state.recording.frames;
  if (frames.length < 2) return;
  state.echo = { frames, timer: 0, px: frames[0].px, py: frames[0].py, active: true, loopCount: 0 };
  state.recording = null;
}

function updateRecording() {
  if (!state.recording || !state.recording.active) return;
  if (state.tiles[state.player.y][state.player.x] === T.ANTI_ECHO) {
    showMessage('Recording disrupted by anti-echo field');
    state.recording = null;
    document.getElementById('recording-bar-container').classList.remove('active');
    document.getElementById('recording-bar-fill').style.width = '0%';
    return;
  }
  state.recording.frames.push({ px: state.player.px, py: state.player.py });
  if (state.recording.frames.length >= RECORD_MAX_FRAMES) { stopRecording(); return; }
  document.getElementById('recording-bar-fill').style.width = (state.recording.frames.length / RECORD_MAX_FRAMES * 100) + '%';
}

function updateEcho() {
  if (!state.echo || !state.echo.active) return;
  const e = state.echo, frames = e.frames;
  if (!frames || frames.length < 2) return;
  e.timer++;
  if (e.timer >= frames.length) { e.timer = 0; e.loopCount++; }
  e.px = frames[e.timer].px;
  e.py = frames[e.timer].py;
}

function updateDoorsAndPlates() {
  for (const id in state.plates) {
    const plate = state.plates[id];
    const playerOn = state.player.x === plate.x && state.player.y === plate.y;
    let echoOn = false;
    if (state.echo && state.echo.active && state.echo.frames.length > 0) {
      const idx = Math.min(state.echo.timer, state.echo.frames.length - 1);
      const ex = Math.round((state.echo.frames[idx].px - TILE / 2) / TILE);
      const ey = Math.round((state.echo.frames[idx].py - TILE / 2) / TILE);
      if (ex === plate.x && ey === plate.y) echoOn = true;
    }
    let boxOn = false;
    for (const box of state.boxes) { if (box.x === plate.x && box.y === plate.y) { boxOn = true; break; } }
    plate.pressed = playerOn || echoOn || boxOn;
  }
  for (const id in state.doors) {
    const door = state.doors[id];
    const linkedPlate = state.plates[door.plateId];
    if (linkedPlate && linkedPlate.pressed) { door.open = true; door.linger = LINGER_MAX; }
    else if (door.linger > 0) { door.linger--; }
    else { door.open = false; }
  }
}

function draw() {
  state.frame++;
  if ((state.keys || 0) > 0) {
    document.getElementById('key-counter').textContent = 'Keys: ' + state.keys;
  } else {
    document.getElementById('key-counter').textContent = '';
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#090914';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const t = state.tiles[y][x];
      const rx = x * TILE, ry = y * TILE;

      if (t === T.EMPTY) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#12122a' : '#161630';
        ctx.fillRect(rx, ry, TILE, TILE);
      } else if (t === T.WALL) {
        ctx.fillStyle = '#1e1e3a';
        ctx.fillRect(rx, ry, TILE, TILE);
        ctx.fillStyle = '#2e2e50';
        ctx.fillRect(rx + 2, ry + 2, TILE - 4, 3);
        ctx.fillRect(rx + 2, ry + 2, 3, TILE - 4);
        ctx.fillStyle = '#0e0e20';
        ctx.fillRect(rx + TILE - 3, ry, 3, TILE);
        ctx.fillRect(rx, ry + TILE - 3, TILE, 3);
        ctx.strokeStyle = '#2a2a48';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx + 0.5, ry + 0.5, TILE - 1, TILE - 1);
      } else if (t === T.PLATE) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#12122a' : '#161630';
        ctx.fillRect(rx, ry, TILE, TILE);
        const plate = Object.values(state.plates).find(p => p.x === x && p.y === y);
        const pressed = plate && plate.pressed;
        ctx.fillStyle = pressed ? '#664422' : '#443322';
        ctx.beginPath();
        ctx.arc(rx + TILE / 2, ry + TILE / 2, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pressed ? '#886633' : '#332211';
        ctx.beginPath();
        ctx.arc(rx + TILE / 2, ry + TILE / 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pressed ? '#cc8844' : '#554433';
        ctx.beginPath();
        ctx.arc(rx + TILE / 2, ry + TILE / 2, pressed ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        if (pressed) {
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 25;
          ctx.fillStyle = '#ffaa44';
          ctx.beginPath();
          ctx.arc(rx + TILE / 2, ry + TILE / 2, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (t === T.DOOR) {
        const door = Object.values(state.doors).find(d => d.x === x && d.y === y);
        if (door && door.open) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#12122a' : '#161630';
          ctx.fillRect(rx, ry, TILE, TILE);
          ctx.fillStyle = '#1a2a1a';
          ctx.fillRect(rx + 2, ry + 2, TILE - 4, TILE - 4);
          ctx.shadowColor = '#44ff66';
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#22cc44';
          ctx.beginPath();
          ctx.arc(rx + TILE / 2, ry + TILE / 2, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#44ff66';
          ctx.font = '20px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('\u25B2', rx + TILE / 2, ry + TILE / 2);
        } else {
          ctx.fillStyle = '#1a0a18';
          ctx.fillRect(rx, ry, TILE, TILE);
          ctx.fillStyle = '#3a1530';
          ctx.fillRect(rx + 2, ry + 2, TILE - 4, 3);
          ctx.fillRect(rx + 2, ry + 2, 3, TILE - 4);
          ctx.fillStyle = '#0a0508';
          ctx.fillRect(rx + TILE - 3, ry, 3, TILE);
          ctx.fillRect(rx, ry + TILE - 3, TILE, 3);
          ctx.fillStyle = '#cc3355';
          ctx.fillRect(rx + TILE / 2 - 7, ry + TILE / 2 - 9, 14, 18);
          ctx.fillStyle = '#881133';
          ctx.fillRect(rx + TILE / 2 - 4, ry + TILE / 2 - 6, 8, 12);
          ctx.fillStyle = '#ff4466';
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('X', rx + TILE / 2, ry + TILE / 2 + 1);
          ctx.fillStyle = '#cc224488';
          ctx.shadowColor = '#ff2244';
          ctx.shadowBlur = 10;
          ctx.fillRect(rx + TILE / 2 - 6, ry + TILE / 2 - 8, 12, 16);
          ctx.shadowBlur = 0;
        }
      } else if (t === T.SPIKE) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(rx, ry, TILE, TILE);
        const glint = Math.sin(state.frame / 10 + x + y) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(204, 34, 68, ${glint})`;
        for (let s = 0; s < 3; s++) {
          const sx = rx + 10 + s * 20;
          ctx.beginPath();
          ctx.moveTo(sx, ry + TILE - 6);
          ctx.lineTo(sx + 10, ry + 4);
          ctx.lineTo(sx + 20, ry + TILE - 6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = `rgba(255, 68, 102, ${glint * 0.8})`;
        for (let s = 0; s < 3; s++) {
          const sx = rx + 12 + s * 20;
          ctx.beginPath();
          ctx.moveTo(sx, ry + TILE - 8);
          ctx.lineTo(sx + 8, ry + 6);
          ctx.lineTo(sx + 16, ry + TILE - 8);
          ctx.closePath();
          ctx.fill();
        }
      } else if (t === T.ANTI_ECHO) {
        ctx.fillStyle = '#0a0a18';
        ctx.fillRect(rx, ry, TILE, TILE);
        const wave = Math.sin(state.frame / 15 + x + y) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(80, 20, 80, ${0.3 + wave * 0.2})`;
        ctx.fillRect(rx, ry, TILE, TILE);
        ctx.strokeStyle = `rgba(200, 60, 200, ${0.4 + wave * 0.3})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const ringR = 10 + i * 8 + Math.sin(state.frame / 20 + i) * 3;
          ctx.beginPath();
          ctx.arc(rx + TILE / 2, ry + TILE / 2, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#aa44cc';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NO', rx + TILE / 2, ry + TILE / 2);
        ctx.fillText('ECHO', rx + TILE / 2, ry + TILE / 2 + 14);
      } else if (t === T.KEY) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#12122a' : '#161630';
        ctx.fillRect(rx, ry, TILE, TILE);
        const glow = Math.sin(state.frame / 12) * 0.3 + 0.7;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20 * glow;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(rx + TILE / 2, ry + TILE / 2 - 2, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b8960c';
        ctx.fillRect(rx + TILE / 2 - 4, ry + TILE / 2, 8, 14);
        ctx.fillRect(rx + TILE / 2 - 12, ry + TILE / 2 + 8, 24, 4);
        ctx.fillStyle = '#ffed4a';
        ctx.beginPath();
        ctx.arc(rx + TILE / 2, ry + TILE / 2 - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffd70066';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('KEY', rx + TILE / 2, ry + TILE - 2);
      } else if (t === T.LOCKED_DOOR) {
        ctx.fillStyle = '#1a0a18';
        ctx.fillRect(rx, ry, TILE, TILE);
        ctx.fillStyle = '#2a1a28';
        ctx.fillRect(rx + 2, ry + 2, TILE - 4, 3);
        ctx.fillRect(rx + 2, ry + 2, 3, TILE - 4);
        ctx.fillStyle = '#0a0508';
        ctx.fillRect(rx + TILE - 3, ry, 3, TILE);
        ctx.fillRect(rx, ry + TILE - 3, TILE, 3);
        const lglow = Math.sin(state.frame / 15 + x + y) * 0.4 + 0.6;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10 * lglow;
        ctx.fillStyle = '#cc8822';
        ctx.fillRect(rx + TILE / 2 - 8, ry + TILE / 2 - 10, 16, 20);
        ctx.fillStyle = '#885511';
        ctx.fillRect(rx + TILE / 2 - 5, ry + TILE / 2 - 7, 10, 14);
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath();
        ctx.arc(rx + TILE / 2 + 4, ry + TILE / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffcc4488';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('LOCK', rx + TILE / 2, ry + TILE - 2);
      }
    }
  }

  for (const id in state.plates) {
    const plate = state.plates[id];
    if (plate.pressed) {
      const rx = plate.x * TILE, ry = plate.y * TILE;
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#ff880044';
      ctx.beginPath();
      ctx.arc(rx + TILE / 2, ry + TILE / 2, TILE * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  if (state.exitPos) {
    const ex = state.exitPos.x * TILE + TILE / 2;
    const ey = state.exitPos.y * TILE + TILE / 2;
    const pulse = Math.sin(state.frame / 20) * 0.3 + 0.7;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 35 * pulse;
    ctx.fillStyle = `rgba(255, 215, 0, ${0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(ex, ey, TILE * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 215, 0, ${0.05 * pulse})`;
    ctx.beginPath();
    ctx.arc(ex, ey, TILE * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20 * pulse;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(ex, ey, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffed4a';
    ctx.beginPath();
    ctx.arc(ex - 2, ey - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd70088';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('EXIT', ex, ey + 10);
  }

  for (const box of state.boxes) drawBox(box);
  if (state.echo && state.echo.active) drawEcho(state.echo);
  drawPlayer();

  if (state.recording && state.recording.active) {
    const pulse = Math.sin(state.frame / 4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, 50, 50, ${0.06 + pulse * 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('\u25CF RECORDING', canvas.width / 2, 8);
    ctx.fillStyle = '#ff444466';
    ctx.beginPath();
    ctx.arc(state.player.px, state.player.py, 22 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = state.player, px = p.px, py = p.py;
  ctx.shadowColor = '#00ccff';
  ctx.shadowBlur = 25;
  const pScale = state.recording && state.recording.active ? 1 + Math.sin(state.frame / 4) * 0.08 : 1;
  ctx.fillStyle = '#006688';
  ctx.beginPath(); ctx.arc(px, py, 16 * pScale, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#00bbff';
  ctx.beginPath(); ctx.arc(px - 1, py - 1, 12 * pScale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#44ddff';
  ctx.beginPath(); ctx.arc(px - 3, py - 3, 7 * pScale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath(); ctx.arc(px - 5, py - 6, 3 * pScale, 0, Math.PI * 2); ctx.fill();
}

function drawEcho(echo) {
  const px = echo.px, py = echo.py;
  if (px === undefined || py === undefined) return;
  ctx.save();
  ctx.globalAlpha = 0.55;
  const drift = Math.sin(state.frame / 30 + echo.loopCount) * 2;
  const ex = px + drift, ey = py + drift;
  ctx.shadowColor = '#7733ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#5522aa';
  ctx.beginPath(); ctx.arc(ex, ey, 15, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#8844ff';
  ctx.beginPath(); ctx.arc(ex - 1, ey - 1, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#aa66ff';
  ctx.beginPath(); ctx.arc(ex - 3, ey - 3, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath(); ctx.arc(ex - 5, ey - 6, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(180, 130, 255, 0.7)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('echo', ex, ey - 18);
  ctx.restore();
  if (echo.loopCount > 0) {
    ctx.fillStyle = '#8888aa66';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`loop ${echo.loopCount}`, canvas.width / 2, canvas.height - 6);
  }
}

function drawBox(box) {
  const rx = box.x * TILE, ry = box.y * TILE;
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(rx + 4, ry + 4, TILE - 8, TILE - 8);
  ctx.strokeStyle = '#6B4914';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + 4, ry + 4, TILE - 8, TILE - 8);
  ctx.strokeStyle = '#5a3a0a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx + 6, ry + 6); ctx.lineTo(rx + TILE - 6, ry + TILE - 6);
  ctx.moveTo(rx + TILE - 6, ry + 6); ctx.lineTo(rx + 6, ry + TILE - 6);
  ctx.stroke();
  ctx.fillStyle = '#a08030';
  ctx.fillRect(rx + 6, ry + 8, TILE - 12, 3);
  ctx.fillStyle = '#7a5910';
  ctx.fillRect(rx + 6, ry + TILE - 12, TILE - 12, 3);
  ctx.strokeStyle = '#4a3a0a';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 10, ry + 16, TILE - 20, TILE - 32);
  ctx.strokeStyle = '#9a7920';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 8, ry + 14, TILE - 16, TILE - 28);
}

function drawMinimap() {
  const mmSize = 7;
  const mmX = canvas.width - state.cols * mmSize - 8;
  const mmY = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(mmX - 3, mmY - 3, state.cols * mmSize + 6, state.rows * mmSize + 6);
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const t = state.tiles[y][x];
      const rx = mmX + x * mmSize, ry = mmY + y * mmSize;
      if (t === T.WALL) { ctx.fillStyle = '#2e2e50'; ctx.fillRect(rx, ry, mmSize, mmSize); }
      else if (t === T.EMPTY || t === T.PLATE) { ctx.fillStyle = '#12122a'; ctx.fillRect(rx, ry, mmSize, mmSize); }
      else if (t === T.DOOR) { const d = Object.values(state.doors).find(d => d.x === x && d.y === y); ctx.fillStyle = d && d.open ? '#22cc4488' : '#cc335588'; ctx.fillRect(rx, ry, mmSize, mmSize); }
      else if (t === T.ANTI_ECHO) { ctx.fillStyle = '#66228888'; ctx.fillRect(rx, ry, mmSize, mmSize); }
      else if (t === T.KEY) { ctx.fillStyle = '#ffd700'; ctx.fillRect(rx, ry, mmSize, mmSize); }
      else if (t === T.LOCKED_DOOR) { ctx.fillStyle = '#cc882288'; ctx.fillRect(rx, ry, mmSize, mmSize); }
      else if (t === T.SPIKE) { ctx.fillStyle = '#ff224466'; ctx.fillRect(rx, ry, mmSize, mmSize); }
    }
  }
  for (const box of state.boxes) { ctx.fillStyle = '#b8860b'; ctx.fillRect(mmX + box.x * mmSize, mmY + box.y * mmSize, mmSize, mmSize); }
  if (state.exitPos) { ctx.fillStyle = '#ffd700'; ctx.fillRect(mmX + state.exitPos.x * mmSize, mmY + state.exitPos.y * mmSize, mmSize, mmSize); }
  ctx.fillStyle = '#00bbff';
  ctx.fillRect(mmX + state.player.x * mmSize, mmY + state.player.y * mmSize, mmSize, mmSize);
  if (state.echo && state.echo.active && state.echo.frames.length > 0) {
    const idx = Math.min(state.echo.timer, state.echo.frames.length - 1);
    const ex = Math.round((state.echo.frames[idx].px - TILE / 2) / TILE);
    const ey = Math.round((state.echo.frames[idx].py - TILE / 2) / TILE);
    ctx.fillStyle = '#8844ff';
    ctx.fillRect(mmX + ex * mmSize, mmY + ey * mmSize, mmSize, mmSize);
  }
}

function gameLoop() {
  if (!state.dead && !state.done) {
    updatePlayer();
    updateRecording();
    updateEcho();
    updateDoorsAndPlates();
  }
  draw();
  drawMinimap();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'r' || e.key === 'R') {
    if (state.dead || state.done) { resetGame(); return; }
    if (state.recording && state.recording.active) {
      if (state.recording.frames.length > 0) showMessage('Echo created — it repeats your movement in a loop');
      stopRecording();
    } else { showMessage('Recording... (max 3s)'); startRecording(); }
    return;
  }
  const dir = DIRS[e.key];
  if (dir) {
    const p = state.player;
    if (p.moving) state.inputQueue.push(dir);
    else tryMove(dir.x, dir.y);
  }
});

document.getElementById('next-btn').addEventListener('click', () => {
  if (state.currentLevel === LEVELS.length - 1) state.currentLevel = 0;
  else state.currentLevel++;
  resetGame();
});

document.getElementById('retry-btn').addEventListener('click', () => { resetGame(); });

state.currentLevel = 0;
resetGame();
gameLoop();
