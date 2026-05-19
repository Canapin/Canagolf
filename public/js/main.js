(function () {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const setupEl      = document.getElementById('setup');
  const lobbyEl      = document.getElementById('lobby');
  const scoreboardEl = document.getElementById('scoreboard');
  const sbListEl     = document.getElementById('scoreboard-list');
  const sbCloseBtn   = document.getElementById('scoreboard-close');
  const sbWaitingEl  = document.getElementById('scoreboard-waiting');
  const gameEl       = document.getElementById('game-ui');
  const playerListEl = document.getElementById('player-list');
  const addPlayerBtn = document.getElementById('add-player');
  const startBtn     = document.getElementById('start-game');
  const canvas       = document.getElementById('canvas');
  const ctx          = canvas.getContext('2d');
  const hudEl        = document.getElementById('hud');

  let game   = null;
  let mouseX = 0;
  let mouseY = 0;

  // ── Online mode state ─────────────────────────────────────────────────────
  let socket           = null;
  let isOnlineMode     = false;
  let localPlayerId    = null;
  let localPlayerIndex = -1;
  let isLocalHost      = false;

  // ── Debug panel ───────────────────────────────────────────────────────────

  (function () {
    const sliders = [
      { id: 'sl-ball-rest', val: 'val-ball-rest', prop: 'BALL_RESTITUTION',   fmt: v => v.toFixed(2) },
      { id: 'sl-power',    val: 'val-power',    prop: 'MAX_POWER',          fmt: v => v.toFixed(1) },
      { id: 'sl-scale',    val: 'val-scale',    prop: 'POWER_SCALE',        fmt: v => v.toFixed(3) },
      { id: 'sl-friction', val: 'val-friction', prop: 'FRICTION',           fmt: v => v.toFixed(3) },
      { id: 'sl-sand',     val: 'val-sand',     prop: 'SAND_FRICTION',      fmt: v => v.toFixed(3) },
      { id: 'sl-bouncy',   val: 'val-bouncy',   prop: 'BOUNCY_RESTITUTION', fmt: v => v.toFixed(2) },
      { id: 'sl-sticky',   val: 'val-sticky',   prop: 'STICKY_RESTITUTION', fmt: v => v.toFixed(2) },
      { id: 'sl-slope',    val: 'val-slope',    prop: 'SLOPE_FORCE',         fmt: v => v.toFixed(3) },
      { id: 'sl-slope-rf', val: 'val-slope-rf', prop: 'SLOPE_ROLL_FRICTION', fmt: v => v.toFixed(4) },
    ];
    sliders.forEach(({ id, val, prop, fmt }) => {
      const input = document.getElementById(id);
      const label = document.getElementById(val);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        Physics[prop] = v;
        label.textContent = fmt(v);
      });
    });
  })();

  // ── Tab switching ─────────────────────────────────────────────────────────

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('tab-local').hidden  = target !== 'local';
      document.getElementById('tab-online').hidden = target !== 'online';
    });
  });

  // ── Local setup screen ────────────────────────────────────────────────────

  function addPlayerRow(defaultName) {
    const row = document.createElement('div');
    row.className = 'player-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultName || '';
    input.placeholder = `Player ${playerListEl.children.length + 1}`;
    input.maxLength = 20;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => {
      if (playerListEl.children.length > 1) row.remove();
    };

    row.appendChild(input);
    row.appendChild(removeBtn);
    playerListEl.appendChild(row);
    input.focus();
  }

  addPlayerRow('Player 1');
  addPlayerRow('Player 2');

  addPlayerBtn.addEventListener('click', () => {
    if (playerListEl.children.length < 8) addPlayerRow('');
  });

  startBtn.addEventListener('click', async () => {
    const names = Array.from(playerListEl.querySelectorAll('input'))
      .map(i => i.value.trim())
      .filter(n => n.length > 0);
    if (names.length === 0) return;
    await startLocalGame(names);
  });

  // ── Online setup screen ───────────────────────────────────────────────────

  const onlineNameEl  = document.getElementById('online-name');
  const btnCreate     = document.getElementById('btn-create');
  const joinCodeEl    = document.getElementById('join-code');
  const btnJoin       = document.getElementById('btn-join');
  const onlineErrorEl = document.getElementById('online-error');

  function connectSocket() {
    if (socket) return;
    socket = io();
    bindSocketEvents();
  }

  btnCreate.addEventListener('click', () => {
    const name = onlineNameEl.value.trim();
    if (!name) { onlineErrorEl.textContent = 'Enter your name first.'; return; }
    onlineErrorEl.textContent = '';
    connectSocket();
    socket.emit('c:create', { name });
  });

  btnJoin.addEventListener('click', () => {
    const name = onlineNameEl.value.trim();
    const code = joinCodeEl.value.trim().toUpperCase();
    if (!name) { onlineErrorEl.textContent = 'Enter your name first.'; return; }
    if (code.length !== 4) { onlineErrorEl.textContent = 'Enter a 4-letter room code.'; return; }
    onlineErrorEl.textContent = '';
    connectSocket();
    socket.emit('c:join', { name, code });
  });

  // ── Lobby ─────────────────────────────────────────────────────────────────

  const lobbyCodeEl    = document.getElementById('lobby-code');
  const lobbyPlayersEl = document.getElementById('lobby-players');
  const lobbyStartBtn  = document.getElementById('lobby-start');
  const lobbyWaitingEl = document.getElementById('lobby-waiting');

  lobbyStartBtn.addEventListener('click', () => socket.emit('c:start'));

  function showLobby(code, isHost) {
    setupEl.hidden = true;
    lobbyEl.hidden = false;
    lobbyCodeEl.textContent  = code;
    lobbyStartBtn.hidden     = !isHost;
    lobbyWaitingEl.hidden    = isHost;
  }

  // ── Socket events ─────────────────────────────────────────────────────────

  function bindSocketEvents() {
    socket.on('s:error', ({ msg }) => {
      onlineErrorEl.textContent = msg;
    });

    socket.on('s:created', ({ code, playerId }) => {
      localPlayerId = playerId;
      isOnlineMode  = true;
      isLocalHost   = true;
      showLobby(code, true);
    });

    socket.on('s:joined', ({ code, playerId }) => {
      localPlayerId = playerId;
      isOnlineMode  = true;
      showLobby(code, false);
    });

    socket.on('s:lobby', ({ players, hostId }) => {
      isLocalHost = localPlayerId === hostId;
      lobbyPlayersEl.innerHTML = players
        .map(p => `<li>${p.name}${p.id === hostId ? ' 👑' : ''}</li>`)
        .join('');
      if (isLocalHost) {
        lobbyStartBtn.hidden  = false;
        lobbyWaitingEl.hidden = true;
      }
    });

    socket.on('s:start', ({ mapText, players }) => {
      const map = Physics.parseMap(mapText);
      localPlayerIndex = players.findIndex(p => p.id === localPlayerId);
      lobbyEl.hidden = true;
      beginGame(map, players.map(p => p.name));
    });

    socket.on('s:shot', ({ playerIndex, vx, vy, strokes }) => {
      if (!game) return;
      const player = game.players[playerIndex];
      player.strokes = strokes;
      // Only apply velocity for remote players — local player already launched
      if (playerIndex !== localPlayerIndex) {
        player.ball.vx = vx;
        player.ball.vy = vy;
      }
      updateHUD();
    });

    socket.on('s:ballpos', ({ playerIndex, x, y }) => {
      if (!game) return;
      const ball = game.players[playerIndex].ball;
      ball.x = x;
      ball.y = y;
    });

    socket.on('s:sink', ({ playerIndex, x, y }) => {
      if (!game) return;
      const player = game.players[playerIndex];
      player.ball.x  = x;
      player.ball.y  = y;
      player.ball.vx = 0;
      player.ball.vy = 0;
      player.sunk    = true;
      updateHUD();
    });

    socket.on('s:turn', ({ currentPlayerIndex }) => {
      if (!game) return;
      game.currentPlayerIndex = currentPlayerIndex;
      game.players[currentPlayerIndex].started = true;
      updateHUD();
    });

    socket.on('s:gameover', ({ players }) => {
      if (!game) return;
      game.over = true;
      render();
      setTimeout(() => showScoreboard(players, isLocalHost), 400);
    });

    socket.on('s:close', () => {
      location.reload();
    });
  }

  // ── Game start ────────────────────────────────────────────────────────────

  async function startLocalGame(playerNames) {
    const resp = await fetch('/maps/hole1.txt');
    if (!resp.ok) { alert('Failed to load map.'); return; }
    const map = Physics.parseMap(await resp.text());
    beginGame(map, playerNames);
  }

  function beginGame(map, playerNames) {
    canvas.width  = map.width  * Physics.TILE_SIZE;
    canvas.height = map.height * Physics.TILE_SIZE;

    game = Game.createGame(map, playerNames);

    setupEl.hidden = true;
    gameEl.hidden  = false;

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onCanvasClick);

    updateHUD();
    requestAnimationFrame(loop);
  }

  // ── Input handlers ────────────────────────────────────────────────────────

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }

  function onCanvasClick(e) {
    if (!game || game.over) return;
    if (isOnlineMode && localPlayerIndex !== game.currentPlayerIndex) return;

    const ball = Game.getCurrentBall(game);
    if (Physics.isMoving(ball)) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    Game.getCurrentPlayer(game).strokeOrigin = { x: ball.x, y: ball.y };
    if (!isOnlineMode) Game.onShot(game);
    Physics.launchBall(ball, cx, cy);

    if (isOnlineMode) socket.emit('c:shot', { vx: ball.vx, vy: ball.vy });
    updateHUD();
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  function loop() {
    if (!game) return;

    const ball      = Game.getCurrentBall(game);
    const wasMoving = Physics.isMoving(ball);

    // Update all started, non-sunk balls
    game.players.forEach(p => {
      if (!p.sunk && p.started && Physics.isMoving(p.ball)) {
        Physics.updateBall(p.ball, game.map.tiles);
      }
    });

    // Ball-to-ball collisions (local only; online balls are server-authoritative)
    if (!isOnlineMode) {
      Physics.resolveBallCollisions(game.players);
    }

    if (wasMoving) {
      if (Physics.isWaterTile(Physics.tileAt(game.map.tiles, ball.x, ball.y))) {
        const origin = Game.getCurrentPlayer(game).strokeOrigin;
        ball.x = origin.x;
        ball.y = origin.y;
        ball.vx = 0;
        ball.vy = 0;
        if (isOnlineMode && localPlayerIndex === game.currentPlayerIndex) {
          socket.emit('c:stopped', { x: ball.x, y: ball.y, sunk: false });
        } else if (!isOnlineMode) {
          Game.onBallStopped(game);
          updateHUD();
        }
        render();
        requestAnimationFrame(loop);
        return;
      }

      const hole = Physics.checkHole(ball, game.map.holes);
      if (hole) {
        ball.x = hole.x;
        ball.y = hole.y;
        ball.vx = 0;
        ball.vy = 0;

        if (isOnlineMode) {
          if (localPlayerIndex === game.currentPlayerIndex) {
            socket.emit('c:stopped', { x: ball.x, y: ball.y, sunk: true });
          }
        } else {
          Game.onSink(game);
          updateHUD();
          if (game.over) {
            render();
            setTimeout(showEndScreen, 400);
            return;
          }
        }
      } else if (!Physics.isMoving(ball)) {
        if (isOnlineMode && localPlayerIndex === game.currentPlayerIndex) {
          socket.emit('c:stopped', { x: ball.x, y: ball.y, sunk: false });
        } else if (!isOnlineMode) {
          Game.onBallStopped(game);
          updateHUD();
        }
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Renderer.renderMap(ctx, game.map);

    game.players.forEach((p, i) => {
      if (!p.sunk && p.started) Renderer.renderBall(ctx, p.ball, i);
    });

    const currentBall = Game.getCurrentBall(game);
    const canAim = !Physics.isMoving(currentBall) && !game.over &&
                   (!isOnlineMode || localPlayerIndex === game.currentPlayerIndex);
    if (canAim) {
      Renderer.renderAimLine(ctx, currentBall, mouseX, mouseY);
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  function updateHUD() {
    hudEl.innerHTML = game.players.map((p, i) => {
      const classes = ['player-score'];
      if (i === game.currentPlayerIndex && !p.sunk) classes.push('active');
      if (p.sunk) classes.push('sunk');
      return `<span class="${classes.join(' ')}">${p.name}: ${p.strokes}</span>`;
    }).join('<span class="sep">|</span>');
  }

  // ── Scoreboard ────────────────────────────────────────────────────────────

  function showScoreboard(players, isHost) {
    const sorted = [...players].sort((a, b) => a.strokes - b.strokes);
    sbListEl.innerHTML = sorted.map(p =>
      `<li><span class="score-name">${p.name}</span><span class="score-strokes">${p.strokes} stroke${p.strokes !== 1 ? 's' : ''}</span></li>`
    ).join('');
    sbCloseBtn.hidden  = !isHost;
    sbWaitingEl.hidden = isHost;
    scoreboardEl.hidden = false;
  }

  sbCloseBtn.addEventListener('click', () => {
    if (isOnlineMode) {
      socket.emit('c:close');
    } else {
      location.reload();
    }
  });

  // ── End screen (local) ────────────────────────────────────────────────────

  function showEndScreen() {
    showScoreboard(game.players, true);
  }
})();
