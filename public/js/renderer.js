const Renderer = (function () {

  const BALL_COLORS  = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#e91e63'];
  const FAIRWAY      = '#3a7a35';
  const WALL_FACE    = '#5a5a5a';
  const WALL_EDGE    = '#3a3a3a';
  const HOLE_COLOR   = '#0a0a0a';
  const HOLE_RIM     = '#222';
  const SAND_COLOR   = '#c8a84b';
  const WATER_COLOR  = '#2a7fd4';
  const SLOPE_FACE = {
    [Physics.TILE.SLOPE_U]: '#72c45a',
    [Physics.TILE.SLOPE_L]: '#50a03c',
    [Physics.TILE.SLOPE_R]: '#2d6228',
    [Physics.TILE.SLOPE_D]: '#1c4d18',
  };
  const SLOPE_CHEV = {
    [Physics.TILE.SLOPE_U]: '#1e5c15',
    [Physics.TILE.SLOPE_L]: '#1e5c15',
    [Physics.TILE.SLOPE_R]: '#6ec054',
    [Physics.TILE.SLOPE_D]: '#6ec054',
  };
  const BOUNCY_FACE  = '#e8940a';
  const BOUNCY_EDGE  = '#9a5c00';
  const DRAG_FACE    = '#3a4e7a';
  const DRAG_EDGE    = '#1a2a4a';

  const T = Physics.TILE_SIZE;

  // ── Map ──────────────────────────────────────────────────────────────────

  function renderMap(ctx, map) {
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        renderTile(ctx, col, row, map.tiles[row][col]);
      }
    }
  }

  function renderTile(ctx, col, row, tile) {
    const x = col * T;
    const y = row * T;

    if (tile === Physics.TILE.WALL) {
      ctx.fillStyle = WALL_FACE;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = WALL_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      return;
    }
    if (tile === Physics.TILE.BOUNCY) {
      ctx.fillStyle = BOUNCY_FACE; ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = BOUNCY_EDGE; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      // Spring chevrons
      const cx = x + T / 2, cy = y + T / 2, hw = T * 0.28, hh = T * 0.18;
      ctx.strokeStyle = BOUNCY_EDGE; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      [-hh, hh].forEach(oy => {
        ctx.beginPath();
        ctx.moveTo(cx - hw, cy + oy); ctx.lineTo(cx, cy + oy - hh); ctx.lineTo(cx + hw, cy + oy);
        ctx.stroke();
      });
      return;
    }
    if (tile === Physics.TILE.STICKY_WALL) {
      ctx.fillStyle = DRAG_FACE; ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = DRAG_EDGE; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      // Inward dashes suggesting absorption
      const cx = x + T / 2, cy = y + T / 2, s = T * 0.22;
      ctx.strokeStyle = DRAG_EDGE; ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (tile === Physics.TILE.SAND) {
      ctx.fillStyle = SAND_COLOR; ctx.fillRect(x, y, T, T); return;
    }
    if (tile === Physics.TILE.WATER) {
      ctx.fillStyle = WATER_COLOR; ctx.fillRect(x, y, T, T); return;
    }

    // Slope tiles — vivid green background + dark chevron
    if (tile === Physics.TILE.SLOPE_U || tile === Physics.TILE.SLOPE_D ||
        tile === Physics.TILE.SLOPE_L || tile === Physics.TILE.SLOPE_R) {
      const cx = x + T / 2, cy = y + T / 2, a = T * 0.28;
      ctx.fillStyle = SLOPE_FACE[tile]; ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = SLOPE_CHEV[tile]; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (tile === Physics.TILE.SLOPE_R) { ctx.moveTo(cx-a, cy-a); ctx.lineTo(cx+a, cy); ctx.lineTo(cx-a, cy+a); }
      if (tile === Physics.TILE.SLOPE_L) { ctx.moveTo(cx+a, cy-a); ctx.lineTo(cx-a, cy); ctx.lineTo(cx+a, cy+a); }
      if (tile === Physics.TILE.SLOPE_U) { ctx.moveTo(cx-a, cy+a); ctx.lineTo(cx,   cy-a); ctx.lineTo(cx+a, cy+a); }
      if (tile === Physics.TILE.SLOPE_D) { ctx.moveTo(cx-a, cy-a); ctx.lineTo(cx,   cy+a); ctx.lineTo(cx+a, cy-a); }
      ctx.stroke();
      return;
    }

    // Diagonal wall tiles — wall triangle + fairway triangle + hypotenuse edge
    const DIAG_WALL = { i: 'LL', j: 'UR', k: 'LR', l: 'UL' };
    if (DIAG_WALL[tile]) {
      const fw = DIAG_WALL[tile];
      ctx.fillStyle = WALL_FACE; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = FAIRWAY; ctx.beginPath();
      if (fw === 'LL') { ctx.moveTo(x,y);   ctx.lineTo(x,y+T);   ctx.lineTo(x+T,y+T); }
      if (fw === 'UR') { ctx.moveTo(x,y);   ctx.lineTo(x+T,y);   ctx.lineTo(x+T,y+T); }
      if (fw === 'LR') { ctx.moveTo(x+T,y); ctx.lineTo(x,y+T);   ctx.lineTo(x+T,y+T); }
      if (fw === 'UL') { ctx.moveTo(x,y);   ctx.lineTo(x+T,y);   ctx.lineTo(x,y+T);   }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = WALL_EDGE; ctx.lineWidth = 1.5; ctx.beginPath();
      if (fw === 'LL' || fw === 'UR') { ctx.moveTo(x, y);   ctx.lineTo(x+T, y+T); }
      else                            { ctx.moveTo(x+T, y); ctx.lineTo(x, y+T);   }
      ctx.stroke();
      return;
    }

    // Diagonal sand/water tiles — draw fairway base then material triangle
    const DIAG = {
      a: [SAND_COLOR,  'UR'], b: [SAND_COLOR,  'LL'],
      c: [SAND_COLOR,  'UL'], d: [SAND_COLOR,  'LR'],
      e: [WATER_COLOR, 'UR'], f: [WATER_COLOR, 'LL'],
      g: [WATER_COLOR, 'UL'], h: [WATER_COLOR, 'LR'],
    };
    if (DIAG[tile]) {
      const [color, tri] = DIAG[tile];
      ctx.fillStyle = FAIRWAY; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = color;
      ctx.beginPath();
      if (tri === 'UR') { ctx.moveTo(x,y);   ctx.lineTo(x+T,y); ctx.lineTo(x+T,y+T); }
      if (tri === 'LL') { ctx.moveTo(x,y);   ctx.lineTo(x,y+T); ctx.lineTo(x+T,y+T); }
      if (tri === 'UL') { ctx.moveTo(x,y);   ctx.lineTo(x+T,y); ctx.lineTo(x,y+T);   }
      if (tri === 'LR') { ctx.moveTo(x+T,y); ctx.lineTo(x,y+T); ctx.lineTo(x+T,y+T); }
      ctx.closePath(); ctx.fill();
      return;
    }

    // Material curves/bumps — same arc geometry as wall variants, different fill color
    function metaArcs(meta) {
      if (meta.ox === 1 && meta.oy === 1) return [Math.PI,       Math.PI * 1.5];
      if (meta.ox === 0 && meta.oy === 1) return [Math.PI * 1.5, Math.PI * 2  ];
      if (meta.ox === 1 && meta.oy === 0) return [Math.PI * 0.5, Math.PI      ];
      return [0, Math.PI * 0.5];
    }
    const MAT_CURVE = {
      m: SAND_COLOR, n: SAND_COLOR, o: SAND_COLOR, p: SAND_COLOR,
      u: WATER_COLOR, x: WATER_COLOR, y: WATER_COLOR, z: WATER_COLOR,
    };
    const MAT_BUMP = {
      q: SAND_COLOR, r: SAND_COLOR, s: SAND_COLOR, t: SAND_COLOR,
      B: WATER_COLOR, C: WATER_COLOR, D: WATER_COLOR, E: WATER_COLOR,
    };
    if (MAT_CURVE[tile]) {
      const meta = Physics.CURVE_META[tile];
      const ax = x + meta.ox * T, ay = y + meta.oy * T;
      const [a0, a1] = metaArcs(meta);
      ctx.fillStyle = FAIRWAY; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = MAT_CURVE[tile];
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, T, a0, a1, false);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = WALL_EDGE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ax, ay, T, a0, a1, false); ctx.stroke();
      return;
    }
    if (MAT_BUMP[tile]) {
      const meta = Physics.BUMP_META[tile];
      const ax = x + meta.ox * T, ay = y + meta.oy * T;
      const [a0, a1] = metaArcs(meta);
      ctx.fillStyle = MAT_BUMP[tile]; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = FAIRWAY;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, T, a0, a1, false);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = WALL_EDGE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ax, ay, T, a0, a1, false); ctx.stroke();
      return;
    }

    ctx.fillStyle = FAIRWAY;
    ctx.fillRect(x, y, T, T);

    if (tile === Physics.TILE.HOLE) {
      ctx.fillStyle = HOLE_RIM;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = HOLE_COLOR;
      ctx.beginPath();
      ctx.arc(x + T / 2, y + T / 2, T / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const meta = Physics.CURVE_META[tile];
    if (meta) {
      // Arc center is at one corner of the tile; the fairway is a quarter-circle
      // pie-slice in the open quadrant. Draw wall first, fairway on top.
      const ax = x + meta.ox * T;
      const ay = y + meta.oy * T;

      // Angles: increasing angle in Canvas 2D goes clockwise on screen.
      // Each type sweeps from one axis-aligned direction to the adjacent one,
      // covering the open quadrant.
      //   TL: π → 3π/2   TR: 3π/2 → 2π   BL: π/2 → π   BR: 0 → π/2
      const ARCS = {
        [Physics.TILE.CURVE_TL]: [Math.PI,        Math.PI * 1.5],
        [Physics.TILE.CURVE_TR]: [Math.PI * 1.5,  Math.PI * 2  ],
        [Physics.TILE.CURVE_BL]: [Math.PI * 0.5,  Math.PI      ],
        [Physics.TILE.CURVE_BR]: [0,               Math.PI * 0.5],
      };
      const [a0, a1] = ARCS[tile];

      // Wall background (whole tile)
      ctx.fillStyle = WALL_FACE;
      ctx.fillRect(x, y, T, T);

      // Fairway pie-slice (open quadrant)
      ctx.fillStyle = FAIRWAY;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.arc(ax, ay, T, a0, a1, false);
      ctx.closePath();
      ctx.fill();

      // Arc outline
      ctx.strokeStyle = WALL_EDGE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ax, ay, T, a0, a1, false);
      ctx.stroke();
    }

    const bumpMeta = Physics.BUMP_META[tile];
    if (bumpMeta) {
      const bax = x + bumpMeta.ox * T;
      const bay = y + bumpMeta.oy * T;
      const BUMP_ARCS = {
        [Physics.TILE.BUMP_TL]: [Math.PI,       Math.PI * 1.5],
        [Physics.TILE.BUMP_TR]: [Math.PI * 1.5, Math.PI * 2  ],
        [Physics.TILE.BUMP_BL]: [Math.PI * 0.5, Math.PI      ],
        [Physics.TILE.BUMP_BR]: [0,              Math.PI * 0.5],
      };
      const [ba0, ba1] = BUMP_ARCS[tile];
      ctx.fillStyle = WALL_FACE;
      ctx.beginPath();
      ctx.moveTo(bax, bay);
      ctx.arc(bax, bay, T, ba0, ba1, false);
      ctx.closePath();
      ctx.fill();

      // Arc outline
      ctx.strokeStyle = WALL_EDGE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bax, bay, T, ba0, ba1, false);
      ctx.stroke();
    }
  }

  // ── Ball ─────────────────────────────────────────────────────────────────

  function renderBall(ctx, ball, playerIndex) {
    const color = BALL_COLORS[playerIndex % BALL_COLORS.length];
    const r = Physics.BALL_RADIUS;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ball.x + 1, ball.y + 2, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(ball.x - r * 0.3, ball.y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
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

    const power = Math.min(dist * Physics.POWER_SCALE, Physics.MAX_POWER) / Physics.MAX_POWER;

    ctx.save();
    ctx.globalAlpha = 0.3 + power * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(cursorX, cursorY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Power arc at ball
    ctx.strokeStyle = power > 0.7 ? '#e74c3c' : power > 0.4 ? '#f39c12' : '#2ecc71';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, Physics.BALL_RADIUS + 4, 0, Math.PI * 2 * power);
    ctx.stroke();

    ctx.restore();
  }

  return { renderMap, renderTile, renderBall, renderAimLine };
})();
