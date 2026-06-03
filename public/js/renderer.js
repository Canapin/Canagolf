const Renderer = (function () {
  const BALL_COLORS = [
    "#e74c3c",
    "#3498db",
    "#f39c12",
    "#2ecc71",
    "#9b59b6",
    "#e67e22",
    "#1abc9c",
    "#e91e63",
  ];
  const FAIRWAY = "#3a7a35";
  const WALL_FACE = "#A0A0A0";
  const WALL_EDGE = "#898989";
  const HOLE_COLOR = "#0a0a0a";
  const SAND_COLOR = "#c8a84b";
  const ICE_COLOR = "#88ddff";
  const SNOW_COLOR = "#f0f8ff";
  const WATER_COLOR = "#2a7fd4";
  const LAVA_COLOR = "#c83500";
  const SLOPE_COLORS = {
    U: "#72c45a", UL: "#65bc52", UR: "#509e40",
    L: "#50a03c", R: "#2d6228",
    DL: "#1e5216", DR: "#184510", D: "#1c4d18",
  };

  // Single source of truth for all slope tile rendering metadata.
  // Each entry: [tile, direction, shapeSpec]
  // shapeSpec: 'full' | 'diag:UR/LL/UL/LR' | 'curve:TL/TR/BL/BR' | 'bump:TL/TR/BL/BR'
  const _T = Physics.TILE;
  const SLOPE_CATALOG = [
    // Full slopes
    [_T.SLOPE_U,'U','full'],   [_T.SLOPE_D,'D','full'],
    [_T.SLOPE_L,'L','full'],   [_T.SLOPE_R,'R','full'],
    [_T.SLOPE_UL,'UL','full'], [_T.SLOPE_UR,'UR','full'],
    [_T.SLOPE_DL,'DL','full'], [_T.SLOPE_DR,'DR','full'],
    // Natural diagonals (direction matches tile shape)
    [_T.SLOPE_DIAG_UR,'UR','diag:UR'], [_T.SLOPE_DIAG_DL,'DL','diag:LL'],
    [_T.SLOPE_DIAG_UL,'UL','diag:UL'], [_T.SLOPE_DIAG_DR,'DR','diag:LR'],
    // Natural curves & bumps
    [_T.SLOPE_CURVE_TL,'UL','curve:TL'], [_T.SLOPE_CURVE_TR,'UR','curve:TR'],
    [_T.SLOPE_CURVE_BL,'DL','curve:BL'], [_T.SLOPE_CURVE_BR,'DR','curve:BR'],
    [_T.SLOPE_BUMP_TL,'UL','bump:TL'],   [_T.SLOPE_BUMP_TR,'UR','bump:TR'],
    [_T.SLOPE_BUMP_BL,'DL','bump:BL'],   [_T.SLOPE_BUMP_BR,'DR','bump:BR'],
    // Cardinal slope ↑ partial tiles
    [_T.SLOPE_U_DIAG_UR,'U','diag:UR'],   [_T.SLOPE_U_DIAG_LL,'U','diag:LL'],
    [_T.SLOPE_U_DIAG_UL,'U','diag:UL'],   [_T.SLOPE_U_DIAG_LR,'U','diag:LR'],
    [_T.SLOPE_U_CURVE_TL,'U','curve:TL'], [_T.SLOPE_U_CURVE_TR,'U','curve:TR'],
    [_T.SLOPE_U_CURVE_BL,'U','curve:BL'], [_T.SLOPE_U_CURVE_BR,'U','curve:BR'],
    [_T.SLOPE_U_BUMP_TL,'U','bump:TL'],   [_T.SLOPE_U_BUMP_TR,'U','bump:TR'],
    [_T.SLOPE_U_BUMP_BL,'U','bump:BL'],   [_T.SLOPE_U_BUMP_BR,'U','bump:BR'],
    // Cardinal slope ↓ partial tiles
    [_T.SLOPE_D_DIAG_UR,'D','diag:UR'],   [_T.SLOPE_D_DIAG_LL,'D','diag:LL'],
    [_T.SLOPE_D_DIAG_UL,'D','diag:UL'],   [_T.SLOPE_D_DIAG_LR,'D','diag:LR'],
    [_T.SLOPE_D_CURVE_TL,'D','curve:TL'], [_T.SLOPE_D_CURVE_TR,'D','curve:TR'],
    [_T.SLOPE_D_CURVE_BL,'D','curve:BL'], [_T.SLOPE_D_CURVE_BR,'D','curve:BR'],
    [_T.SLOPE_D_BUMP_TL,'D','bump:TL'],   [_T.SLOPE_D_BUMP_TR,'D','bump:TR'],
    [_T.SLOPE_D_BUMP_BL,'D','bump:BL'],   [_T.SLOPE_D_BUMP_BR,'D','bump:BR'],
    // Cardinal slope ← partial tiles
    [_T.SLOPE_L_DIAG_UR,'L','diag:UR'],   [_T.SLOPE_L_DIAG_LL,'L','diag:LL'],
    [_T.SLOPE_L_DIAG_UL,'L','diag:UL'],   [_T.SLOPE_L_DIAG_LR,'L','diag:LR'],
    [_T.SLOPE_L_CURVE_TL,'L','curve:TL'], [_T.SLOPE_L_CURVE_TR,'L','curve:TR'],
    [_T.SLOPE_L_CURVE_BL,'L','curve:BL'], [_T.SLOPE_L_CURVE_BR,'L','curve:BR'],
    [_T.SLOPE_L_BUMP_TL,'L','bump:TL'],   [_T.SLOPE_L_BUMP_TR,'L','bump:TR'],
    [_T.SLOPE_L_BUMP_BL,'L','bump:BL'],   [_T.SLOPE_L_BUMP_BR,'L','bump:BR'],
    // Cardinal slope → partial tiles
    [_T.SLOPE_R_DIAG_UR,'R','diag:UR'],   [_T.SLOPE_R_DIAG_LL,'R','diag:LL'],
    [_T.SLOPE_R_DIAG_UL,'R','diag:UL'],   [_T.SLOPE_R_DIAG_LR,'R','diag:LR'],
    [_T.SLOPE_R_CURVE_TL,'R','curve:TL'], [_T.SLOPE_R_CURVE_TR,'R','curve:TR'],
    [_T.SLOPE_R_CURVE_BL,'R','curve:BL'], [_T.SLOPE_R_CURVE_BR,'R','curve:BR'],
    [_T.SLOPE_R_BUMP_TL,'R','bump:TL'],   [_T.SLOPE_R_BUMP_TR,'R','bump:TR'],
    [_T.SLOPE_R_BUMP_BL,'R','bump:BL'],   [_T.SLOPE_R_BUMP_BR,'R','bump:BR'],
    // Diagonal slope ↖ additional per-orientation variants
    [_T.SLOPE_UL_DIAG_UR,'UL','diag:UR'],  [_T.SLOPE_UL_DIAG_LL,'UL','diag:LL'],
    [_T.SLOPE_UL_DIAG_LR,'UL','diag:LR'],
    [_T.SLOPE_UL_CURVE_TR,'UL','curve:TR'],[_T.SLOPE_UL_CURVE_BL,'UL','curve:BL'],
    [_T.SLOPE_UL_CURVE_BR,'UL','curve:BR'],
    [_T.SLOPE_UL_BUMP_TR,'UL','bump:TR'],  [_T.SLOPE_UL_BUMP_BL,'UL','bump:BL'],
    [_T.SLOPE_UL_BUMP_BR,'UL','bump:BR'],
    // Diagonal slope ↗ additional per-orientation variants
    [_T.SLOPE_UR_DIAG_LL,'UR','diag:LL'],  [_T.SLOPE_UR_DIAG_UL,'UR','diag:UL'],
    [_T.SLOPE_UR_DIAG_LR,'UR','diag:LR'],
    [_T.SLOPE_UR_CURVE_TL,'UR','curve:TL'],[_T.SLOPE_UR_CURVE_BL,'UR','curve:BL'],
    [_T.SLOPE_UR_CURVE_BR,'UR','curve:BR'],
    [_T.SLOPE_UR_BUMP_TL,'UR','bump:TL'],  [_T.SLOPE_UR_BUMP_BL,'UR','bump:BL'],
    [_T.SLOPE_UR_BUMP_BR,'UR','bump:BR'],
    // Diagonal slope ↙ additional per-orientation variants
    [_T.SLOPE_DL_DIAG_UR,'DL','diag:UR'],  [_T.SLOPE_DL_DIAG_UL,'DL','diag:UL'],
    [_T.SLOPE_DL_DIAG_LR,'DL','diag:LR'],
    [_T.SLOPE_DL_CURVE_TL,'DL','curve:TL'],[_T.SLOPE_DL_CURVE_TR,'DL','curve:TR'],
    [_T.SLOPE_DL_CURVE_BR,'DL','curve:BR'],
    [_T.SLOPE_DL_BUMP_TL,'DL','bump:TL'],  [_T.SLOPE_DL_BUMP_TR,'DL','bump:TR'],
    [_T.SLOPE_DL_BUMP_BR,'DL','bump:BR'],
    // Diagonal slope ↘ additional per-orientation variants
    [_T.SLOPE_DR_DIAG_UR,'DR','diag:UR'],  [_T.SLOPE_DR_DIAG_LL,'DR','diag:LL'],
    [_T.SLOPE_DR_DIAG_UL,'DR','diag:UL'],
    [_T.SLOPE_DR_CURVE_TL,'DR','curve:TL'],[_T.SLOPE_DR_CURVE_TR,'DR','curve:TR'],
    [_T.SLOPE_DR_CURVE_BL,'DR','curve:BL'],
    [_T.SLOPE_DR_BUMP_TL,'DR','bump:TL'],  [_T.SLOPE_DR_BUMP_TR,'DR','bump:TR'],
    [_T.SLOPE_DR_BUMP_BL,'DR','bump:BL'],
  ];
  const SLOPE_FACE = {}, SLOPE_DIAG_INFO = {}, SLOPE_CURVE_INFO = {}, SLOPE_BUMP_INFO = {}, TILE_TO_SLOPE_DIR = {};
  SLOPE_CATALOG.forEach(([tile, dir, spec]) => {
    TILE_TO_SLOPE_DIR[tile] = dir;
    if (spec === "full") { SLOPE_FACE[tile] = SLOPE_COLORS[dir]; return; }
    const colon = spec.indexOf(":");
    const kind = spec.slice(0, colon), sub = spec.slice(colon + 1);
    if (kind === "diag") SLOPE_DIAG_INFO[tile] = [dir, sub];
    else if (kind === "curve") SLOPE_CURVE_INFO[tile] = [dir, sub];
    else SLOPE_BUMP_INFO[tile] = [dir, sub];
  });
  const GHOST_FACE = "#848c84";
  const GHOST_EDGE = "#5a625a";
  const GHOST_CHEV = "#d4dcd4";
  const BOUNCY_FACE = "#e8940a";
  const BOUNCY_EDGE = "#9a5c00";
  const DRAG_FACE = "#3a4e7a";
  const DRAG_EDGE = "#1a2a4a";

  const T = Physics.TILE_SIZE;

  function wallFaceColors(tile) {
    if (Physics.BOUNCY_TILES.has(tile)) return [BOUNCY_FACE, BOUNCY_EDGE];
    if (Physics.STICKY_TILES.has(tile)) return [DRAG_FACE, DRAG_EDGE];
    return [WALL_FACE, WALL_EDGE];
  }

  function groundColor(tile) {
    if (Physics.isIceTile(tile)) return ICE_COLOR;
    if (Physics.isSnowTile(tile)) return SNOW_COLOR;
    if (Physics.isSandTile(tile)) return SAND_COLOR;
    if (Physics.isWaterTile(tile)) return WATER_COLOR;
    if (Physics.isLavaTile(tile)) return LAVA_COLOR;
    return FAIRWAY;
  }

  function metaArcs(meta) {
    if (meta.ox === 1 && meta.oy === 1) return [Math.PI, Math.PI * 1.5];
    if (meta.ox === 0 && meta.oy === 1) return [Math.PI * 1.5, Math.PI * 2];
    if (meta.ox === 1 && meta.oy === 0) return [Math.PI * 0.5, Math.PI];
    return [0, Math.PI * 0.5];
  }

  function drawSlopeArrows(ctx, tile, x, y) {
    const dir = TILE_TO_SLOPE_DIR[tile];
    if (!dir) return;
    const a = T * 0.1;
    ctx.strokeStyle = FAIRWAY;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    for (let qx = 1; qx <= 3; qx += 2) {
      for (let qy = 1; qy <= 3; qy += 2) {
        const cx = x + (qx * T) / 4, cy = y + (qy * T) / 4;
        ctx.beginPath();
        if (dir === "R")  { ctx.moveTo(cx - a, cy - a); ctx.lineTo(cx + a, cy); ctx.lineTo(cx - a, cy + a); }
        if (dir === "L")  { ctx.moveTo(cx + a, cy - a); ctx.lineTo(cx - a, cy); ctx.lineTo(cx + a, cy + a); }
        if (dir === "U")  { ctx.moveTo(cx - a, cy + a); ctx.lineTo(cx, cy - a); ctx.lineTo(cx + a, cy + a); }
        if (dir === "D")  { ctx.moveTo(cx - a, cy - a); ctx.lineTo(cx, cy + a); ctx.lineTo(cx + a, cy - a); }
        if (dir === "UL") { ctx.moveTo(cx + a, cy); ctx.lineTo(cx - a, cy - a); ctx.lineTo(cx, cy + a); }
        if (dir === "UR") { ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy - a); ctx.lineTo(cx, cy + a); }
        if (dir === "DL") { ctx.moveTo(cx + a, cy); ctx.lineTo(cx - a, cy + a); ctx.lineTo(cx, cy - a); }
        if (dir === "DR") { ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy + a); ctx.lineTo(cx, cy - a); }
        ctx.stroke();
      }
    }
  }

  function drawTriPath(ctx, tri, x, y) {
    if (tri === "UR") { ctx.moveTo(x, y); ctx.lineTo(x + T, y); ctx.lineTo(x + T, y + T); }
    if (tri === "LL") { ctx.moveTo(x, y); ctx.lineTo(x, y + T); ctx.lineTo(x + T, y + T); }
    if (tri === "UL") { ctx.moveTo(x, y); ctx.lineTo(x + T, y); ctx.lineTo(x, y + T); }
    if (tri === "LR") { ctx.moveTo(x + T, y); ctx.lineTo(x, y + T); ctx.lineTo(x + T, y + T); }
    ctx.closePath();
  }

  // ── Map ──────────────────────────────────────────────────────────────────

  function renderMap(ctx, map) {
    const ground = map.ground || map.tiles;
    const walls = map.walls || map.tiles;
    const layers = map.groundLayers || [];
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const baseTile = ground[row][col];
        const layerTiles = layers.map(layer => layer[row]?.[col] || ".");
        renderGroundTile(ctx, col, row, baseTile, layerTiles);
        // openColor: topmost visible ground tile's color for wall open-areas
        const topTile = [...layerTiles].reverse().find(t => t && t !== ".") || baseTile;
        renderWallTile(ctx, col, row, walls[row][col], topTile);
      }
    }
    if (map.teleporterPairs) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      for (const pair of map.teleporterPairs) {
        if (pair.uses < 5) continue;
        for (const tile of pair) {
          ctx.beginPath();
          ctx.arc(tile.col * T + T / 2, tile.row * T + T / 2, T / 2 - 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (map.blackHoleTiles) {
      ctx.fillStyle = "rgba(80,80,80,0.65)";
      for (const bh of map.blackHoleTiles) {
        if (!bh.dormant) continue;
        ctx.beginPath();
        ctx.arc(bh.col * T + T / 2, bh.row * T + T / 2, T / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (map.holes) {
      const BR = Physics.BALL_RADIUS;
      for (const hole of map.holes) {
        ctx.fillStyle = HOLE_COLOR;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, BR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Ground tile ───────────────────────────────────────────────────────────

  // Draws only the terrain shape of a tile (no fairway pre-fill). Uses clipping for partial shapes.
  function renderTileShapeOnly(ctx, x, y, tile) {
    if (!tile || tile === ".") return;

    const TP_COLORS = {
      "=": { bg: "#1a0830", ring1: "#9030d0", ring2: "#c070ff" },
      "|": { bg: "#081828", ring1: "#1878c8", ring2: "#50c8ff" },
      "/": { bg: "#1a1000", ring1: "#b87010", ring2: "#ffe050" },
    };
    if (TP_COLORS[tile]) {
      const { bg, ring1, ring2 } = TP_COLORS[tile];
      const hx = x + T / 2, hy = y + T / 2;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(hx, hy, T / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ring1; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, T * 0.36, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = ring2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hx, hy, T * 0.16, 0, Math.PI * 2); ctx.stroke();
      return;
    }

    if (tile === Physics.TILE.SWAP) {
      const cx = x + T / 2, cy = y + T / 2;
      ctx.fillStyle = "#c08000"; ctx.beginPath(); ctx.arc(cx, cy, T / 2 - 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#805000"; ctx.beginPath(); ctx.arc(cx, cy, T / 2 - 5, 0, Math.PI * 2); ctx.fill();
      const hw = T * 0.27, hs = 2.5;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy - hs); ctx.lineTo(cx + hw, cy - hs);
      ctx.moveTo(cx + hw - 4, cy - hs - 3); ctx.lineTo(cx + hw, cy - hs); ctx.lineTo(cx + hw - 4, cy - hs + 3);
      ctx.moveTo(cx + hw, cy + hs); ctx.lineTo(cx - hw, cy + hs);
      ctx.moveTo(cx - hw + 4, cy + hs - 3); ctx.lineTo(cx - hw, cy + hs); ctx.lineTo(cx - hw + 4, cy + hs + 3);
      ctx.stroke();
      return;
    }

    if (tile === Physics.TILE.BLACKHOLE) {
      const cx = x + T / 2, cy = y + T / 2;
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(cx, cy, T / 2 - 1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#7000cc"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, T / 2 - 3, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#aa50ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, T * 0.18, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
      return;
    }

    if (tile === Physics.TILE.HOLE) {
      ctx.fillStyle = HOLE_COLOR;
      ctx.beginPath();
      ctx.arc(x + T / 2, y + T / 2, Physics.BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Full solid tiles
    if (tile === Physics.TILE.SAND)  { RenderShared.renderFull(ctx, x, y, T, SAND_COLOR, false, true, false, false, false); return; }
    if (tile === Physics.TILE.ICE)   { RenderShared.renderFull(ctx, x, y, T, ICE_COLOR, false, false, false, true, false); return; }
    if (tile === Physics.TILE.SNOW)  { RenderShared.renderFull(ctx, x, y, T, SNOW_COLOR, false, false, false, false, true); return; }
    if (tile === Physics.TILE.WATER) { RenderShared.renderFull(ctx, x, y, T, WATER_COLOR, true, false, false, false, false); return; }
    if (tile === Physics.TILE.LAVA)  { RenderShared.renderFull(ctx, x, y, T, LAVA_COLOR, false, false, true, false, false); return; }

    if (SLOPE_FACE[tile]) {
      ctx.fillStyle = SLOPE_FACE[tile];
      ctx.fillRect(x, y, T, T);
      drawSlopeArrows(ctx, tile, x, y);
      return;
    }

    // Diagonal tiles — clip to triangle, fill
    const DIAG = {
      a: [SAND_COLOR, "UR"], b: [SAND_COLOR, "LL"], c: [SAND_COLOR, "UL"], d: [SAND_COLOR, "LR"],
      e: [WATER_COLOR, "UR"], f: [WATER_COLOR, "LL"], g: [WATER_COLOR, "UL"], h: [WATER_COLOR, "LR"],
      [Physics.TILE.LAVA_DIAG_UR]: [LAVA_COLOR, "LL"],
      [Physics.TILE.LAVA_DIAG_LL]: [LAVA_COLOR, "UR"],
      [Physics.TILE.LAVA_DIAG_UL]: [LAVA_COLOR, "LR"],
      [Physics.TILE.LAVA_DIAG_LR]: [LAVA_COLOR, "UL"],
      [Physics.TILE.ICE_UR]: [ICE_COLOR, "UR"], [Physics.TILE.ICE_LL]: [ICE_COLOR, "LL"],
      [Physics.TILE.ICE_UL]: [ICE_COLOR, "UL"], [Physics.TILE.ICE_LR]: [ICE_COLOR, "LR"],
      [Physics.TILE.SNOW_UR]: [SNOW_COLOR, "UR"], [Physics.TILE.SNOW_LL]: [SNOW_COLOR, "LL"],
      [Physics.TILE.SNOW_UL]: [SNOW_COLOR, "UL"], [Physics.TILE.SNOW_LR]: [SNOW_COLOR, "LR"],
    };
    if (DIAG[tile]) {
      const [color, tri] = DIAG[tile];
      RenderShared.renderDiag(ctx, x, y, T, tri, color, Physics.isWaterTile(tile), Physics.isSandTile(tile), Physics.isLavaTile(tile), Physics.isIceTile(tile), Physics.isSnowTile(tile));
      return;
    }

    if (SLOPE_DIAG_INFO[tile]) {
      const [dir, tri] = SLOPE_DIAG_INFO[tile];
      ctx.save();
      ctx.beginPath(); drawTriPath(ctx, tri, x, y); ctx.clip();
      ctx.fillStyle = SLOPE_COLORS[dir]; ctx.fillRect(x, y, T, T);
      drawSlopeArrows(ctx, tile, x, y);
      ctx.restore();
      return;
    }

    // Curve tiles — clip to arc sector, fill
    const MAT_CURVE = {
      m: SAND_COLOR, n: SAND_COLOR, o: SAND_COLOR, p: SAND_COLOR,
      u: WATER_COLOR, x: WATER_COLOR, y: WATER_COLOR, z: WATER_COLOR,
      [Physics.TILE.LAVA_CURVE_TL]: LAVA_COLOR, [Physics.TILE.LAVA_CURVE_TR]: LAVA_COLOR,
      [Physics.TILE.LAVA_CURVE_BL]: LAVA_COLOR, [Physics.TILE.LAVA_CURVE_BR]: LAVA_COLOR,
      [Physics.TILE.ICE_CURVE_TL]: ICE_COLOR, [Physics.TILE.ICE_CURVE_TR]: ICE_COLOR,
      [Physics.TILE.ICE_CURVE_BL]: ICE_COLOR, [Physics.TILE.ICE_CURVE_BR]: ICE_COLOR,
      [Physics.TILE.SNOW_CURVE_TL]: SNOW_COLOR, [Physics.TILE.SNOW_CURVE_TR]: SNOW_COLOR,
      [Physics.TILE.SNOW_CURVE_BL]: SNOW_COLOR, [Physics.TILE.SNOW_CURVE_BR]: SNOW_COLOR,
    };
    if (MAT_CURVE[tile]) {
      const meta = Physics.CURVE_META[tile];
      const corner = RenderShared.cornerFromMeta(meta.ox, meta.oy);
      RenderShared.renderCurve(ctx, x, y, T, corner, MAT_CURVE[tile], Physics.isWaterTile(tile), Physics.isSandTile(tile), Physics.isLavaTile(tile), Physics.isIceTile(tile), Physics.isSnowTile(tile));
      return;
    }

    if (SLOPE_CURVE_INFO[tile]) {
      const [dir] = SLOPE_CURVE_INFO[tile];
      const meta = Physics.CURVE_META[tile];
      const ax = x + meta.ox * T, ay = y + meta.oy * T;
      const [a0, a1] = metaArcs(meta);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, T, a0, a1, false); ctx.closePath(); ctx.clip();
      ctx.fillStyle = SLOPE_COLORS[dir]; ctx.fillRect(x, y, T, T);
      drawSlopeArrows(ctx, tile, x, y);
      ctx.restore();
      return;
    }

    // Bump tiles — evenodd clip: tile rect minus arc sector = the convex bump area
    const MAT_BUMP = {
      q: SAND_COLOR, r: SAND_COLOR, s: SAND_COLOR, t: SAND_COLOR,
      B: WATER_COLOR, C: WATER_COLOR, D: WATER_COLOR, E: WATER_COLOR,
      [Physics.TILE.LAVA_BUMP_TL]: LAVA_COLOR, [Physics.TILE.LAVA_BUMP_TR]: LAVA_COLOR,
      [Physics.TILE.LAVA_BUMP_BL]: LAVA_COLOR, [Physics.TILE.LAVA_BUMP_BR]: LAVA_COLOR,
      [Physics.TILE.ICE_BUMP_TL]: ICE_COLOR, [Physics.TILE.ICE_BUMP_TR]: ICE_COLOR,
      [Physics.TILE.ICE_BUMP_BL]: ICE_COLOR, [Physics.TILE.ICE_BUMP_BR]: ICE_COLOR,
      [Physics.TILE.SNOW_BUMP_TL]: SNOW_COLOR, [Physics.TILE.SNOW_BUMP_TR]: SNOW_COLOR,
      [Physics.TILE.SNOW_BUMP_BL]: SNOW_COLOR, [Physics.TILE.SNOW_BUMP_BR]: SNOW_COLOR,
    };
    if (MAT_BUMP[tile]) {
      const meta = Physics.BUMP_META[tile];
      const corner = RenderShared.cornerFromMeta(meta.ox, meta.oy);
      RenderShared.renderBump(ctx, x, y, T, corner, MAT_BUMP[tile], false, false, false, Physics.isIceTile(tile), Physics.isSnowTile(tile));
      return;
    }

    if (SLOPE_BUMP_INFO[tile]) {
      const [dir] = SLOPE_BUMP_INFO[tile];
      const meta = Physics.BUMP_META[tile];
      const ax = x + meta.ox * T, ay = y + meta.oy * T;
      const [a0, a1] = metaArcs(meta);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, T, T);
      ctx.moveTo(ax, ay); ctx.arc(ax, ay, T, a0, a1, false); ctx.closePath();
      ctx.clip("evenodd");
      ctx.fillStyle = SLOPE_COLORS[dir]; ctx.fillRect(x, y, T, T);
      drawSlopeArrows(ctx, tile, x, y);
      ctx.restore();
    }
  }

  function renderGroundTile(ctx, col, row, baseTile, layerTiles) {
    const x = col * T, y = row * T;
    ctx.fillStyle = FAIRWAY;
    ctx.fillRect(x, y, T, T);
    renderTileShapeOnly(ctx, x, y, baseTile);
    if (layerTiles) {
      for (const lt of layerTiles) renderTileShapeOnly(ctx, x, y, lt);
    }
  }

  // ── Wall tile ─────────────────────────────────────────────────────────────
  // openColor = color of ground tile underneath (for open areas in partial walls)

  function renderWallTile(ctx, col, row, tile, groundTile) {
    if (!tile || tile === ".") return;
    const x = col * T,
      y = row * T;
    const openColor = groundColor(groundTile);

    if (tile === Physics.TILE.WALL) {
      ctx.fillStyle = WALL_FACE;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = WALL_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      return;
    }

    if (tile === Physics.TILE.BOUNCY) {
      ctx.fillStyle = BOUNCY_FACE;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = BOUNCY_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      const a = T * 0.1;
      [
        [1, 1, "UL"],
        [3, 1, "UR"],
        [1, 3, "DL"],
        [3, 3, "DR"],
      ].forEach(([qx, qy, dir]) => {
        const cx = x + (qx * T) / 4,
          cy = y + (qy * T) / 4;
        ctx.beginPath();
        if (dir === "UL") {
          ctx.moveTo(cx + a, cy);
          ctx.lineTo(cx - a, cy - a);
          ctx.lineTo(cx, cy + a);
        }
        if (dir === "UR") {
          ctx.moveTo(cx - a, cy);
          ctx.lineTo(cx + a, cy - a);
          ctx.lineTo(cx, cy + a);
        }
        if (dir === "DL") {
          ctx.moveTo(cx + a, cy);
          ctx.lineTo(cx - a, cy + a);
          ctx.lineTo(cx, cy - a);
        }
        if (dir === "DR") {
          ctx.moveTo(cx - a, cy);
          ctx.lineTo(cx + a, cy + a);
          ctx.lineTo(cx, cy - a);
        }
        ctx.stroke();
      });
      return;
    }

    if (tile === Physics.TILE.STICKY_WALL) {
      ctx.fillStyle = DRAG_FACE;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = DRAG_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      ctx.strokeStyle = "rgba(170,200,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      const a = T * 0.1;
      [
        [1, 1, "DR"],
        [3, 1, "DL"],
        [1, 3, "UR"],
        [3, 3, "UL"],
      ].forEach(([qx, qy, dir]) => {
        const cx = x + (qx * T) / 4,
          cy = y + (qy * T) / 4;
        ctx.beginPath();
        if (dir === "UL") {
          ctx.moveTo(cx + a, cy);
          ctx.lineTo(cx - a, cy - a);
          ctx.lineTo(cx, cy + a);
        }
        if (dir === "UR") {
          ctx.moveTo(cx - a, cy);
          ctx.lineTo(cx + a, cy - a);
          ctx.lineTo(cx, cy + a);
        }
        if (dir === "DL") {
          ctx.moveTo(cx + a, cy);
          ctx.lineTo(cx - a, cy + a);
          ctx.lineTo(cx, cy - a);
        }
        if (dir === "DR") {
          ctx.moveTo(cx - a, cy);
          ctx.lineTo(cx + a, cy + a);
          ctx.lineTo(cx, cy - a);
        }
        ctx.stroke();
      });
      return;
    }

    if (tile === Physics.TILE.CIRCLE_WALL) {
      const [face, edge] = wallFaceColors(tile);
      const cx = x + T / 2,
        cy = y + T / 2;
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(cx, cy, T / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, T / 2, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    // Ghost walls (cardinal one-way)
    const GHOST_DIR = {
      [Physics.TILE.GHOST_R]: "R",
      [Physics.TILE.GHOST_L]: "L",
      [Physics.TILE.GHOST_U]: "U",
      [Physics.TILE.GHOST_D]: "D",
    };
    // Phantom walls (diagonal one-way)
    const PHANTOM_DIR = {
      [Physics.TILE.PHANTOM_UR]: "UR",
      [Physics.TILE.PHANTOM_UL]: "UL",
      [Physics.TILE.PHANTOM_DR]: "DR",
      [Physics.TILE.PHANTOM_DL]: "DL",
    };
    if (GHOST_DIR[tile] || PHANTOM_DIR[tile]) {
      const dir = GHOST_DIR[tile] || PHANTOM_DIR[tile];
      ctx.fillStyle = WALL_FACE;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = WALL_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      const a = T * 0.1;
      ctx.strokeStyle = GHOST_CHEV;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      for (let qx = 1; qx <= 3; qx += 2) {
        for (let qy = 1; qy <= 3; qy += 2) {
          const cx = x + (qx * T) / 4,
            cy = y + (qy * T) / 4;
          ctx.beginPath();
          if (dir === "R") {
            ctx.moveTo(cx - a, cy - a);
            ctx.lineTo(cx + a, cy);
            ctx.lineTo(cx - a, cy + a);
          }
          if (dir === "L") {
            ctx.moveTo(cx + a, cy - a);
            ctx.lineTo(cx - a, cy);
            ctx.lineTo(cx + a, cy + a);
          }
          if (dir === "U") {
            ctx.moveTo(cx - a, cy + a);
            ctx.lineTo(cx, cy - a);
            ctx.lineTo(cx + a, cy + a);
          }
          if (dir === "D") {
            ctx.moveTo(cx - a, cy - a);
            ctx.lineTo(cx, cy + a);
            ctx.lineTo(cx + a, cy - a);
          }
          if (dir === "UR") {
            ctx.moveTo(cx - a, cy);
            ctx.lineTo(cx + a, cy - a);
            ctx.lineTo(cx, cy + a);
          }
          if (dir === "UL") {
            ctx.moveTo(cx + a, cy);
            ctx.lineTo(cx - a, cy - a);
            ctx.lineTo(cx, cy + a);
          }
          if (dir === "DR") {
            ctx.moveTo(cx - a, cy);
            ctx.lineTo(cx + a, cy + a);
            ctx.lineTo(cx, cy - a);
          }
          if (dir === "DL") {
            ctx.moveTo(cx + a, cy);
            ctx.lineTo(cx - a, cy + a);
            ctx.lineTo(cx, cy - a);
          }
          ctx.stroke();
        }
      }
      return;
    }

    // Diagonal walls — open triangle uses openColor
    const DIAG_WALL = {
      i: "LL",
      j: "UR",
      k: "LR",
      l: "UL",
      N: "LL",
      P: "UR",
      Q: "LR",
      R: "UL",
      "(": "LL",
      ")": "UR",
      "[": "LR",
      "]": "UL",
    };
    if (DIAG_WALL[tile]) {
      const fw = DIAG_WALL[tile];
      const [face, edge] = wallFaceColors(tile);
      ctx.fillStyle = face;
      ctx.beginPath();
      if (fw === "LL") {
        ctx.moveTo(x, y);
        ctx.lineTo(x + T, y);
        ctx.lineTo(x + T, y + T);
      }
      if (fw === "UR") {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + T);
        ctx.lineTo(x + T, y + T);
      }
      if (fw === "LR") {
        ctx.moveTo(x, y);
        ctx.lineTo(x + T, y);
        ctx.lineTo(x, y + T);
      }
      if (fw === "UL") {
        ctx.moveTo(x + T, y);
        ctx.lineTo(x, y + T);
        ctx.lineTo(x + T, y + T);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (fw === "LL") {
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + T - 0.5, y + 0.5);
        ctx.lineTo(x + T - 0.5, y + T - 0.5);
        ctx.closePath();
      } else if (fw === "UR") {
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + 0.5, y + T - 0.5);
        ctx.lineTo(x + T - 0.5, y + T - 0.5);
        ctx.closePath();
      } else if (fw === "LR") {
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + T - 0.5, y + 0.5);
        ctx.lineTo(x + 0.5, y + T - 0.5);
        ctx.closePath();
      } else {
        ctx.moveTo(x + T - 0.5, y + 0.5);
        ctx.lineTo(x + T - 0.5, y + T - 0.5);
        ctx.lineTo(x + 0.5, y + T - 0.5);
        ctx.closePath();
      }
      ctx.stroke();
      // 2 chevrons in solid wall area — only for bouncy/sticky variants
      if (Physics.BOUNCY_TILES.has(tile) || Physics.STICKY_TILES.has(tile)) {
        const isSticky = Physics.STICKY_TILES.has(tile);
        let p1x, p1y, p2x, p2y;
        if (fw === "LL") {
          p1x = x + T * 0.78;
          p1y = y + T * 0.44;
          p2x = x + T * 0.55;
          p2y = y + T * 0.22;
        }
        if (fw === "UR") {
          p1x = x + T * 0.22;
          p1y = y + T * 0.56;
          p2x = x + T * 0.45;
          p2y = y + T * 0.78;
        }
        if (fw === "LR") {
          p1x = x + T * 0.22;
          p1y = y + T * 0.44;
          p2x = x + T * 0.45;
          p2y = y + T * 0.22;
        }
        if (fw === "UL") {
          p1x = x + T * 0.56;
          p1y = y + T * 0.78;
          p2x = x + T * 0.78;
          p2y = y + T * 0.56;
        }
        const a = T * 0.09;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        [
          [p1x, p1y],
          [p2x, p2y],
        ].forEach(([pcx, pcy]) => {
          ctx.beginPath();
          if (fw === "LL") {
            if (isSticky) {
              ctx.moveTo(pcx - a, pcy);
              ctx.lineTo(pcx + a, pcy - a);
              ctx.lineTo(pcx, pcy + a);
            } else {
              ctx.moveTo(pcx + a, pcy);
              ctx.lineTo(pcx - a, pcy + a);
              ctx.lineTo(pcx, pcy - a);
            }
          }
          if (fw === "UR") {
            if (isSticky) {
              ctx.moveTo(pcx + a, pcy);
              ctx.lineTo(pcx - a, pcy + a);
              ctx.lineTo(pcx, pcy - a);
            } else {
              ctx.moveTo(pcx - a, pcy);
              ctx.lineTo(pcx + a, pcy - a);
              ctx.lineTo(pcx, pcy + a);
            }
          }
          if (fw === "LR") {
            if (isSticky) {
              ctx.moveTo(pcx + a, pcy);
              ctx.lineTo(pcx - a, pcy - a);
              ctx.lineTo(pcx, pcy + a);
            } else {
              ctx.moveTo(pcx - a, pcy);
              ctx.lineTo(pcx + a, pcy + a);
              ctx.lineTo(pcx, pcy - a);
            }
          }
          if (fw === "UL") {
            if (isSticky) {
              ctx.moveTo(pcx - a, pcy);
              ctx.lineTo(pcx + a, pcy + a);
              ctx.lineTo(pcx, pcy - a);
            } else {
              ctx.moveTo(pcx + a, pcy);
              ctx.lineTo(pcx - a, pcy - a);
              ctx.lineTo(pcx, pcy + a);
            }
          }
          ctx.stroke();
        });
      }
      return;
    }

    // Curves — open arc lets ground show through; chevrons in solid area for bouncy/sticky
    const curveMeta = Physics.CURVE_META[tile];
    if (curveMeta) {
      const ax = x + curveMeta.ox * T,
        ay = y + curveMeta.oy * T;
      const [a0, a1] = metaArcs(curveMeta);
      const [face, edge] = wallFaceColors(tile);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, T, T);
      ctx.moveTo(ax, ay);
      ctx.arc(ax, ay, T, a0, a1, false);
      ctx.closePath();
      ctx.clip("evenodd");
      ctx.fillStyle = face;
      ctx.fillRect(x, y, T, T);
      ctx.restore();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ax, ay, T, a0, a1, false);
      if (curveMeta.ox === 0 && curveMeta.oy === 0) {
        ctx.moveTo(x + T - 0.5, y + T - 0.5); ctx.lineTo(x + T, y);
        ctx.moveTo(x + T - 0.5, y + T - 0.5); ctx.lineTo(x, y + T);
      } else if (curveMeta.ox === 1 && curveMeta.oy === 0) {
        ctx.moveTo(x + 0.5, y + T - 0.5); ctx.lineTo(x + T, y + T);
        ctx.moveTo(x + 0.5, y + T - 0.5); ctx.lineTo(x, y);
      } else if (curveMeta.ox === 0 && curveMeta.oy === 1) {
        ctx.moveTo(x + T - 0.5, y + 0.5); ctx.lineTo(x, y);
        ctx.moveTo(x + T - 0.5, y + 0.5); ctx.lineTo(x + T, y + T);
      } else {
        ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x, y + T);
        ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + T, y);
      }
      ctx.stroke();
      return;
    }

    // Bumps — solid arc, ground shows through open area; 3 chevrons in solid arc area
    const bumpMeta = Physics.BUMP_META[tile];
    if (bumpMeta) {
      const bax = x + bumpMeta.ox * T,
        bay = y + bumpMeta.oy * T;
      const [ba0, ba1] = metaArcs(bumpMeta);
      const [face, edge] = wallFaceColors(tile);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bax, bay);
      ctx.arc(bax, bay, T, ba0, ba1, false);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = face;
      ctx.fillRect(x, y, T, T);
      ctx.restore();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bax, bay, T, ba0, ba1, false);
      if (bumpMeta.ox === 0 && bumpMeta.oy === 0) {
        ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + T, y);
        ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x, y + T);
      } else if (bumpMeta.ox === 1 && bumpMeta.oy === 0) {
        ctx.moveTo(x + T - 0.5, y + 0.5); ctx.lineTo(x + T, y + T);
        ctx.moveTo(x + T - 0.5, y + 0.5); ctx.lineTo(x, y);
      } else if (bumpMeta.ox === 0 && bumpMeta.oy === 1) {
        ctx.moveTo(x + 0.5, y + T - 0.5); ctx.lineTo(x, y);
        ctx.moveTo(x + 0.5, y + T - 0.5); ctx.lineTo(x + T, y + T);
      } else {
        ctx.moveTo(x + T - 0.5, y + T - 0.5); ctx.lineTo(x, y + T);
        ctx.moveTo(x + T - 0.5, y + T - 0.5); ctx.lineTo(x + T, y);
      }
      ctx.stroke();
      if (Physics.BOUNCY_TILES.has(tile) || Physics.STICKY_TILES.has(tile)) {
        const isSticky = Physics.STICKY_TILES.has(tile);
        const midAngle = (ba0 + ba1) / 2;
        const spread = Math.PI / 8;
        const a = T * 0.09;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        [midAngle - spread, midAngle + spread].forEach((angle) => {
          const pcx = bax + T * 0.72 * Math.cos(angle);
          const pcy = bay + T * 0.72 * Math.sin(angle);
          const nx = Math.cos(angle),
            ny = Math.sin(angle);
          const tx = -ny,
            ty = nx;
          ctx.beginPath();
          ctx.moveTo(pcx - tx * a, pcy - ty * a);
          ctx.lineTo(pcx + (isSticky ? -nx : nx) * a, pcy + (isSticky ? -ny : ny) * a);
          ctx.lineTo(pcx + tx * a, pcy + ty * a);
          ctx.stroke();
        });
      }
      return;
    }
  }

  // ── Ball ─────────────────────────────────────────────────────────────────

  function renderBall(ctx, ball, playerIndex) {
    const color = BALL_COLORS[playerIndex % BALL_COLORS.length];
    const r = Physics.BALL_RADIUS;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(ball.x + 1, ball.y + 2, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(ball.x - r * 0.3, ball.y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Aim line ─────────────────────────────────────────────────────────────

  function renderAimLine(ctx, ball, cursorX, cursorY) {
    const dx = cursorX - ball.x;
    const dy = cursorY - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return;

    const eff = dist < Physics.BALL_RADIUS ? 0 : dist - Physics.BALL_RADIUS;
    const maxDist = Physics.MAX_POWER / Physics.POWER_SCALE;
    const t = Math.min(eff / maxDist, 1);
    const power = Math.pow(t, Physics.POWER_EXP);

    const capDist = Physics.BALL_RADIUS + maxDist;
    const lineEndDist = Math.min(dist, capDist);

    // Cursor side: line drawn from capped cursor position toward ball surface
    const behindEndX = ball.x + (dx / dist) * lineEndDist;
    const behindEndY = ball.y + (dy / dist) * lineEndDist;

    // nx, ny = launch direction (away from cursor)
    const nx = -dx / dist;
    const ny = -dy / dist;
    const r = Physics.BALL_RADIUS;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(behindEndX, behindEndY);
    ctx.lineTo(ball.x - nx * r, ball.y - ny * r); // stop at ball surface
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead at ball surface (cursor side), tip pointing toward ball
    const AH = 9, AW = 5;
    const arrowBaseX = ball.x - nx * (r + AH);
    const arrowBaseY = ball.y - ny * (r + AH);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(arrowBaseX + nx * AH, arrowBaseY + ny * AH);
    ctx.lineTo(arrowBaseX - ny * AW, arrowBaseY + nx * AW);
    ctx.lineTo(arrowBaseX + ny * AW, arrowBaseY - nx * AW);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = power > 0.7 ? '#e74c3c' : power > 0.4 ? '#f39c12' : '#2ecc71';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, Physics.BALL_RADIUS + 4, 0, Math.PI * 2 * power);
    ctx.stroke();

    ctx.restore();
  }

  function renderSiphonCones(ctx, map, players) {
    if (!map.blackHoleTiles) return;
    const BR = Physics.BALL_RADIUS, TT = Physics.TILE_SIZE;
    const TILE_R = TT / 2 - 3;
    for (const p of players) {
      if (p.sunk || p.eliminated || p.waterPending || !Physics.isMoving(p.ball)) continue;
      const b = p.ball;
      for (const bh of map.blackHoleTiles) {
        if (!bh.dormant) continue;
        const cx = bh.col * TT + TT / 2, cy = bh.row * TT + TT / 2;
        const effectR = (bh.radius ?? Physics.BH_RADIUS_TILES) * TT;
        const dx = b.x - cx, dy = b.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= effectR || dist < 1) continue;
        if (b._triggeredSiphon) continue;
        if (b.vx * dx + b.vy * dy >= 0) continue;
        const t = dist / effectR;
        const nx = dx / dist, ny = dy / dist;
        const px = -ny, py = nx;
        const sx = cx + nx * TILE_R, sy = cy + ny * TILE_R;
        const bx = b.x - nx * BR, by = b.y - ny * BR;
        const halfW = t * 8;
        ctx.fillStyle = "rgba(130,50,210,0.35)";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(bx + px * halfW, by + py * halfW);
        ctx.lineTo(bx - px * halfW, by - py * halfW);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(160,80,240,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(bx + px * halfW, by + py * halfW);
        ctx.lineTo(bx - px * halfW, by - py * halfW);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  function renderSwapDots(ctx, map, players) {
    if (!map.swapTiles) return;
    const BR = Physics.BALL_RADIUS, TT = Physics.TILE_SIZE;
    const TILE_R = TT / 2 - 2;
    ctx.lineCap = "round";
    for (const p of players) {
      if (p.sunk || p.eliminated || p.waterPending || !(p.started || Physics.isMoving(p.ball))) continue;
      const b = p.ball;
      const color = BALL_COLORS[players.indexOf(p) % BALL_COLORS.length];
      for (const sw of map.swapTiles) {
        const cx = sw.col * TT + TT / 2, cy = sw.row * TT + TT / 2;
        const effectR = (sw.radius ?? Physics.SWAP_RADIUS_TILES) * TT;
        const dx = b.x - cx, dy = b.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= effectR || dist < 1) continue;
        const nx = dx / dist, ny = dy / dist;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([0, 6]);
        ctx.beginPath();
        ctx.moveTo(b.x - nx * BR, b.y - ny * BR);
        ctx.lineTo(cx + nx * TILE_R, cy + ny * TILE_R);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.lineCap = "butt";
  }

  return {
    BALL_COLORS,
    renderMap,
    renderGroundTile,
    renderWallTile,
    renderBall,
    renderAimLine,
    renderSwapDots,
    renderSiphonCones,
  };
})();
