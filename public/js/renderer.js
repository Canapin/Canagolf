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
  const WATER_COLOR = "#2a7fd4";
  const LAVA_COLOR = "#b02000";
  const SLOPE_COLORS = {
    U: "#72c45a", UL: "#65bc52", UR: "#509e40",
    L: "#50a03c", R: "#2d6228",
    DL: "#1e5216", DR: "#184510", D: "#1c4d18",
  };
  const SLOPE_FACE = {
    [Physics.TILE.SLOPE_U]:  SLOPE_COLORS.U,
    [Physics.TILE.SLOPE_UL]: SLOPE_COLORS.UL,
    [Physics.TILE.SLOPE_UR]: SLOPE_COLORS.UR,
    [Physics.TILE.SLOPE_L]:  SLOPE_COLORS.L,
    [Physics.TILE.SLOPE_R]:  SLOPE_COLORS.R,
    [Physics.TILE.SLOPE_DL]: SLOPE_COLORS.DL,
    [Physics.TILE.SLOPE_DR]: SLOPE_COLORS.DR,
    [Physics.TILE.SLOPE_D]:  SLOPE_COLORS.D,
  };
  // Partial slope tiles: [direction, tri-shape] for diagonals
  const SLOPE_DIAG_INFO = {
    [Physics.TILE.SLOPE_DIAG_UR]: ["UR", "UR"],
    [Physics.TILE.SLOPE_DIAG_DL]: ["DL", "LL"],
    [Physics.TILE.SLOPE_DIAG_UL]: ["UL", "UL"],
    [Physics.TILE.SLOPE_DIAG_DR]: ["DR", "LR"],
    // Cardinal slope diagonals
    [Physics.TILE.SLOPE_U_DIAG_UR]: ["U", "UR"], [Physics.TILE.SLOPE_U_DIAG_LL]: ["U", "LL"],
    [Physics.TILE.SLOPE_U_DIAG_UL]: ["U", "UL"], [Physics.TILE.SLOPE_U_DIAG_LR]: ["U", "LR"],
    [Physics.TILE.SLOPE_D_DIAG_UR]: ["D", "UR"], [Physics.TILE.SLOPE_D_DIAG_LL]: ["D", "LL"],
    [Physics.TILE.SLOPE_D_DIAG_UL]: ["D", "UL"], [Physics.TILE.SLOPE_D_DIAG_LR]: ["D", "LR"],
    [Physics.TILE.SLOPE_L_DIAG_UR]: ["L", "UR"], [Physics.TILE.SLOPE_L_DIAG_LL]: ["L", "LL"],
    [Physics.TILE.SLOPE_L_DIAG_UL]: ["L", "UL"], [Physics.TILE.SLOPE_L_DIAG_LR]: ["L", "LR"],
    [Physics.TILE.SLOPE_R_DIAG_UR]: ["R", "UR"], [Physics.TILE.SLOPE_R_DIAG_LL]: ["R", "LL"],
    [Physics.TILE.SLOPE_R_DIAG_UL]: ["R", "UL"], [Physics.TILE.SLOPE_R_DIAG_LR]: ["R", "LR"],
    // Diagonal slope additional per-orientation diagonals
    [Physics.TILE.SLOPE_UL_DIAG_UR]: ["UL", "UR"], [Physics.TILE.SLOPE_UL_DIAG_LL]: ["UL", "LL"],
    [Physics.TILE.SLOPE_UL_DIAG_LR]: ["UL", "LR"],
    [Physics.TILE.SLOPE_UR_DIAG_LL]: ["UR", "LL"], [Physics.TILE.SLOPE_UR_DIAG_UL]: ["UR", "UL"],
    [Physics.TILE.SLOPE_UR_DIAG_LR]: ["UR", "LR"],
    [Physics.TILE.SLOPE_DL_DIAG_UR]: ["DL", "UR"], [Physics.TILE.SLOPE_DL_DIAG_UL]: ["DL", "UL"],
    [Physics.TILE.SLOPE_DL_DIAG_LR]: ["DL", "LR"],
    [Physics.TILE.SLOPE_DR_DIAG_UR]: ["DR", "UR"], [Physics.TILE.SLOPE_DR_DIAG_LL]: ["DR", "LL"],
    [Physics.TILE.SLOPE_DR_DIAG_UL]: ["DR", "UL"],
  };
  // Partial slope tiles: [direction, corner] for curves and bumps
  const SLOPE_CURVE_INFO = {
    [Physics.TILE.SLOPE_CURVE_TL]: ["UL", "TL"],
    [Physics.TILE.SLOPE_CURVE_TR]: ["UR", "TR"],
    [Physics.TILE.SLOPE_CURVE_BL]: ["DL", "BL"],
    [Physics.TILE.SLOPE_CURVE_BR]: ["DR", "BR"],
    // Cardinal slope curves
    [Physics.TILE.SLOPE_U_CURVE_TL]: ["U", "TL"], [Physics.TILE.SLOPE_U_CURVE_TR]: ["U", "TR"],
    [Physics.TILE.SLOPE_U_CURVE_BL]: ["U", "BL"], [Physics.TILE.SLOPE_U_CURVE_BR]: ["U", "BR"],
    [Physics.TILE.SLOPE_D_CURVE_TL]: ["D", "TL"], [Physics.TILE.SLOPE_D_CURVE_TR]: ["D", "TR"],
    [Physics.TILE.SLOPE_D_CURVE_BL]: ["D", "BL"], [Physics.TILE.SLOPE_D_CURVE_BR]: ["D", "BR"],
    [Physics.TILE.SLOPE_L_CURVE_TL]: ["L", "TL"], [Physics.TILE.SLOPE_L_CURVE_TR]: ["L", "TR"],
    [Physics.TILE.SLOPE_L_CURVE_BL]: ["L", "BL"], [Physics.TILE.SLOPE_L_CURVE_BR]: ["L", "BR"],
    [Physics.TILE.SLOPE_R_CURVE_TL]: ["R", "TL"], [Physics.TILE.SLOPE_R_CURVE_TR]: ["R", "TR"],
    [Physics.TILE.SLOPE_R_CURVE_BL]: ["R", "BL"], [Physics.TILE.SLOPE_R_CURVE_BR]: ["R", "BR"],
    // Diagonal slope additional per-orientation curves
    [Physics.TILE.SLOPE_UL_CURVE_TR]: ["UL", "TR"], [Physics.TILE.SLOPE_UL_CURVE_BL]: ["UL", "BL"],
    [Physics.TILE.SLOPE_UL_CURVE_BR]: ["UL", "BR"],
    [Physics.TILE.SLOPE_UR_CURVE_TL]: ["UR", "TL"], [Physics.TILE.SLOPE_UR_CURVE_BL]: ["UR", "BL"],
    [Physics.TILE.SLOPE_UR_CURVE_BR]: ["UR", "BR"],
    [Physics.TILE.SLOPE_DL_CURVE_TL]: ["DL", "TL"], [Physics.TILE.SLOPE_DL_CURVE_TR]: ["DL", "TR"],
    [Physics.TILE.SLOPE_DL_CURVE_BR]: ["DL", "BR"],
    [Physics.TILE.SLOPE_DR_CURVE_TL]: ["DR", "TL"], [Physics.TILE.SLOPE_DR_CURVE_TR]: ["DR", "TR"],
    [Physics.TILE.SLOPE_DR_CURVE_BL]: ["DR", "BL"],
  };
  const SLOPE_BUMP_INFO = {
    [Physics.TILE.SLOPE_BUMP_TL]: ["UL", "TL"],
    [Physics.TILE.SLOPE_BUMP_TR]: ["UR", "TR"],
    [Physics.TILE.SLOPE_BUMP_BL]: ["DL", "BL"],
    [Physics.TILE.SLOPE_BUMP_BR]: ["DR", "BR"],
    // Cardinal slope bumps
    [Physics.TILE.SLOPE_U_BUMP_TL]: ["U", "TL"], [Physics.TILE.SLOPE_U_BUMP_TR]: ["U", "TR"],
    [Physics.TILE.SLOPE_U_BUMP_BL]: ["U", "BL"], [Physics.TILE.SLOPE_U_BUMP_BR]: ["U", "BR"],
    [Physics.TILE.SLOPE_D_BUMP_TL]: ["D", "TL"], [Physics.TILE.SLOPE_D_BUMP_TR]: ["D", "TR"],
    [Physics.TILE.SLOPE_D_BUMP_BL]: ["D", "BL"], [Physics.TILE.SLOPE_D_BUMP_BR]: ["D", "BR"],
    [Physics.TILE.SLOPE_L_BUMP_TL]: ["L", "TL"], [Physics.TILE.SLOPE_L_BUMP_TR]: ["L", "TR"],
    [Physics.TILE.SLOPE_L_BUMP_BL]: ["L", "BL"], [Physics.TILE.SLOPE_L_BUMP_BR]: ["L", "BR"],
    [Physics.TILE.SLOPE_R_BUMP_TL]: ["R", "TL"], [Physics.TILE.SLOPE_R_BUMP_TR]: ["R", "TR"],
    [Physics.TILE.SLOPE_R_BUMP_BL]: ["R", "BL"], [Physics.TILE.SLOPE_R_BUMP_BR]: ["R", "BR"],
    // Diagonal slope additional per-orientation bumps
    [Physics.TILE.SLOPE_UL_BUMP_TR]: ["UL", "TR"], [Physics.TILE.SLOPE_UL_BUMP_BL]: ["UL", "BL"],
    [Physics.TILE.SLOPE_UL_BUMP_BR]: ["UL", "BR"],
    [Physics.TILE.SLOPE_UR_BUMP_TL]: ["UR", "TL"], [Physics.TILE.SLOPE_UR_BUMP_BL]: ["UR", "BL"],
    [Physics.TILE.SLOPE_UR_BUMP_BR]: ["UR", "BR"],
    [Physics.TILE.SLOPE_DL_BUMP_TL]: ["DL", "TL"], [Physics.TILE.SLOPE_DL_BUMP_TR]: ["DL", "TR"],
    [Physics.TILE.SLOPE_DL_BUMP_BR]: ["DL", "BR"],
    [Physics.TILE.SLOPE_DR_BUMP_TL]: ["DR", "TL"], [Physics.TILE.SLOPE_DR_BUMP_TR]: ["DR", "TR"],
    [Physics.TILE.SLOPE_DR_BUMP_BL]: ["DR", "BL"],
  };
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

  // Maps a slope tile char to its direction string for arrow drawing
  const TILE_TO_SLOPE_DIR = {
    [Physics.TILE.SLOPE_U]:  "U",  [Physics.TILE.SLOPE_D]:  "D",
    [Physics.TILE.SLOPE_L]:  "L",  [Physics.TILE.SLOPE_R]:  "R",
    [Physics.TILE.SLOPE_UL]: "UL", [Physics.TILE.SLOPE_UR]: "UR",
    [Physics.TILE.SLOPE_DL]: "DL", [Physics.TILE.SLOPE_DR]: "DR",
    [Physics.TILE.SLOPE_DIAG_UR]: "UR", [Physics.TILE.SLOPE_DIAG_DL]: "DL",
    [Physics.TILE.SLOPE_DIAG_UL]: "UL", [Physics.TILE.SLOPE_DIAG_DR]: "DR",
    [Physics.TILE.SLOPE_CURVE_TL]: "UL", [Physics.TILE.SLOPE_CURVE_TR]: "UR",
    [Physics.TILE.SLOPE_CURVE_BL]: "DL", [Physics.TILE.SLOPE_CURVE_BR]: "DR",
    [Physics.TILE.SLOPE_BUMP_TL]:  "UL", [Physics.TILE.SLOPE_BUMP_TR]:  "UR",
    [Physics.TILE.SLOPE_BUMP_BL]:  "DL", [Physics.TILE.SLOPE_BUMP_BR]:  "DR",
    // Cardinal slope partial tiles
    [Physics.TILE.SLOPE_U_DIAG_UR]:"U",[Physics.TILE.SLOPE_U_DIAG_LL]:"U",[Physics.TILE.SLOPE_U_DIAG_UL]:"U",[Physics.TILE.SLOPE_U_DIAG_LR]:"U",
    [Physics.TILE.SLOPE_U_CURVE_TL]:"U",[Physics.TILE.SLOPE_U_CURVE_TR]:"U",[Physics.TILE.SLOPE_U_CURVE_BL]:"U",[Physics.TILE.SLOPE_U_CURVE_BR]:"U",
    [Physics.TILE.SLOPE_U_BUMP_TL]:"U",[Physics.TILE.SLOPE_U_BUMP_TR]:"U",[Physics.TILE.SLOPE_U_BUMP_BL]:"U",[Physics.TILE.SLOPE_U_BUMP_BR]:"U",
    [Physics.TILE.SLOPE_D_DIAG_UR]:"D",[Physics.TILE.SLOPE_D_DIAG_LL]:"D",[Physics.TILE.SLOPE_D_DIAG_UL]:"D",[Physics.TILE.SLOPE_D_DIAG_LR]:"D",
    [Physics.TILE.SLOPE_D_CURVE_TL]:"D",[Physics.TILE.SLOPE_D_CURVE_TR]:"D",[Physics.TILE.SLOPE_D_CURVE_BL]:"D",[Physics.TILE.SLOPE_D_CURVE_BR]:"D",
    [Physics.TILE.SLOPE_D_BUMP_TL]:"D",[Physics.TILE.SLOPE_D_BUMP_TR]:"D",[Physics.TILE.SLOPE_D_BUMP_BL]:"D",[Physics.TILE.SLOPE_D_BUMP_BR]:"D",
    [Physics.TILE.SLOPE_L_DIAG_UR]:"L",[Physics.TILE.SLOPE_L_DIAG_LL]:"L",[Physics.TILE.SLOPE_L_DIAG_UL]:"L",[Physics.TILE.SLOPE_L_DIAG_LR]:"L",
    [Physics.TILE.SLOPE_L_CURVE_TL]:"L",[Physics.TILE.SLOPE_L_CURVE_TR]:"L",[Physics.TILE.SLOPE_L_CURVE_BL]:"L",[Physics.TILE.SLOPE_L_CURVE_BR]:"L",
    [Physics.TILE.SLOPE_L_BUMP_TL]:"L",[Physics.TILE.SLOPE_L_BUMP_TR]:"L",[Physics.TILE.SLOPE_L_BUMP_BL]:"L",[Physics.TILE.SLOPE_L_BUMP_BR]:"L",
    [Physics.TILE.SLOPE_R_DIAG_UR]:"R",[Physics.TILE.SLOPE_R_DIAG_LL]:"R",[Physics.TILE.SLOPE_R_DIAG_UL]:"R",[Physics.TILE.SLOPE_R_DIAG_LR]:"R",
    [Physics.TILE.SLOPE_R_CURVE_TL]:"R",[Physics.TILE.SLOPE_R_CURVE_TR]:"R",[Physics.TILE.SLOPE_R_CURVE_BL]:"R",[Physics.TILE.SLOPE_R_CURVE_BR]:"R",
    [Physics.TILE.SLOPE_R_BUMP_TL]:"R",[Physics.TILE.SLOPE_R_BUMP_TR]:"R",[Physics.TILE.SLOPE_R_BUMP_BL]:"R",[Physics.TILE.SLOPE_R_BUMP_BR]:"R",
    // Diagonal slope additional per-orientation tiles
    [Physics.TILE.SLOPE_UL_DIAG_UR]:"UL",[Physics.TILE.SLOPE_UL_DIAG_LL]:"UL",[Physics.TILE.SLOPE_UL_DIAG_LR]:"UL",
    [Physics.TILE.SLOPE_UL_CURVE_TR]:"UL",[Physics.TILE.SLOPE_UL_CURVE_BL]:"UL",[Physics.TILE.SLOPE_UL_CURVE_BR]:"UL",
    [Physics.TILE.SLOPE_UL_BUMP_TR]:"UL",[Physics.TILE.SLOPE_UL_BUMP_BL]:"UL",[Physics.TILE.SLOPE_UL_BUMP_BR]:"UL",
    [Physics.TILE.SLOPE_UR_DIAG_LL]:"UR",[Physics.TILE.SLOPE_UR_DIAG_UL]:"UR",[Physics.TILE.SLOPE_UR_DIAG_LR]:"UR",
    [Physics.TILE.SLOPE_UR_CURVE_TL]:"UR",[Physics.TILE.SLOPE_UR_CURVE_BL]:"UR",[Physics.TILE.SLOPE_UR_CURVE_BR]:"UR",
    [Physics.TILE.SLOPE_UR_BUMP_TL]:"UR",[Physics.TILE.SLOPE_UR_BUMP_BL]:"UR",[Physics.TILE.SLOPE_UR_BUMP_BR]:"UR",
    [Physics.TILE.SLOPE_DL_DIAG_UR]:"DL",[Physics.TILE.SLOPE_DL_DIAG_UL]:"DL",[Physics.TILE.SLOPE_DL_DIAG_LR]:"DL",
    [Physics.TILE.SLOPE_DL_CURVE_TL]:"DL",[Physics.TILE.SLOPE_DL_CURVE_TR]:"DL",[Physics.TILE.SLOPE_DL_CURVE_BR]:"DL",
    [Physics.TILE.SLOPE_DL_BUMP_TL]:"DL",[Physics.TILE.SLOPE_DL_BUMP_TR]:"DL",[Physics.TILE.SLOPE_DL_BUMP_BR]:"DL",
    [Physics.TILE.SLOPE_DR_DIAG_UR]:"DR",[Physics.TILE.SLOPE_DR_DIAG_LL]:"DR",[Physics.TILE.SLOPE_DR_DIAG_UL]:"DR",
    [Physics.TILE.SLOPE_DR_CURVE_TL]:"DR",[Physics.TILE.SLOPE_DR_CURVE_TR]:"DR",[Physics.TILE.SLOPE_DR_CURVE_BL]:"DR",
    [Physics.TILE.SLOPE_DR_BUMP_TL]:"DR",[Physics.TILE.SLOPE_DR_BUMP_TR]:"DR",[Physics.TILE.SLOPE_DR_BUMP_BL]:"DR",
  };

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
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy - hs); ctx.lineTo(cx + hw, cy - hs);
      ctx.moveTo(cx + hw - 4, cy - hs - 3); ctx.lineTo(cx + hw, cy - hs); ctx.lineTo(cx + hw - 4, cy - hs + 3);
      ctx.moveTo(cx + hw, cy + hs); ctx.lineTo(cx - hw, cy + hs);
      ctx.moveTo(cx - hw + 4, cy + hs - 3); ctx.lineTo(cx - hw, cy + hs); ctx.lineTo(cx - hw + 4, cy + hs + 3);
      ctx.stroke();
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
    if (tile === Physics.TILE.SAND)  { ctx.fillStyle = SAND_COLOR;  ctx.fillRect(x, y, T, T); return; }
    if (tile === Physics.TILE.WATER) { ctx.fillStyle = WATER_COLOR; ctx.fillRect(x, y, T, T); return; }
    if (tile === Physics.TILE.LAVA)  { ctx.fillStyle = LAVA_COLOR;  ctx.fillRect(x, y, T, T); return; }

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
    };
    if (DIAG[tile]) {
      const [color, tri] = DIAG[tile];
      ctx.save();
      ctx.beginPath(); drawTriPath(ctx, tri, x, y); ctx.clip();
      ctx.fillStyle = color; ctx.fillRect(x, y, T, T);
      ctx.restore();
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
    };
    if (MAT_CURVE[tile]) {
      const meta = Physics.CURVE_META[tile];
      const ax = x + meta.ox * T, ay = y + meta.oy * T;
      const [a0, a1] = metaArcs(meta);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, T, a0, a1, false); ctx.closePath(); ctx.clip();
      ctx.fillStyle = MAT_CURVE[tile]; ctx.fillRect(x, y, T, T);
      ctx.restore();
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
    };
    if (MAT_BUMP[tile]) {
      const meta = Physics.BUMP_META[tile];
      const ax = x + meta.ox * T, ay = y + meta.oy * T;
      const [a0, a1] = metaArcs(meta);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, T, T);
      ctx.moveTo(ax, ay); ctx.arc(ax, ay, T, a0, a1, false); ctx.closePath();
      ctx.clip("evenodd");
      ctx.fillStyle = MAT_BUMP[tile]; ctx.fillRect(x, y, T, T);
      ctx.restore();
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
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = openColor;
      ctx.beginPath();
      if (fw === "LL") {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + T);
        ctx.lineTo(x + T, y + T);
      }
      if (fw === "UR") {
        ctx.moveTo(x, y);
        ctx.lineTo(x + T, y);
        ctx.lineTo(x + T, y + T);
      }
      if (fw === "LR") {
        ctx.moveTo(x + T, y);
        ctx.lineTo(x, y + T);
        ctx.lineTo(x + T, y + T);
      }
      if (fw === "UL") {
        ctx.moveTo(x, y);
        ctx.lineTo(x + T, y);
        ctx.lineTo(x, y + T);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (fw === "LL") {
        ctx.moveTo(x, y);       ctx.lineTo(x + T, y);
        ctx.moveTo(x + T, y);   ctx.lineTo(x + T, y + T);
        ctx.moveTo(x, y);       ctx.lineTo(x + T, y + T);
      } else if (fw === "UR") {
        ctx.moveTo(x, y);       ctx.lineTo(x, y + T);
        ctx.moveTo(x, y + T);   ctx.lineTo(x + T, y + T);
        ctx.moveTo(x, y);       ctx.lineTo(x + T, y + T);
      } else if (fw === "LR") {
        ctx.moveTo(x, y);       ctx.lineTo(x + T, y);
        ctx.moveTo(x, y);       ctx.lineTo(x, y + T);
        ctx.moveTo(x + T, y);   ctx.lineTo(x, y + T);
      } else {
        ctx.moveTo(x + T, y);   ctx.lineTo(x + T, y + T);
        ctx.moveTo(x, y + T);   ctx.lineTo(x + T, y + T);
        ctx.moveTo(x + T, y);   ctx.lineTo(x, y + T);
      }
      ctx.stroke();
      // 2 chevrons in solid wall area — only for bouncy/sticky variants
      if (Physics.BOUNCY_TILES.has(tile) || Physics.STICKY_TILES.has(tile)) {
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
            ctx.moveTo(pcx + a, pcy);
            ctx.lineTo(pcx - a, pcy + a);
            ctx.lineTo(pcx, pcy - a);
          }
          if (fw === "UR") {
            ctx.moveTo(pcx - a, pcy);
            ctx.lineTo(pcx + a, pcy - a);
            ctx.lineTo(pcx, pcy + a);
          }
          if (fw === "LR") {
            ctx.moveTo(pcx - a, pcy);
            ctx.lineTo(pcx + a, pcy + a);
            ctx.lineTo(pcx, pcy - a);
          }
          if (fw === "UL") {
            ctx.moveTo(pcx + a, pcy);
            ctx.lineTo(pcx - a, pcy - a);
            ctx.lineTo(pcx, pcy + a);
          }
          ctx.stroke();
        });
      }
      return;
    }

    // Curves — open arc uses openColor; chevrons in solid area for bouncy/sticky
    const curveMeta = Physics.CURVE_META[tile];
    if (curveMeta) {
      const ax = x + curveMeta.ox * T,
        ay = y + curveMeta.oy * T;
      const [a0, a1] = metaArcs(curveMeta);
      const [face, edge] = wallFaceColors(tile);
      ctx.fillStyle = face;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = openColor;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.arc(ax, ay, T, a0, a1, false);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ax, ay, T, a0, a1, false);
      const ocx = ax + T * (Math.cos(a0) + Math.cos(a1));
      const ocy = ay + T * (Math.sin(a0) + Math.sin(a1));
      ctx.moveTo(ocx, ocy); ctx.lineTo(ax + T * Math.cos(a0), ay + T * Math.sin(a0));
      ctx.moveTo(ocx, ocy); ctx.lineTo(ax + T * Math.cos(a1), ay + T * Math.sin(a1));
      ctx.stroke();
      if (Physics.BOUNCY_TILES.has(tile) || Physics.STICKY_TILES.has(tile)) {
        // Place chevrons in the solid wall area — opposite side of arc from center
        const midAngle = (a0 + a1) / 2 + Math.PI;
        const spread = Math.PI / 8;
        const a = T * 0.09;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        [midAngle - spread, midAngle + spread].forEach((angle) => {
          const pcx = ax + T * 0.52 * Math.cos(angle);
          const pcy = ay + T * 0.52 * Math.sin(angle);
          const nx = Math.cos(angle),
            ny = Math.sin(angle);
          const tx = -ny,
            ty = nx;
          ctx.beginPath();
          ctx.moveTo(pcx - tx * a, pcy - ty * a);
          ctx.lineTo(pcx + nx * a, pcy + ny * a);
          ctx.lineTo(pcx + tx * a, pcy + ty * a);
          ctx.stroke();
        });
      }
      return;
    }

    // Bumps — solid arc, open area uses openColor; 3 chevrons in solid arc area
    const bumpMeta = Physics.BUMP_META[tile];
    if (bumpMeta) {
      const bax = x + bumpMeta.ox * T,
        bay = y + bumpMeta.oy * T;
      const [ba0, ba1] = metaArcs(bumpMeta);
      const [face, edge] = wallFaceColors(tile);
      ctx.fillStyle = openColor;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.moveTo(bax, bay);
      ctx.arc(bax, bay, T, ba0, ba1, false);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bax, bay, T, ba0, ba1, false);
      ctx.moveTo(bax, bay); ctx.lineTo(bax + T * Math.cos(ba0), bay + T * Math.sin(ba0));
      ctx.moveTo(bax, bay); ctx.lineTo(bax + T * Math.cos(ba1), bay + T * Math.sin(ba1));
      ctx.stroke();
      if (Physics.BOUNCY_TILES.has(tile) || Physics.STICKY_TILES.has(tile)) {
        const midAngle = (ba0 + ba1) / 2;
        const spread = Math.PI / 8;
        const a = T * 0.09;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        [midAngle - spread, midAngle + spread].forEach((angle) => {
          const pcx = bax + T * 0.52 * Math.cos(angle);
          const pcy = bay + T * 0.52 * Math.sin(angle);
          const nx = Math.cos(angle),
            ny = Math.sin(angle);
          const tx = -ny,
            ty = nx;
          ctx.beginPath();
          ctx.moveTo(pcx - tx * a, pcy - ty * a);
          ctx.lineTo(pcx + nx * a, pcy + ny * a);
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

  return {
    BALL_COLORS,
    renderMap,
    renderGroundTile,
    renderWallTile,
    renderBall,
    renderAimLine,
  };
})();
