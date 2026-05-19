const Game = (function () {

  function createGame(map, playerNames) {
    const players = playerNames.map((name, i) => ({
      name,
      strokes: 0,
      ball: Physics.createBall(map.startX, map.startY),
      sunk: false,
      started: i === 0,
      strokeOrigin: { x: map.startX, y: map.startY },
    }));
    return { map, players, currentPlayerIndex: 0, over: false };
  }

  function getCurrentPlayer(game) {
    return game.players[game.currentPlayerIndex];
  }

  function getCurrentBall(game) {
    return getCurrentPlayer(game).ball;
  }

  function onShot(game) {
    getCurrentPlayer(game).strokes++;
  }

  function onBallStopped(game) {
    _advanceToNextActive(game);
  }

  function onSink(game) {
    getCurrentPlayer(game).sunk = true;
    if (game.players.every(p => p.sunk)) {
      game.over = true;
      return;
    }
    _advanceToNextActive(game);
  }

  function _advanceToNextActive(game) {
    const n = game.players.length;
    let idx = (game.currentPlayerIndex + 1) % n;
    let tries = 0;
    while (game.players[idx].sunk && tries < n) {
      idx = (idx + 1) % n;
      tries++;
    }
    game.currentPlayerIndex = idx;
    game.players[idx].started = true;
  }

  return { createGame, getCurrentPlayer, getCurrentBall, onShot, onBallStopped, onSink };
})();
