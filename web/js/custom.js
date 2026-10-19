// "דמות מתמונה": any picture becomes a playable character.
// The picture is processed once, in high resolution (up to 8K): the background is removed (flood fill from the
// edges, soft edge), it is cropped, scaled to Mario's size and gets the game's dark cartoon outline. In the game it
// walks with bouncing cartoon shoes, stretches when jumping, turns cartwheels, wobbles at the edge.
// Stored in localStorage ("icymario.custom"), so it stays (also in the desktop app).
import { CHARS } from './chars.js';

const INK = '#120818';
const KEY = 'icymario.custom';
const H = 640;                 // stored height in px: ~12 px per game pixel = sharp even at 8K
const LOG_H = 50, LOG_W = 46;  // size in the game (Mario: 30 x 52)

export const custom = {
  id: 'custom', name: 'הדמות שלי', game: 'מתמונה', desc: 'הדמות מהתמונה שלך', img: null, w: 0, h: 0, draw: drawCustom,
};

// ------------------------------------------------------------------ storage
export function init() {
  const s = localStorage.getItem(KEY);
  if (!s) return Promise.resolve(false);
  try {
    const d = JSON.parse(s);
    return loadImage(d.src).then(im => { use(im, d.w, d.h); return true; }).catch(() => false);
  } catch (e) { return Promise.resolve(false); }
}
function use(im, w, h) {
  custom.img = im; custom.w = w; custom.h = h;
  if (!CHARS.includes(custom)) CHARS.push(custom);
}
const loadImage = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });

// ------------------------------------------------------------------ pick a picture (file dialog) -> character
let input = null;
export function pickImage() {
  return new Promise(resolve => {
    if (!input) {
      input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
      document.body.appendChild(input);
    }
    input.value = '';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) { resolve(false); return; }
      try {
        const url = URL.createObjectURL(f);
        const im = await loadImage(url);
        URL.revokeObjectURL(url);
        const r = process(im);
        let src = r.canvas.toDataURL('image/webp', 0.95);
        if (!src.startsWith('data:image/webp')) src = r.canvas.toDataURL('image/png');
        try { localStorage.setItem(KEY, JSON.stringify({ src, w: r.w, h: r.h })); } catch (e) { /* too big: only this session */ }
        use(await loadImage(src), r.w, r.h);
        resolve(true);
      } catch (e) { console.error(e); resolve(false); }
    };
    input.click();
  });
}

// ------------------------------------------------------------------ image processing
function process(im) {
  // 1. work copy (big pictures are reduced first; keeps it fast)
  const k0 = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
  const W0 = Math.max(1, Math.round(im.naturalWidth * k0)), H0 = Math.max(1, Math.round(im.naturalHeight * k0));
  const c0 = canvas(W0, H0), x0 = c0.getContext('2d', { willReadFrequently: true });
  x0.drawImage(im, 0, 0, W0, H0);
  const d = x0.getImageData(0, 0, W0, H0);
  removeBackground(d.data, W0, H0);
  x0.putImageData(d, 0, 0);
  // 2. crop to what is left
  let minX = W0, minY = H0, maxX = -1, maxY = -1;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    if (d.data[(y * W0 + x) * 4 + 3] > 24) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) { minX = 0; minY = 0; maxX = W0 - 1; maxY = H0 - 1; }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  // 3. size in the game: as tall as Mario, not wider than LOG_W
  const asp = cw / ch;
  let lh = LOG_H, lw = LOG_H * asp;
  if (lw > LOG_W) { lw = LOG_W; lh = LOG_W / asp; }
  // 4. final high-resolution picture with the cartoon outline
  const px = H / LOG_H;                                      // stored px per game px
  const ol = Math.max(3, Math.round(1.6 * px));              // outline ~1.6 game px, like the sprites
  const fw = Math.round(lw * px), fh = Math.round(lh * px);
  const out = canvas(fw + 2 * ol, fh + 2 * ol), xo = out.getContext('2d');
  xo.imageSmoothingEnabled = true; xo.imageSmoothingQuality = 'high';
  const body = canvas(fw, fh), xb = body.getContext('2d');
  xb.imageSmoothingEnabled = true; xb.imageSmoothingQuality = 'high';
  xb.drawImage(c0, minX, minY, cw, ch, 0, 0, fw, fh);
  const sil = canvas(fw, fh), xs = sil.getContext('2d');      // silhouette in the outline colour
  xs.drawImage(body, 0, 0); xs.globalCompositeOperation = 'source-in'; xs.fillStyle = INK; xs.fillRect(0, 0, fw, fh);
  for (let a = 0; a < 32; a++) {
    const t = a / 32 * Math.PI * 2;
    xo.drawImage(sil, ol + Math.cos(t) * ol, ol + Math.sin(t) * ol);
  }
  xo.drawImage(sil, ol, ol);
  xo.drawImage(body, ol, ol);
  return { canvas: out, w: (fw + 2 * ol) / px, h: (fh + 2 * ol) / px };
}

// background = what touches the picture's border and looks like it (flood fill, colour distance to the local seed)
function removeBackground(p, W, H) {
  // already transparent around the edges (PNG cut-out): keep it
  let clear = 0, n = 0;
  const edge = (x, y) => { n++; if (p[(y * W + x) * 4 + 3] < 200) clear++; };
  for (let x = 0; x < W; x++) { edge(x, 0); edge(x, H - 1); }
  for (let y = 0; y < H; y++) { edge(0, y); edge(W - 1, y); }
  if (clear > n * 0.3) return;
  const T1 = 42, T2 = 78;                                     // fully / partly background (colour distance)
  const seen = new Uint8Array(W * H);
  const sx = new Int32Array(W * H);                          // the reference pixel each pixel is compared with
  const q = new Int32Array(W * H);
  let qh = 0, qt = 0;
  const push = (i, s) => { seen[i] = 1; q[qt++] = i; sx[i] = s; };
  for (let x = 0; x < W; x++) { push(x, x); const b = (H - 1) * W + x; if (!seen[b]) push(b, b); }
  for (let y = 0; y < H; y++) { const l = y * W; if (!seen[l]) push(l, l); const r = l + W - 1; if (!seen[r]) push(r, r); }
  const dist = (i, j) => Math.hypot(p[i * 4] - p[j * 4], p[i * 4 + 1] - p[j * 4 + 1], p[i * 4 + 2] - p[j * 4 + 2]);
  const alpha = new Float32Array(W * H).fill(1);
  while (qh < qt) {
    const i = q[qh++], s = sx[i];
    const dd = dist(i, s);
    if (dd >= T2) continue;                                   // the subject starts here
    alpha[i] = dd <= T1 ? 0 : (dd - T1) / (T2 - T1);
    if (alpha[i] > 0.5) continue;                             // soft edge: do not go further in
    const x = i % W, y = (i / W) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) {
      if (j < 0 || seen[j]) continue;
      // follow slow colour changes (gradients, shadows): the reference moves along while the steps stay small
      push(j, dist(j, i) < 10 && dd < 20 ? i : s);
    }
  }
  for (let i = 0; i < W * H; i++) if (alpha[i] < 1) p[i * 4 + 3] = Math.round(p[i * 4 + 3] * alpha[i]);
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

// ------------------------------------------------------------------ drawing (feet at 0, 0; see chars.js poses)
function drawCustom(ctx, p) {
  const c = custom;
  if (!c.img) return;
  const shoeH = 5, w = c.w, h = c.h;
  const walk = p.kind === 'walk' ? p.ph * Math.PI * 2 : 0;
  const bob = p.kind === 'walk' ? -Math.abs(Math.sin(walk)) * 3 : 0;
  ctx.save();
  if (p.kind === 'spin') { ctx.translate(0, -(h + shoeH) / 2); ctx.rotate(p.ang); ctx.translate(0, (h + shoeH) / 2); }
  if (p.kind === 'edge') ctx.rotate(Math.sin(p.t / 4) * 0.13 * (p.face || 1));
  if (p.kind === 'scared') ctx.translate(Math.sin(p.t * 2.3) * 1.2, 0);
  // shoes (in front of / behind each other while walking)
  const shoe = (dx, lift) => {
    ctx.save(); ctx.translate(dx, -lift);
    ctx.fillStyle = '#c4161c'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.face < 0 ? -2 : 2, -2.6, 6.2, 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(p.face < 0 ? -4 : 0, -4, 2.2, 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const air = p.kind === 'air' || p.kind === 'spin';
  shoe(-6 + (p.kind === 'walk' ? Math.sin(walk) * 4 : 0), air ? 3 : p.kind === 'walk' ? Math.max(0, Math.sin(walk)) * 3 : 0);
  shoe(6 - (p.kind === 'walk' ? Math.sin(walk) * 4 : 0), air ? 1 : p.kind === 'walk' ? Math.max(0, -Math.sin(walk)) * 3 : 0);
  // the picture: squash & stretch, a little tilt while walking, turns with the direction of travel
  let sx = 1, sy = 1;
  if (p.kind === 'air') { const v = Math.max(-1, Math.min(1, -p.vy / 14)); sy = 1 + 0.08 * v; sx = 1 - 0.06 * v; }
  if (p.kind === 'blink') { sy = 0.97; sx = 1.02; }
  ctx.translate(0, -shoeH + 1 + bob);
  if (p.kind === 'walk') ctx.rotate(Math.sin(walk) * 0.06);
  if (p.kind === 'look') ctx.rotate(Math.sin(p.t / 9) * 0.05);
  ctx.scale((p.face < 0 ? -1 : 1) * sx, sy);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c.img, -w / 2, -h, w, h);
  ctx.restore();
}
