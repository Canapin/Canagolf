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
const VERSION = "2026-06-04";
if (typeof console !== "undefined") console.log("Physics v" + VERSION);

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
  let MAX_VELOCITY = 25; // absolute speed cap (px/frame) — prevents bouncy-wall runaway

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
    // Slope partial-tile variants (diagonal, concave, convex)
    SLOPE_DIAG_UR: "Ĉ", // slope ↗ — upper-right triangle, force UR
    SLOPE_DIAG_DL: "ĉ", // slope ↙ — lower-left triangle, force DL
    SLOPE_DIAG_UL: "Ċ", // slope ↖ — upper-left triangle, force UL
    SLOPE_DIAG_DR: "ċ", // slope ↘ — lower-right triangle, force DR
    SLOPE_CURVE_TL: "Č", // slope concave ↖ — TL corner area, force UL
    SLOPE_CURVE_TR: "č", // slope concave ↗ — TR corner area, force UR
    SLOPE_CURVE_BL: "Ď", // slope concave ↙ — BL corner area, force DL
    SLOPE_CURVE_BR: "ď", // slope concave ↘ — BR corner area, force DR
    SLOPE_BUMP_TL: "Đ", // slope convex ↖ — TL corner bump, force UL
    SLOPE_BUMP_TR: "đ", // slope convex ↗ — TR corner bump, force UR
    SLOPE_BUMP_BL: "Ē", // slope convex ↙ — BL corner bump, force DL
    SLOPE_BUMP_BR: "ē", // slope convex ↘ — BR corner bump, force DR
    // Cardinal slope partial-tile variants (diagonal, concave, convex) — force matches base cardinal direction
    SLOPE_U_DIAG_UR: "Ĕ", SLOPE_U_DIAG_LL: "ĕ", SLOPE_U_DIAG_UL: "Ė", SLOPE_U_DIAG_LR: "ė",
    SLOPE_U_CURVE_TL: "Ę", SLOPE_U_CURVE_TR: "ę", SLOPE_U_CURVE_BL: "Ě", SLOPE_U_CURVE_BR: "ě",
    SLOPE_U_BUMP_TL: "Ĝ", SLOPE_U_BUMP_TR: "ĝ", SLOPE_U_BUMP_BL: "Ğ", SLOPE_U_BUMP_BR: "ğ",
    SLOPE_D_DIAG_UR: "Ġ", SLOPE_D_DIAG_LL: "ġ", SLOPE_D_DIAG_UL: "Ģ", SLOPE_D_DIAG_LR: "ģ",
    SLOPE_D_CURVE_TL: "Ĥ", SLOPE_D_CURVE_TR: "ĥ", SLOPE_D_CURVE_BL: "Ħ", SLOPE_D_CURVE_BR: "ħ",
    SLOPE_D_BUMP_TL: "Ĩ", SLOPE_D_BUMP_TR: "ĩ", SLOPE_D_BUMP_BL: "Ī", SLOPE_D_BUMP_BR: "ī",
    SLOPE_L_DIAG_UR: "Ĭ", SLOPE_L_DIAG_LL: "ĭ", SLOPE_L_DIAG_UL: "Į", SLOPE_L_DIAG_LR: "į",
    SLOPE_L_CURVE_TL: "İ", SLOPE_L_CURVE_TR: "ı", SLOPE_L_CURVE_BL: "Ũ", SLOPE_L_CURVE_BR: "ũ",
    SLOPE_L_BUMP_TL: "Ĵ", SLOPE_L_BUMP_TR: "ĵ", SLOPE_L_BUMP_BL: "Ķ", SLOPE_L_BUMP_BR: "ķ",
    SLOPE_R_DIAG_UR: "ĸ", SLOPE_R_DIAG_LL: "Ĺ", SLOPE_R_DIAG_UL: "ĺ", SLOPE_R_DIAG_LR: "Ļ",
    SLOPE_R_CURVE_TL: "ļ", SLOPE_R_CURVE_TR: "Ľ", SLOPE_R_CURVE_BL: "ľ", SLOPE_R_CURVE_BR: "Ŀ",
    SLOPE_R_BUMP_TL: "ŀ", SLOPE_R_BUMP_TR: "Ł", SLOPE_R_BUMP_BL: "ł", SLOPE_R_BUMP_BR: "Ń",
    // Diagonal slope additional per-orientation variants (non-natural shape+direction combos)
    SLOPE_UL_DIAG_UR: "ń", SLOPE_UL_DIAG_LL: "Ņ", SLOPE_UL_DIAG_LR: "ņ",
    SLOPE_UL_CURVE_TR: "Ň", SLOPE_UL_CURVE_BL: "ň", SLOPE_UL_CURVE_BR: "ŉ",
    SLOPE_UL_BUMP_TR: "Ŋ", SLOPE_UL_BUMP_BL: "ŋ", SLOPE_UL_BUMP_BR: "Ō",
    SLOPE_UR_DIAG_LL: "ō", SLOPE_UR_DIAG_UL: "Ŏ", SLOPE_UR_DIAG_LR: "ŏ",
    SLOPE_UR_CURVE_TL: "Ő", SLOPE_UR_CURVE_BL: "ő", SLOPE_UR_CURVE_BR: "Œ",
    SLOPE_UR_BUMP_TL: "œ", SLOPE_UR_BUMP_BL: "Ŕ", SLOPE_UR_BUMP_BR: "ŕ",
    SLOPE_DL_DIAG_UR: "Ŗ", SLOPE_DL_DIAG_UL: "ŗ", SLOPE_DL_DIAG_LR: "Ř",
    SLOPE_DL_CURVE_TL: "ř", SLOPE_DL_CURVE_TR: "Ś", SLOPE_DL_CURVE_BR: "ś",
    SLOPE_DL_BUMP_TL: "Ŝ", SLOPE_DL_BUMP_TR: "ŝ", SLOPE_DL_BUMP_BR: "Ş",
    SLOPE_DR_DIAG_UR: "ş", SLOPE_DR_DIAG_LL: "Š", SLOPE_DR_DIAG_UL: "š",
    SLOPE_DR_CURVE_TL: "Ţ", SLOPE_DR_CURVE_TR: "ţ", SLOPE_DR_CURVE_BL: "Ť",
    SLOPE_DR_BUMP_TL: "ť", SLOPE_DR_BUMP_TR: "Ŧ", SLOPE_DR_BUMP_BL: "ŧ",
    TELEPORTER: "=", // teleporter pair 1 (purple)
    TELEPORTER_B: "|", // teleporter pair 2 (cyan)
    TELEPORTER_C: "/", // teleporter pair 3 (gold)
    SWAP: "?", // ball swaps position with a random opponent's ball and stops
    BLACKHOLE: "Ū", // pulls nearby balls toward it on activation; one use per turn
    // One-way walls — diagonal (complement GHOST_R/L/U/D for 8-direction coverage)
    PHANTOM_UR: "-", // passes if ball moves up-right (vx>0 && vy<0)
    PHANTOM_UL: "!", // passes if ball moves up-left
    PHANTOM_DR: ",", // passes if ball moves down-right
    PHANTOM_DL: ";", // passes if ball moves down-left
    CIRCLE_WALL: "\\", // circular wall obstacle (full circle, radius = half tile)
    ICE: "þ", // ice surface (lower friction than regular)
    ICE_UR: "Þ", ICE_LL: "ß", ICE_UL: "à", ICE_LR: "á",
    ICE_CURVE_TL: "â", ICE_CURVE_TR: "ã", ICE_CURVE_BL: "ä", ICE_CURVE_BR: "å",
    ICE_BUMP_TL: "æ", ICE_BUMP_TR: "ç", ICE_BUMP_BL: "è", ICE_BUMP_BR: "é",
    SNOW: "ê",
    SNOW_UR: "ë", SNOW_LL: "ì", SNOW_UL: "í", SNOW_LR: "î",
    SNOW_CURVE_TL: "ï", SNOW_CURVE_TR: "ð", SNOW_CURVE_BL: "ñ", SNOW_CURVE_BR: "ò",
    SNOW_BUMP_TL: "ó", SNOW_BUMP_TR: "ô", SNOW_BUMP_BL: "õ", SNOW_BUMP_BR: "ö",
  };

  let ICE_FRICTION = 0.998;
  let SNOW_FRICTION = 0.975;
  let SAND_FRICTION = 0.955;
  let SLOPE_FORCE = 0.013;
  let SLOPE_ROLL_FRICTION = 0.99; // no rolling resistance on slopes — force accumulates each frame
  let BALL_RESTITUTION = 0.5; // ball-to-ball CoR: 0=inelastic (merge), 1=elastic (full exchange)
  let BALL_FRICTION = 0.3; // ball-to-ball tangential friction (Coulomb μ)
  let BOUNCY_RESTITUTION = 1.5;
  let STICKY_RESTITUTION = 0.1;
  let BH_IMPULSE_FACTOR = 0.75;
  let BH_RADIUS_TILES = 10;
  let SWAP_RADIUS_TILES = 8;

  const ICE_SET = new Set([
    TILE.ICE, TILE.ICE_UR, TILE.ICE_LL, TILE.ICE_UL, TILE.ICE_LR,
    TILE.ICE_CURVE_TL, TILE.ICE_CURVE_TR, TILE.ICE_CURVE_BL, TILE.ICE_CURVE_BR,
    TILE.ICE_BUMP_TL, TILE.ICE_BUMP_TR, TILE.ICE_BUMP_BL, TILE.ICE_BUMP_BR,
  ]);
  const SNOW_SET = new Set([
    TILE.SNOW, TILE.SNOW_UR, TILE.SNOW_LL, TILE.SNOW_UL, TILE.SNOW_LR,
    TILE.SNOW_CURVE_TL, TILE.SNOW_CURVE_TR, TILE.SNOW_CURVE_BL, TILE.SNOW_CURVE_BR,
    TILE.SNOW_BUMP_TL, TILE.SNOW_BUMP_TR, TILE.SNOW_BUMP_BL, TILE.SNOW_BUMP_BR,
  ]);
  const SAND_SET = new Set([
    TILE.SAND, TILE.SAND_UR, TILE.SAND_LL, TILE.SAND_UL, TILE.SAND_LR,
    TILE.SAND_CURVE_TL, TILE.SAND_CURVE_TR, TILE.SAND_CURVE_BL, TILE.SAND_CURVE_BR,
    TILE.SAND_BUMP_TL, TILE.SAND_BUMP_TR, TILE.SAND_BUMP_BL, TILE.SAND_BUMP_BR,
  ]);
  const WATER_SET = new Set([
    TILE.WATER, TILE.WATER_UR, TILE.WATER_LL, TILE.WATER_UL, TILE.WATER_LR,
    TILE.WATER_CURVE_TL, TILE.WATER_CURVE_TR, TILE.WATER_CURVE_BL, TILE.WATER_CURVE_BR,
    TILE.WATER_BUMP_TL, TILE.WATER_BUMP_TR, TILE.WATER_BUMP_BL, TILE.WATER_BUMP_BR,
  ]);
  const LAVA_SET = new Set([
    TILE.LAVA,
    TILE.LAVA_DIAG_UR, TILE.LAVA_DIAG_LL, TILE.LAVA_DIAG_UL, TILE.LAVA_DIAG_LR,
    TILE.LAVA_CURVE_TL, TILE.LAVA_CURVE_TR, TILE.LAVA_CURVE_BL, TILE.LAVA_CURVE_BR,
    TILE.LAVA_BUMP_TL, TILE.LAVA_BUMP_TR, TILE.LAVA_BUMP_BL, TILE.LAVA_BUMP_BR,
  ]);
  const SLOPE_SET = new Set([
    TILE.SLOPE_U, TILE.SLOPE_D, TILE.SLOPE_L, TILE.SLOPE_R,
    TILE.SLOPE_UL, TILE.SLOPE_UR, TILE.SLOPE_DL, TILE.SLOPE_DR,
    TILE.SLOPE_DIAG_UR, TILE.SLOPE_DIAG_DL, TILE.SLOPE_DIAG_UL, TILE.SLOPE_DIAG_DR,
    TILE.SLOPE_CURVE_TL, TILE.SLOPE_CURVE_TR, TILE.SLOPE_CURVE_BL, TILE.SLOPE_CURVE_BR,
    TILE.SLOPE_BUMP_TL, TILE.SLOPE_BUMP_TR, TILE.SLOPE_BUMP_BL, TILE.SLOPE_BUMP_BR,
    // Cardinal slope partial tiles
    TILE.SLOPE_U_DIAG_UR, TILE.SLOPE_U_DIAG_LL, TILE.SLOPE_U_DIAG_UL, TILE.SLOPE_U_DIAG_LR,
    TILE.SLOPE_U_CURVE_TL, TILE.SLOPE_U_CURVE_TR, TILE.SLOPE_U_CURVE_BL, TILE.SLOPE_U_CURVE_BR,
    TILE.SLOPE_U_BUMP_TL, TILE.SLOPE_U_BUMP_TR, TILE.SLOPE_U_BUMP_BL, TILE.SLOPE_U_BUMP_BR,
    TILE.SLOPE_D_DIAG_UR, TILE.SLOPE_D_DIAG_LL, TILE.SLOPE_D_DIAG_UL, TILE.SLOPE_D_DIAG_LR,
    TILE.SLOPE_D_CURVE_TL, TILE.SLOPE_D_CURVE_TR, TILE.SLOPE_D_CURVE_BL, TILE.SLOPE_D_CURVE_BR,
    TILE.SLOPE_D_BUMP_TL, TILE.SLOPE_D_BUMP_TR, TILE.SLOPE_D_BUMP_BL, TILE.SLOPE_D_BUMP_BR,
    TILE.SLOPE_L_DIAG_UR, TILE.SLOPE_L_DIAG_LL, TILE.SLOPE_L_DIAG_UL, TILE.SLOPE_L_DIAG_LR,
    TILE.SLOPE_L_CURVE_TL, TILE.SLOPE_L_CURVE_TR, TILE.SLOPE_L_CURVE_BL, TILE.SLOPE_L_CURVE_BR,
    TILE.SLOPE_L_BUMP_TL, TILE.SLOPE_L_BUMP_TR, TILE.SLOPE_L_BUMP_BL, TILE.SLOPE_L_BUMP_BR,
    TILE.SLOPE_R_DIAG_UR, TILE.SLOPE_R_DIAG_LL, TILE.SLOPE_R_DIAG_UL, TILE.SLOPE_R_DIAG_LR,
    TILE.SLOPE_R_CURVE_TL, TILE.SLOPE_R_CURVE_TR, TILE.SLOPE_R_CURVE_BL, TILE.SLOPE_R_CURVE_BR,
    TILE.SLOPE_R_BUMP_TL, TILE.SLOPE_R_BUMP_TR, TILE.SLOPE_R_BUMP_BL, TILE.SLOPE_R_BUMP_BR,
    // Diagonal slope additional per-orientation variants
    TILE.SLOPE_UL_DIAG_UR, TILE.SLOPE_UL_DIAG_LL, TILE.SLOPE_UL_DIAG_LR,
    TILE.SLOPE_UL_CURVE_TR, TILE.SLOPE_UL_CURVE_BL, TILE.SLOPE_UL_CURVE_BR,
    TILE.SLOPE_UL_BUMP_TR, TILE.SLOPE_UL_BUMP_BL, TILE.SLOPE_UL_BUMP_BR,
    TILE.SLOPE_UR_DIAG_LL, TILE.SLOPE_UR_DIAG_UL, TILE.SLOPE_UR_DIAG_LR,
    TILE.SLOPE_UR_CURVE_TL, TILE.SLOPE_UR_CURVE_BL, TILE.SLOPE_UR_CURVE_BR,
    TILE.SLOPE_UR_BUMP_TL, TILE.SLOPE_UR_BUMP_BL, TILE.SLOPE_UR_BUMP_BR,
    TILE.SLOPE_DL_DIAG_UR, TILE.SLOPE_DL_DIAG_UL, TILE.SLOPE_DL_DIAG_LR,
    TILE.SLOPE_DL_CURVE_TL, TILE.SLOPE_DL_CURVE_TR, TILE.SLOPE_DL_CURVE_BR,
    TILE.SLOPE_DL_BUMP_TL, TILE.SLOPE_DL_BUMP_TR, TILE.SLOPE_DL_BUMP_BR,
    TILE.SLOPE_DR_DIAG_UR, TILE.SLOPE_DR_DIAG_LL, TILE.SLOPE_DR_DIAG_UL,
    TILE.SLOPE_DR_CURVE_TL, TILE.SLOPE_DR_CURVE_TR, TILE.SLOPE_DR_CURVE_BL,
    TILE.SLOPE_DR_BUMP_TL, TILE.SLOPE_DR_BUMP_TR, TILE.SLOPE_DR_BUMP_BL,
  ]);
  const BOUNCY_TILES = new Set([
    TILE.BOUNCY,
    TILE.BOUNCY_WALL_UR, TILE.BOUNCY_WALL_LL, TILE.BOUNCY_WALL_UL, TILE.BOUNCY_WALL_LR,
    TILE.BOUNCY_CURVE_TL, TILE.BOUNCY_CURVE_TR, TILE.BOUNCY_CURVE_BL, TILE.BOUNCY_CURVE_BR,
    TILE.BOUNCY_BUMP_TL, TILE.BOUNCY_BUMP_TR, TILE.BOUNCY_BUMP_BL, TILE.BOUNCY_BUMP_BR,
  ]);
  const STICKY_TILES = new Set([
    TILE.STICKY_WALL,
    TILE.STICKY_WALL_UR, TILE.STICKY_WALL_LL, TILE.STICKY_WALL_UL, TILE.STICKY_WALL_LR,
    TILE.STICKY_CURVE_TL, TILE.STICKY_CURVE_TR, TILE.STICKY_CURVE_BL, TILE.STICKY_CURVE_BR,
    TILE.STICKY_BUMP_TL, TILE.STICKY_BUMP_TR, TILE.STICKY_BUMP_BL, TILE.STICKY_BUMP_BR,
  ]);
  const PHANTOM_TILES = new Set([
    TILE.PHANTOM_UR, TILE.PHANTOM_UL, TILE.PHANTOM_DR, TILE.PHANTOM_DL,
  ]);
  const WALL_CHARS_SET = new Set([
    TILE.WALL, TILE.BOUNCY, TILE.STICKY_WALL, TILE.CIRCLE_WALL,
    TILE.WALL_UR, TILE.WALL_LL, TILE.WALL_UL, TILE.WALL_LR,
    TILE.BOUNCY_WALL_UR, TILE.BOUNCY_WALL_LL, TILE.BOUNCY_WALL_UL, TILE.BOUNCY_WALL_LR,
    TILE.STICKY_WALL_UR, TILE.STICKY_WALL_LL, TILE.STICKY_WALL_UL, TILE.STICKY_WALL_LR,
    TILE.CURVE_TL, TILE.CURVE_TR, TILE.CURVE_BL, TILE.CURVE_BR,
    TILE.BOUNCY_CURVE_TL, TILE.BOUNCY_CURVE_TR, TILE.BOUNCY_CURVE_BL, TILE.BOUNCY_CURVE_BR,
    TILE.STICKY_CURVE_TL, TILE.STICKY_CURVE_TR, TILE.STICKY_CURVE_BL, TILE.STICKY_CURVE_BR,
    TILE.BUMP_TL, TILE.BUMP_TR, TILE.BUMP_BL, TILE.BUMP_BR,
    TILE.BOUNCY_BUMP_TL, TILE.BOUNCY_BUMP_TR, TILE.BOUNCY_BUMP_BL, TILE.BOUNCY_BUMP_BR,
    TILE.STICKY_BUMP_TL, TILE.STICKY_BUMP_TR, TILE.STICKY_BUMP_BL, TILE.STICKY_BUMP_BR,
    TILE.GHOST_R, TILE.GHOST_L, TILE.GHOST_U, TILE.GHOST_D,
    TILE.PHANTOM_UR, TILE.PHANTOM_UL, TILE.PHANTOM_DR, TILE.PHANTOM_DL,
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
  function isIceTile(t) {
    return ICE_SET.has(t);
  }
  function isSnowTile(t) {
    return SNOW_SET.has(t);
  }
  function isSlopeTile(t) {
    return SLOPE_SET.has(t);
  }

  // ── Map variation transformations ────────────────────────────────────────

  const XFORM = { h: {}, v: {}, b: {} };
  const H = XFORM.h, V = XFORM.v, B = XFORM.b;

  // Helper: define a 4-tuple TL/TR/BL/BR corner mapping
  function _corner4(tl, tr, bl, br) {
    H[tl]=tr; H[tr]=tl; H[bl]=br; H[br]=bl;
    V[tl]=bl; V[tr]=br; V[bl]=tl; V[br]=tr;
    B[tl]=br; B[tr]=bl; B[bl]=tr; B[br]=tl;
  }

  // Helper: define a 4-tuple diagonal mapping (UR/LL/UL/LR)
  function _diag4(ur, ll, ul, lr) {
    H[ur]=ul; H[ul]=ur; H[ll]=lr; H[lr]=ll;
    V[ur]=lr; V[lr]=ur; V[ll]=ul; V[ul]=ll;
    B[ur]=ll; B[ll]=ur; B[ul]=lr; B[lr]=ul;
  }

  // Wall diagonals (wall fills complement)
  _diag4('i',  'j',  'k',  'l');
  _diag4('N',  'P',  'Q',  'R');
  _diag4('(',  ')',  '[',  ']');
  // Wall curves (convex arc sector)
  _corner4('1', '2', '3', '4');
  _corner4('T', 'U', 'V', 'X');
  _corner4('{', '}', '@', '$');
  // Wall bumps (concave, tile minus arc)
  _corner4('5', '6', '7', '8');
  _corner4('Y', 'Z', '0', '9');
  _corner4('%', '&', '*', '_');
  // Sand diagonals
  _diag4('a', 'b', 'c', 'd');
  // Water diagonals
  _diag4('e', 'f', 'g', 'h');
  // Lava diagonals (renderer draws inverted vs tile name)
  _diag4("'", ':', '"', '`');
  // Sand curves
  _corner4('m', 'n', 'o', 'p');
  // Water curves
  _corner4('u', 'x', 'y', 'z');
  // Lava curves
  _corner4('Ā', 'ā', 'Ă', 'ă');
  // Sand bumps
  _corner4('q', 'r', 's', 't');
  // Water bumps
  _corner4('B', 'C', 'D', 'E');
  // Lava bumps
  _corner4('Ą', 'ą', 'Ć', 'ć');
  // Ice diagonals
  _diag4('Þ', 'ß', 'à', 'á');
  // Ice curves
  _corner4('â', 'ã', 'ä', 'å');
  // Ice bumps
  _corner4('æ', 'ç', 'è', 'é');
  // Snow diagonals
  _diag4('ë', 'ì', 'í', 'î');
  // Snow curves
  _corner4('ï', 'ð', 'ñ', 'ò');
  // Snow bumps
  _corner4('ó', 'ô', 'õ', 'ö');
  // Full slopes — cardinal
  H['<']='>'; H['>']='<';
  V['^']='v'; V['v']='^';
  B['^']='v'; B['v']='^'; B['<']='>'; B['>']='<';
  // Full slopes — diagonal
  H['F']='G'; H['G']='F'; H['H']='I'; H['I']='H';
  V['F']='H'; V['G']='I'; V['H']='F'; V['I']='G';
  B['F']='I'; B['G']='H'; B['H']='G'; B['I']='F';
  // Natural diagonal slopes
  _diag4('Ĉ','ĉ','Ċ','ċ');
  // Natural curve slopes
  _corner4('Č','č','Ď','ď');
  // Natural bump slopes
  _corner4('Đ','đ','Ē','ē');
  // Cardinal U-slope partials
  _corner4('Ę','ę','Ě','ě');
  _corner4('Ĝ','ĝ','Ğ','ğ');
  _diag4('Ĕ','ĕ','Ė','ė');
  // U→D on vertical/both flip (shape V-flip: TL↔BL, TR↔BR, UR↔LR, LL↔UL)
  V['Ĕ']='ģ'; V['Ė']='ġ'; V['ĕ']='Ģ'; V['ė']='Ġ';
  V['Ę']='Ħ'; V['ę']='ħ'; V['Ě']='Ĥ'; V['ě']='ĥ';
  V['Ĝ']='Ī'; V['ĝ']='ī'; V['Ğ']='Ĩ'; V['ğ']='ĩ';
  B['Ĕ']='ġ'; B['Ė']='ģ'; B['ĕ']='Ġ'; B['ė']='Ģ';
  B['Ę']='ħ'; B['ę']='Ħ'; B['Ě']='ĥ'; B['ě']='Ĥ';
  B['Ĝ']='ī'; B['ĝ']='Ī'; B['Ğ']='ĩ'; B['ğ']='Ĩ';
  // Cardinal D-slope partials
  _corner4('Ĥ','ĥ','Ħ','ħ');
  _corner4('Ĩ','ĩ','Ī','ī');
  _diag4('Ġ','ġ','Ģ','ģ');
  // D→U on vertical/both flip
  V['Ġ']='ė'; V['Ģ']='ĕ'; V['ġ']='Ė'; V['ģ']='Ĕ';
  V['Ĥ']='Ě'; V['ĥ']='ě'; V['Ħ']='Ę'; V['ħ']='ę';
  V['Ĩ']='Ğ'; V['ĩ']='ğ'; V['Ī']='Ĝ'; V['ī']='ĝ';
  B['Ġ']='ĕ'; B['Ģ']='ė'; B['ġ']='Ĕ'; B['ģ']='Ė';
  B['Ĥ']='ě'; B['ĥ']='Ě'; B['Ħ']='ę'; B['ħ']='Ę';
  B['Ĩ']='ğ'; B['ĩ']='Ğ'; B['Ī']='ĝ'; B['ī']='Ĝ';
  // Cardinal L-slope partials
  _corner4('İ','ı','Ũ','ũ');
  _corner4('Ĵ','ĵ','Ķ','ķ');
  _diag4('Ĭ','ĭ','Į','į');
  // L→R on horizontal/both flip
  H['Ĭ']='ĺ'; H['Į']='ĸ'; H['ĭ']='Ļ'; H['į']='Ĺ';
  H['İ']='Ľ'; H['ı']='ļ'; H['Ũ']='Ŀ'; H['ũ']='ľ';
  H['Ĵ']='Ł'; H['ĵ']='ŀ'; H['Ķ']='Ń'; H['ķ']='ł';
  B['Ĭ']='Ĺ'; B['Į']='Ļ'; B['ĭ']='ĸ'; B['į']='ĺ';
  B['İ']='Ŀ'; B['ı']='ľ'; B['Ũ']='Ľ'; B['ũ']='ļ';
  B['Ĵ']='Ń'; B['ĵ']='ł'; B['Ķ']='Ł'; B['ķ']='ŀ';
  // Cardinal R-slope partials
  _corner4('ļ','Ľ','ľ','Ŀ');
  _corner4('ŀ','Ł','ł','Ń');
  _diag4('ĸ','Ĺ','ĺ','Ļ');
  // R→L on horizontal/both flip
  H['ĸ']='Į'; H['ĺ']='Ĭ'; H['Ĺ']='į'; H['Ļ']='ĭ';
  H['ļ']='ı'; H['Ľ']='İ'; H['ľ']='ũ'; H['Ŀ']='Ũ';
  H['ŀ']='ĵ'; H['Ł']='Ĵ'; H['ł']='ķ'; H['Ń']='Ķ';
  B['ĸ']='ĭ'; B['ĺ']='į'; B['Ĺ']='Ĭ'; B['Ļ']='Į';
  B['ļ']='ũ'; B['Ľ']='Ũ'; B['ľ']='ı'; B['Ŀ']='İ';
  B['ŀ']='ķ'; B['Ł']='Ķ'; B['ł']='ĵ'; B['Ń']='Ĵ';
  // ── UL/UR/DL/DR cross-group overrides — generated from (dir,shape) table ──
  // UL → UR (H), UL → DL (V), UL → DR (B)
  H['ń']='Ŏ'; H['Ņ']='ŏ'; H['ņ']='ō'; H['Ň']='Ő'; H['ň']='Œ'; H['ŉ']='ő'; H['Ŋ']='œ'; H['ŋ']='ŕ'; H['Ō']='Ŕ';
  V['ń']='Ř'; V['Ņ']='ŗ'; V['ņ']='Ŗ'; V['Ň']='ś'; V['ň']='ř'; V['ŉ']='Ś'; V['Ŋ']='Ş'; V['ŋ']='Ŝ'; V['Ō']='ŝ';
  B['ń']='Š'; B['Ņ']='ş'; B['ņ']='š'; B['Ň']='Ť'; B['ň']='ţ'; B['ŉ']='Ţ'; B['Ŋ']='ŧ'; B['ŋ']='Ŧ'; B['Ō']='ť';
  // UR → UL (H), UR → DR (V), UR → DL (B)
  H['ō']='ņ'; H['Ŏ']='ń'; H['ŏ']='Ņ'; H['Ő']='Ň'; H['ő']='ŉ'; H['Œ']='ň'; H['œ']='Ŋ'; H['Ŕ']='Ō'; H['ŕ']='ŋ';
  V['ō']='š'; V['Ŏ']='Š'; V['ŏ']='ş'; V['Ő']='Ť'; V['ő']='Ţ'; V['Œ']='ţ'; V['œ']='ŧ'; V['Ŕ']='ť'; V['ŕ']='Ŧ';
  B['ō']='Ŗ'; B['Ŏ']='Ř'; B['ŏ']='ŗ'; B['Ő']='ś'; B['ő']='Ś'; B['Œ']='ř'; B['œ']='Ş'; B['Ŕ']='ŝ'; B['ŕ']='Ŝ';
  // DL → DR (H), DL → UL (V), DL → UR (B)
  H['Ŗ']='š'; H['ŗ']='ş'; H['Ř']='Š'; H['ř']='ţ'; H['Ś']='Ţ'; H['ś']='Ť'; H['Ŝ']='Ŧ'; H['ŝ']='ť'; H['Ş']='ŧ';
  V['Ŗ']='ņ'; V['ŗ']='Ņ'; V['Ř']='ń'; V['ř']='ň'; V['Ś']='ŉ'; V['ś']='Ň'; V['Ŝ']='ŋ'; V['ŝ']='Ō'; V['Ş']='Ŋ';
  B['Ŗ']='ō'; B['ŗ']='ŏ'; B['Ř']='Ŏ'; B['ř']='Œ'; B['Ś']='ő'; B['ś']='Ő'; B['Ŝ']='ŕ'; B['ŝ']='Ŕ'; B['Ş']='œ';
  // DR → DL (H), DR → UR (V), DR → UL (B)
  H['ş']='ŗ'; H['Š']='Ř'; H['š']='Ŗ'; H['Ţ']='Ś'; H['ţ']='ř'; H['Ť']='ś'; H['ť']='ŝ'; H['Ŧ']='Ŝ'; H['ŧ']='Ş';
  V['ş']='ŏ'; V['Š']='Ŏ'; V['š']='ō'; V['Ţ']='ő'; V['ţ']='Œ'; V['Ť']='Ő'; V['ť']='Ŕ'; V['Ŧ']='ŕ'; V['ŧ']='œ';
  B['ş']='Ņ'; B['Š']='ń'; B['š']='ņ'; B['Ţ']='ŉ'; B['ţ']='ň'; B['Ť']='Ň'; B['ť']='Ō'; B['Ŧ']='ŋ'; B['ŧ']='Ŋ';
  // Ghost walls (cardinal one-way)
  H['J']='K'; H['K']='J';
  V['L']='M'; V['M']='L';
  B['J']='K'; B['K']='J'; B['L']='M'; B['M']='L';
  // Phantom walls (diagonal one-way)
  H['-']='!'; H['!']='-'; H[',']=';'; H[';']=',';
  V['-']=','; V[',']='-'; V['!']=';'; V[';']='!';
  B['-']=';'; B[';']='-'; B['!']=','; B[',']='!';

  function transformLayer(layer, mode) {
    const h = layer.length, w = layer[0].length;
    const xf = XFORM[mode];
    const result = [];
    for (let r = 0; r < h; r++) {
      result[r] = [];
      for (let c = 0; c < w; c++) {
        let sr = r, sc = c;
        if (mode === 'h') sc = w - 1 - c;
        else if (mode === 'v') sr = h - 1 - r;
        else { sc = w - 1 - c; sr = h - 1 - r; }
        const ch = layer[sr][sc];
        result[r][c] = xf[ch] || ch;
      }
    }
    return result;
  }

  // ── Map parsing ───────────────────────────────────────────────────────────

  function parseMap(input, variationMode) {
    let ground, walls, groundLayers = [];
    let swapRadiiData = {}, bhRadiiData = {};
    let legacySwapRadius, legacyBhRadius;

    if (input.trim().startsWith("{")) {
      const data = JSON.parse(input);
      ground = data.ground.map((r) => r.split(""));
      walls = data.walls.map((r) => r.split(""));
      if (data.groundLayers) {
        groundLayers = data.groundLayers.map(layer => layer.map(r => r.split("")));
      }
      if (data.swapRadii) swapRadiiData = data.swapRadii;
      if (data.bhRadii) bhRadiiData = data.bhRadii;
      if (typeof data.swapRadius === 'number') legacySwapRadius = data.swapRadius;
      if (typeof data.bhRadius === 'number') legacyBhRadius = data.bhRadius;
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

    // Apply map variation transformation before extracting special tiles
    if (variationMode && variationMode !== 'none') {
      const h = ground.length, w = ground[0].length;
      ground = transformLayer(ground, variationMode);
      walls = transformLayer(walls, variationMode);
      if (groundLayers.length) {
        groundLayers = groundLayers.map(layer => transformLayer(layer, variationMode));
      }
      // Remap swapRadii/bhRadii coordinate keys
      function remapRadii(data) {
        const result = {};
        for (const key of Object.keys(data)) {
          const [c, r] = key.split(',').map(Number);
          let nc = c, nr = r;
          if (variationMode === 'h') nc = w - 1 - c;
          else if (variationMode === 'v') nr = h - 1 - r;
          else { nc = w - 1 - c; nr = h - 1 - r; }
          result[nc + ',' + nr] = data[key];
        }
        return result;
      }
      if (Object.keys(swapRadiiData).length) swapRadiiData = remapRadii(swapRadiiData);
      if (Object.keys(bhRadiiData).length) bhRadiiData = remapRadii(bhRadiiData);
    }

    let startX = null,
      startY = null;
    const starts = [];
    const holes = [];
    const tpByType = {};
    const blackHoleTiles = [];
    const swapTiles = [];
    const TP_CHARS = new Set([
      TILE.TELEPORTER,
      TILE.TELEPORTER_B,
      TILE.TELEPORTER_C,
    ]);

    const foundSpawnHole = new Set();

    for (let row = 0; row < ground.length; row++) {
      for (let col = 0; col < ground[row].length; col++) {
        const ch = ground[row][col];
        if (ch === "S") {
          const sx = col * TILE_SIZE + TILE_SIZE / 2;
          const sy = row * TILE_SIZE + TILE_SIZE / 2;
          if (startX === null) { startX = sx; startY = sy; }
          starts.push({ x: sx, y: sy });
          foundSpawnHole.add(col + ',' + row);
          ground[row][col] = ".";
        } else if (ch === TILE.HOLE) {
          holes.push({
            x: col * TILE_SIZE + TILE_SIZE / 2,
            y: row * TILE_SIZE + TILE_SIZE / 2,
          });
          foundSpawnHole.add(col + ',' + row);
          ground[row][col] = ".";
        } else if (TP_CHARS.has(ch)) {
          const tp = {
            ch,
            col,
            row,
            x: col * TILE_SIZE + TILE_SIZE / 2,
            y: row * TILE_SIZE + TILE_SIZE / 2,
          };
          (tpByType[ch] = tpByType[ch] || []).push(tp);
          ground[row][col] = ".";
        } else if (ch === TILE.BLACKHOLE) {
          const bhEntry = { col, row, dormant: false, ch };
          const bhR = bhRadiiData[col + ',' + row] ?? legacyBhRadius;
          if (bhR != null) bhEntry.radius = bhR;
          blackHoleTiles.push(bhEntry);
          ground[row][col] = ".";
        } else if (ch === TILE.SWAP) {
          const swEntry = { col, row, ch };
          const swR = swapRadiiData[col + ',' + row] ?? legacySwapRadius;
          if (swR != null) swEntry.radius = swR;
          swapTiles.push(swEntry);
          ground[row][col] = ".";
        }
      }
    }
    // Scan ground layers for spawn/hole objects placed on any surface
    if (groundLayers) {
      for (let li = 0; li < groundLayers.length; li++) {
        const layer = groundLayers[li];
        for (let row = 0; row < layer.length; row++) {
          for (let col = 0; col < layer[row].length; col++) {
            const ch = layer[row][col];
            if (ch === "S") {
              const key = col + ',' + row;
              if (!foundSpawnHole.has(key)) {
                foundSpawnHole.add(key);
                const sx = col * TILE_SIZE + TILE_SIZE / 2;
                const sy = row * TILE_SIZE + TILE_SIZE / 2;
                if (startX === null) { startX = sx; startY = sy; }
                starts.push({ x: sx, y: sy });
              }
              layer[row][col] = ".";
            } else if (ch === TILE.HOLE) {
              const key = col + ',' + row;
              if (!foundSpawnHole.has(key)) {
                foundSpawnHole.add(key);
                holes.push({
                  x: col * TILE_SIZE + TILE_SIZE / 2,
                  y: row * TILE_SIZE + TILE_SIZE / 2,
                });
              }
              layer[row][col] = ".";
            } else if (TP_CHARS.has(ch)) {
              const tp = { ch, col, row, x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
              (tpByType[ch] = tpByType[ch] || []).push(tp);
              layer[row][col] = ".";
            } else if (ch === TILE.BLACKHOLE) {
              const bhEntry = { col, row, dormant: false, ch };
              const bhR = bhRadiiData[col + ',' + row] ?? legacyBhRadius;
              if (bhR != null) bhEntry.radius = bhR;
              blackHoleTiles.push(bhEntry);
              layer[row][col] = ".";
            } else if (ch === TILE.SWAP) {
              const swEntry = { col, row, ch };
              const swR = swapRadiiData[col + ',' + row] ?? legacySwapRadius;
              if (swR != null) swEntry.radius = swR;
              swapTiles.push(swEntry);
              layer[row][col] = ".";
            }
          }
        }
      }
    }

    const teleporterPairs = [];
    Object.values(tpByType).forEach((tiles) => {
      for (let i = 0; i + 1 < tiles.length; i += 2) {
        const pair = [tiles[i], tiles[i + 1]];
        pair.uses = 0;
        teleporterPairs.push(pair);
      }
    });

    return {
      ground,
      walls,
      tiles: walls,
      groundLayers,
      width: (ground[0] || []).length,
      height: ground.length,
      startX,
      startY,
      starts,
      holes,
      teleporterPairs,
      blackHoleTiles,
      swapTiles,
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
      _tpOccupied: new Set(),
      _tpExitTile: null,
      _wasOnSwap: false,
      _wasOnBlackHole: false,
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

  function isDiagHypAt(tile, lx, ly) {
    const m = DIAG_WALL_META[tile];
    if (!m) return false;
    const isUB = m.shape === "UR" || m.shape === "LL";
    return isUB
      ? (lx === 0 && ly === 0) || (lx === TILE_SIZE && ly === TILE_SIZE)
      : (lx === TILE_SIZE && ly === 0) || (lx === 0 && ly === TILE_SIZE);
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

        // Skip ghost corners between adjacent wall-type tiles (square or diagonal)
        const onCornerX = cx === left || cx === right;
        const onCornerY = cy === top || cy === bottom;
        if (onCornerX && onCornerY) {
          const adjCol = cx === left ? col - 1 : col + 1;
          const adjRow = cy === top ? row - 1 : row + 1;
          if (
            wallRestitution(getTile(tiles, adjCol, row)) !== undefined ||
            wallRestitution(getTile(tiles, col, adjRow)) !== undefined ||
            isDiagHypAt(getTile(tiles, adjCol, row), cx - adjCol * TILE_SIZE, cy - row * TILE_SIZE) ||
            isDiagHypAt(getTile(tiles, col, adjRow), cx - col * TILE_SIZE, cy - adjRow * TILE_SIZE)
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

  // ── Arc geometry ──────────────────────────────────────────────────────────
  // ox,oy: arc center as multiples of TILE_SIZE from tile origin.
  // sx,sy: sign of the open quadrant direction from center.
  // Shared by both CURVE_META (concave) and BUMP_META (convex) — same geometry, opposite collision logic.
  const CORNER_GEO = {
    TL: { ox: 1, oy: 1, sx: -1, sy: -1 },
    TR: { ox: 0, oy: 1, sx: +1, sy: -1 },
    BL: { ox: 1, oy: 0, sx: -1, sy: +1 },
    BR: { ox: 0, oy: 0, sx: +1, sy: +1 },
  };

  // CURVE_META: concave arc tiles — ball is in the open area, pushed inward when too far from center.
  // Wall convention (post-inversion fix): BUMP_* chars are the concave wall tiles.
  // Ground tiles: all CURVE_* surface tiles use concave collision.
  const CURVE_META = {};
  [
    [TILE.BUMP_TL,
     TILE.SAND_CURVE_TL, TILE.WATER_CURVE_TL, TILE.LAVA_CURVE_TL,
     TILE.BOUNCY_BUMP_TL, TILE.STICKY_BUMP_TL,
     TILE.SLOPE_CURVE_TL,
     TILE.SLOPE_U_CURVE_TL, TILE.SLOPE_D_CURVE_TL, TILE.SLOPE_L_CURVE_TL, TILE.SLOPE_R_CURVE_TL,
      TILE.SLOPE_UR_CURVE_TL, TILE.SLOPE_DL_CURVE_TL, TILE.SLOPE_DR_CURVE_TL,
      TILE.ICE_CURVE_TL, TILE.SNOW_CURVE_TL],
    [TILE.BUMP_TR,
      TILE.SAND_CURVE_TR, TILE.WATER_CURVE_TR, TILE.LAVA_CURVE_TR,
      TILE.BOUNCY_BUMP_TR, TILE.STICKY_BUMP_TR,
      TILE.SLOPE_CURVE_TR,
      TILE.SLOPE_U_CURVE_TR, TILE.SLOPE_D_CURVE_TR, TILE.SLOPE_L_CURVE_TR, TILE.SLOPE_R_CURVE_TR,
      TILE.SLOPE_UL_CURVE_TR, TILE.SLOPE_DL_CURVE_TR, TILE.SLOPE_DR_CURVE_TR,
      TILE.ICE_CURVE_TR, TILE.SNOW_CURVE_TR],
    [TILE.BUMP_BL,
      TILE.SAND_CURVE_BL, TILE.WATER_CURVE_BL, TILE.LAVA_CURVE_BL,
      TILE.BOUNCY_BUMP_BL, TILE.STICKY_BUMP_BL,
      TILE.SLOPE_CURVE_BL,
      TILE.SLOPE_U_CURVE_BL, TILE.SLOPE_D_CURVE_BL, TILE.SLOPE_L_CURVE_BL, TILE.SLOPE_R_CURVE_BL,
      TILE.SLOPE_UL_CURVE_BL, TILE.SLOPE_UR_CURVE_BL, TILE.SLOPE_DR_CURVE_BL,
      TILE.ICE_CURVE_BL, TILE.SNOW_CURVE_BL],
    [TILE.BUMP_BR,
      TILE.SAND_CURVE_BR, TILE.WATER_CURVE_BR, TILE.LAVA_CURVE_BR,
      TILE.BOUNCY_BUMP_BR, TILE.STICKY_BUMP_BR,
      TILE.SLOPE_CURVE_BR,
      TILE.SLOPE_U_CURVE_BR, TILE.SLOPE_D_CURVE_BR, TILE.SLOPE_L_CURVE_BR, TILE.SLOPE_R_CURVE_BR,
      TILE.SLOPE_UL_CURVE_BR, TILE.SLOPE_UR_CURVE_BR, TILE.SLOPE_DL_CURVE_BR,
      TILE.ICE_CURVE_BR, TILE.SNOW_CURVE_BR],
  ].forEach((group, i) => {
    const geo = CORNER_GEO[["TL", "TR", "BL", "BR"][i]];
    group.forEach(t => { CURVE_META[t] = geo; });
  });

  // ── Diagonal wall metadata ────────────────────────────────────────────────
  // Each entry: outward normal (nx,ny) pointing from wall into fairway.
  const DIAG_WALL_META = {};
  [
    ["UR", -1 / Math.SQRT2, +1 / Math.SQRT2, [TILE.WALL_UR, TILE.BOUNCY_WALL_UR, TILE.STICKY_WALL_UR]],
    ["LL", +1 / Math.SQRT2, -1 / Math.SQRT2, [TILE.WALL_LL, TILE.BOUNCY_WALL_LL, TILE.STICKY_WALL_LL]],
    ["UL", +1 / Math.SQRT2, +1 / Math.SQRT2, [TILE.WALL_UL, TILE.BOUNCY_WALL_UL, TILE.STICKY_WALL_UL]],
    ["LR", -1 / Math.SQRT2, -1 / Math.SQRT2, [TILE.WALL_LR, TILE.BOUNCY_WALL_LR, TILE.STICKY_WALL_LR]],
  ].forEach(([shape, nx, ny, tiles]) => {
    tiles.forEach(t => { DIAG_WALL_META[t] = { nx, ny, shape }; });
  });

  // BUMP_META: convex arc tiles — ball is pushed outward when too close to center.
  // Wall convention: CURVE_* chars are the convex wall tiles.
  // Ground tiles: all BUMP_* surface tiles use convex collision.
  const BUMP_META = {};
  [
    [TILE.CURVE_TL,
     TILE.SAND_BUMP_TL, TILE.WATER_BUMP_TL, TILE.LAVA_BUMP_TL,
     TILE.BOUNCY_CURVE_TL, TILE.STICKY_CURVE_TL,
     TILE.SLOPE_BUMP_TL,
     TILE.SLOPE_U_BUMP_TL, TILE.SLOPE_D_BUMP_TL, TILE.SLOPE_L_BUMP_TL, TILE.SLOPE_R_BUMP_TL,
      TILE.SLOPE_UR_BUMP_TL, TILE.SLOPE_DL_BUMP_TL, TILE.SLOPE_DR_BUMP_TL,
      TILE.ICE_BUMP_TL, TILE.SNOW_BUMP_TL],
    [TILE.CURVE_TR,
      TILE.SAND_BUMP_TR, TILE.WATER_BUMP_TR, TILE.LAVA_BUMP_TR,
      TILE.BOUNCY_CURVE_TR, TILE.STICKY_CURVE_TR,
      TILE.SLOPE_BUMP_TR,
      TILE.SLOPE_U_BUMP_TR, TILE.SLOPE_D_BUMP_TR, TILE.SLOPE_L_BUMP_TR, TILE.SLOPE_R_BUMP_TR,
      TILE.SLOPE_UL_BUMP_TR, TILE.SLOPE_DL_BUMP_TR, TILE.SLOPE_DR_BUMP_TR,
      TILE.ICE_BUMP_TR, TILE.SNOW_BUMP_TR],
    [TILE.CURVE_BL,
      TILE.SAND_BUMP_BL, TILE.WATER_BUMP_BL, TILE.LAVA_BUMP_BL,
      TILE.BOUNCY_CURVE_BL, TILE.STICKY_CURVE_BL,
      TILE.SLOPE_BUMP_BL,
      TILE.SLOPE_U_BUMP_BL, TILE.SLOPE_D_BUMP_BL, TILE.SLOPE_L_BUMP_BL, TILE.SLOPE_R_BUMP_BL,
      TILE.SLOPE_UL_BUMP_BL, TILE.SLOPE_UR_BUMP_BL, TILE.SLOPE_DR_BUMP_BL,
      TILE.ICE_BUMP_BL, TILE.SNOW_BUMP_BL],
    [TILE.CURVE_BR,
      TILE.SAND_BUMP_BR, TILE.WATER_BUMP_BR, TILE.LAVA_BUMP_BR,
      TILE.BOUNCY_CURVE_BR, TILE.STICKY_CURVE_BR,
      TILE.SLOPE_BUMP_BR,
      TILE.SLOPE_U_BUMP_BR, TILE.SLOPE_D_BUMP_BR, TILE.SLOPE_L_BUMP_BR, TILE.SLOPE_R_BUMP_BR,
      TILE.SLOPE_UL_BUMP_BR, TILE.SLOPE_UR_BUMP_BR, TILE.SLOPE_DL_BUMP_BR,
      TILE.ICE_BUMP_BR, TILE.SNOW_BUMP_BR],
  ].forEach((group, i) => {
    const geo = CORNER_GEO[["TL", "TR", "BL", "BR"][i]];
    group.forEach(t => { BUMP_META[t] = geo; });
  });

  // Shape codes for diagonal slope tiles: 0=UR(bx>by), 1=LL(by>bx), 2=UL(bx+by<T), 3=LR(bx+by>T)
  const DIAG_SLOPE_META = {};
  [
    [0, [TILE.SLOPE_DIAG_UR,
         TILE.SLOPE_U_DIAG_UR, TILE.SLOPE_D_DIAG_UR, TILE.SLOPE_L_DIAG_UR, TILE.SLOPE_R_DIAG_UR,
         TILE.SLOPE_UL_DIAG_UR, TILE.SLOPE_DL_DIAG_UR, TILE.SLOPE_DR_DIAG_UR]],
    [1, [TILE.SLOPE_DIAG_DL,
         TILE.SLOPE_U_DIAG_LL, TILE.SLOPE_D_DIAG_LL, TILE.SLOPE_L_DIAG_LL, TILE.SLOPE_R_DIAG_LL,
         TILE.SLOPE_UL_DIAG_LL, TILE.SLOPE_UR_DIAG_LL, TILE.SLOPE_DR_DIAG_LL]],
    [2, [TILE.SLOPE_DIAG_UL,
         TILE.SLOPE_U_DIAG_UL, TILE.SLOPE_D_DIAG_UL, TILE.SLOPE_L_DIAG_UL, TILE.SLOPE_R_DIAG_UL,
         TILE.SLOPE_UR_DIAG_UL, TILE.SLOPE_DL_DIAG_UL, TILE.SLOPE_DR_DIAG_UL]],
    [3, [TILE.SLOPE_DIAG_DR,
         TILE.SLOPE_U_DIAG_LR, TILE.SLOPE_D_DIAG_LR, TILE.SLOPE_L_DIAG_LR, TILE.SLOPE_R_DIAG_LR,
         TILE.SLOPE_UL_DIAG_LR, TILE.SLOPE_UR_DIAG_LR, TILE.SLOPE_DL_DIAG_LR]],
  ].forEach(([code, tiles]) => {
    tiles.forEach(t => { DIAG_SLOPE_META[t] = code; });
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

          // Ghost-corner suppression at hypotenuse endpoints.
          // UR/LL share the TL↔BR diagonal; UL/LR share the TR↔BL diagonal.
          // When two compatible diagonals meet at a shared hypotenuse vertex,
          // the ball sees a phantom corner instead of a flat surface. Detect
          // this and substitute the hypotenuse normal (same as `inside` branch).
          const isUBGroup = meta.shape === "UR" || meta.shape === "LL";
          const isHypVert = isUBGroup
            ? (qx === 0 && qy === 0) || (qx === T && qy === T)
            : (qx === T && qy === 0) || (qx === 0 && qy === T);
          if (isHypVert) {
            const gCol = col + (qx > 0 ? 1 : 0);
            const gRow = row + (qy > 0 ? 1 : 0);
            let useHyp = false;
            for (const [nc, nr] of [[gCol-1,gRow-1],[gCol,gRow-1],[gCol-1,gRow],[gCol,gRow]]) {
              if (nc === col && nr === row) continue;
              const nbrTile = getTile(tiles, nc, nr);
              if (isDiagHypAt(nbrTile, (gCol - nc) * TILE_SIZE, (gRow - nr) * TILE_SIZE) || wallRestitution(nbrTile) !== undefined) {
                useHyp = true;
                break;
              }
            }
            if (useHyp) {
              const S2 = Math.SQRT2;
              const dHyp =
                meta.shape === "UR" ? (by - bx) / S2
                : meta.shape === "LL" ? (bx - by) / S2
                : meta.shape === "UL" ? (bx + by - T) / S2
                : (T - bx - by) / S2;
              const hypOverlap = r - dHyp;
              if (hypOverlap > 0) {
                ball.x += meta.nx * hypOverlap;
                ball.y += meta.ny * hypOverlap;
                const dot = ball.vx * meta.nx + ball.vy * meta.ny;
                if (dot < 0) bounceVelocity(ball, meta.nx, meta.ny, dot, tile);
              }
              continue;
            }
          }

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
  function updateBall(ball, wallTiles, groundTiles, groundLayers) {
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

    const curTile = gt ? getSurfaceAt(gt, ball.x, ball.y, groundLayers) : null;
    const f = isIceTile(curTile)
      ? ICE_FRICTION
      : isSnowTile(curTile)
        ? SNOW_FRICTION
        : isSandTile(curTile)
          ? SAND_FRICTION
          : isSlopeTile(curTile)
            ? SLOPE_ROLL_FRICTION
            : FRICTION;
    ball.vx *= f;
    ball.vy *= f;

    const F2 = SLOPE_FORCE / Math.SQRT2;
    if (curTile === TILE.SLOPE_U ||
        curTile === TILE.SLOPE_U_DIAG_UR || curTile === TILE.SLOPE_U_DIAG_LL ||
        curTile === TILE.SLOPE_U_DIAG_UL || curTile === TILE.SLOPE_U_DIAG_LR ||
        curTile === TILE.SLOPE_U_CURVE_TL || curTile === TILE.SLOPE_U_CURVE_TR ||
        curTile === TILE.SLOPE_U_CURVE_BL || curTile === TILE.SLOPE_U_CURVE_BR ||
        curTile === TILE.SLOPE_U_BUMP_TL || curTile === TILE.SLOPE_U_BUMP_TR ||
        curTile === TILE.SLOPE_U_BUMP_BL || curTile === TILE.SLOPE_U_BUMP_BR) {
      ball.vy -= SLOPE_FORCE;
    } else if (curTile === TILE.SLOPE_D ||
        curTile === TILE.SLOPE_D_DIAG_UR || curTile === TILE.SLOPE_D_DIAG_LL ||
        curTile === TILE.SLOPE_D_DIAG_UL || curTile === TILE.SLOPE_D_DIAG_LR ||
        curTile === TILE.SLOPE_D_CURVE_TL || curTile === TILE.SLOPE_D_CURVE_TR ||
        curTile === TILE.SLOPE_D_CURVE_BL || curTile === TILE.SLOPE_D_CURVE_BR ||
        curTile === TILE.SLOPE_D_BUMP_TL || curTile === TILE.SLOPE_D_BUMP_TR ||
        curTile === TILE.SLOPE_D_BUMP_BL || curTile === TILE.SLOPE_D_BUMP_BR) {
      ball.vy += SLOPE_FORCE;
    } else if (curTile === TILE.SLOPE_L ||
        curTile === TILE.SLOPE_L_DIAG_UR || curTile === TILE.SLOPE_L_DIAG_LL ||
        curTile === TILE.SLOPE_L_DIAG_UL || curTile === TILE.SLOPE_L_DIAG_LR ||
        curTile === TILE.SLOPE_L_CURVE_TL || curTile === TILE.SLOPE_L_CURVE_TR ||
        curTile === TILE.SLOPE_L_CURVE_BL || curTile === TILE.SLOPE_L_CURVE_BR ||
        curTile === TILE.SLOPE_L_BUMP_TL || curTile === TILE.SLOPE_L_BUMP_TR ||
        curTile === TILE.SLOPE_L_BUMP_BL || curTile === TILE.SLOPE_L_BUMP_BR) {
      ball.vx -= SLOPE_FORCE;
    } else if (curTile === TILE.SLOPE_R ||
        curTile === TILE.SLOPE_R_DIAG_UR || curTile === TILE.SLOPE_R_DIAG_LL ||
        curTile === TILE.SLOPE_R_DIAG_UL || curTile === TILE.SLOPE_R_DIAG_LR ||
        curTile === TILE.SLOPE_R_CURVE_TL || curTile === TILE.SLOPE_R_CURVE_TR ||
        curTile === TILE.SLOPE_R_CURVE_BL || curTile === TILE.SLOPE_R_CURVE_BR ||
        curTile === TILE.SLOPE_R_BUMP_TL || curTile === TILE.SLOPE_R_BUMP_TR ||
        curTile === TILE.SLOPE_R_BUMP_BL || curTile === TILE.SLOPE_R_BUMP_BR) {
      ball.vx += SLOPE_FORCE;
    } else if (
      curTile === TILE.SLOPE_UL ||
      curTile === TILE.SLOPE_DIAG_UL || curTile === TILE.SLOPE_CURVE_TL || curTile === TILE.SLOPE_BUMP_TL ||
      curTile === TILE.SLOPE_UL_DIAG_UR || curTile === TILE.SLOPE_UL_DIAG_LL || curTile === TILE.SLOPE_UL_DIAG_LR ||
      curTile === TILE.SLOPE_UL_CURVE_TR || curTile === TILE.SLOPE_UL_CURVE_BL || curTile === TILE.SLOPE_UL_CURVE_BR ||
      curTile === TILE.SLOPE_UL_BUMP_TR || curTile === TILE.SLOPE_UL_BUMP_BL || curTile === TILE.SLOPE_UL_BUMP_BR
    ) {
      ball.vx -= F2;
      ball.vy -= F2;
    } else if (
      curTile === TILE.SLOPE_UR ||
      curTile === TILE.SLOPE_DIAG_UR || curTile === TILE.SLOPE_CURVE_TR || curTile === TILE.SLOPE_BUMP_TR ||
      curTile === TILE.SLOPE_UR_DIAG_LL || curTile === TILE.SLOPE_UR_DIAG_UL || curTile === TILE.SLOPE_UR_DIAG_LR ||
      curTile === TILE.SLOPE_UR_CURVE_TL || curTile === TILE.SLOPE_UR_CURVE_BL || curTile === TILE.SLOPE_UR_CURVE_BR ||
      curTile === TILE.SLOPE_UR_BUMP_TL || curTile === TILE.SLOPE_UR_BUMP_BL || curTile === TILE.SLOPE_UR_BUMP_BR
    ) {
      ball.vx += F2;
      ball.vy -= F2;
    } else if (
      curTile === TILE.SLOPE_DL ||
      curTile === TILE.SLOPE_DIAG_DL || curTile === TILE.SLOPE_CURVE_BL || curTile === TILE.SLOPE_BUMP_BL ||
      curTile === TILE.SLOPE_DL_DIAG_UR || curTile === TILE.SLOPE_DL_DIAG_UL || curTile === TILE.SLOPE_DL_DIAG_LR ||
      curTile === TILE.SLOPE_DL_CURVE_TL || curTile === TILE.SLOPE_DL_CURVE_TR || curTile === TILE.SLOPE_DL_CURVE_BR ||
      curTile === TILE.SLOPE_DL_BUMP_TL || curTile === TILE.SLOPE_DL_BUMP_TR || curTile === TILE.SLOPE_DL_BUMP_BR
    ) {
      ball.vx -= F2;
      ball.vy += F2;
    } else if (
      curTile === TILE.SLOPE_DR ||
      curTile === TILE.SLOPE_DIAG_DR || curTile === TILE.SLOPE_CURVE_BR || curTile === TILE.SLOPE_BUMP_BR ||
      curTile === TILE.SLOPE_DR_DIAG_UR || curTile === TILE.SLOPE_DR_DIAG_LL || curTile === TILE.SLOPE_DR_DIAG_UL ||
      curTile === TILE.SLOPE_DR_CURVE_TL || curTile === TILE.SLOPE_DR_CURVE_TR || curTile === TILE.SLOPE_DR_CURVE_BL ||
      curTile === TILE.SLOPE_DR_BUMP_TL || curTile === TILE.SLOPE_DR_BUMP_TR || curTile === TILE.SLOPE_DR_BUMP_BL
    ) {
      ball.vx += F2;
      ball.vy += F2;
    }

    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > MAX_VELOCITY) {
      const scale = MAX_VELOCITY / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
    if (speed < MIN_SPEED && !isSlopeTile(curTile) && !isIceTile(curTile)) {
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

  function isOnTeleporter(ball, teleporterPairs) {
    const r2 = (TILE_SIZE / 2) ** 2;
    const occupied = new Set();
    for (const pair of teleporterPairs) {
      for (const tp of pair) {
        const key = `${tp.col},${tp.row}`;
        if ((ball.x - tp.x) ** 2 + (ball.y - tp.y) ** 2 < r2) occupied.add(key);
      }
    }
    return occupied;
  }

  function checkTeleporter(ball, pairs) {
    const r2 = (TILE_SIZE / 2) * (TILE_SIZE / 2);
    for (const pair of pairs) {
      if (pair.uses >= 5) continue;
      const [a, b] = pair;
      const aKey = `${a.col},${a.row}`;
      const bKey = `${b.col},${b.row}`;
      if ((ball.x - a.x) ** 2 + (ball.y - a.y) ** 2 < r2) {
        if (ball._tpOccupied.has(aKey) || ball._tpExitTile === aKey) continue;
        pair.uses++;
        ball._tpExitTile = bKey;
        return b;
      }
      if ((ball.x - b.x) ** 2 + (ball.y - b.y) ** 2 < r2) {
        if (ball._tpOccupied.has(bKey) || ball._tpExitTile === bKey) continue;
        pair.uses++;
        ball._tpExitTile = aKey;
        return a;
      }
    }
    return null;
  }

  // ── Swap detection (circular hitbox, radius = TILE_SIZE/2) ───────────────
  // Returns the swap tile {col,row} the ball is on, or null.

  function checkSwap(ball, swapTiles) {
    const r2 = (TILE_SIZE / 2) ** 2;
    for (const sw of swapTiles) {
      const cx = sw.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = sw.row * TILE_SIZE + TILE_SIZE / 2;
      if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 < r2) return { col: sw.col, row: sw.row };
    }
    return null;
  }

  // ── Black hole detection & impulse ───────────────────────────────────────

  function checkBlackHole(ball, blackHoleTiles) {
    const r2 = (TILE_SIZE / 2) ** 2;
    for (const bh of blackHoleTiles) {
      const cx = bh.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = bh.row * TILE_SIZE + TILE_SIZE / 2;
      if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 < r2) return true;
    }
    return false;
  }

  function getActiveBlackHole(ball, blackHoleTiles) {
    const r2 = (TILE_SIZE / 2) ** 2;
    for (const bh of blackHoleTiles) {
      if (bh.dormant) continue;
      const cx = bh.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = bh.row * TILE_SIZE + TILE_SIZE / 2;
      if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 < r2) return bh;
    }
    return null;
  }

  function applyBlackHoleImpulse(ball, bhX, bhY) {
    const dx = bhX - ball.x, dy = bhY - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const v = BH_IMPULSE_FACTOR * dist * (1 - FRICTION);
    ball.vx += (dx / dist) * v;
    ball.vy += (dy / dist) * v;
  }

  // ── Tile helpers ──────────────────────────────────────────────────────────

  function getTile(tiles, col, row) {
    if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length)
      return TILE.WALL;
    return tiles[row][col];
  }

  function getCellContent(col, row, groundTiles, groundLayers) {
    if (groundLayers) {
      for (let i = groundLayers.length - 1; i >= 0; i--) {
        const ch = getTile(groundLayers[i], col, row);
        if (ch !== ".") return ch;
      }
    }
    return getTile(groundTiles, col, row);
  }

  function tileAt(tiles, worldX, worldY) {
    return getTile(
      tiles,
      Math.floor(worldX / TILE_SIZE),
      Math.floor(worldY / TILE_SIZE),
    );
  }

  function _surfaceAt(groundTiles, worldX, worldY) {
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

    // Diagonal ice (same shapes as sand)
    if (tile === TILE.ICE_UR) return bx > by ? tile : TILE.EMPTY;
    if (tile === TILE.ICE_LL) return by > bx ? tile : TILE.EMPTY;
    if (tile === TILE.ICE_UL) return bx + by < T ? tile : TILE.EMPTY;
    if (tile === TILE.ICE_LR) return bx + by > T ? tile : TILE.EMPTY;

    // Diagonal snow (same shapes as sand)
    if (tile === TILE.SNOW_UR) return bx > by ? tile : TILE.EMPTY;
    if (tile === TILE.SNOW_LL) return by > bx ? tile : TILE.EMPTY;
    if (tile === TILE.SNOW_UL) return bx + by < T ? tile : TILE.EMPTY;
    if (tile === TILE.SNOW_LR) return bx + by > T ? tile : TILE.EMPTY;

    // Diagonal slope variants (all shapes, all force directions)
    const diagSlopeShape = DIAG_SLOPE_META[tile];
    if (diagSlopeShape !== undefined) {
      if (diagSlopeShape === 0) return bx > by ? tile : TILE.EMPTY;
      if (diagSlopeShape === 1) return by > bx ? tile : TILE.EMPTY;
      if (diagSlopeShape === 2) return bx + by < T ? tile : TILE.EMPTY;
      return bx + by > T ? tile : TILE.EMPTY;
    }

    // Curve terrain: terrain inside the arc (dist < T from arc center)
    const curveMeta = CURVE_META[tile];
    if (
      curveMeta &&
      (isSandTile(tile) || isWaterTile(tile) || isLavaTile(tile) || isSlopeTile(tile) || isIceTile(tile) || isSnowTile(tile))
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
      (isSandTile(tile) || isWaterTile(tile) || isLavaTile(tile) || isSlopeTile(tile) || isIceTile(tile) || isSnowTile(tile))
    ) {
      const ax = col * T + bumpMeta.ox * T;
      const ay = row * T + bumpMeta.oy * T;
      const dx = worldX - ax;
      const dy = worldY - ay;
      return Math.sqrt(dx * dx + dy * dy) > T ? tile : TILE.EMPTY;
    }

    return tile;
  }

  function getSurfaceAt(groundTiles, worldX, worldY, groundLayers) {
    if (groundLayers) {
      for (let i = groundLayers.length - 1; i >= 0; i--) {
        const result = _surfaceAt(groundLayers[i], worldX, worldY);
        if (result !== TILE.EMPTY) return result;
      }
    }
    return _surfaceAt(groundTiles, worldX, worldY);
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
    get ICE_FRICTION() {
      return ICE_FRICTION;
    },
    set ICE_FRICTION(v) {
      ICE_FRICTION = v;
    },
    get SNOW_FRICTION() {
      return SNOW_FRICTION;
    },
    set SNOW_FRICTION(v) {
      SNOW_FRICTION = v;
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
    get BH_IMPULSE_FACTOR() {
      return BH_IMPULSE_FACTOR;
    },
    set BH_IMPULSE_FACTOR(v) {
      BH_IMPULSE_FACTOR = v;
    },
    get BH_RADIUS_TILES() {
      return BH_RADIUS_TILES;
    },
    set BH_RADIUS_TILES(v) {
      BH_RADIUS_TILES = v;
    },
    get SWAP_RADIUS_TILES() {
      return SWAP_RADIUS_TILES;
    },
    set SWAP_RADIUS_TILES(v) {
      SWAP_RADIUS_TILES = v;
    },
    VERSION,
    TILE_SIZE,
    POWER_EXP,
    TILE,
    WALL_CHARS_SET,
    ICE_SET,
    SNOW_SET,
    isSandTile,
    isIceTile,
    isSnowTile,
    isWaterTile,
    isSlopeTile,
    isLavaTile,
    isSwapTile,
    parseMap,
    transformLayer,
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
    checkBlackHole,
    getActiveBlackHole,
    applyBlackHoleImpulse,
    getTile,
    tileAt,
    getSurfaceAt,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Physics;
}
