# Slope Tile Design Backup — 2026-05-31

Reverted but saved for future use.

## Color scheme

- Default fairway: `#2E7D32`
- Slope background: `#388E3C`
- Chevrons: `rgba(255,255,255,0.65)`, 1.5px stroke, round caps/join

## Chevron design

2 stacked chevrons per tile, positioned along the direction axis at ~1/3 and ~2/3 of the tile. Dimensions from SVG 24×24 viewBox:

- arm (center→tip): `T * 5/48` (= 2.5/24)
- spread (center→leg): `T * 5/24` (= 5/24)
- Diagonal arm: `arm / √2`, diagonal spread: `spread / √2`

### Positions

| Dir | Pos 1 | Pos 2 |
|-----|-------|-------|
| R/L | `[x+pL, cy]` | `[x+pR, cy]` |
| U/D | `[cx, y+pL]` | `[cx, y+pR]` |
| UR  | `[x+pL, y+pR]` | `[x+pR, y+pL]` |
| UL  | `[x+pR, y+pR]` | `[x+pL, y+pL]` |
| DR  | `[x+pL, y+pL]` | `[x+pR, y+pR]` |
| DL  | `[x+pR, y+pL]` | `[x+pL, y+pR]` |

Where `pL = T*17/48`, `pR = T*31/48`, `cx = x+T/2`, `cy = y+T/2`.

### Paths (per chevron center pcx, pcy)

```
R:  moveTo(pcx-arm, pcy-spread); lineTo(pcx+arm, pcy); lineTo(pcx-arm, pcy+spread)
L:  moveTo(pcx+arm, pcy-spread); lineTo(pcx-arm, pcy); lineTo(pcx+arm, pcy+spread)
U:  moveTo(pcx-spread, pcy+arm); lineTo(pcx, pcy-arm); lineTo(pcx+spread, pcy+arm)
D:  moveTo(pcx-spread, pcy-arm); lineTo(pcx, pcy+arm); lineTo(pcx+spread, pcy-arm)
UL: moveTo(pcx+dArm-dSpr, pcy+dArm+dSpr); lineTo(pcx-dArm, pcy-dArm); lineTo(pcx+dArm+dSpr, pcy+dArm-dSpr)
UR: moveTo(pcx-dArm-dSpr, pcy+dArm-dSpr); lineTo(pcx+dArm, pcy-dArm); lineTo(pcx-dArm+dSpr, pcy+dArm+dSpr)
DL: moveTo(pcx+dArm+dSpr, pcy-dArm+dSpr); lineTo(pcx-dArm, pcy+dArm); lineTo(pcx+dArm-dSpr, pcy-dArm-dSpr)
DR: moveTo(pcx-dArm+dSpr, pcy-dArm-dSpr); lineTo(pcx+dArm, pcy+dArm); lineTo(pcx-dArm-dSpr, pcy-dArm+dSpr)
```

## Files changed

- `public/js/renderer.js` — `drawSlopeArrows`, `SLOPE_FACE` → `true`, `FAIRWAY`, `FAIRWAY_BG`
- `editor/editor.html` — `drawSlopeArrows`, `SLOPE_FACE`, `FW`

## renderer.js key constants

```js
const FAIRWAY = "#388E3C";
const FAIRWAY_BG = "#2E7D32";
```

## editor.html key constants

```js
const FW = "#2E7D32";
const SLOPE_FACE = {
  U: "#388E3C", UL: "#388E3C", UR: "#388E3C",
  L: "#388E3C", R: "#388E3C",
  DL: "#388E3C", DR: "#388E3C", D: "#388E3C",
};
```
