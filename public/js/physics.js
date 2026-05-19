/**
 * Pure physics module — no DOM, importable by Node.js tests and browser alike.
 *
 * Map tile legend:
 *   # = wall (solid square)
 *   . = empty (fairway)
 *   O = hole
 *   S = ball start (parsed away, becomes .)
 *   1 = concave arc, open corner top-left     (arc center at tile bottom-right)
 *   2 = concave arc, open corner top-right    (arc center at tile bottom-left)
 *   3 = concave arc, open corner bottom-left  (arc center at tile top-right)
 *   4 = concave arc, open corner bottom-right (arc center at tile top-left)
 *   5 = convex bump, solid quarter top-left   (arc center at tile bottom-right)
 *   6 = convex bump, solid quarter top-right  (arc center at tile bottom-left)
 *   7 = convex bump, solid quarter bottom-left(arc center at tile top-right)
 *   8 = convex bump, solid quarter bottom-right(arc center at tile top-left)
 *   Place 5,6 / 7,8 in a 2×2 block to form a solid circle obstacle.
 */
const Physics = (function () {

  const TILE_SIZE   = 28;
  const BALL_RADIUS = TILE_SIZE * 3 / 8;   // diameter = 3/4 tile
  const HOLE_RADIUS = 14;   // = TILE_SIZE / 2
  let   FRICTION    = 0.995;
  const MIN_SPEED   = 0.05;
  let   MAX_POWER   = 8;
  let   POWER_SCALE = 0.05;   // px-of-cursor-distance → power unit

  const TILE = {
    EMPTY:      '.',
    WALL:       '#',
    HOLE:       'O',
    START:      'S',
    SAND:       'A',
    SAND_UR:    'a',   // sand fills upper-right triangle
    SAND_LL:    'b',   // sand fills lower-left triangle
    SAND_UL:    'c',   // sand fills upper-left triangle
    SAND_LR:    'd',   // sand fills lower-right triangle
    WATER:           'W',
    WATER_UR:        'e',
    WATER_LL:        'f',
    WATER_UL:        'g',
    WATER_LR:        'h',
    SAND_CURVE_TL:   'm',
    SAND_CURVE_TR:   'n',
    SAND_CURVE_BL:   'o',
    SAND_CURVE_BR:   'p',
    SAND_BUMP_TL:    'q',
    SAND_BUMP_TR:    'r',
    SAND_BUMP_BL:    's',
    SAND_BUMP_BR:    't',
    WATER_CURVE_TL:  'u',
    WATER_CURVE_TR:  'x',
    WATER_CURVE_BL:  'y',
    WATER_CURVE_BR:  'z',
    WATER_BUMP_TL:   'B',
    WATER_BUMP_TR:   'C',
    WATER_BUMP_BL:   'D',
    WATER_BUMP_BR:   'E',
    BOUNCY:     '+',   // bouncy wall (super-elastic restitution)
    STICKY_WALL: '~',  // sticky wall — zeroes normal component, tangential preserved
    SLOPE_U:    '^',   // slope pushing ball upward
    SLOPE_D:    'v',   // slope pushing ball downward
    SLOPE_L:    '<',   // slope pushing ball leftward
    SLOPE_R:    '>',   // slope pushing ball rightward
    WALL_UR:    'i',   // diagonal wall, solid upper-right triangle
    WALL_LL:    'j',   // diagonal wall, solid lower-left triangle
    WALL_UL:    'k',   // diagonal wall, solid upper-left triangle
    WALL_LR:    'l',   // diagonal wall, solid lower-right triangle
    CURVE_TL:   '1',
    CURVE_TR:   '2',
    CURVE_BL:   '3',
    CURVE_BR:   '4',
    BUMP_TL:    '5',
    BUMP_TR:    '6',
    BUMP_BL:    '7',
    BUMP_BR:    '8',
  };

  let   SAND_FRICTION  = 0.92;
  let   SLOPE_FORCE    = 0.018;
  let   BOUNCY_RESTITUTION  = 1.6;
  let   STICKY_RESTITUTION  = 0;
  const SAND_SET  = new Set(['A','a','b','c','d','m','n','o','p','q','r','s','t']);
  const WATER_SET = new Set(['W','e','f','g','h','u','x','y','z','B','C','D','E']);
  const SLOPE_SET = new Set(['^','v','<','>']);

  function isSandTile(t)  { return SAND_SET.has(t);  }
  function isWaterTile(t) { return WATER_SET.has(t); }
  function isSlopeTile(t) { return SLOPE_SET.has(t); }

  // ── Map parsing ───────────────────────────────────────────────────────────

  function parseMap(text) {
    const rows = text.trim().split('\n').map(r => r.split(''));
    let startX = null, startY = null;
    const holes = [];

    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < rows[row].length; col++) {
        const ch = rows[row][col];
        if (ch === 'S') {
          startX = col * TILE_SIZE + TILE_SIZE / 2;
          startY = row * TILE_SIZE + TILE_SIZE / 2;
          rows[row][col] = '.';
        } else if (ch === 'O') {
          holes.push({ x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 });
        }
      }
    }

    return {
      tiles: rows,
      width: rows[0].length,
      height: rows.length,
      startX,
      startY,
      holes,
    };
  }

  // ── Ball lifecycle ────────────────────────────────────────────────────────

  function createBall(x, y) {
    return { x, y, vx: 0, vy: 0, _stuckAge: 0, _minX: x, _maxX: x, _minY: y, _maxY: y };
  }

  function launchBall(ball, cursorX, cursorY) {
    const dx = cursorX - ball.x;
    const dy = cursorY - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const power = Math.min(dist * POWER_SCALE, MAX_POWER);
    ball.vx = (dx / dist) * power;
    ball.vy = (dy / dist) * power;
  }

  function isMoving(ball) {
    return ball.vx !== 0 || ball.vy !== 0;
  }

  // ── Wall collision ────────────────────────────────────────────────────────

  // Coefficient of restitution per wall tile type (reads live tunable vars)
  function wallRestitution(tile) {
    if (tile === TILE.WALL)        return 1.0;
    if (tile === TILE.BOUNCY)      return BOUNCY_RESTITUTION;
    if (tile === TILE.STICKY_WALL) return STICKY_RESTITUTION;
    return undefined;
  }

  function resolveWallCollisions(ball, tiles) {
    const r = BALL_RADIUS;
    const minCol = Math.floor((ball.x - r) / TILE_SIZE);
    const maxCol = Math.floor((ball.x + r) / TILE_SIZE);
    const minRow = Math.floor((ball.y - r) / TILE_SIZE);
    const maxRow = Math.floor((ball.y + r) / TILE_SIZE);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const wallTile    = getTile(tiles, col, row);
        const restitution = wallRestitution(wallTile);
        if (restitution === undefined) continue;

        const left   = col * TILE_SIZE;
        const top    = row * TILE_SIZE;
        const right  = left + TILE_SIZE;
        const bottom = top  + TILE_SIZE;

        const cx = Math.max(left, Math.min(ball.x, right));
        const cy = Math.max(top,  Math.min(ball.y, bottom));
        const dx = ball.x - cx;
        const dy = ball.y - cy;
        const distSq = dx * dx + dy * dy;

        if (distSq >= r * r) continue;

        if (distSq === 0) {
          const dLeft = ball.x - left, dRight = right  - ball.x;
          const dTop  = ball.y - top,  dBottom = bottom - ball.y;
          const min = Math.min(dLeft, dRight, dTop, dBottom);
          let fnx = 0, fny = 0;
          if      (min === dLeft)   { ball.x = left   - r; fnx = -1; }
          else if (min === dRight)  { ball.x = right  + r; fnx = +1; }
          else if (min === dTop)    { ball.y = top    - r; fny = -1; }
          else                      { ball.y = bottom + r; fny = +1; }
          const fdot = ball.vx * fnx + ball.vy * fny;
          if (fdot < 0) {
            if (wallTile === TILE.STICKY_WALL) {
              ball.vx -= fdot * fnx;
              ball.vy -= fdot * fny;
              ball.vx *= STICKY_RESTITUTION;
              ball.vy *= STICKY_RESTITUTION;
            } else {
              ball.vx -= (1 + restitution) * fdot * fnx;
              ball.vy -= (1 + restitution) * fdot * fny;
            }
          }
          continue;
        }

        // Skip ghost corners between adjacent wall-type tiles
        const onCornerX = cx === left || cx === right;
        const onCornerY = cy === top  || cy === bottom;
        if (onCornerX && onCornerY) {
          const adjCol = cx === left ? col - 1 : col + 1;
          const adjRow = cy === top  ? row - 1 : row + 1;
          if (wallRestitution(getTile(tiles, adjCol, row)) !== undefined ||
              wallRestitution(getTile(tiles, col, adjRow)) !== undefined) continue;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        ball.x += nx * (r - dist);
        ball.y += ny * (r - dist);

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          if (wallTile === TILE.STICKY_WALL) {
            ball.vx -= dot * nx;
            ball.vy -= dot * ny;
            ball.vx *= STICKY_RESTITUTION;
            ball.vy *= STICKY_RESTITUTION;
          } else {
            ball.vx -= (1 + restitution) * dot * nx;
            ball.vy -= (1 + restitution) * dot * ny;
          }
        }
      }
    }
  }

  // ── Curve collision ───────────────────────────────────────────────────────
  //
  // Each concave quarter-circle tile has its arc center at one corner of the
  // tile (the "solid" corner). The ball lives in the open quadrant on the
  // opposite side. Collision fires when the ball drifts farther than
  // (TILE_SIZE - BALL_RADIUS) from the arc center, i.e. it is pressing
  // against the curved wall. Normal points outward from the arc center; for a
  // concave surface the ball is moving *away* from center when hitting the
  // wall, so we reflect when dot > 0.
  //
  // Tile → arc center offset & open-quadrant sign:
  //   1 CURVE_TL: center at (tileX+T, tileY+T), open toward (-x, -y)
  //   2 CURVE_TR: center at (tileX,   tileY+T), open toward (+x, -y)
  //   3 CURVE_BL: center at (tileX+T, tileY  ), open toward (-x, +y)
  //   4 CURVE_BR: center at (tileX,   tileY  ), open toward (+x, +y)

  const CURVE_META = {
    [TILE.CURVE_TL]: { ox: 1, oy: 1, sx: -1, sy: -1 },
    [TILE.CURVE_TR]: { ox: 0, oy: 1, sx: +1, sy: -1 },
    [TILE.CURVE_BL]: { ox: 1, oy: 0, sx: -1, sy: +1 },
    [TILE.CURVE_BR]: { ox: 0, oy: 0, sx: +1, sy: +1 },
  };

  // Sand and water curve/bump tiles share collision geometry with wall curves/bumps.
  // Populate after the const definitions below via mutation.

  // ── Diagonal wall metadata ────────────────────────────────────────────────
  // Each entry: outward normal (nx,ny) pointing from wall into fairway.
  // Signed distance from ball to hypotenuse (positive = fairway side) is
  // computed inline in resolveDiagWallCollisions below.
  const DIAG_WALL_META = {
    [TILE.WALL_UR]: { nx: -1 / Math.SQRT2, ny:  1 / Math.SQRT2 },
    [TILE.WALL_LL]: { nx:  1 / Math.SQRT2, ny: -1 / Math.SQRT2 },
    [TILE.WALL_UL]: { nx:  1 / Math.SQRT2, ny:  1 / Math.SQRT2 },
    [TILE.WALL_LR]: { nx: -1 / Math.SQRT2, ny: -1 / Math.SQRT2 },
  };

  // Same center/sign layout as CURVE_META but for convex bumps.
  // Solid fills the arc quadrant; ball bounces off from outside.
  const BUMP_META = {
    [TILE.BUMP_TL]: { ox: 1, oy: 1, sx: -1, sy: -1 },
    [TILE.BUMP_TR]: { ox: 0, oy: 1, sx: +1, sy: -1 },
    [TILE.BUMP_BL]: { ox: 1, oy: 0, sx: -1, sy: +1 },
    [TILE.BUMP_BR]: { ox: 0, oy: 0, sx: +1, sy: +1 },
  };

  // Extend curve/bump meta for sand and water variants (same geometry, different material)
  [
    [TILE.SAND_CURVE_TL, TILE.CURVE_TL], [TILE.SAND_CURVE_TR, TILE.CURVE_TR],
    [TILE.SAND_CURVE_BL, TILE.CURVE_BL], [TILE.SAND_CURVE_BR, TILE.CURVE_BR],
    [TILE.WATER_CURVE_TL, TILE.CURVE_TL], [TILE.WATER_CURVE_TR, TILE.CURVE_TR],
    [TILE.WATER_CURVE_BL, TILE.CURVE_BL], [TILE.WATER_CURVE_BR, TILE.CURVE_BR],
  ].forEach(([t, wt]) => { CURVE_META[t] = CURVE_META[wt]; });
  [
    [TILE.SAND_BUMP_TL, TILE.BUMP_TL], [TILE.SAND_BUMP_TR, TILE.BUMP_TR],
    [TILE.SAND_BUMP_BL, TILE.BUMP_BL], [TILE.SAND_BUMP_BR, TILE.BUMP_BR],
    [TILE.WATER_BUMP_TL, TILE.BUMP_TL], [TILE.WATER_BUMP_TR, TILE.BUMP_TR],
    [TILE.WATER_BUMP_BL, TILE.BUMP_BL], [TILE.WATER_BUMP_BR, TILE.BUMP_BR],
  ].forEach(([t, wt]) => { BUMP_META[t] = BUMP_META[wt]; });

  function resolveCurveCollisions(ball, tiles) {
    const r = BALL_RADIUS;
    const T = TILE_SIZE;
    const minCol = Math.floor((ball.x - r) / T);
    const maxCol = Math.floor((ball.x + r) / T);
    const minRow = Math.floor((ball.y - r) / T);
    const maxRow = Math.floor((ball.y + r) / T);

    // Deduplicate by arc center: 2×2 blocks share one center and must push only once
    const seen = new Set();

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = getTile(tiles, col, row);
        const meta = CURVE_META[tile];
        if (!meta) continue;

        const tileX = col * T;
        const tileY = row * T;
        const ax = tileX + meta.ox * T;
        const ay = tileY + meta.oy * T;

        const dx = ball.x - ax;
        const dy = ball.y - ay;

        // Skip if ball is clearly outside the open quadrant (strict < 0 keeps
        // the seam at dx=0 / dy=0 alive so tile boundaries don't create gaps)
        if (dx * meta.sx < 0 || dy * meta.sy < 0) continue;

        const key = ax + ',' + ay;
        if (seen.has(key)) continue;
        seen.add(key);

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        const overlap = dist - (T - r);
        if (overlap <= 0) continue;

        const nx = dx / dist;
        const ny = dy / dist;

        ball.x -= nx * overlap;
        ball.y -= ny * overlap;

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot > 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
      }
    }
  }

  // ── Bump collision ────────────────────────────────────────────────────────
  //
  // Convex quarter-circle: solid fills one quadrant with arc radius T.
  // Ball (radius r) must stay at distance ≥ T from the arc center when in the
  // solid quadrant. Trigger fires when dist < T + r; normal points outward.
  // Reflect when ball is moving toward the center (dot < 0).

  function resolveBumpCollisions(ball, tiles) {
    const r = BALL_RADIUS;
    const T = TILE_SIZE;
    const triggerDist = T + r;
    const minCol = Math.floor((ball.x - r) / T);
    const maxCol = Math.floor((ball.x + r) / T);
    const minRow = Math.floor((ball.y - r) / T);
    const maxRow = Math.floor((ball.y + r) / T);

    const seen = new Set();

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = getTile(tiles, col, row);
        const meta = BUMP_META[tile];
        if (!meta) continue;

        const ax = col * T + meta.ox * T;
        const ay = row * T + meta.oy * T;
        const dx = ball.x - ax;
        const dy = ball.y - ay;

        if (dx * meta.sx < 0 || dy * meta.sy < 0) continue;

        const key = ax + ',' + ay;
        if (seen.has(key)) continue;
        seen.add(key);

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0 || dist >= triggerDist) continue;

        const nx = dx / dist;
        const ny = dy / dist;

        ball.x += nx * (triggerDist - dist);
        ball.y += ny * (triggerDist - dist);

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
      }
    }
  }

  // ── Diagonal wall collision ───────────────────────────────────────────────
  //
  // Hypotenuse normals (fairway-pointing):
  //   WALL_UR / WALL_LL share the TL→BR diagonal; WALL_UL / WALL_LR share TR→BL.
  // Signed distance d (positive = fairway side):
  //   UR:  (py − px) / √2
  //   LL:  (px − py) / √2
  //   UL:  (px + py − T) / √2
  //   LR:  (T − px − py) / √2
  // Collision when d < BALL_RADIUS.

  function resolveDiagWallCollisions(ball, tiles) {
    const r  = BALL_RADIUS;
    const T  = TILE_SIZE;
    const S2 = Math.SQRT2;
    const minCol = Math.floor((ball.x - r) / T);
    const maxCol = Math.floor((ball.x + r) / T);
    const minRow = Math.floor((ball.y - r) / T);
    const maxRow = Math.floor((ball.y + r) / T);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = getTile(tiles, col, row);
        const meta = DIAG_WALL_META[tile];
        if (!meta) continue;

        const px = ball.x - col * T;
        const py = ball.y - row * T;

        let d;
        if      (tile === TILE.WALL_UR) d = (py - px) / S2;
        else if (tile === TILE.WALL_LL) d = (px - py) / S2;
        else if (tile === TILE.WALL_UL) d = (px + py - T) / S2;
        else                            d = (T - px - py) / S2;

        if (d >= r) continue;

        const { nx, ny } = meta;
        const overlap = r - d;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
      }
    }
  }

  // ── Physics step ──────────────────────────────────────────────────────────

  // tiles is optional; pass map.tiles to enable wall & curve collisions.
  function updateBall(ball, tiles) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (tiles) {
      resolveWallCollisions(ball, tiles);
      resolveCurveCollisions(ball, tiles);
      resolveBumpCollisions(ball, tiles);
      resolveDiagWallCollisions(ball, tiles);
    }

    const curTile = tiles ? tileAt(tiles, ball.x, ball.y) : null;
    const f = (curTile && isSandTile(curTile)) ? FRICTION * SAND_FRICTION : FRICTION;
    ball.vx *= f;
    ball.vy *= f;

    if      (curTile === TILE.SLOPE_U) ball.vy -= SLOPE_FORCE;
    else if (curTile === TILE.SLOPE_D) ball.vy += SLOPE_FORCE;
    else if (curTile === TILE.SLOPE_L) ball.vx -= SLOPE_FORCE;
    else if (curTile === TILE.SLOPE_R) ball.vx += SLOPE_FORCE;

    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed < MIN_SPEED && !isSlopeTile(curTile)) {
      ball.vx = 0;
      ball.vy = 0;
    }

    // Stuck detection: track the bounding box of travel over a rolling window.
    // A stuck ball (slope-vs-wall, bouncy loop) stays in a tiny region; a
    // legitimately moving or bouncing ball sweeps through real space.
    if (ball.vx !== 0 || ball.vy !== 0) {
      ball._stuckAge++;
      if (ball.x < ball._minX) ball._minX = ball.x;
      if (ball.x > ball._maxX) ball._maxX = ball.x;
      if (ball.y < ball._minY) ball._minY = ball.y;
      if (ball.y > ball._maxY) ball._maxY = ball.y;
      if (ball._stuckAge >= 90) {
        if (ball._maxX - ball._minX < 5 && ball._maxY - ball._minY < 5) {
          ball.vx = 0;
          ball.vy = 0;
        }
        ball._minX = ball._maxX = ball.x;
        ball._minY = ball._maxY = ball.y;
        ball._stuckAge = 0;
      }
    } else {
      ball._minX = ball._maxX = ball.x;
      ball._minY = ball._maxY = ball.y;
      ball._stuckAge = 0;
    }
  }

  // ── Ball-to-ball collision ────────────────────────────────────────────────

  function resolveBallCollisions(players) {
    const minDist = BALL_RADIUS * 2;
    for (let i = 0; i < players.length; i++) {
      const pi = players[i];
      if (pi.sunk || !pi.started) continue;
      for (let j = i + 1; j < players.length; j++) {
        const pj = players[j];
        if (pj.sunk || !pj.started) continue;

        const a = pi.ball;
        const b = pj.ball;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist || distSq === 0) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlapping balls equally
        const half = (minDist - dist) / 2;
        a.x -= nx * half;
        a.y -= ny * half;
        b.x += nx * half;
        b.y += ny * half;

        // Elastic collision, equal mass: exchange normal velocity components
        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          a.vx -= dot * nx;
          a.vy -= dot * ny;
          b.vx += dot * nx;
          b.vy += dot * ny;
        }
      }
    }
  }

  // ── Hole detection ────────────────────────────────────────────────────────

  function checkHole(ball, holes) {
    for (const hole of holes) {
      const dx = ball.x - hole.x;
      const dy = ball.y - hole.y;
      if (dx * dx + dy * dy < HOLE_RADIUS * HOLE_RADIUS) return hole;
    }
    return null;
  }

  // ── Tile helpers ──────────────────────────────────────────────────────────

  function getTile(tiles, col, row) {
    if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) return TILE.WALL;
    return tiles[row][col];
  }

  function tileAt(tiles, worldX, worldY) {
    return getTile(tiles, Math.floor(worldX / TILE_SIZE), Math.floor(worldY / TILE_SIZE));
  }

  return {
    TILE_SIZE, BALL_RADIUS, HOLE_RADIUS, MIN_SPEED,
    get MAX_POWER()           { return MAX_POWER;           }, set MAX_POWER(v)           { MAX_POWER           = v; },
    get POWER_SCALE()         { return POWER_SCALE;         }, set POWER_SCALE(v)         { POWER_SCALE         = v; },
    get FRICTION()            { return FRICTION;            }, set FRICTION(v)            { FRICTION            = v; },
    get SAND_FRICTION()       { return SAND_FRICTION;       }, set SAND_FRICTION(v)       { SAND_FRICTION       = v; },
    get BOUNCY_RESTITUTION()  { return BOUNCY_RESTITUTION;  }, set BOUNCY_RESTITUTION(v)  { BOUNCY_RESTITUTION  = v; },
    get STICKY_RESTITUTION()  { return STICKY_RESTITUTION;  }, set STICKY_RESTITUTION(v)  { STICKY_RESTITUTION  = v; },
    get SLOPE_FORCE()         { return SLOPE_FORCE;         }, set SLOPE_FORCE(v)         { SLOPE_FORCE         = v; },
    TILE,
    isSandTile, isWaterTile, isSlopeTile,
    parseMap,
    createBall, launchBall, isMoving, updateBall,
    resolveWallCollisions, resolveCurveCollisions, CURVE_META,
    resolveBumpCollisions, BUMP_META,
    resolveDiagWallCollisions, DIAG_WALL_META,
    resolveBallCollisions,
    checkHole,
    getTile, tileAt,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Physics;
}
