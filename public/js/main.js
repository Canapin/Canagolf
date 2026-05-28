(function () {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const setupEl      = document.getElementById('setup');
  const lobbyEl      = document.getElementById('lobby');
  const scoreboardEl = document.getElementById('scoreboard');
  const sbListEl     = document.getElementById('scoreboard-list');
  const sbCloseBtn   = document.getElementById('scoreboard-close');
  const sbWaitingEl  = document.getElementById('scoreboard-waiting');
  const resultsEl    = document.getElementById('results-screen');
  const resultsWinnerEl = document.getElementById('results-winner');
  const resultsTableEl  = document.getElementById('results-table');
  const resultsCloseBtn = document.getElementById('results-close');
  const resultsWaitingEl = document.getElementById('results-waiting');
  const gameEl       = document.getElementById('game-ui');
  const playerListEl = document.getElementById('player-list');
  const addPlayerBtn = document.getElementById('add-player');
  const startBtn     = document.getElementById('start-game');
  const canvas       = document.getElementById('canvas');
  const ctx          = canvas.getContext('2d');
  const hudEl        = document.getElementById('hud');
  const debugPanelEl = document.getElementById('debug-panel');

  const MARGIN = Physics.TILE_SIZE * 4; // rough border around the course

  let game        = null;
  let gameStarted = false;
  let gameSession = null; // { mapList, mapIndex, playerNames, scores }
  let mouseX = 0;
  let mouseY = 0;
  let loopId      = null;
  let lastTime    = 0;
  let accumulator = 0;
  const PHYSICS_STEP = 1000 / 240;

  // ── Online mode state ─────────────────────────────────────────────────────
  let socket           = null;
  let isOnlineMode     = false;
  let localPlayerId    = null;
  let localPlayerIndex = -1;
  let isLocalHost      = false;
  let isOnlineHoleOver = false;
  let waitingForTurnSwitch = false;

  // ── Debug panel ───────────────────────────────────────────────────────────

  (function () {
    const sliders = [
      { id: 'sl-ball-rest', val: 'val-ball-rest', prop: 'BALL_RESTITUTION',   fmt: v => v.toFixed(2) },
      { id: 'sl-power',     val: 'val-power',     prop: 'MAX_POWER',          fmt: v => v.toFixed(1) },
      { id: 'sl-scale',     val: 'val-scale',     prop: 'POWER_SCALE',        fmt: v => v.toFixed(3) },
      { id: 'sl-friction',  val: 'val-friction',  prop: 'FRICTION',           fmt: v => v.toFixed(3) },
      { id: 'sl-sand',      val: 'val-sand',      prop: 'SAND_FRICTION',      fmt: v => v.toFixed(3) },
      { id: 'sl-bouncy',    val: 'val-bouncy',    prop: 'BOUNCY_RESTITUTION', fmt: v => v.toFixed(2) },
      { id: 'sl-sticky',    val: 'val-sticky',    prop: 'STICKY_RESTITUTION', fmt: v => v.toFixed(2) },
      { id: 'sl-slope',     val: 'val-slope',     prop: 'SLOPE_FORCE',        fmt: v => v.toFixed(3) },
      { id: 'sl-slope-rf',  val: 'val-slope-rf',  prop: 'SLOPE_ROLL_FRICTION',fmt: v => v.toFixed(4) },
      { id: 'sl-bh-impulse',  val: 'val-bh-impulse',  prop: 'BH_IMPULSE_FACTOR',  fmt: v => v.toFixed(2) },
      { id: 'sl-bh-radius',   val: 'val-bh-radius',   prop: 'BH_RADIUS_TILES',    fmt: v => v.toFixed(0) },
      { id: 'sl-swap-radius', val: 'val-swap-radius', prop: 'SWAP_RADIUS_TILES',  fmt: v => v.toFixed(0) },
    ];
    sliders.forEach(({ id, val, prop, fmt }) => {
      const input = document.getElementById(id);
      const label = document.getElementById(val);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        Physics[prop] = v;
        label.textContent = fmt(v);
      });
      const current = Physics[prop];
      input.value = current;
      label.textContent = fmt(current);
    });

    document.getElementById('debug-toggle').addEventListener('click', () => {
      debugPanelEl.hidden = !debugPanelEl.hidden;
      localStorage.setItem('canagolf_debugOpen', debugPanelEl.hidden ? '0' : '1');
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
    const mapVal  = document.getElementById('map-select-local').value || 'hole1';
    const rounds  = parseInt(document.getElementById('rounds-input').value) || 10;
    if (mapVal === '__random') {
      await startSession(names, rounds);
    } else if (mapVal.startsWith('__camp_')) {
      await startCampaign(names, parseInt(mapVal.slice(7)));
    } else {
      await startLocalGame(names, mapVal);
    }
  });

  // ── Map list ──────────────────────────────────────────────────────────────

  (async function populateMapSelects() {
    try {
      const [maps, campaigns] = await Promise.all([
        fetch('/api/maps').then(r => r.json()),
        fetch('/api/campaigns').then(r => r.json()).catch(() => []),
      ]);
      const localSel = document.getElementById('map-select-local');
      const lobbySel = document.getElementById('map-select-lobby');

      campaigns.forEach((c, i) => {
        [localSel, lobbySel].forEach(sel => {
          const opt = document.createElement('option');
          opt.value = `__camp_${i}`; opt.textContent = c.name;
          sel.appendChild(opt);
        });
      });

      [localSel, lobbySel].forEach(sel => {
        const opt = document.createElement('option');
        opt.value = '__random'; opt.textContent = 'Random';
        sel.appendChild(opt);
        const sep = document.createElement('option'); sep.disabled = true; sep.textContent = '──────────';
        sel.appendChild(sep);
      });

      maps.forEach(m => {
        [localSel, lobbySel].forEach(sel => {
          const opt = document.createElement('option'); opt.value = m; opt.textContent = m;
          sel.appendChild(opt);
        });
      });

      localSel.addEventListener('change', () => {
        document.getElementById('rounds-row').hidden = localSel.value !== '__random';
      });
      lobbySel.addEventListener('change', () => {
        document.getElementById('lobby-rounds-row').hidden = lobbySel.value !== '__random';
      });
    } catch { /* no-op */ }
  })();

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
    const isSpectator = document.getElementById('host-spectator').checked;
    socket.emit('c:create', { name, isSpectator });
  });

  btnJoin.addEventListener('click', () => {
    const name = onlineNameEl.value.trim();
    const code = joinCodeEl.value.trim().toUpperCase();
    if (!name) { onlineErrorEl.textContent = 'Enter your name first.'; return; }
    if (code.length !== 4) { onlineErrorEl.textContent = 'Enter a 4-letter room code.'; return; }
    onlineErrorEl.textContent = '';
    connectSocket();
    socket.emit('c:join', { name, code, isSpectator: document.getElementById('host-spectator').checked });
  });

  // ── Lobby ─────────────────────────────────────────────────────────────────

  const lobbyCodeEl    = document.getElementById('lobby-code');
  const lobbyPlayersEl = document.getElementById('lobby-players');
  const lobbyStartBtn  = document.getElementById('lobby-start');
  const lobbyWaitingEl = document.getElementById('lobby-waiting');
  const lobbyMapRowEl  = document.getElementById('lobby-map-row');

  lobbyStartBtn.addEventListener('click', () => {
    const mapName = document.getElementById('map-select-lobby').value || 'hole1';
    const rounds  = parseInt(document.getElementById('rounds-input-lobby').value) || 10;
    socket.emit('c:start', { map: mapName, rounds });
  });

  function showLobby(code, isHost) {
    setupEl.hidden = true;
    lobbyEl.hidden = false;
    lobbyCodeEl.textContent  = code;
    lobbyStartBtn.hidden     = !isHost;
    lobbyWaitingEl.hidden    = isHost;
    lobbyMapRowEl.hidden     = !isHost;
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
        .map(p => `<li>${p.name}${p.id === hostId ? ' 👑' : ''}${p.isSpectator ? ' (spectator)' : ''}</li>`)
        .join('');
      if (isLocalHost) {
        lobbyStartBtn.hidden  = false;
        lobbyWaitingEl.hidden = true;
      }
    });

    socket.on('s:start', ({ mapText, players, currentPlayerIndex = 0 }) => {
      const map = Physics.parseMap(mapText);
      localPlayerIndex = players.findIndex(p => p.id === localPlayerId);
      lobbyEl.hidden = true;
      scoreboardEl.hidden = true;
      isOnlineHoleOver = false;
      waitingForTurnSwitch = false;
      beginGame(map, players.map(p => p.name), currentPlayerIndex);
    });

    socket.on('s:shot', ({ playerIndex, vx, vy, strokes }) => {
      if (!game) return;
      const player = game.players[playerIndex];
      player.strokes = strokes;
      game.turnActive = true;
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
      game.turnActive = false;
      updateHUD();
    });

    socket.on('s:turn', ({ currentPlayerIndex, playerStates }) => {
      if (!game) return;
      waitingForTurnSwitch = false;
      game.map.teleporterPairs.forEach(pair => { pair.uses = 0; });
      game.map.blackHoleTiles.forEach(bh => { bh.dormant = false; });
      game.currentPlayerIndex = currentPlayerIndex;
      game.players[currentPlayerIndex].started = true;
      game.turnActive = false;
      if (playerStates) {
        game.players.forEach((p, i) => {
          if (!playerStates[i]) return;
          p.ball.x = playerStates[i].x;
          p.ball.y = playerStates[i].y;
          p.ball.vx = 0;
          p.ball.vy = 0;
          p.sunk       = p.sunk       || playerStates[i].sunk;
          p.eliminated = p.eliminated || playerStates[i].eliminated;
          p.waterPending    = false;
          p.waterRespawnPos = null;
        });
      }
      updateHUD();
    });

    socket.on('s:holeover', ({ players, holeIndex, totalHoles }) => {
      if (!game || isOnlineHoleOver) return;
      isOnlineHoleOver = true;
      game.over = true;
      render();
      setTimeout(() => {
        if (!isOnlineHoleOver) return;
        showScoreboard(
          players, isLocalHost,
          `Hole ${holeIndex + 1} / ${totalHoles}`,
          'Next Hole ▶'
        );
      }, 400);
    });

    socket.on('s:gameover', ({ players, holeScores }) => {
      if (!game || game.over) return;
      game.over = true;
      render();
      setTimeout(() => showFinalResults(holeScores, isLocalHost), 400);
    });

    socket.on('s:close', () => {
      location.reload();
    });
  }

  // ── Game start ────────────────────────────────────────────────────────────

  async function loadAndStartMap(mapName, playerNames) {
    let resp = await fetch(`/maps/${mapName}.json`);
    if (!resp.ok) resp = await fetch(`/maps/${mapName}.txt`);
    if (!resp.ok) { alert('Failed to load map: ' + mapName); return; }
    const map = Physics.parseMap(await resp.text());
    beginGame(map, playerNames);
  }

  async function startLocalGame(playerNames, mapName = 'hole1') {
    await loadAndStartMap(mapName, playerNames);
  }

  async function startSession(playerNames, rounds) {
    let maps = [];
    try { maps = await (await fetch('/api/maps')).json(); } catch {}
    const pool = maps.filter(m => !m.startsWith('_'));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const mapList = pool.slice(0, rounds);
    if (!mapList.length) { alert('No maps found for this mode.'); return; }
    gameSession = {
      mapList, mapIndex: 0, playerNames,
      scores: Object.fromEntries(playerNames.map(n => [n, 0])),
      holeScores: [],
      startingPlayerOffset: Math.floor(Math.random() * playerNames.length),
    };
    await loadAndStartMap(mapList[0], playerNames);
  }

  async function startCampaign(playerNames, campIndex) {
    let campaigns = [];
    try { campaigns = await fetch('/api/campaigns').then(r => r.json()); } catch {}
    const camp = campaigns[campIndex];
    if (!camp?.maps?.length) { alert('Campaign not found.'); return; }
    gameSession = {
      mapList: camp.maps, mapIndex: 0, playerNames,
      scores: Object.fromEntries(playerNames.map(n => [n, 0])),
      holeScores: [],
      startingPlayerOffset: Math.floor(Math.random() * playerNames.length),
    };
    await loadAndStartMap(camp.maps[0], playerNames);
  }

  function beginGame(map, playerNames, startPlayerIndex = 0) {
    if (loopId !== null) { cancelAnimationFrame(loopId); loopId = null; }
    lastTime    = 0;
    accumulator = 0;

    canvas.width  = map.width  * Physics.TILE_SIZE + MARGIN * 2;
    canvas.height = map.height * Physics.TILE_SIZE + MARGIN * 2;

    if (gameSession) {
      startPlayerIndex = (gameSession.startingPlayerOffset + gameSession.mapIndex) % playerNames.length;
    }
    game = Game.createGame(map, playerNames, startPlayerIndex);

    if (!gameStarted) {
      gameStarted = true;
      setupEl.hidden = true;
      lobbyEl.hidden = true;
      gameEl.hidden  = false;
      const debugAllowed = !isOnlineMode || isLocalHost;
      const toggleBtn = document.getElementById('debug-toggle');
      toggleBtn.hidden = !debugAllowed;
      if (debugAllowed) {
        debugPanelEl.hidden = localStorage.getItem('canagolf_debugOpen') !== '1';
      }
      document.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('click', onCanvasClick);
    }

    updateHUD();
    loopId = requestAnimationFrame(loop);
  }

  // ── Input handlers ────────────────────────────────────────────────────────

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left - MARGIN;
    mouseY = e.clientY - rect.top  - MARGIN;
  }

  function onCanvasClick(e) {
    if (!game || game.over) return;
    if (isOnlineMode && (localPlayerIndex !== game.currentPlayerIndex || waitingForTurnSwitch)) return;

    if (game.players.some(p => !p.sunk && !p.eliminated && Physics.isMoving(p.ball))) return;

    const ball = Game.getCurrentBall(game);
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left - MARGIN;
    const cy = e.clientY - rect.top  - MARGIN;

    Game.getCurrentPlayer(game).strokeOrigin = { x: ball.x, y: ball.y };
    if (!isOnlineMode) Game.onShot(game);
    else game.turnActive = true;
    Physics.launchBall(ball, cx, cy);

    if (isOnlineMode) socket.emit('c:shot', { vx: ball.vx, vy: ball.vy });
    updateHUD();
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  function physicsStep() {
    if (!game) return null;

    const ball = Game.getCurrentBall(game);
    const wasMoving = Physics.isMoving(ball);
    const wasAnyMoving = game.players.some(p => !p.sunk && !p.eliminated && Physics.isMoving(p.ball));

    // Save safe position only when ball is at rest — prevents tracking right up to water edge
    game.players.forEach(p => {
      if (!p.sunk && !p.eliminated && !p.waterPending && !Physics.isMoving(p.ball)) {
        const gt = Physics.getSurfaceAt(game.map.ground, p.ball.x, p.ball.y, game.map.groundLayers);
        if (!Physics.isWaterTile(gt) && !Physics.isLavaTile(gt)) {
          p.safePos = { x: p.ball.x, y: p.ball.y };
        }
      }
    });

    // Update all moving, non-sunk, non-eliminated balls
    game.players.forEach(p => {
      if (!p.sunk && !p.eliminated && !p.waterPending && Physics.isMoving(p.ball)) {
        Physics.applyHoleGravity(p.ball, game.map.holes);
        Physics.updateBall(p.ball, game.map.walls, game.map.ground, game.map.groundLayers);
      }
    });

    Physics.resolveBallCollisions(game.players);

    let turnEnded = false;

    // Hazard checks run unconditionally — ball may have been stopped by MIN_SPEED inside hazard
    const curTile = Physics.getSurfaceAt(game.map.ground, ball.x, ball.y, game.map.groundLayers);

    // Lava — player eliminated, no respawn
    if (!turnEnded && Physics.isLavaTile(curTile)) {
      if (!isOnlineMode) {
        Game.onEliminated(game);
        updateHUD();
        if (game.over) return 'over';
      } else {
        const p = Game.getCurrentPlayer(game);
        p.eliminated = true; p.ball.vx = 0; p.ball.vy = 0;
        if (game.players.every(pl => pl.sunk || pl.eliminated)) game.over = true;
        updateHUD();
        if (localPlayerIndex === game.currentPlayerIndex) {
          const playerStates = game.players.map(p => ({
            x: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.x : p.ball.x,
            y: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.y : p.ball.y,
            sunk: p.sunk, eliminated: p.eliminated,
          }));
          waitingForTurnSwitch = true;
          socket.emit('c:stopped', { x: ball.x, y: ball.y, sunk: true, playerStates });
        }
      }
      turnEnded = true;
    }

    // Water — reset to stroke origin; turn advances via all-stopped check
    if (!turnEnded && Physics.isWaterTile(curTile)) {
      const origin = Game.getCurrentPlayer(game).strokeOrigin;
      if (origin) {
        ball.x = origin.x; ball.y = origin.y; ball.vx = 0; ball.vy = 0;
        if (isOnlineMode && localPlayerIndex === game.currentPlayerIndex) {
          const playerStates = game.players.map(p => ({
            x: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.x : p.ball.x,
            y: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.y : p.ball.y,
            sunk: p.sunk, eliminated: p.eliminated,
          }));
          waitingForTurnSwitch = true;
          socket.emit('c:stopped', { x: ball.x, y: ball.y, sunk: false, playerStates });
          turnEnded = true;
        }
      }
    }

    if (wasMoving) {
      // Swap — exchange position, transfer velocity to target; only on entry; radius-limited
      const swapTile = Physics.checkSwap(ball, game.map.ground);
      if (!turnEnded && swapTile && !ball._wasOnSwap) {
        const swapCX = swapTile.col * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
        const swapCY = swapTile.row * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
        const swapObj = game.map.swapTiles.find(s => s.col === swapTile.col && s.row === swapTile.row);
        const swapR2 = (Physics.TILE_SIZE * (swapObj?.radius ?? Physics.SWAP_RADIUS_TILES)) ** 2;
        const others = game.players.filter((p, i) => {
          if (i === game.currentPlayerIndex || p.sunk || p.eliminated || !p.started) return false;
          const dx = p.ball.x - swapCX, dy = p.ball.y - swapCY;
          return dx * dx + dy * dy <= swapR2;
        });
        if (others.length > 0) {
          const target = others[Math.floor(Math.random() * others.length)];
          const tx = target.ball.x, ty = target.ball.y;
          target.ball.x = ball.x; target.ball.y = ball.y;
          ball.x = tx; ball.y = ty;
          target.ball.vx = ball.vx; target.ball.vy = ball.vy;
          target.ball._wasOnSwap = true;
          ball.vx = 0; ball.vy = 0;
          // turn advances via all-stopped check once target ball settles
        }
      }

      // Black hole — pull nearby opponents toward it; one activation per turn
      if (!turnEnded && !ball._wasOnBlackHole) {
        const bh = Physics.getActiveBlackHole(ball, game.map.blackHoleTiles);
        if (bh) {
          bh.dormant = true;
          const bhX = bh.col * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
          const bhY = bh.row * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
          const pullR2 = (Physics.TILE_SIZE * (bh.radius ?? Physics.BH_RADIUS_TILES)) ** 2;
          game.players.forEach((p, i) => {
            if (i === game.currentPlayerIndex || p.sunk || p.eliminated) return;
            const dx = bhX - p.ball.x, dy = bhY - p.ball.y;
            if (dx * dx + dy * dy <= pullR2) Physics.applyBlackHoleImpulse(p.ball, bhX, bhY);
          });
        }
      }

      // Hole — sink ball
      if (!turnEnded) {
        const hole = Physics.checkHole(ball, game.map.holes);
        if (hole) {
          ball.x = hole.x; ball.y = hole.y; ball.vx = 0; ball.vy = 0;
          if (isOnlineMode) {
            if (localPlayerIndex === game.currentPlayerIndex) {
              game.players[game.currentPlayerIndex].sunk = true;
              const playerStates = game.players.map(p => ({
                x: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.x : p.ball.x,
                y: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.y : p.ball.y,
                sunk: p.sunk, eliminated: p.eliminated,
              }));
              waitingForTurnSwitch = true;
              socket.emit('c:stopped', { x: ball.x, y: ball.y, sunk: true, playerStates });
            }
          } else {
            Game.onSink(game); updateHUD();
            if (game.over) return 'over';
          }
          turnEnded = true;
        }
      }
    }

    // Tile effects for non-current balls knocked by collisions
    let nonCurStateChanged = false;
    game.players.forEach((p, i) => {
      if (i === game.currentPlayerIndex || p.sunk || p.eliminated || p.waterPending) return;
      const swapTile2 = Physics.isMoving(p.ball) && !p.ball._wasOnSwap
        ? Physics.checkSwap(p.ball, game.map.ground) : null;
      if (swapTile2) {
        const swapCX = swapTile2.col * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
        const swapCY = swapTile2.row * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
        const swapObj2 = game.map.swapTiles.find(s => s.col === swapTile2.col && s.row === swapTile2.row);
        const swapR2 = (Physics.TILE_SIZE * (swapObj2?.radius ?? Physics.SWAP_RADIUS_TILES)) ** 2;
        const swapTargets = game.players.filter((tp, ti) => {
          if (ti === i || tp.sunk || tp.eliminated || !tp.started) return false;
          const dx = tp.ball.x - swapCX, dy = tp.ball.y - swapCY;
          return dx * dx + dy * dy <= swapR2;
        });
        if (swapTargets.length > 0) {
          const target = swapTargets[Math.floor(Math.random() * swapTargets.length)];
          const tx = target.ball.x, ty = target.ball.y;
          target.ball.x = p.ball.x; target.ball.y = p.ball.y;
          p.ball.x = tx; p.ball.y = ty;
          target.ball.vx = p.ball.vx; target.ball.vy = p.ball.vy;
          target.ball._wasOnSwap = true;
          p.ball.vx = 0; p.ball.vy = 0;
          nonCurStateChanged = true;
        }
      }
      if (Physics.isMoving(p.ball) && !p.ball._wasOnBlackHole) {
        const bh2 = Physics.getActiveBlackHole(p.ball, game.map.blackHoleTiles);
        if (bh2) {
          bh2.dormant = true;
          const bhX = bh2.col * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
          const bhY = bh2.row * Physics.TILE_SIZE + Physics.TILE_SIZE / 2;
          const pullR2 = (Physics.TILE_SIZE * (bh2.radius ?? Physics.BH_RADIUS_TILES)) ** 2;
          game.players.forEach((tp, ti) => {
            if (ti === i || tp.sunk || tp.eliminated) return;
            const dx = bhX - tp.ball.x, dy = bhY - tp.ball.y;
            if (dx * dx + dy * dy <= pullR2) Physics.applyBlackHoleImpulse(tp.ball, bhX, bhY);
          });
          nonCurStateChanged = true;
        }
      }
      const gt = Physics.getSurfaceAt(game.map.ground, p.ball.x, p.ball.y, game.map.groundLayers);
      if (Physics.isWaterTile(gt)) {
        p.waterRespawnPos = p.safePos ? { x: p.safePos.x, y: p.safePos.y } : { x: p.ball.x, y: p.ball.y };
        p.waterPending = true;
        p.ball.vx = 0; p.ball.vy = 0;
        nonCurStateChanged = true;
      } else if (Physics.isLavaTile(gt)) {
        p.ball.vx = 0; p.ball.vy = 0;
        p.eliminated = true;
        if (game.players.every(pl => pl.sunk || pl.eliminated)) game.over = true;
        nonCurStateChanged = true;
      } else if (Physics.isMoving(p.ball)) {
        const hole = Physics.checkHole(p.ball, game.map.holes);
        if (hole) {
          p.ball.x = hole.x; p.ball.y = hole.y; p.ball.vx = 0; p.ball.vy = 0;
          p.sunk = true;
          if (game.players.every(pl => pl.sunk || pl.eliminated)) game.over = true;
          nonCurStateChanged = true;
        }
      }
    });
    if (nonCurStateChanged) {
      updateHUD();
      if (game.over && !isOnlineMode) return 'over';
    }

    // Teleporter — fires for any active ball (covers target balls kicked by swap)
    if (!turnEnded) {
      game.players.forEach(p => {
        if (p.sunk || p.eliminated) return;
        const tpDest = Physics.checkTeleporter(p.ball, game.map.teleporterPairs);
        if (tpDest) { p.ball.x = tpDest.x; p.ball.y = tpDest.y; }
      });
    }

    // Advance turn only when ALL balls have come to rest
    if (!turnEnded && game.turnActive && wasAnyMoving && !game.over) {
      const nowAnyMoving = game.players.some(p => !p.sunk && !p.eliminated && Physics.isMoving(p.ball));
      if (!nowAnyMoving) {
        if (isOnlineMode && localPlayerIndex === game.currentPlayerIndex) {
          const playerStates = game.players.map(p => ({
            x: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.x : p.ball.x,
            y: p.waterPending && p.waterRespawnPos ? p.waterRespawnPos.y : p.ball.y,
            sunk: p.sunk, eliminated: p.eliminated,
          }));
          waitingForTurnSwitch = true;
          socket.emit('c:stopped', { x: ball.x, y: ball.y, sunk: false, playerStates });
        } else if (!isOnlineMode) {
          Game.onBallStopped(game); updateHUD();
        }
      }
    }

    // Track teleporter and swap occupancy to implement entry-only triggering
    game.players.forEach(p => {
      if (!p.sunk && !p.eliminated) {
        p.ball._tpOccupied = Physics.isOnTeleporter(p.ball, game.map.ground);
        p.ball._wasOnSwap = Physics.checkSwap(p.ball, game.map.ground);
        p.ball._wasOnBlackHole = Physics.checkBlackHole(p.ball, game.map.blackHoleTiles);
        if (p.ball._tpExitTile) {
          const [ec, er] = p.ball._tpExitTile.split(',').map(Number);
          if (Math.floor(p.ball.x / Physics.TILE_SIZE) !== ec ||
              Math.floor(p.ball.y / Physics.TILE_SIZE) !== er)
            p.ball._tpExitTile = null;
        }
      }
    });

    return null;
  }

  function loop(ts) {
    if (!game) return;

    const delta = lastTime === 0 ? PHYSICS_STEP : ts - lastTime;
    lastTime = ts;
    accumulator += Math.min(delta, 200);

    let result = null;
    while (accumulator >= PHYSICS_STEP) {
      result = physicsStep();
      accumulator -= PHYSICS_STEP;
      if (result === 'over') { accumulator = 0; break; }
    }

    render();

    if (result === 'over') {
      setTimeout(showEndScreen, 400);
      return;
    }

    loopId = requestAnimationFrame(loop);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1c4010';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(MARGIN, MARGIN);

    Renderer.renderMap(ctx, game.map);

    const isMyTurn = !game.over && (!isOnlineMode || localPlayerIndex === game.currentPlayerIndex);
    if (isMyTurn) {
      const TT = Physics.TILE_SIZE;
      ctx.lineWidth = 1.5;
      if (game.map.swapTiles && game.map.swapTiles.length > 0) {
        ctx.strokeStyle = "rgba(192,128,0,0.5)";
        for (const sw of game.map.swapTiles) {
          const r = (sw.radius ?? Physics.SWAP_RADIUS_TILES) * TT;
          ctx.beginPath();
          ctx.arc(sw.col * TT + TT / 2, sw.row * TT + TT / 2, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      if (game.map.blackHoleTiles && game.map.blackHoleTiles.length > 0) {
        ctx.strokeStyle = "rgba(170,80,255,0.5)";
        for (const bh of game.map.blackHoleTiles) {
          if (bh.dormant) continue;
          const r = (bh.radius ?? Physics.BH_RADIUS_TILES) * TT;
          ctx.beginPath();
          ctx.arc(bh.col * TT + TT / 2, bh.row * TT + TT / 2, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    game.players.forEach((p, i) => {
      if (!p.sunk && !p.eliminated && !p.waterPending && (p.started || Physics.isMoving(p.ball)))
        Renderer.renderBall(ctx, p.ball, i);
    });

    const currentBall = Game.getCurrentBall(game);
    const anyBallMoving = game.players.some(p => !p.sunk && !p.eliminated && Physics.isMoving(p.ball));
    const canAim = !anyBallMoving && !game.over && !waitingForTurnSwitch &&
                   (!isOnlineMode || localPlayerIndex === game.currentPlayerIndex);
    if (canAim) {
      Renderer.renderAimLine(ctx, currentBall, mouseX, mouseY);
    }

    ctx.restore();
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  function updateHUD() {
    const roundHtml = gameSession
      ? `<div class="hud-round">Round ${gameSession.mapIndex + 1} / ${gameSession.mapList.length}</div>`
      : '';
    const scoresHtml = game.players.map((p, i) => {
      const classes = ['player-score'];
      if (i === game.currentPlayerIndex && !p.sunk && !p.eliminated) classes.push('active');
      if (p.sunk || p.eliminated) classes.push('sunk');
      const suffix = p.eliminated ? ' 💀' : '';
      const color = Renderer.BALL_COLORS[i % Renderer.BALL_COLORS.length];
      const dot = `<span class="ball-dot" style="background:${color}"></span>`;
      return `<span class="${classes.join(' ')}">${dot}${p.name}: ${p.strokes}${suffix}</span>`;
    }).join('<span class="sep">|</span>');
    hudEl.innerHTML = roundHtml + `<div class="hud-scores">${scoresHtml}</div>`;
  }

  // ── Scoreboard ────────────────────────────────────────────────────────────

  function showScoreboard(players, isHost, title = 'Hole Complete!', closeLabel = 'Play Again') {
    const sorted = [...players].sort((a, b) => a.strokes - b.strokes);
    sbListEl.innerHTML = sorted.map(p =>
      `<li><span class="score-name">${p.name}</span><span class="score-strokes">${p.strokes} stroke${p.strokes !== 1 ? 's' : ''}</span></li>`
    ).join('');
    document.getElementById('scoreboard-title').textContent = title;
    sbCloseBtn.textContent = closeLabel;
    sbCloseBtn.hidden  = !isHost;
    sbWaitingEl.hidden = isHost;
    scoreboardEl.hidden = false;
  }

  function showFinalResults(holeScores, isHost) {
    if (!holeScores || !holeScores.length) return;
    const playerNames = holeScores[0].map(p => p.name);
    const numHoles = holeScores.length;

    // Compute totals
    const totals = {};
    playerNames.forEach(n => { totals[n] = 0; });
    holeScores.forEach(hole => {
      hole.forEach(p => { totals[p.name] = (totals[p.name] ?? 0) + p.strokes; });
    });

    // Sort by total ascending
    const sorted = [...playerNames].sort((a, b) => totals[a] - totals[b]);
    const minTotal = totals[sorted[0]];
    const winners = sorted.filter(n => totals[n] === minTotal);

    // Winner banner
    resultsWinnerEl.textContent = '🏆 ' + winners.join(' & ') + (winners.length === 1 ? ' wins!' : ' win!');

    // Build table
    const minPerHole = holeScores.map(hole =>
      Math.min(...hole.map(p => p.strokes))
    );

    // Header
    let html = '<thead><tr><th>Player</th>';
    for (let h = 0; h < numHoles; h++) html += `<th>H${h + 1}</th>`;
    html += '<th>Total</th></tr></thead><tbody>';

    // Rows
    sorted.forEach(name => {
      const isWinner = totals[name] === minTotal;
      html += `<tr class="${isWinner ? 'results-winner-row' : ''}">`;
      html += `<td>${name}</td>`;
      holeScores.forEach((hole, h) => {
        const entry = hole.find(p => p.name === name);
        const strokes = entry ? entry.strokes : '—';
        const isBest = typeof strokes === 'number' && strokes === minPerHole[h];
        html += `<td class="${isBest ? 'results-best' : ''}">${strokes}</td>`;
      });
      html += `<td class="results-total">${totals[name]}</td>`;
      html += '</tr>';
    });
    html += '</tbody>';

    resultsTableEl.innerHTML = html;
    resultsCloseBtn.hidden  = !isHost;
    resultsWaitingEl.hidden = isHost;
    resultsEl.hidden = false;
  }

  resultsCloseBtn.addEventListener('click', () => {
    if (isOnlineMode) {
      socket.emit('c:close');
    } else {
      location.reload();
    }
  });

  sbCloseBtn.addEventListener('click', () => {
    if (isOnlineMode) {
      if (isOnlineHoleOver) {
        isOnlineHoleOver = false;
        scoreboardEl.hidden = true;
        socket.emit('c:nexthole');
      } else {
        socket.emit('c:close');
      }
    } else if (gameSession) {
      const isLast = gameSession.mapIndex >= gameSession.mapList.length - 1;
      scoreboardEl.hidden = true;
      if (isLast) {
        location.reload();
      } else {
        gameSession.mapIndex++;
        loadAndStartMap(gameSession.mapList[gameSession.mapIndex], gameSession.playerNames);
      }
    } else {
      location.reload();
    }
  });

  // ── End screen (local) ────────────────────────────────────────────────────

  function showEndScreen() {
    // Lava penalty: eliminated players get worst-alive score + 3
    const alivePlayers = game.players.filter(p => !p.eliminated);
    const maxStrokes = alivePlayers.length > 0 ? Math.max(...alivePlayers.map(p => p.strokes)) : 0;
    game.players.forEach(p => { if (p.eliminated) p.strokes = maxStrokes + 3; });

    if (gameSession) {
      gameSession.holeScores.push(game.players.map(p => ({ name: p.name, strokes: p.strokes })));
      game.players.forEach(p => { gameSession.scores[p.name] = (gameSession.scores[p.name] ?? 0) + p.strokes; });
      const roundNum   = gameSession.mapIndex + 1;
      const totalRounds = gameSession.mapList.length;
      const isLast     = roundNum >= totalRounds;
      if (isLast) {
        showFinalResults(gameSession.holeScores, true);
      } else {
        const cumPlayers = gameSession.playerNames.map(n => ({ name: n, strokes: gameSession.scores[n] }));
        showScoreboard(cumPlayers, true, `Hole ${roundNum} / ${totalRounds}`, 'Next Hole ▶');
      }
    } else {
      showScoreboard(game.players, true);
    }
  }
})();
