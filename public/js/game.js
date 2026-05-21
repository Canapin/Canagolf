const Game = (function () {

  function createGame(map, playerNames) {
    const players = playerNames.map((name, i) => ({
      name,
      strokes: 0,
      ball: Physics.createBall(map.startX, map.startY),
      sunk: false,
      eliminated: false,
      started: i === 0,
      strokeOrigin: { x: map.startX, y: map.startY },
    }));
    return { map, players, currentPlayerIndex: 0, over: false, turnActive: false };
  }

  function getCurrentPlayer(game) {
    return game.players[game.currentPlayerIndex];
  }

  function getCurrentBall(game) {
    return getCurrentPlayer(game).ball;
  }

  function onShot(game) {
    getCurrentPlayer(game).strokes++;
    game.turnActive = true;
  }

  function onBallStopped(game) {
    game.turnActive = false;
    _advanceToNextActive(game);
  }

  function onSink(game) {
    game.turnActive = false;
    getCurrentPlayer(game).sunk = true;
    if (game.players.every(p => p.sunk || p.eliminated)) { game.over = true; return; }
    _advanceToNextActive(game);
  }

  function onEliminated(game) {
    game.turnActive = false;
    const p = getCurrentPlayer(game);
    p.eliminated = true;
    p.ball.vx = 0; p.ball.vy = 0;
    if (game.players.every(p => p.sunk || p.eliminated)) { game.over = true; return; }
    _advanceToNextActive(game);
  }

  function _advanceToNextActive(game) {
    game.players[game.currentPlayerIndex].ball._tpUsedPairs.clear();
    game.players.forEach(p => {
      if (p.waterPending && p.waterRespawnPos) {
        p.ball.x = p.waterRespawnPos.x; p.ball.y = p.waterRespawnPos.y;
        p.ball.vx = 0; p.ball.vy = 0;
        p.waterPending = false; p.waterRespawnPos = null;
      }
    });
    const n = game.players.length;
    let idx = (game.currentPlayerIndex + 1) % n;
    let tries = 0;
    while ((game.players[idx].sunk || game.players[idx].eliminated) && tries < n) {
      idx = (idx + 1) % n;
      tries++;
    }
    game.currentPlayerIndex = idx;
    game.players[idx].started = true;
  }

  return { createGame, getCurrentPlayer, getCurrentBall, onShot, onBallStopped, onSink, onEliminated };
})();
