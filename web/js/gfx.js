// Drawing layer. The game thinks in the original 640x480 pixels; this module maps that onto the
// real canvas at the screen's native resolution (up to 8K) and draws the 6x xBRZ "HD" bitmaps,
// or the original pixels with nearest-neighbour scaling in "classic" mode.
import { visual } from './bidi.js';

export const W = 640, H = 480;

const imgs = { '1x': {}, hd: {} };
let meta = null;
let ctx = null, canvas = null;
let scale = 1, offX = 0, offY = 0;      // logical px -> device px
let margin = 0;                          // logical px visible left/right of the 640 picture (full-screen touch mode)
let mode = 'hd';                         // 'hd' | 'classic'

export function setAssets(m, images) { meta = m; Object.assign(imgs['1x'], images['1x']); Object.assign(imgs.hd, images.hd); }
export function setMode(m) { mode = m; }
export function getMode() { return mode; }
export function size(name) { return meta.img[name]; }

export function attach(c) { canvas = c; ctx = c.getContext('2d', { alpha: false }); }

// game rectangle in CSS px -> device transform
export function layout(rect, dpr) {
  scale = rect.w * dpr / W;
  offX = rect.x * dpr; offY = rect.y * dpr;
  margin = offX > 0 ? offX / scale : 0;
}
export const getMargin = () => margin;

export function begin() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offX, offY);
  ctx.imageSmoothingEnabled = mode === 'hd';
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.beginPath(); ctx.rect(-margin, 0, W + 2 * margin, H); ctx.clip();
}
export function end() { ctx.restore(); }

// snap a logical coordinate to the device pixel grid (crisp edges, smooth sub-pixel motion)
const snap = v => Math.round(v * scale) / scale;

function src(name) {
  return mode === 'hd' ? imgs.hd[name] || imgs['1x'][name] : imgs['1x'][name];
}

export function img(name, x, y, o) {
  const s = meta.img[name];
  if (!s) return;
  const im = src(name);
  if (!im) return;
  let [w, h] = s;
  if (o && o.w) { w = o.w; h = o.h; }
  if (!o) {                                // snap both edges: tiles meet without hairline seams
    const x0 = snap(x), y0 = snap(y);
    ctx.drawImage(im, x0, y0, snap(x + w) - x0, snap(y + h) - y0);
    return;
  }
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.rot || o.flip || o.scale) {
    const cx = o.cx !== undefined ? o.cx : x + w / 2, cy = o.cy !== undefined ? o.cy : y + h / 2;
    ctx.translate(snap(cx), snap(cy));
    if (o.rot) ctx.rotate(o.rot);
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(im, x - cx, y - cy, w, h);
  } else {
    ctx.drawImage(im, snap(x), snap(y), w, h);
  }
  ctx.restore();
}

// part of a bitmap (sx, sy, sw, sh in original pixels)
export function part(name, sx, sy, sw, sh, x, y) {
  const im = src(name);
  if (!im || sw <= 0 || sh <= 0) return;
  const k = im === imgs.hd[name] ? meta.hd : 1;
  const x0 = snap(x), y0 = snap(y);
  ctx.drawImage(im, sx * k, sy * k, sw * k, sh * k, x0, y0, snap(x + sw) - x0, snap(y + sh) - y0);
}

export function rect(x, y, w, h, color, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.restore();
}

// ---------------------------------------------------------------- bitmap fonts (the game's own)
// str is logical (Hebrew reading order); it is laid out in visual order like the patched exe does.
export function textWidth(font, str, logical = true) {
  const f = meta.font[font];
  const s = logical ? visual(String(str)) : String(str);
  let w = 0;
  for (const ch of s) { const g = f.g[ch.codePointAt(0)] || f.g[32]; w += g[2]; }
  return w;
}

export function text(font, str, x, y, align = 'left', o = {}) {
  const f = meta.font[font];
  if (!f) return 0;
  const s = o.visual ? String(str) : visual(String(str));
  const w = textWidth(font, s, false);
  if (align === 'center') x -= w / 2; else if (align === 'right') x -= w;
  const im = src(font);
  const k = im === imgs.hd[font] ? meta.hd : 1;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  let cx = snap(x); const cy = snap(y);
  for (const ch of s) {
    const g = f.g[ch.codePointAt(0)] || f.g[32];
    const [gx, gy, gw, gh] = g;
    if (ch !== ' ') ctx.drawImage(im, gx * k, gy * k, gw * k, gh * k, cx, cy, gw, gh);
    cx += gw;
  }
  ctx.restore();
  return w;
}

// FONT3 with the black outline the game uses (4 black copies around a white one)
export function smallText(str, x, y, align = 'left') {
  for (const [dx, dy] of [[1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) text('FONT3_k', str, x + dx, y + dy, align);
  text('FONT3_w', str, x, y, align);
}

export function fontHeight(font) { return meta.font[font].h; }
export function context() { return ctx; }
