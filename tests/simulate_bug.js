'use strict';
const fs = require('fs');
const path = require('path');
const Physics = require('../public/js/physics.js');

const T = Physics.TILE_SIZE;
const R = Physics.BALL_RADIUS;
const HOLE_Y = 8 * T; // top edge of lower tile

function makeWallTiles(mapJson) {
  return mapJson.walls.map(r => r.split(''));
}

// Remove the upper tile for isolated-lower test
function removeUpperTile(walls) {
  return walls.map((row, r) =>
    row.map((ch, c) => (r === 7 && c === 5 ? '.' : ch))
  );
}

function simulate(label, walls, startX, startY, vx, vy, frames = 200) {
  const ball = Physics.createBall(startX, startY);
  ball.vx = vx; ball.vy = vy;

  let bouncedUp = false;
  let teleported = false;
  let bounceFrame = -1;
  let teleportFrame = -1;
  let maxY = ball.y;
  let maxYFrame = 0;

  for (let f = 0; f < frames; f++) {
    const prevVY = ball.vy;
    Physics.updateBall(ball, walls);

    if (ball.y > maxY) { maxY = ball.y; maxYFrame = f; }

    // Bounce UP: vy was positive (falling) and flipped to negative (going up)
    // AND the bounce happens near the lower tile's top edge
    if (!bouncedUp && !teleported && prevVY > 0 && ball.vy < 0) {
      if (ball.y < HOLE_Y + R + 4) { // within a few px of the top edge
        bouncedUp = true;
        bounceFrame = f;
      }
    }

    // Teleport: ball passes through the lower tile without bouncing
    // This means ball y went from above HOLE_Y to below HOLE_Y+T without a bounce
    if (!bouncedUp && !teleported && ball.y > HOLE_Y + T + R) {
      // Check that it crossed the lower tile
      teleported = true;
      teleportFrame = f;
    }

    if (!Physics.isMoving(ball)) break;
  }

  return { bouncedUp, teleported, bounceFrame, teleportFrame, maxY, maxYFrame };
}

function testVelocity(vx, vy) {
  const mapJson = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../maps/_test1.json'), 'utf-8'
  ));
  const bothTiles = makeWallTiles(mapJson);
  const lowerOnly = removeUpperTile(makeWallTiles(mapJson));
  const startX = 126, startY = 210;

  const both = simulate('both', bothTiles, startX, startY, vx, vy);
  const lower = simulate('lower', lowerOnly, startX, startY, vx, vy);

  return { both, lower };
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  Ghost-Corner Fix Validation — With-Fix vs. Isolated Lower Tile');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  If "both tiles" shows teleport but "lower only" bounces correctly');
console.log('  for the same velocity, something is still wrong.');
console.log('');

console.log('  vel       both tiles          lower only          same?');
console.log('  ───────  ──────────────────  ──────────────────  ─────');

let allMatch = true;
for (const vx of [1, 2, 3]) {
  for (const vy of [2, 3, 4, 5]) {
    const { both, lower } = testVelocity(vx, vy);

    const bothResult = both.bouncedUp ? 'BOUNCE' : (both.teleported ? 'TELEPORT' : 'OTHER');
    const lowerResult = lower.bouncedUp ? 'BOUNCE' : (lower.teleported ? 'TELEPORT' : 'OTHER');
    const match = bothResult === lowerResult ? '✓' : '✗ MISMATCH';
    if (!match.includes('✓')) allMatch = false;

    const line = `  vx=${vx},vy=${vy}  ${bothResult.padEnd(10)} (f${String(both.bounceFrame >= 0 ? both.bounceFrame : both.teleportFrame >= 0 ? both.teleportFrame : '-').padStart(3)})  ${lowerResult.padEnd(10)} (f${String(lower.bounceFrame >= 0 ? lower.bounceFrame : lower.teleportFrame >= 0 ? lower.teleportFrame : '-').padStart(3)})  ${match}`;
    console.log(line);
  }
}

console.log('');
if (allMatch) {
  console.log('  ✓ ALL MATCH — fix correct: both-tile behavior matches isolated-lower.');
} else {
  console.log('  ✗ MISMATCHES exist — fix insufficient for those velocities.');
}
