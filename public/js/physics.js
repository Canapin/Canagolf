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
  const TILE_SIZE = 28;
  const BALL_RADIUS = (TILE_SIZE * 3) / 8; // diameter = 3/4 tile
  let HOLE_SINK_RADIUS = 3; // ball disappears within this distance from hole center
  let HOLE_GRAVITY_OUTER = TILE_SIZE / 2; // outer boundary of gravitational pull (edge of tile)
  let HOLE_GRAVITY_FORCE = 0.4; // max pull strength (px/frame²) at inner edge
  let FRICTION = 0.995;
  const MIN_SPEED = 0.05;
  let MAX_POWER = 6;
  let POWER_SCALE = 0.05; // px-of-cursor-distance → power unit
  const POWER_EXP = 1.5; // exponent for power curve (>1 = finer at short range)

  const TILE = {
    EMPTY: ".",
    WALL: "#",
    HOLE: "O",
    START: "S",
    SAND: "A",
    SAND_UR: "a", // sand fills upper-right triangle
    SAND_LL: "b", // sand fills lower-left triangle
    SAND_UL: "c", // sand fills upper-left triangle
    SAND_LR: "d", // sand fills lower-right triangle
    WATER: "W",
    WATER_UR: "e",
    WATER_LL: "f",
    WATER_UL: "g",
    WATER_LR: "h",
    SAND_CURVE_TL: "m",
    SAND_CURVE_TR: "n",
    SAND_CURVE_BL: "o",
    SAND_CURVE_BR: "p",
    SAND_BUMP_TL: "q",
    SAND_BUMP_TR: "r",
    SAND_BUMP_BL: "s",
    SAND_BUMP_BR: "t",
    WATER_CURVE_TL: "u",
    WATER_CURVE_TR: "x",
    WATER_CURVE_BL: "y",
    WATER_CURVE_BR: "z",
    WATER_BUMP_TL: "B",
    WATER_BUMP_TR: "C",
    WATER_BUMP_BL: "D",
    WATER_BUMP_BR: "E",
    BOUNCY: "+", // bouncy wall (super-elastic restitution)
    STICKY_WALL: "~", // sticky wall — zeroes normal component, tangential preserved
    SLOPE_U: "^", // slope pushing ball upward
    SLOPE_D: "v", // slope pushing ball downward
    SLOPE_L: "<", // slope pushing ball leftward
    SLOPE_R: ">", // slope pushing ball rightward
    SLOPE_UL: "F", // slope pushing ball up-left
    SLOPE_UR: "G", // slope pushing ball up-right
    SLOPE_DL: "H", // slope pushing ball down-left
    SLOPE_DR: "I", // slope pushing ball down-right
    GHOST_R: "J", // one-way wall: ball passes going right, blocks going left
    GHOST_L: "K", // one-way wall: ball passes going left
    GHOST_U: "L", // one-way wall: ball passes going up
    GHOST_D: "M", // one-way wall: ball passes going down
    WALL_UR: "i", // diagonal wall, solid upper-right triangle
    WALL_LL: "j", // diagonal wall, solid lower-left triangle
    WALL_UL: "k", // diagonal wall, solid upper-left triangle
    WALL_LR: "l", // diagonal wall, solid lower-right triangle
    CURVE_TL: "1",
    CURVE_TR: "2",
    CURVE_BL: "3",
    CURVE_BR: "4",
    BUMP_TL: "5",
    BUMP_TR: "6",
    BUMP_BL: "7",
    BUMP_BR: "8",
    // Bouncy variants of diagonal / curve / bump walls
    BOUNCY_WALL_UR: "N",
    BOUNCY_WALL_LL: "P",
    BOUNCY_WALL_UL: "Q",
    BOUNCY_WALL_LR: "R",
    BOUNCY_CURVE_TL: "T",
    BOUNCY_CURVE_TR: "U",
    BOUNCY_CURVE_BL: "V",
    BOUNCY_CURVE_BR: "X",
    BOUNCY_BUMP_TL: "Y",
    BOUNCY_BUMP_TR: "Z",
    BOUNCY_BUMP_BL: "0",
    BOUNCY_BUMP_BR: "9",
    // Sticky variants of diagonal / curve / bump walls
    STICKY_WALL_UR: "(",
    STICKY_WALL_LL: ")",
    STICKY_WALL_UL: "[",
    STICKY_WALL_LR: "]",
    STICKY_CURVE_TL: "{",
    STICKY_CURVE_TR: "}",
    STICKY_CURVE_BL: "@",
    STICKY_CURVE_BR: "$",
    STICKY_BUMP_TL: "%",
    STICKY_BUMP_TR: "&",
    STICKY_BUMP_BL: "*",
    STICKY_BUMP_BR: "_",
    // Special surface tiles
    LAVA: "w", // like water, but player is eliminated (no respawn)
    LAVA_DIAG_UR: "'",
    LAVA_DIAG_LL: ":",
    LAVA_DIAG_UL: "`",
    LAVA_DIAG_LR: '"',
    LAVA_CURVE_TL: "Ā",
    LAVA_CURVE_TR: "ā",
    LAVA_CURVE_BL: "Ă",
    LAVA_CURVE_BR: "ă",
    LAVA_BUMP_TL: "Ą",
    LAVA_BUMP_TR: "ą",
    LAVA_BUMP_BL: "Ć",
    LAVA_BUMP_BR: "ć",
    TELEPORTER: "=", // teleporter pair 1 (purple)
    TELEPORTER_B: "|", // teleporter pair 2 (cyan)
    TELEPORTER_C: "/", // teleporter pair 3 (gold)
    SWAP: "?", // ball swaps position with a random opponent's ball and stops
    // One-way walls — diagonal (complement GHOST_R/L/U/D for 8-direction coverage)
    PHANTOM_UR: "-", // passes if ball moves up-right (vx>0 && vy<0)
    PHANTOM_UL: "!", // passes if ball moves up-left
    PHANTOM_DR: ",", // passes if ball moves down-right
    PHANTOM_DL: ";", // passes if ball moves down-left
    CIRCLE_WALL: "\\", // circular wall obstacle (full circle, radius = half tile)
  };

  let SAND_FRICTION = 0.96;
  let SLOPE_FORCE = 0.018;
  let SLOPE_ROLL_FRICTION = 0.99; // no rolling resistance on slopes — force accumulates each frame
  let BALL_RESTITUTION = 0.5; // ball-to-ball CoR: 0=inelastic (merge), 1=elastic (full exchange)
  let BALL_FRICTION = 0.3; // ball-to-ball tangential friction (Coulomb μ)
  let BOUNCY_RESTITUTION = 1.5;
  let STICKY_RESTITUTION = 0.1;
  const SAND_SET = new Set([
    "A",
    "a",
    "b",
    "c",
    "d",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
  ]);
  const WATER_SET = new Set([
    "W",
    "e",
    "f",
    "g",
    "h",
    "u",
    "x",
    "y",
    "z",
    "B",
    "C",
    "D",
    "E",
  ]);
  const SLOPE_SET = new Set(["^", "v", "<", ">", "F", "G", "H", "I"]);
  const BOUNCY_TILES = new Set([
    "N",
    "P",
    "Q",
    "R",
    "T",
    "U",
    "V",
    "X",
    "Y",
    "Z",
    "0",
    "9",
    "+",
  ]);
  const STICKY_TILES = new Set([
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "@",
    "$",
    "%",
    "&",
    "*",
    "_",
    "~",
  ]);
  const PHANTOM_TILES = new Set(["-", "!", ",", ";"]);
  const LAVA_SET = new Set([
    "w",
    "'",
    ":",
    "`",
    '"',
    "Ā",
    "ā",
    "Ă",
    "ă",
    "Ą",
    "ą",
    "Ć",
    "ć",
  ]);
  const WALL_CHARS_SET = new Set([
    "#",
    "+",
    "~",
    "i",
    "j",
    "k",
    "l",
    "N",
    "P",
    "Q",
    "R",
    "(",
    ")",
    "[",
    "]",
    "1",
    "2",
    "3",
    "4",
    "T",
    "U",
    "V",
    "X",
    "{",
    "}",
    "@",
    "$",
    "5",
    "6",
    "7",
    "8",
    "Y",
    "Z",
    "0",
    "9",
    "%",
    "&",
    "*",
    "_",
    "J",
    "K",
    "L",
    "M",
    "-",
    "!",
    ",",
    ";",
    "\\",
  ]);

  function isSandTile(t) {
    return SAND_SET.has(t);
  }
  function isWaterTile(t) {
    return WATER_SET.has(t);
  }
  function isLavaTile(t) {
    return LAVA_SET.has(t);
  }
  function isSwapTile(t) {
    return t === TILE.SWAP;
  }
  function isSlopeTile(t) {
    return SLOPE_SET.has(t);
  }

  // ── Map parsing ───────────────────────────────────────────────────────────

  function parseMap(input) {
    let ground, walls;

    if (input.trim().startsWith("{")) {
      const data = JSON.parse(input);
      ground = data.ground.map((r) => r.split(""));
      walls = data.walls.map((r) => r.split(""));
    } else {
      const rows = input
        .trim()
        .split("\n")
        .map((r) => r.split(""));
      ground = rows.map((row) =>
        row.map((ch) => (WALL_CHARS_SET.has(ch) ? "." : ch)),
      );
      walls = rows.map((row) =>
        row.map((ch) => (WALL_CHARS_SET.has(ch) ? ch : ".")),
      );
    }

    let startX = null,
      startY = null;
    const holes = [];
    const tpByType = {};
    const TP_CHARS = new Set([
      TILE.TELEPORTER,
      TILE.TELEPORTER_B,
      TILE.TELEPORTER_C,
    ]);

    for (let row = 0; row < ground.length; row++) {
      for (let col = 0; col < ground[row].length; col++) {
        const ch = ground[row][col];
        if (ch === "S") {
          startX = col * TILE_SIZE + TILE_SIZE / 2;
          startY = row * TILE_SIZE + TILE_SIZE / 2;
          ground[row][col] = ".";
        } else if (ch === TILE.HOLE) {
          holes.push({
            x: col * TILE_SIZE + TILE_SIZE / 2,
            y: row * TILE_SIZE + TILE_SIZE / 2,
          });
        } else if (TP_CHARS.has(ch)) {
          const tp = {
            col,
            row,
            x: col * TILE_SIZE + TILE_SIZE / 2,
            y: row * TILE_SIZE + TILE_SIZE / 2,
          };
          (tpByType[ch] = tpByType[ch] || []).push(tp);
        }
      }
    }
    const teleporterPairs = [];
    Object.values(tpByType).forEach((tiles) => {
      for (let i = 0; i + 1 < tiles.length; i += 2)
        teleporterPairs.push([tiles[i], tiles[i + 1]]);
    });

    return {
      ground,
      walls,
      tiles: walls,
      width: (ground[0] || []).length,
      height: ground.length,
      startX,
      startY,
      holes,
      teleporterPairs,
    };
  }

  // ── Ball lifecycle ────────────────────────────────────────────────────────

  function createBall(x, y) {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      _stuckAge: 0,
      _minX: x,
      _maxX: x,
      _minY: y,
      _maxY: y,
      _wasOnTp: false,
      _wasOnSwap: false,
      _tpUsedPairs: new Set(),
    };
  }

  function launchBall(ball, cursorX, cursorY) {
    const dx = cursorX - ball.x;
    const dy = cursorY - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < BALL_RADIUS) return;
    const eff = dist - BALL_RADIUS;
    const maxDist = MAX_POWER / POWER_SCALE;
    const t = Math.min(eff / maxDist, 1);
    const power = MAX_POWER * Math.pow(t, POWER_EXP);
    ball.vx = -(dx / dist) * power;
    ball.vy = -(dy / dist) * power;
  }

  function isMoving(ball) {
    return ball.vx !== 0 || ball.vy !== 0;
  }

  // ── Wall collision ────────────────────────────────────────────────────────

  // Coefficient of restitution per wall tile type (reads live tunable vars)
  function wallRestitution(tile) {
    if (tile === TILE.WALL) return 1.0;
    if (tile === TILE.BOUNCY) return BOUNCY_RESTITUTION;
    if (tile === TILE.STICKY_WALL) return STICKY_RESTITUTION;
    if (
      tile === TILE.GHOST_R ||
      tile === TILE.GHOST_L ||
      tile === TILE.GHOST_U ||
      tile === TILE.GHOST_D
    )
      return 1.0;
    if (PHANTOM_TILES.has(tile)) return 1.0;
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
        const wallTile = getTile(tiles, col, row);
        const restitution = wallRestitution(wallTile);
        if (restitution === undefined) continue;

        // Ghost/phantom walls: skip collision when ball moves in the allowed direction
        if (wallTile === TILE.GHOST_R && ball.vx > 0) continue;
        if (wallTile === TILE.GHOST_L && ball.vx < 0) continue;
        if (wallTile === TILE.GHOST_U && ball.vy < 0) continue;
        if (wallTile === TILE.GHOST_D && ball.vy > 0) continue;
        if (wallTile === TILE.PHANTOM_UR && ball.vx > 0 && ball.vy < 0)
          continue;
        if (wallTile === TILE.PHANTOM_UL && ball.vx < 0 && ball.vy < 0)
          continue;
        if (wallTile === TILE.PHANTOM_DR && ball.vx > 0 && ball.vy > 0)
          continue;
        if (wallTile === TILE.PHANTOM_DL && ball.vx < 0 && ball.vy > 0)
          continue;

        const left = col * TILE_SIZE;
        const top = row * TILE_SIZE;
        const right = left + TILE_SIZE;
        const bottom = top + TILE_SIZE;

        const cx = Math.max(left, Math.min(ball.x, right));
        const cy = Math.max(top, Math.min(ball.y, bottom));
        const dx = ball.x - cx;
        const dy = ball.y - cy;
        const distSq = dx * dx + dy * dy;

        if (distSq >= r * r) continue;

        if (distSq === 0) {
          const dLeft = ball.x - left,
            dRight = right - ball.x;
          const dTop = ball.y - top,
            dBottom = bottom - ball.y;
          const min = Math.min(dLeft, dRight, dTop, dBottom);
          let fnx = 0,
            fny = 0;
          if (min === dLeft) {
            ball.x = left - r;
            fnx = -1;
          } else if (min === dRight) {
            ball.x = right + r;
            fnx = +1;
          } else if (min === dTop) {
            ball.y = top - r;
            fny = -1;
          } else {
            ball.y = bottom + r;
            fny = +1;
          }
          const fdot = ball.vx * fnx + ball.vy * fny;
          if (fdot < 0) {
            ball.vx -= 2 * fdot * fnx;
            ball.vy -= 2 * fdot * fny;
            ball.vx *= restitution;
            ball.vy *= restitution;
          }
          continue;
        }

        // Skip ghost corners between adjacent wall-type tiles
        const onCornerX = cx === left || cx === right;
        const onCornerY = cy === top || cy === bottom;
        if (onCornerX && onCornerY) {
          const adjCol = cx === left ? col - 1 : col + 1;
          const adjRow = cy === top ? row - 1 : row + 1;
          if (
            wallRestitution(getTile(tiles, adjCol, row)) !== undefined ||
            wallRestitution(getTile(tiles, col, adjRow)) !== undefined
          )
            continue;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        ball.x += nx * (r - dist);
        ball.y += ny * (r - dist);

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
          ball.vx *= restitution;
          ball.vy *= restitution;
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
    [TILE.WALL_UR]: { nx: -1 / Math.SQRT2, ny: 1 / Math.SQRT2, shape: "UR" },
    [TILE.WALL_LL]: { nx: 1 / Math.SQRT2, ny: -1 / Math.SQRT2, shape: "LL" },
    [TILE.WALL_UL]: { nx: 1 / Math.SQRT2, ny: 1 / Math.SQRT2, shape: "UL" },
    [TILE.WALL_LR]: { nx: -1 / Math.SQRT2, ny: -1 / Math.SQRT2, shape: "LR" },
  };
  [
    [TILE.BOUNCY_WALL_UR, TILE.WALL_UR],
    [TILE.BOUNCY_WALL_LL, TILE.WALL_LL],
    [TILE.BOUNCY_WALL_UL, TILE.WALL_UL],
    [TILE.BOUNCY_WALL_LR, TILE.WALL_LR],
    [TILE.STICKY_WALL_UR, TILE.WALL_UR],
    [TILE.STICKY_WALL_LL, TILE.WALL_LL],
    [TILE.STICKY_WALL_UL, TILE.WALL_UL],
    [TILE.STICKY_WALL_LR, TILE.WALL_LR],
  ].forEach(([t, wt]) => {
    DIAG_WALL_META[t] = DIAG_WALL_META[wt];
  });

  // Same center/sign layout as CURVE_META but for convex bumps.
  // Solid fills the arc quadrant; ball bounces off from outside.
  const BUMP_META = {
    [TILE.BUMP_TL]: { ox: 1, oy: 1, sx: -1, sy: -1 },
    [TILE.BUMP_TR]: { ox: 0, oy: 1, sx: +1, sy: -1 },
    [TILE.BUMP_BL]: { ox: 1, oy: 0, sx: -1, sy: +1 },
    [TILE.BUMP_BR]: { ox: 0, oy: 0, sx: +1, sy: +1 },
  };

  // Extend curve/bump meta for sand, water, bouncy and sticky variants
  [
    [TILE.SAND_CURVE_TL, TILE.CURVE_TL],
    [TILE.SAND_CURVE_TR, TILE.CURVE_TR],
    [TILE.SAND_CURVE_BL, TILE.CURVE_BL],
    [TILE.SAND_CURVE_BR, TILE.CURVE_BR],
    [TILE.WATER_CURVE_TL, TILE.CURVE_TL],
    [TILE.WATER_CURVE_TR, TILE.CURVE_TR],
    [TILE.WATER_CURVE_BL, TILE.CURVE_BL],
    [TILE.WATER_CURVE_BR, TILE.CURVE_BR],
    [TILE.BOUNCY_CURVE_TL, TILE.CURVE_TL],
    [TILE.BOUNCY_CURVE_TR, TILE.CURVE_TR],
    [TILE.BOUNCY_CURVE_BL, TILE.CURVE_BL],
    [TILE.BOUNCY_CURVE_BR, TILE.CURVE_BR],
    [TILE.STICKY_CURVE_TL, TILE.CURVE_TL],
    [TILE.STICKY_CURVE_TR, TILE.CURVE_TR],
    [TILE.STICKY_CURVE_BL, TILE.CURVE_BL],
    [TILE.STICKY_CURVE_BR, TILE.CURVE_BR],
    [TILE.LAVA_CURVE_TL, TILE.CURVE_TL],
    [TILE.LAVA_CURVE_TR, TILE.CURVE_TR],
    [TILE.LAVA_CURVE_BL, TILE.CURVE_BL],
    [TILE.LAVA_CURVE_BR, TILE.CURVE_BR],
  ].forEach(([t, wt]) => {
    CURVE_META[t] = CURVE_META[wt];
  });
  [
    [TILE.SAND_BUMP_TL, TILE.BUMP_TL],
    [TILE.SAND_BUMP_TR, TILE.BUMP_TR],
    [TILE.SAND_BUMP_BL, TILE.BUMP_BL],
    [TILE.SAND_BUMP_BR, TILE.BUMP_BR],
    [TILE.WATER_BUMP_TL, TILE.BUMP_TL],
    [TILE.WATER_BUMP_TR, TILE.BUMP_TR],
    [TILE.WATER_BUMP_BL, TILE.BUMP_BL],
    [TILE.WATER_BUMP_BR, TILE.BUMP_BR],
    [TILE.BOUNCY_BUMP_TL, TILE.BUMP_TL],
    [TILE.BOUNCY_BUMP_TR, TILE.BUMP_TR],
    [TILE.BOUNCY_BUMP_BL, TILE.BUMP_BL],
    [TILE.BOUNCY_BUMP_BR, TILE.BUMP_BR],
    [TILE.STICKY_BUMP_TL, TILE.BUMP_TL],
    [TILE.STICKY_BUMP_TR, TILE.BUMP_TR],
    [TILE.STICKY_BUMP_BL, TILE.BUMP_BL],
    [TILE.STICKY_BUMP_BR, TILE.BUMP_BR],
    [TILE.LAVA_BUMP_TL, TILE.BUMP_TL],
    [TILE.LAVA_BUMP_TR, TILE.BUMP_TR],
    [TILE.LAVA_BUMP_BL, TILE.BUMP_BL],
    [TILE.LAVA_BUMP_BR, TILE.BUMP_BR],
  ].forEach(([t, wt]) => {
    BUMP_META[t] = BUMP_META[wt];
  });

  function bounceVelocity(ball, nx, ny, dot, tile) {
    const e = STICKY_TILES.has(tile)
      ? STICKY_RESTITUTION
      : BOUNCY_TILES.has(tile)
        ? BOUNCY_RESTITUTION
        : 1.0;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
    ball.vx *= e;
    ball.vy *= e;
  }

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

        const key = ax + "," + ay;
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
        if (dot > 0) bounceVelocity(ball, nx, ny, dot, tile);
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

        const key = ax + "," + ay;
        if (seen.has(key)) continue;
        seen.add(key);

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0 || dist >= triggerDist) continue;

        const nx = dx / dist;
        const ny = dy / dist;

        ball.x += nx * (triggerDist - dist);
        ball.y += ny * (triggerDist - dist);

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) bounceVelocity(ball, nx, ny, dot, tile);
      }
    }
  }

  // ── Circle wall collision ─────────────────────────────────────────────────
  //
  // The CIRCLE_WALL tile is a solid circle of radius T/2 centered in the tile.
  // Ball (radius BALL_RADIUS) collides when dist(centers) < T/2 + BALL_RADIUS.

  function resolveCircleWallCollisions(ball, wallsGrid) {
    const T = TILE_SIZE,
      r = BALL_RADIUS;
    const minDist = T / 2 + r;
    const col0 = Math.max(0, Math.floor((ball.x - minDist) / T));
    const col1 = Math.min(
      wallsGrid[0].length - 1,
      Math.floor((ball.x + minDist) / T),
    );
    const row0 = Math.max(0, Math.floor((ball.y - minDist) / T));
    const row1 = Math.min(
      wallsGrid.length - 1,
      Math.floor((ball.y + minDist) / T),
    );
    for (let row = row0; row <= row1; row++) {
      for (let col = col0; col <= col1; col++) {
        if (wallsGrid[row][col] !== TILE.CIRCLE_WALL) continue;
        const cx = col * T + T / 2,
          cy = row * T + T / 2;
        const dx = ball.x - cx,
          dy = ball.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0 || dist >= minDist) continue;
        const nx = dx / dist,
          ny = dy / dist;
        ball.x = cx + nx * minDist;
        ball.y = cy + ny * minDist;
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
    const r = BALL_RADIUS,
      T = TILE_SIZE;
    const DIAG_TRI = {
      UR: [
        [0, 0],
        [T, 0],
        [T, T],
      ],
      LL: [
        [0, 0],
        [0, T],
        [T, T],
      ],
      UL: [
        [0, 0],
        [T, 0],
        [0, T],
      ],
      LR: [
        [T, 0],
        [0, T],
        [T, T],
      ],
    };
    const minCol = Math.floor((ball.x - r) / T);
    const maxCol = Math.floor((ball.x + r) / T);
    const minRow = Math.floor((ball.y - r) / T);
    const maxRow = Math.floor((ball.y + r) / T);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = getTile(tiles, col, row);
        const meta = DIAG_WALL_META[tile];
        if (!meta) continue;

        const bx = ball.x - col * T;
        const by = ball.y - row * T;
        const [[ax, ay], [vx, vy], [wx, wy]] = DIAG_TRI[meta.shape];

        function seg(p0x, p0y, p1x, p1y) {
          const dx = p1x - p0x,
            dy = p1y - p0y,
            lenSq = dx * dx + dy * dy;
          if (lenSq === 0) return [p0x, p0y];
          const t = Math.max(
            0,
            Math.min(1, ((bx - p0x) * dx + (by - p0y) * dy) / lenSq),
          );
          return [p0x + t * dx, p0y + t * dy];
        }

        const c1 = (vx - ax) * (by - ay) - (vy - ay) * (bx - ax);
        const c2 = (wx - vx) * (by - vy) - (wy - vy) * (bx - vx);
        const c3 = (ax - wx) * (by - wy) - (ay - wy) * (bx - wx);
        const inside = !(
          (c1 < 0 || c2 < 0 || c3 < 0) &&
          (c1 > 0 || c2 > 0 || c3 > 0)
        );

        let nx, ny, overlap;

        if (inside) {
          nx = meta.nx;
          ny = meta.ny;
          const S2 = Math.SQRT2;
          const d =
            meta.shape === "UR"
              ? (by - bx) / S2
              : meta.shape === "LL"
                ? (bx - by) / S2
                : meta.shape === "UL"
                  ? (bx + by - T) / S2
                  : (T - bx - by) / S2;
          overlap = r - d;
        } else {
          const [e1x, e1y] = seg(ax, ay, vx, vy);
          const [e2x, e2y] = seg(vx, vy, wx, wy);
          const [e3x, e3y] = seg(wx, wy, ax, ay);
          const s1 = (bx - e1x) ** 2 + (by - e1y) ** 2;
          const s2 = (bx - e2x) ** 2 + (by - e2y) ** 2;
          const s3 = (bx - e3x) ** 2 + (by - e3y) ** 2;
          let qx, qy;
          if (s1 <= s2 && s1 <= s3) {
            qx = e1x;
            qy = e1y;
          } else if (s2 <= s3) {
            qx = e2x;
            qy = e2y;
          } else {
            qx = e3x;
            qy = e3y;
          }
          const dx = bx - qx,
            dy = by - qy;
          const distSq = dx * dx + dy * dy;
          if (distSq === 0 || distSq >= r * r) continue;
          const dist = Math.sqrt(distSq);
          nx = dx / dist;
          ny = dy / dist;
          overlap = r - dist;
        }

        ball.x += nx * overlap;
        ball.y += ny * overlap;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) bounceVelocity(ball, nx, ny, dot, tile);
      }
    }
  }

  // ── Physics step ──────────────────────────────────────────────────────────

  // wallTiles for collision; groundTiles for surface effects (falls back to wallTiles).
  function updateBall(ball, wallTiles, groundTiles) {
    const gt = groundTiles || wallTiles;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (wallTiles) {
      resolveWallCollisions(ball, wallTiles);
      resolveCurveCollisions(ball, wallTiles);
      resolveBumpCollisions(ball, wallTiles);
      resolveDiagWallCollisions(ball, wallTiles);
      resolveCircleWallCollisions(ball, wallTiles);
    }

    const curTile = gt ? getSurfaceAt(gt, ball.x, ball.y) : null;
    const f = isSandTile(curTile)
      ? FRICTION * SAND_FRICTION
      : isSlopeTile(curTile)
        ? SLOPE_ROLL_FRICTION
        : FRICTION;
    ball.vx *= f;
    ball.vy *= f;

    const F2 = SLOPE_FORCE / Math.SQRT2;
    if (curTile === TILE.SLOPE_U) ball.vy -= SLOPE_FORCE;
    else if (curTile === TILE.SLOPE_D) ball.vy += SLOPE_FORCE;
    else if (curTile === TILE.SLOPE_L) ball.vx -= SLOPE_FORCE;
    else if (curTile === TILE.SLOPE_R) ball.vx += SLOPE_FORCE;
    else if (curTile === TILE.SLOPE_UL) {
      ball.vx -= F2;
      ball.vy -= F2;
    } else if (curTile === TILE.SLOPE_UR) {
      ball.vx += F2;
      ball.vy -= F2;
    } else if (curTile === TILE.SLOPE_DL) {
      ball.vx -= F2;
      ball.vy += F2;
    } else if (curTile === TILE.SLOPE_DR) {
      ball.vx += F2;
      ball.vy += F2;
    }

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
      if (ball._stuckAge >= 120) {
        if (ball._maxX - ball._minX < 3 && ball._maxY - ball._minY < 3) {
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
      if (pi.sunk || pi.eliminated || !pi.started || pi.waterPending) continue;
      for (let j = i + 1; j < players.length; j++) {
        const pj = players[j];
        if (pj.sunk || pj.eliminated || !pj.started || pj.waterPending)
          continue;

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

        // Ball-to-ball collision with tunable restitution.
        // impulse = (1+e)/2 × dot  (equal mass, CoR = BALL_RESTITUTION)
        // e=1 → fully elastic (normal velocities exchanged)
        // e=0 → perfectly inelastic (normal velocities averaged)
        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          const imp = ((1 + BALL_RESTITUTION) / 2) * dot;
          a.vx -= imp * nx;
          a.vy -= imp * ny;
          b.vx += imp * nx;
          b.vy += imp * ny;

          // Tangential (Coulomb) friction: reduce relative sliding at contact
          const tx = -ny,
            ty = nx;
          const dvt = dvx * tx + dvy * ty;
          const maxFric = BALL_FRICTION * imp;
          const impT = Math.max(-maxFric, Math.min(maxFric, dvt / 2));
          a.vx -= impT * tx;
          a.vy -= impT * ty;
          b.vx += impT * tx;
          b.vy += impT * ty;
        }
      }
    }
  }

  // ── Hole detection ────────────────────────────────────────────────────────

  function checkHole(ball, holes) {
    for (const hole of holes) {
      const dx = ball.x - hole.x;
      const dy = ball.y - hole.y;
      if (dx * dx + dy * dy < HOLE_SINK_RADIUS * HOLE_SINK_RADIUS) return hole;
    }
    return null;
  }

  function applyHoleGravity(ball, holes) {
    for (const hole of holes) {
      const dx = hole.x - ball.x;
      const dy = hole.y - ball.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= HOLE_GRAVITY_OUTER * HOLE_GRAVITY_OUTER) continue;
      const dist = Math.sqrt(distSq);
      if (dist < HOLE_SINK_RADIUS) continue;
      const t =
        1 - (dist - HOLE_SINK_RADIUS) / (HOLE_GRAVITY_OUTER - HOLE_SINK_RADIUS);
      const strength = HOLE_GRAVITY_FORCE * t * t;
      ball.vx += (dx / dist) * strength;
      ball.vy += (dy / dist) * strength;
    }
  }

  // ── Teleporter detection ──────────────────────────────────────────────────

  function isOnTeleporter(ball, groundTiles) {
    const r2 = (TILE_SIZE / 2) ** 2;
    const TP_CHARS = new Set([
      TILE.TELEPORTER,
      TILE.TELEPORTER_B,
      TILE.TELEPORTER_C,
    ]);
    const minCol = Math.floor((ball.x - TILE_SIZE / 2) / TILE_SIZE);
    const maxCol = Math.floor((ball.x + TILE_SIZE / 2) / TILE_SIZE);
    const minRow = Math.floor((ball.y - TILE_SIZE / 2) / TILE_SIZE);
    const maxRow = Math.floor((ball.y + TILE_SIZE / 2) / TILE_SIZE);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!TP_CHARS.has(getTile(groundTiles, col, row))) continue;
        const cx = col * TILE_SIZE + TILE_SIZE / 2;
        const cy = row * TILE_SIZE + TILE_SIZE / 2;
        if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 < r2) return true;
      }
    }
    return false;
  }

  function checkTeleporter(ball, pairs) {
    if (ball._wasOnTp) return null;
    const r2 = (TILE_SIZE / 2) * (TILE_SIZE / 2);
    for (let i = 0; i < pairs.length; i++) {
      if (ball._tpUsedPairs.has(i)) continue;
      const [a, b] = pairs[i];
      if ((ball.x - a.x) ** 2 + (ball.y - a.y) ** 2 < r2) {
        ball._tpUsedPairs.add(i);
        return b;
      }
      if ((ball.x - b.x) ** 2 + (ball.y - b.y) ** 2 < r2) {
        ball._tpUsedPairs.add(i);
        return a;
      }
    }
    return null;
  }

  // ── Swap detection (circular hitbox, radius = TILE_SIZE/2) ───────────────

  function checkSwap(ball, groundTiles) {
    const r2 = (TILE_SIZE / 2) ** 2;
    const minCol = Math.floor((ball.x - TILE_SIZE / 2) / TILE_SIZE);
    const maxCol = Math.floor((ball.x + TILE_SIZE / 2) / TILE_SIZE);
    const minRow = Math.floor((ball.y - TILE_SIZE / 2) / TILE_SIZE);
    const maxRow = Math.floor((ball.y + TILE_SIZE / 2) / TILE_SIZE);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (getTile(groundTiles, col, row) !== TILE.SWAP) continue;
        const cx = col * TILE_SIZE + TILE_SIZE / 2;
        const cy = row * TILE_SIZE + TILE_SIZE / 2;
        if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 < r2) return true;
      }
    }
    return false;
  }

  // ── Tile helpers ──────────────────────────────────────────────────────────

  function getTile(tiles, col, row) {
    if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length)
      return TILE.WALL;
    return tiles[row][col];
  }

  function tileAt(tiles, worldX, worldY) {
    return getTile(
      tiles,
      Math.floor(worldX / TILE_SIZE),
      Math.floor(worldY / TILE_SIZE),
    );
  }

  function getSurfaceAt(groundTiles, worldX, worldY) {
    const T = TILE_SIZE;
    const col = Math.floor(worldX / T);
    const row = Math.floor(worldY / T);
    const tile = getTile(groundTiles, col, row);
    const bx = worldX - col * T;
    const by = worldY - row * T;

    // Diagonal sand
    if (tile === TILE.SAND_UR) return bx > by ? tile : TILE.EMPTY;
    if (tile === TILE.SAND_LL) return by > bx ? tile : TILE.EMPTY;
    if (tile === TILE.SAND_UL) return bx + by < T ? tile : TILE.EMPTY;
    if (tile === TILE.SAND_LR) return bx + by > T ? tile : TILE.EMPTY;

    // Diagonal water (same shapes as sand)
    if (tile === TILE.WATER_UR) return bx > by ? tile : TILE.EMPTY;
    if (tile === TILE.WATER_LL) return by > bx ? tile : TILE.EMPTY;
    if (tile === TILE.WATER_UL) return bx + by < T ? tile : TILE.EMPTY;
    if (tile === TILE.WATER_LR) return bx + by > T ? tile : TILE.EMPTY;

    // Diagonal lava — renderer draws INVERTED triangle vs. tile name
    if (tile === TILE.LAVA_DIAG_UR) return by > bx ? tile : TILE.EMPTY;
    if (tile === TILE.LAVA_DIAG_LL) return bx > by ? tile : TILE.EMPTY;
    if (tile === TILE.LAVA_DIAG_UL) return bx + by > T ? tile : TILE.EMPTY;
    if (tile === TILE.LAVA_DIAG_LR) return bx + by < T ? tile : TILE.EMPTY;

    // Curve terrain: terrain inside the arc (dist < T from arc center)
    const curveMeta = CURVE_META[tile];
    if (
      curveMeta &&
      (isSandTile(tile) || isWaterTile(tile) || isLavaTile(tile))
    ) {
      const ax = col * T + curveMeta.ox * T;
      const ay = row * T + curveMeta.oy * T;
      const dx = worldX - ax;
      const dy = worldY - ay;
      return Math.sqrt(dx * dx + dy * dy) < T ? tile : TILE.EMPTY;
    }

    // Bump terrain: terrain outside the arc (dist > T from arc center)
    const bumpMeta = BUMP_META[tile];
    if (
      bumpMeta &&
      (isSandTile(tile) || isWaterTile(tile) || isLavaTile(tile))
    ) {
      const ax = col * T + bumpMeta.ox * T;
      const ay = row * T + bumpMeta.oy * T;
      const dx = worldX - ax;
      const dy = worldY - ay;
      return Math.sqrt(dx * dx + dy * dy) > T ? tile : TILE.EMPTY;
    }

    return tile;
  }

  return {
    TILE_SIZE,
    BALL_RADIUS,
    MIN_SPEED,
    BOUNCY_TILES,
    STICKY_TILES,
    PHANTOM_TILES,
    get MAX_POWER() {
      return MAX_POWER;
    },
    set MAX_POWER(v) {
      MAX_POWER = v;
    },
    get POWER_SCALE() {
      return POWER_SCALE;
    },
    set POWER_SCALE(v) {
      POWER_SCALE = v;
    },
    get FRICTION() {
      return FRICTION;
    },
    set FRICTION(v) {
      FRICTION = v;
    },
    get SAND_FRICTION() {
      return SAND_FRICTION;
    },
    set SAND_FRICTION(v) {
      SAND_FRICTION = v;
    },
    get BALL_RESTITUTION() {
      return BALL_RESTITUTION;
    },
    set BALL_RESTITUTION(v) {
      BALL_RESTITUTION = v;
    },
    get BALL_FRICTION() {
      return BALL_FRICTION;
    },
    set BALL_FRICTION(v) {
      BALL_FRICTION = v;
    },
    get BOUNCY_RESTITUTION() {
      return BOUNCY_RESTITUTION;
    },
    set BOUNCY_RESTITUTION(v) {
      BOUNCY_RESTITUTION = v;
    },
    get STICKY_RESTITUTION() {
      return STICKY_RESTITUTION;
    },
    set STICKY_RESTITUTION(v) {
      STICKY_RESTITUTION = v;
    },
    get SLOPE_FORCE() {
      return SLOPE_FORCE;
    },
    set SLOPE_FORCE(v) {
      SLOPE_FORCE = v;
    },
    get SLOPE_ROLL_FRICTION() {
      return SLOPE_ROLL_FRICTION;
    },
    set SLOPE_ROLL_FRICTION(v) {
      SLOPE_ROLL_FRICTION = v;
    },
    get HOLE_SINK_RADIUS() {
      return HOLE_SINK_RADIUS;
    },
    set HOLE_SINK_RADIUS(v) {
      HOLE_SINK_RADIUS = v;
    },
    get HOLE_GRAVITY_OUTER() {
      return HOLE_GRAVITY_OUTER;
    },
    set HOLE_GRAVITY_OUTER(v) {
      HOLE_GRAVITY_OUTER = v;
    },
    get HOLE_GRAVITY_FORCE() {
      return HOLE_GRAVITY_FORCE;
    },
    set HOLE_GRAVITY_FORCE(v) {
      HOLE_GRAVITY_FORCE = v;
    },
    POWER_EXP,
    TILE,
    WALL_CHARS_SET,
    isSandTile,
    isWaterTile,
    isSlopeTile,
    isLavaTile,
    isSwapTile,
    parseMap,
    createBall,
    launchBall,
    isMoving,
    updateBall,
    resolveWallCollisions,
    resolveCurveCollisions,
    CURVE_META,
    resolveBumpCollisions,
    BUMP_META,
    resolveDiagWallCollisions,
    DIAG_WALL_META,
    resolveCircleWallCollisions,
    resolveBallCollisions,
    checkHole,
    applyHoleGravity,
    isOnTeleporter,
    checkTeleporter,
    checkSwap,
    getTile,
    tileAt,
    getSurfaceAt,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Physics;
}
