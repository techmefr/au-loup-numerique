import * as THREE from 'three';

export const GROUND = { w: 22, d: 16, px: 100 };
const W = GROUND.w * GROUND.px;
const H = GROUND.d * GROUND.px;
const cx = (x) => (x + GROUND.w / 2) * GROUND.px;
const cz = (z) => (z + GROUND.d / 2) * GROUND.px;

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export const riverPoints = [[-8.2, -8.5], [-7.2, -5.2], [-7.9, -2.4], [-6.9, 0.6], [-7.8, 3.6], [-8.4, 6.2], [-8.0, 8.6]];
export const pathPoints = [[2.2, 8.6], [1.6, 5.2], [0.5, 2.4], [0.5, 1.0]];
export const pathBack = [[4.9, -1.0], [5.6, -4.2], [5.0, -6.2], [5.6, -8.6]];

function curve(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(cx(pts[0][0]), cz(pts[0][1]));
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (cx(pts[i][0]) + cx(pts[i + 1][0])) / 2, mz = (cz(pts[i][1]) + cz(pts[i + 1][1])) / 2;
    ctx.quadraticCurveTo(cx(pts[i][0]), cz(pts[i][1]), mx, mz);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(cx(l[0]), cz(l[1]));
}

function stroke(ctx, pts, width, color) {
  curve(ctx, pts);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function paintGround() {
  const rand = rng(7);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const lw = 440, lh = 320;
  const seeds = [];
  const greens = ['#a4d45c', '#8cc54f', '#9fd058', '#7fbb48', '#b0da66', '#94c953'];
  for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < 4; gy++) {
    seeds.push({ x: (gx + 0.2 + rand() * 0.6) * (lw / 5), y: (gy + 0.2 + rand() * 0.6) * (lh / 4), c: greens[Math.floor(rand() * greens.length)] });
  }
  seeds.push({ x: lw * 0.9, y: lh * 0.85, c: '#e3bb4f' }, { x: lw * 0.82, y: lh * 0.92, c: '#e3bb4f' });
  const low = document.createElement('canvas');
  low.width = lw;
  low.height = lh;
  const lctx = low.getContext('2d');
  const img = lctx.createImageData(lw, lh);
  const idx = new Int16Array(lw * lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const wx = x + Math.sin(y * 0.09) * 9 + Math.sin(y * 0.031 + x * 0.02) * 6;
    const wy = y + Math.cos(x * 0.08) * 9;
    let best = 0, bd = 1e9;
    for (let s = 0; s < seeds.length; s++) {
      const d = (wx - seeds[s].x) ** 2 + (wy - seeds[s].y) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    idx[y * lw + x] = best;
  }
  const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const i = y * lw + x;
    const edge = (x + 1 < lw && idx[i + 1] !== idx[i]) || (y + 1 < lh && idx[i + lw] !== idx[i]);
    const gold = seeds[idx[i]].c === '#e3bb4f';
    const [r, g, b] = edge && !gold ? [66, 140, 52] : rgb(seeds[idx[i]].c);
    const n = (Math.sin(x * 0.7 + y * 0.3) + Math.sin(y * 0.9)) * 3;
    img.data.set([r + n, g + n, b + n, 255], i * 4);
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'blur(2px)';
  ctx.drawImage(low, 0, 0, W, H);
  ctx.filter = 'none';

  ctx.fillStyle = '#b9e07f';
  ctx.beginPath();
  ctx.roundRect(cx(-3.4), cz(-6.4), 7.8 * GROUND.px, 7.9 * GROUND.px, 70);
  ctx.fill();
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 3 ? '#a9d56c' : '#d9c777';
    ctx.beginPath();
    ctx.ellipse(cx(-3 + rand() * 7), cz(-6 + rand() * 7), 30 + rand() * 40, 18 + rand() * 24, rand() * 3, 0, 7);
    ctx.fill();
  }

  stroke(ctx, riverPoints, 210, '#e8d89e');
  stroke(ctx, riverPoints, 160, '#3d78c8');
  stroke(ctx, riverPoints, 110, '#5b9be0');
  ctx.globalAlpha = 0.5;
  stroke(ctx, riverPoints, 40, '#a5d0f5');
  ctx.globalAlpha = 1;
  stroke(ctx, pathPoints, 110, '#d9c18c');
  stroke(ctx, pathPoints, 84, '#ead7a6');
  stroke(ctx, pathBack, 90, '#d9c18c');
  stroke(ctx, pathBack, 66, '#ead7a6');

  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = ['#f6e27a', '#ffffff', '#f3c14b'][i % 3];
    ctx.globalAlpha = 0.35 + rand() * 0.4;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 2 + rand() * 3, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const m = mask.getContext('2d');
  m.fillStyle = '#000';
  m.beginPath();
  m.roundRect(110, 90, W - 220, H - 180, 120);
  m.fill();
  for (let i = 0; i < 2600; i++) {
    const t = rand() * 4;
    const side = Math.floor(t);
    const k = t - side;
    const [x, y] = [[110 + k * (W - 220), 90], [W - 110, 90 + k * (H - 180)], [W - 110 - k * (W - 220), H - 90], [110, H - 90 - k * (H - 180)]][side];
    const r = 10 + rand() * 34;
    m.beginPath();
    m.arc(x + (rand() - 0.5) * 50, y + (rand() - 0.5) * 50, r, 0, 7);
    m.fill();
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = 'blur(3px)';
  ctx.drawImage(mask, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
