'use strict';
const fs = require('fs');
const path = require('path');
const Physics = require('../public/js/physics.js');

// ── Helpers ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS  ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL  ${msg}`);
    failed++;
  }
}

function runShot(label, startX, startY, targetX, targetY, maxFrames = 3000) {
  console.log(`\n▶ ${label}`);
  const ball = Physics.createBall(startX, startY);
  Physics.launchBall(ball, targetX, targetY);

  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const power = Math.min(dist * Physics.POWER_SCALE, Physics.MAX_POWER);
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  console.log(`  dist=${dist.toFixed(1)}px  power=${power.toFixed(2)}  vx=${ball.vx.toFixed(3)}  vy=${ball.vy.toFixed(3)}`);

  let frame = 0;
  while (frame < maxFrames) {
    Physics.updateBall(ball);
    frame++;

    const hole = Physics.checkHole(ball, map.holes);
    if (hole) {
      console.log(`  ⬤ SUNK  frame=${frame}  pos=(${ball.x.toFixed(1)}, ${ball.y.toFixed(1)})`);
      return 'sunk';
    }
    if (!Physics.isMoving(ball)) {
      console.log(`  ■ STOP  frame=${frame}  pos=(${ball.x.toFixed(1)}, ${ball.y.toFixed(1)})`);
      return 'stopped';
    }
    if (frame % 60 === 0) {
      const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      console.log(`  f${String(frame).padStart(4)}  pos=(${ball.x.toFixed(1)}, ${ball.y.toFixed(1)})  speed=${spd.toFixed(3)}`);
    }
  }
  console.log(`  ✗ TIMEOUT after ${maxFrames} frames`);
  return 'timeout';
}

// ── Load map ──────────────────────────────────────────────────────────────

const mapText = fs.readFileSync(path.join(__dirname, '../maps/hole1.json'), 'utf-8');
const map = Physics.parseMap(mapText);

console.log('════════════════════════════════════════');
console.log('  Canagolf Physics Simulator');
console.log('════════════════════════════════════════');
console.log(`  Map   : ${map.width}×${map.height} tiles  (${map.width * Physics.TILE_SIZE}×${map.height * Physics.TILE_SIZE} px)`);
console.log(`  Start : (${map.startX}, ${map.startY})`);
console.log(`  Holes : ${map.holes.map(h => `(${h.x},${h.y})`).join('  ')}`);

// ── Test 1: Direct shot toward hole ──────────────────────────────────────
{
  const result = runShot(
    'Direct shot at hole',
    map.startX, map.startY,
    map.holes[0].x, map.holes[0].y
  );
  assert(result === 'sunk', 'Ball sinks when aimed directly at hole');
}

// ── Test 2: Power capping ─────────────────────────────────────────────────
{
  console.log('\n▶ Power capping');
  const b = Physics.createBall(0, 0);
  Physics.launchBall(b, 10000, 0);   // cursor ridiculously far away
  const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  console.log(`  Far cursor (10000px): speed=${spd.toFixed(4)}  max=${Physics.MAX_POWER}`);
  assert(Math.abs(spd - Physics.MAX_POWER) < 0.001, `Speed capped at MAX_POWER (${Physics.MAX_POWER})`);
}

// ── Test 3: Proportional power below max ─────────────────────────────────
{
  console.log('\n▶ Proportional power (short cursor distance)');
  const b = Physics.createBall(0, 0);
  const cursorDist = 50;
  Physics.launchBall(b, cursorDist, 0);
  const expectedPower = cursorDist * Physics.POWER_SCALE;   // 50 * 0.08 = 4 (under MAX_POWER)
  const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  console.log(`  Cursor ${cursorDist}px away: speed=${spd.toFixed(4)}  expected=${expectedPower.toFixed(4)}`);
  assert(Math.abs(spd - expectedPower) < 0.001, 'Power proportional to cursor distance below cap');
}

// ── Test 4: Direction accuracy ────────────────────────────────────────────
{
  console.log('\n▶ Direction accuracy');
  const b = Physics.createBall(0, 0);
  Physics.launchBall(b, 100, 0);   // pure horizontal right
  console.log(`  Horizontal shot: vx=${b.vx.toFixed(4)}  vy=${b.vy.toFixed(4)}`);
  assert(b.vy === 0, 'vy=0 for horizontal shot');
  assert(b.vx > 0, 'vx>0 for shot to the right');

  const b2 = Physics.createBall(0, 0);
  Physics.launchBall(b2, 0, 100);  // pure downward
  console.log(`  Downward  shot: vx=${b2.vx.toFixed(4)}  vy=${b2.vy.toFixed(4)}`);
  assert(b2.vx === 0, 'vx=0 for downward shot');
  assert(b2.vy > 0, 'vy>0 for downward shot');
}

// ── Test 5: Friction ──────────────────────────────────────────────────────
{
  console.log('\n▶ Friction deceleration');
  const b = Physics.createBall(0, 0);
  b.vx = 10;
  Physics.updateBall(b);
  const expected = 10 * Physics.FRICTION;
  console.log(`  After 1 frame: vx=${b.vx.toFixed(6)}  expected=${expected.toFixed(6)}`);
  assert(Math.abs(b.vx - expected) < 1e-9, 'Friction applied correctly after one frame');
}

// ── Test 6: Ball stops eventually ────────────────────────────────────────
{
  console.log('\n▶ Ball eventually stops');
  const b = Physics.createBall(0, 0);
  b.vx = Physics.MAX_POWER;
  let frame = 0;
  while (Physics.isMoving(b) && frame < 10000) {
    Physics.updateBall(b);
    frame++;
  }
  console.log(`  Stopped after ${frame} frames  vx=${b.vx}  vy=${b.vy}`);
  assert(!Physics.isMoving(b), 'Ball comes to rest from max power');
  assert(frame < 10000, 'Ball stops within 10000 frames');
}

// ── Test 7: No launch on zero-distance click ──────────────────────────────
{
  console.log('\n▶ No launch on zero-distance click');
  const b = Physics.createBall(100, 100);
  Physics.launchBall(b, 100, 100);   // cursor exactly on ball
  assert(!Physics.isMoving(b), 'Ball stays still when cursor is on ball');
}

// ── Curve collision tests ─────────────────────────────────────────────────
//
// Grid used: single curve tile surrounded by empties.
// We verify the ball bounces correctly off each of the 4 arc types.

function makeCurveGrid(tileChar) {
  // 3x3 grid, curve tile in the center (col 1, row 1)
  return [
    ['.', '.', '.'],
    ['.', tileChar, '.'],
    ['.', '.', '.'],
  ];
}

// For all tests: tile at col 1, row 1 → tileX=40, tileY=40
const T2 = Physics.TILE_SIZE; // 40

// Helper: run N frames and return whether ball escaped open-quadrant boundary
function runCurve(label, tileChar, startX, startY, vx, vy, frames) {
  console.log(`\n▶ ${label}`);
  const tiles = makeCurveGrid(tileChar);
  const ball  = Physics.createBall(startX, startY);
  ball.vx = vx; ball.vy = vy;

  const meta = Physics.CURVE_META[tileChar];
  // Arc center:
  const ax = T2 + meta.ox * T2;
  const ay = T2 + meta.oy * T2;
  const threshold = T2 - Physics.BALL_RADIUS;   // 32

  let maxDist = 0;
  let bounced = false;
  let prevVX = vx, prevVY = vy;

  for (let f = 0; f < frames; f++) {
    Physics.updateBall(ball, tiles);
    const dx = ball.x - ax, dy = ball.y - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only track penetration while ball is inside the open quadrant
    if (dx * meta.sx > 0 && dy * meta.sy > 0 && dist > maxDist) maxDist = dist;

    // Detect sign change in the component that should flip after bounce
    if (!bounced && (Math.sign(ball.vx) !== Math.sign(prevVX) || Math.sign(ball.vy) !== Math.sign(prevVY))) {
      bounced = true;
      console.log(`  Bounce frame ${f+1}: vx=${ball.vx.toFixed(3)} vy=${ball.vy.toFixed(3)}`);
    }
    prevVX = ball.vx; prevVY = ball.vy;
  }
  console.log(`  max dist from arc center: ${maxDist.toFixed(2)}  threshold: ${threshold}`);
  return { maxDist, bounced, ball };
}

// Test A: CURVE_BR (4) — ball in open bottom-right, shot outward (away from center)
// Arc center at (T2, T2). Ball within threshold, moving right-down (outward).
{
  const r = runCurve('Curve BR — ball bounces off concave arc', '4', 35, 35, 5, 5, 30);
  assert(r.maxDist <= Physics.TILE_SIZE - Physics.BALL_RADIUS + 0.5,
    'Ball never penetrates beyond arc surface (CURVE_BR)');
  assert(r.bounced, 'Ball reflects off CURVE_BR arc');
}

// Test B: CURVE_TL (1) — open top-left, arc center at (2*T2, 2*T2). Ball moving top-left.
{
  const r = runCurve('Curve TL — ball bounces off concave arc', '1', 49, 49, -5, -5, 30);
  assert(r.maxDist <= Physics.TILE_SIZE - Physics.BALL_RADIUS + 0.5,
    'Ball never penetrates beyond arc surface (CURVE_TL)');
  assert(r.bounced, 'Ball reflects off CURVE_TL arc');
}

// Test C: CURVE_TR (2) — open top-right, arc center at (T2, 2*T2). Ball moving right-up.
{
  const r = runCurve('Curve TR — ball bounces off concave arc', '2', 35, 49, 5, -5, 30);
  assert(r.maxDist <= Physics.TILE_SIZE - Physics.BALL_RADIUS + 0.5,
    'Ball never penetrates beyond arc surface (CURVE_TR)');
  assert(r.bounced, 'Ball reflects off CURVE_TR arc');
}

// Test D: CURVE_BL (3) — open bottom-left, arc center at (2*T2, T2). Ball moving left-down.
{
  const r = runCurve('Curve BL — ball bounces off concave arc', '3', 49, 35, -5, 5, 30);
  assert(r.maxDist <= Physics.TILE_SIZE - Physics.BALL_RADIUS + 0.5,
    'Ball never penetrates beyond arc surface (CURVE_BL)');
  assert(r.bounced, 'Ball reflects off CURVE_BL arc');
}

// Test E: Ball passing through toward arc center — should NOT bounce off arc
// (run only 8 frames so ball doesn't return from grid-wall bounces)
{
  console.log('\n▶ Curve — ball moving toward arc center (no arc bounce)');
  const tiles = makeCurveGrid('4');  // CURVE_BR, center at (T2, T2)
  const ball  = Physics.createBall(35, 35);
  ball.vx = -3; ball.vy = -3;  // moving toward arc center
  let reflected = false;
  for (let f = 0; f < 8; f++) {
    const dx0 = ball.x - T2, dy0 = ball.y - T2;
    const prevVX = ball.vx, prevVY = ball.vy;
    Physics.updateBall(ball, tiles);
    // Only flag a sign change that happened while ball was in the open quadrant
    const inQuadrant = dx0 > 0 && dy0 > 0;
    if (inQuadrant && (Math.sign(ball.vx) !== Math.sign(prevVX) || Math.sign(ball.vy) !== Math.sign(prevVY))) {
      reflected = true; break;
    }
  }
  assert(!reflected, 'Ball moving toward arc center passes through without arc bounce');
}

// ── Wall collision tests ──────────────────────────────────────────────────
//
// All use a small programmatic tile grid so we don't depend on hole1.txt layout.
// Grid layout (T = TILE_SIZE = 28):
//
//   #####    row 0  (y: 0–28)
//   #...#    row 1  (y: 28–56)
//   #...#    row 2  (y: 56–84)
//   #...#    row 3  (y: 84–112)
//   #####    row 4  (y: 112–140)
//
// Open space is cols 1–3, rows 1–3.  Center = (col2,row2) = (70, 70).

const T = Physics.TILE_SIZE;
const boxTiles = [
  ['#','#','#','#','#'],
  ['#','.','.','.','#'],
  ['#','.','.','.','#'],
  ['#','.','.','.','#'],
  ['#','#','#','#','#'],
];

// Wall boundaries (inner edges):
//   left wall right edge  = 1*T = 28   → ball must stay  x >= 28 + BALL_R = 42
//   right wall left edge  = 4*T = 112  → ball must stay  x <= 112 - BALL_R = 98
//   top wall bottom edge  = 1*T = 28   → ball must stay  y >= 28 + BALL_R = 42
//   bottom wall top edge  = 4*T = 112  → ball must stay  y <= 112 - BALL_R = 98

const BALL_R = Physics.BALL_RADIUS;
const INNER_MIN = T + BALL_R;       // 48
const INNER_MAX = 4 * T - BALL_R;   // 152

function runBox(label, startX, startY, vx, vy, frames) {
  console.log(`\n▶ ${label}`);
  const ball = Physics.createBall(startX, startY);
  ball.vx = vx;
  ball.vy = vy;
  const positions = [];
  for (let f = 0; f < frames; f++) {
    Physics.updateBall(ball, boxTiles);
    positions.push({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
  }
  return { ball, positions };
}

// Test 8: Horizontal bounce off right wall
{
  const { ball, positions } = runBox('Wall bounce — right wall (vx flips)', 70, 70, 8, 0, 60);
  const escaped = positions.some(p => p.x > INNER_MAX);
  const bounced = positions.some(p => p.vx < 0);
  const maxX    = Math.max(...positions.map(p => p.x));
  console.log(`  max x reached: ${maxX.toFixed(2)}  inner_max: ${INNER_MAX}`);
  assert(!escaped, 'Ball never passes through right wall');
  assert(bounced,  'Ball vx flips negative after right wall bounce');
}

// Test 9: Bounce off left wall
{
  const { ball, positions } = runBox('Wall bounce — left wall (vx flips)', 70, 70, -8, 0, 60);
  const escaped = positions.some(p => p.x < INNER_MIN);
  const bounced = positions.some(p => p.vx > 0);
  const minX    = Math.min(...positions.map(p => p.x));
  console.log(`  min x reached: ${minX.toFixed(2)}  inner_min: ${INNER_MIN}`);
  assert(!escaped, 'Ball never passes through left wall');
  assert(bounced,  'Ball vx flips positive after left wall bounce');
}

// Test 10: Bounce off top wall
{
  const { ball, positions } = runBox('Wall bounce — top wall (vy flips)', 70, 70, 0, -8, 60);
  const escaped = positions.some(p => p.y < INNER_MIN);
  const bounced = positions.some(p => p.vy > 0);
  assert(!escaped, 'Ball never passes through top wall');
  assert(bounced,  'Ball vy flips positive after top wall bounce');
}

// Test 11: Bounce off bottom wall
{
  const { ball, positions } = runBox('Wall bounce — bottom wall (vy flips)', 70, 70, 0, 8, 60);
  const escaped = positions.some(p => p.y > INNER_MAX);
  const bounced = positions.some(p => p.vy < 0);
  assert(!escaped, 'Ball never passes through bottom wall');
  assert(bounced,  'Ball vy flips negative after bottom wall bounce');
}

// Test 12: 45° diagonal — angle of incidence ≈ angle of reflection off a flat wall
{
  console.log('\n▶ 45° diagonal bounce — angle preservation');
  const ball = Physics.createBall(70, 70);
  ball.vx = -4;
  ball.vy = -6;
  const vxBefore = ball.vx;

  let bounced = false;
  for (let f = 0; f < 30; f++) {
    Physics.updateBall(ball, boxTiles);
    if (ball.vy > 0) {
      console.log(`  Bounce at frame ${f+1}: vx=${ball.vx.toFixed(3)} (was ${vxBefore.toFixed(3)}), vy=${ball.vy.toFixed(3)}`);
      // vy should flip; vx should stay negative (wall is horizontal, normal is vertical)
      assert(ball.vy > 0,  'vy flipped to positive after top wall bounce');
      assert(ball.vx < 0,  'vx unchanged in sign after horizontal wall bounce');
      bounced = true;
      break;
    }
  }
  assert(bounced, 'Ball bounced off top wall within 30 frames');
}

// Test 13: Ball stays contained — 500 frames of pinball in box
{
  console.log('\n▶ Long containment test — 500 frames of pinball');
  const ball = Physics.createBall(100, 100);
  ball.vx = 7;
  ball.vy = 5;
  let escaped = false;
  for (let f = 0; f < 500; f++) {
    Physics.updateBall(ball, boxTiles);
    if (ball.x < INNER_MIN || ball.x > INNER_MAX || ball.y < INNER_MIN || ball.y > INNER_MAX) {
      console.log(`  ESCAPED at frame ${f}: pos=(${ball.x.toFixed(1)},${ball.y.toFixed(1)})`);
      escaped = true;
      break;
    }
  }
  console.log(`  Final pos: (${ball.x.toFixed(2)}, ${ball.y.toFixed(2)})`);
  assert(!escaped, 'Ball stays inside box for 500 frames');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
console.log(`  ${passed} passed  ${failed} failed`);
console.log('════════════════════════════════════════');
if (failed > 0) process.exit(1);
