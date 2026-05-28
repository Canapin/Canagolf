const RenderShared = (function () {
  function drawWaterWaves(ctx, x, y, T) {
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 2; row++) {
      const yy = y + T * (0.3 + row * 0.4);
      ctx.beginPath();
      ctx.moveTo(x + T * 0.14, yy);
      ctx.quadraticCurveTo(x + T * 0.3, yy - T * 0.14, x + T * 0.5, yy);
      ctx.quadraticCurveTo(x + T * 0.7, yy + T * 0.14, x + T * 0.86, yy);
      ctx.stroke();
    }
  }

  function drawSandSpecks(ctx, x, y, T) {
    const dots = [
      [0.2, 0.25, "rgba(0,0,0,0.1)"], [0.45, 0.2, "rgba(255,255,255,0.2)"], [0.75, 0.3, "rgba(0,0,0,0.08)"],
      [0.3, 0.5, "rgba(255,255,255,0.25)"], [0.65, 0.55, "rgba(0,0,0,0.12)"], [0.85, 0.5, "rgba(255,255,255,0.18)"],
      [0.15, 0.75, "rgba(0,0,0,0.09)"], [0.5, 0.8, "rgba(255,255,255,0.22)"], [0.7, 0.72, "rgba(0,0,0,0.11)"],
    ];
    for (const [fx, fy, col] of dots) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + T * fx, y + T * fy, T * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const ARC = {
    TL: { ox: 1, oy: 1, a0: Math.PI, a1: Math.PI * 1.5 },
    TR: { ox: 0, oy: 1, a0: Math.PI * 1.5, a1: Math.PI * 2 },
    BL: { ox: 1, oy: 0, a0: Math.PI * 0.5, a1: Math.PI },
    BR: { ox: 0, oy: 0, a0: 0, a1: Math.PI * 0.5 },
  };

  function cornerFromMeta(ox, oy) {
    if (ox === 1 && oy === 1) return "TL";
    if (ox === 0 && oy === 1) return "TR";
    if (ox === 1 && oy === 0) return "BL";
    return "BR";
  }

  function triPath(ctx, x, y, T, tri) {
    switch (tri) {
      case "UR": ctx.moveTo(x, y); ctx.lineTo(x + T, y); ctx.lineTo(x + T, y + T); break;
      case "LL": ctx.moveTo(x, y); ctx.lineTo(x, y + T); ctx.lineTo(x + T, y + T); break;
      case "UL": ctx.moveTo(x, y); ctx.lineTo(x + T, y); ctx.lineTo(x, y + T); break;
      case "LR": ctx.moveTo(x + T, y); ctx.lineTo(x, y + T); ctx.lineTo(x + T, y + T); break;
    }
  }

  function renderFull(ctx, x, y, T, color, isWater, isSand) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, T, T);
    if (isWater) drawWaterWaves(ctx, x, y, T);
    if (isSand) drawSandSpecks(ctx, x, y, T);
  }

  function renderDiag(ctx, x, y, T, tri, color, isWater, isSand) {
    ctx.save();
    ctx.beginPath();
    triPath(ctx, x, y, T, tri);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, T, T);
    if (isWater) drawWaterWaves(ctx, x, y, T);
    if (isSand) drawSandSpecks(ctx, x, y, T);
    ctx.restore();
  }

  function renderCurve(ctx, x, y, T, corner, color, isWater, isSand) {
    const c = ARC[corner];
    const ax = x + c.ox * T, ay = y + c.oy * T;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.arc(ax, ay, T, c.a0, c.a1, false);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, T, T);
    if (isWater) drawWaterWaves(ctx, x, y, T);
    if (isSand) drawSandSpecks(ctx, x, y, T);
    ctx.restore();
  }

  function renderBump(ctx, x, y, T, corner, color, isWater, isSand) {
    const c = ARC[corner];
    const ax = x + c.ox * T, ay = y + c.oy * T;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, T, T);
    ctx.moveTo(ax, ay);
    ctx.arc(ax, ay, T, c.a0, c.a1, false);
    ctx.closePath();
    ctx.clip("evenodd");
    ctx.fillStyle = color;
    ctx.fillRect(x, y, T, T);
    if (isWater) drawWaterWaves(ctx, x, y, T);
    if (isSand) drawSandSpecks(ctx, x, y, T);
    ctx.restore();
  }

  return {
    drawWaterWaves,
    cornerFromMeta,
    renderFull,
    renderDiag,
    renderCurve,
    renderBump,
  };
})();

if (typeof module !== "undefined") module.exports = RenderShared;
