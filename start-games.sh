#!/bin/bash
# Game Server Launcher for Syntax Hub
# Starts multiplayer game servers on separate ports

GAMES_DIR="$(dirname "$0")/games"
LOG_DIR="$(dirname "$0")/data/game-logs"
mkdir -p "$LOG_DIR"

echo "=== Syntax Game Hub - Server Launcher ==="
echo ""

# Agar.io Clone (port 4001)
echo "[1/6] Starting Agar.io Clone on port 4001..."
cd "$GAMES_DIR/agar-io"
if [ -d "node_modules" ]; then
  PORT=4001 node bin/server/server.js > "$LOG_DIR/agar-io.log" 2>&1 &
  echo "  PID: $! | Log: $LOG_DIR/agar-io.log"
else
  echo "  SKIPPED - no node_modules (run: cd games/agar-io && npm install)"
fi

# Tank Trouble (port 4002)
echo "[2/6] Starting Tank Trouble on port 4002..."
cd "$GAMES_DIR/tank-trouble/server"
if [ -d "node_modules" ]; then
  PORT=4002 node src/server.js > "$LOG_DIR/tank-trouble.log" 2>&1 &
  echo "  PID: $! | Log: $LOG_DIR/tank-trouble.log"
else
  echo "  SKIPPED - no node_modules (run: cd games/tank-trouble/server && npm install)"
fi

# Bomberman (port 4003)
echo "[3/6] Starting Bomberman on port 4003..."
cd "$GAMES_DIR/bomberman"
if [ -d "node_modules" ]; then
  PORT=4003 node main.js > "$LOG_DIR/bomberman.log" 2>&1 &
  echo "  PID: $! | Log: $LOG_DIR/bomberman.log"
else
  echo "  SKIPPED - no node_modules (run: cd games/bomberman && npm install)"
fi

# BrowserQuest (port 4004)
echo "[4/6] Starting BrowserQuest on port 4004..."
cd "$GAMES_DIR/browserquest"
if [ -d "node_modules" ]; then
  node bin/server.js > "$LOG_DIR/browserquest.log" 2>&1 &
  echo "  PID: $! | Log: $LOG_DIR/browserquest.log"
else
  echo "  SKIPPED - dependencies not installed (outdated packages)"
fi

# OgarX (port 4005)
echo "[5/6] Starting OgarX on port 4005..."
cd "$GAMES_DIR/ogarx"
if [ -d "node_modules" ]; then
  PORT=4005 node run.js > "$LOG_DIR/ogarx.log" 2>&1 &
  echo "  PID: $! | Log: $LOG_DIR/ogarx.log"
else
  echo "  SKIPPED - no node_modules (run: cd games/ogarx && npm install)"
fi

# Example .io Game (port 4006)
echo "[6/6] Starting Example .io Game on port 4006..."
cd "$GAMES_DIR/io-game"
if [ -d "node_modules" ]; then
  PORT=4006 node src/server.js > "$LOG_DIR/io-game.log" 2>&1 &
  echo "  PID: $! | Log: $LOG_DIR/io-game.log"
else
  echo "  SKIPPED - no node_modules (run: cd games/io-game && npm install)"
fi

echo ""
echo "=== Game servers started ==="
echo "Static games (no server needed):"
echo "  - BananaBread (Cube 2): http://localhost:3000/games/cuber"
echo "  - ArenaJS (OpenArena): http://localhost:3000/games/arena-fps"
echo "  - OpenArena Web: http://localhost:3000/games/openarena-web"
echo ""
echo "Server games (if started):"
echo "  - Agar.io Clone: http://localhost:4001"
echo "  - Tank Trouble: http://localhost:4002"
echo "  - Bomberman: http://localhost:4003"
echo "  - OgarX: http://localhost:4005"
echo "  - Example .io Game: http://localhost:4006"
echo ""
echo "Logs: $LOG_DIR/"
