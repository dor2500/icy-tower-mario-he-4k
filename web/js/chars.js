// Playable characters. Mario's family = the Mario sprites recoloured at load time (Mario's palette from
// tools/make_mario.py -> new colours, shading kept); the guests from other games are drawn as vectors in the
// game's cartoon style, so they stay sharp at any resolution (4K / 8K) like the HD sprites.
//   draw(ctx, pose): pose = { kind: stand|blink|look|walk|air|spin|edge|scared, ph (walk 0..1), face (1 / -1),
//                             t (ticks), vy, ang (spin, radians) }, drawn with the feet at (0, 0)
import * as G from './gfx.js';

const INK = '#120818';
// Mario's palette (tools/make_mario.py): key -> rgb
const PAL = { K: [20, 10, 10], R: [230, 20, 30], r: [165, 10, 20], B: [40, 80, 220], S: [255, 196, 150], s: [225, 145, 105],
  H: [90, 45, 10], W: [255, 255, 255], Y: [255, 220, 0], N: [125, 65, 20] };
const PK = Object.keys(PAL);
const SPRITES = ['MARIO_IDLE1', 'MARIO_IDLE2', 'MARIO_IDLE3', 'MARIO_WALK1', 'MARIO_WALK2', 'MARIO_WALK3', 'MARIO_WALK4',
  'MARIO_JUMP', 'MARIO_JUMP1', 'MARIO_JUMP2', 'MARIO_JUMP3', 'MARIO_CHOCK', 'MARIO_ROTATE', 'MARIO_EDGE1', 'MARIO_EDGE2'];
const FACES = ['HEROFACE000', 'HEROFACE001', 'HEROFACE002'];

export const CHARS = [
  { id: 'mario', name: 'מריו', game: 'סופר מריו', desc: 'הגיבור המקורי' },
  { id: 'luigi', name: "לואיג'י", game: 'סופר מריו', desc: 'האח של מריו, בירוק', map: { R: [40, 175, 55], r: [20, 120, 35], B: [30, 45, 160] } },
  { id: 'fire', name: 'מריו האש', game: 'סופר מריו', desc: 'אחרי שאכל פרח אש', map: { R: [248, 248, 244], r: [205, 205, 216], B: [228, 28, 34] } },
  { id: 'wario', name: 'וואריו', game: 'סופר מריו', desc: 'היריב החמדן', map: { R: [252, 212, 24], r: [205, 160, 0], B: [124, 40, 168], Y: [60, 185, 70] } },
  { id: 'waluigi', name: "וואלואיג'י", game: 'סופר מריו', desc: 'היריב הגבוה והסגול', map: { R: [112, 42, 176], r: [76, 22, 124], B: [36, 36, 72] } },
  { id: 'steve', name: 'סטיב', game: 'מיינקראפט', desc: 'הכורה המרובע', draw: drawSteve },
  { id: 'creeper', name: 'קריפר', game: 'מיינקראפט', desc: 'ססססס... בום!', draw: drawCreeper },
  { id: 'goat', name: 'העז', game: 'גוט סימולטור', desc: 'עם הלשון בחוץ', draw: drawGoat },
  { id: 'crew', name: 'החללי', game: 'אמונג אס', desc: 'אולי הוא המתחזה?', draw: drawCrew },
  { id: 'pacman', name: 'פקמן', game: 'פקמן', desc: 'ווקה ווקה ווקה!', draw: drawPacman },
];

let cur = CHARS[0];
export const getChar = () => cur;
export function setChar(id) { cur = CHARS.find(c => c.id === id) || CHARS[0]; return cur; }

// ---------------------------------------------------------------- recoloured Mario sprites
function recolor(map) {
  const src = PK.map(k => PAL[k]), dst = PK.map(k => map[k] || null);
  const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] + 1;
  return d => {
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      let best = 0, bd = 1e9;
      for (let k = 0; k < src.length; k++) {
        const c = src[k], e = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
        if (e < bd) { bd = e; best = k; }
      }
      const t = dst[best];
      if (!t) continue;
      const f = lum([r, g, b]) / lum(src[best]);           // keep the shading / the blend into the outline
      d[i] = Math.min(255, t[0] * f); d[i + 1] = Math.min(255, t[1] * f); d[i + 2] = Math.min(255, t[2] * f);
    }
  };
}
function ensure(c, names) {
  if (!c.map) return;
  c.done = c.done || {};
  for (const set of ['1x', 'hd']) {
    for (const n of names) {
      const key = set + n;
      if (c.done[key] || !G.loaded(set, n)) continue;
      G.derive(set, n, n + '~' + c.id, c.fn || (c.fn = recolor(c.map)));
      c.done[key] = true;
    }
  }
}
// the sprite name for a character (Mario: unchanged)
export function sprite(c, name) {
  if (!c.map) return name;
  ensure(c, [name]);
  return name + '~' + c.id;
}
// prepare a character's sprites ahead (on selection), so the first frames do not stutter
export function prepare(c) { ensure(c, SPRITES); }

// ---------------------------------------------------------------- drawing the player
// name/flip = Game.frameName; x = the sprite's centre; py = the feet (Game's player y)
export function drawHero(c, name, flip, x, py, o) {
  if (!c.draw) {
    const n = sprite(c, name);
    const [w, h] = G.size(name);
    if (name === 'MARIO_ROTATE') G.img(n, x - w / 2, py - 26 - h / 2, { rot: o.ang, cx: x, cy: py - 26 });
    else G.img(n, x - w / 2, py - h + 2, flip ? { flip: true } : undefined);
    return;
  }
  const ctx = G.context();
  ctx.save();
  ctx.translate(x, py + 2);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  c.draw(ctx, poseOf(name, flip, o));
  ctx.restore();
}
function poseOf(name, flip, o) {
  const k = name.slice(6);
  const pose = { face: o.face || 1, t: o.t || 0, vy: o.vy || 0, ang: o.ang || 0, ph: 0, kind: 'stand' };
  if (k === 'ROTATE') pose.kind = 'spin';
  else if (k.startsWith('JUMP')) pose.kind = 'air';
  else if (k.startsWith('WALK')) { pose.kind = 'walk'; pose.ph = (o.walk || 0) / 56 % 1; }
  else if (k.startsWith('EDGE')) { pose.kind = 'edge'; pose.face = flip ? -1 : 1; }
  else if (k === 'CHOCK') pose.kind = 'scared';
  else if (k === 'IDLE2') pose.kind = 'blink';
  else if (k === 'IDLE3') pose.kind = 'look';
  return pose;
}
// spin (cartwheel) = rotate the whole figure around its middle
function spin(ctx, p, h) { if (p.kind === 'spin') { ctx.translate(0, -h / 2); ctx.rotate(p.ang); ctx.translate(0, h / 2); } }

// menu portrait (in place of Mario's face on the title screen): 206x265 box at (x, y)
export function drawPortrait(c, t, x, y) {
  if (!c.draw) {
    const cc = t % 260;
    const face = cc > 120 && cc < 128 ? 'HEROFACE001' : cc > 200 && cc < 240 ? 'HEROFACE002' : 'HEROFACE000';
    if (c.map) ensure(c, FACES);
    G.img(c.map ? face + '~' + c.id : face, face === 'HEROFACE000' ? x : x - 1, y);
    return;
  }
  const ctx = G.context();
  ctx.save();
  ctx.translate(x + 103, y + 252);
  ctx.scale(4.3, 4.3);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const cc = t % 260;
  c.draw(ctx, { kind: cc > 120 && cc < 128 ? 'blink' : cc > 200 && cc < 240 ? 'look' : 'stand', face: 1, t, ph: 0, vy: 0, ang: 0 });
  ctx.restore();
}
// a character in a box (character select): walking in place when selected
export function drawCard(c, t, x, feet, sc, active) {
  const ctx = G.context();
  ctx.save();
  ctx.translate(x, feet); ctx.scale(sc, sc);
  if (!c.draw) {
    const name = active ? 'MARIO_WALK' + (1 + Math.floor(t / 6) % 4) : (t % 180 > 150 ? 'MARIO_IDLE3' : 'MARIO_IDLE1');
    const n = sprite(c, name);
    const [w, h] = G.size(name);
    G.img(n, -w / 2, -h + 2, active ? { flip: true, cx: 0, cy: -h / 2 } : undefined);
  } else {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    c.draw(ctx, active ? { kind: 'walk', ph: (t / 24) % 1, face: -1, t, vy: 0, ang: 0 } : { kind: t % 180 > 150 ? 'look' : 'stand', face: -1, t, ph: 0, vy: 0, ang: 0 });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- pixel helpers (Minecraft characters)
// grid: rows of characters, pal: char -> colour ('.' = empty); drawn s px per cell at (x, y)
function pix(ctx, grid, pal, x, y, s) {
  const byCol = {};
  grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== '.') (byCol[k] = byCol[k] || []).push(i, j); } });
  for (const k in byCol) {
    const a = byCol[k];
    ctx.fillStyle = pal[k];
    ctx.beginPath();
    for (let n = 0; n < a.length; n += 2) ctx.rect(x + a[n] * s - 0.02, y + a[n + 1] * s - 0.02, s + 0.04, s + 0.04);
    ctx.fill();
  }
}
// a block part with the game's dark outline, rotated around (px, py) (shoulder / hip)
function part(ctx, x, y, w, h, fill, rot, px, py) {
  ctx.save();
  if (rot) { ctx.translate(px, py); ctx.rotate(rot); ctx.translate(-px, -py); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.strokeRect(x, y, w, h);
  if (typeof fill === 'function') fill(x, y, w, h); else { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  ctx.restore();
}
const swing = p => p.kind === 'walk' ? Math.sin(p.ph * Math.PI * 2) * 0.75 : p.kind === 'air' ? 0.55 : 0;

// ---------------------------------------------------------------- Steve (Minecraft)
const STEVE = { H: '#3b2613', h: '#4a3220', S: '#c4936e', s: '#a87a5a', W: '#ffffff', E: '#4b3f9e', N: '#8a5638', M: '#6a3b28' };
const STEVE_FRONT = ['HHHHHHHH', 'HHHHHHHH', 'HSSSSSSH', 'SSSSSSSS', 'SWESSEWS', 'SSSNNSSS', 'SSMSSMSS', 'SSMMMMSS'];
const STEVE_BLINK = ['HHHHHHHH', 'HHHHHHHH', 'HSSSSSSH', 'SSSSSSSS', 'SssSSssS', 'SSSNNSSS', 'SSMSSMSS', 'SSMMMMSS'];
const STEVE_SIDE = ['HHHHHHHH', 'HHHHHHHH', 'HHHHHSSS', 'HHHSSSSS', 'HHSSSWES', 'hHSSSSSN', 'hSSSSSSS', 'hSSSSSMM'];
function drawSteve(ctx, p) {
  const u = 1.625, side = p.kind === 'walk' || (p.kind === 'air' && Math.abs(p.vy) > 0) || p.kind === 'edge';
  spin(ctx, p, 52);
  if (p.kind === 'edge') ctx.rotate(Math.sin(p.t / 4) * 0.12 * p.face);
  const shirt = (x, y, w, h) => { ctx.fillStyle = '#16a5a5'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#108080'; ctx.fillRect(x, y + h - 2, w, 2); };
  const leg = (x, y, w, h) => { ctx.fillStyle = '#3a3ab0'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#6a6a6a'; ctx.fillRect(x, y + h - 2 * u, w, 2 * u); };
  const arm = dark => (x, y, w, h) => { ctx.fillStyle = dark ? '#118888' : '#16a5a5'; ctx.fillRect(x, y, w, 4 * u); ctx.fillStyle = dark ? '#a87a5a' : '#c4936e'; ctx.fillRect(x, y + 4 * u, w, h - 4 * u); };
  const hip = -12 * u, sh = -24 * u, a = swing(p);
  if (side) {
    ctx.scale(p.face, 1);
    const up = p.kind === 'air' ? -2.4 : 0;
    part(ctx, -2 * u, sh, 4 * u, 12 * u, arm(true), up ? up + 0.3 : -a, 0, sh + 2 * u);   // back arm
    part(ctx, -2 * u, hip, 4 * u, 12 * u, leg, a, 0, hip);
    part(ctx, -2 * u, hip, 4 * u, 12 * u, leg, -a, 0, hip);
    part(ctx, -2 * u, sh, 4 * u, 12 * u, shirt, 0);
    part(ctx, -2 * u, sh, 4 * u, 12 * u, arm(false), up || a, 0, sh + 2 * u);              // front arm
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.strokeRect(-4 * u, -32 * u, 8 * u, 8 * u);
    pix(ctx, STEVE_SIDE, STEVE, -4 * u, -32 * u, u);
    return;
  }
  const scared = p.kind === 'scared';
  part(ctx, -4 * u, hip, 4 * u, 12 * u, leg, 0);
  part(ctx, 0, hip, 4 * u, 12 * u, leg, 0);
  part(ctx, -4 * u, sh, 8 * u, 12 * u, shirt, 0);
  ctx.fillStyle = '#c4936e'; ctx.fillRect(-2 * u, sh, 4 * u, 1.2 * u);                     // neck
  const r = scared ? -2.6 : p.kind === 'air' ? -2.8 : 0;
  part(ctx, -8 * u, sh, 4 * u, 12 * u, arm(false), r ? -r : 0, -6 * u, sh + 2 * u);
  part(ctx, 4 * u, sh, 4 * u, 12 * u, arm(false), r ? r : 0, 6 * u, sh + 2 * u);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.strokeRect(-4 * u, -32 * u, 8 * u, 8 * u);
  const face = p.kind === 'blink' ? STEVE_BLINK : STEVE_FRONT;
  ctx.save();
  if (p.kind === 'look') ctx.translate(Math.sin(p.t / 9) > 0 ? u * 0.6 : -u * 0.6, 0);
  pix(ctx, face, STEVE, -4 * u, -32 * u, u);
  ctx.restore();
  if (scared) { ctx.fillStyle = INK; ctx.fillRect(-1 * u, -26 * u, 2 * u, 1.4 * u); }
}

// ---------------------------------------------------------------- Creeper (Minecraft)
const CREEP_FACE = ['........', '........', '.KK..KK.', '.KK..KK.', '...KK...', '..KKKK..', '..KKKK..', '..K..K..'];
function creeperSkin(ctx, x, y, w, h, s, seed) {
  const cols = ['#5dbb4a', '#4aa83a', '#7fd36a', '#3c8f30', '#9be08a'];
  for (let j = 0; j < Math.round(h / s); j++) for (let i = 0; i < Math.round(w / s); i++) {
    ctx.fillStyle = cols[((i * 7 + j * 13 + seed * 5) ^ (i * j)) % 5];
    ctx.fillRect(x + i * s - 0.02, y + j * s - 0.02, s + 0.04, s + 0.04);
  }
}
function drawCreeper(ctx, p) {
  const u = 2;
  spin(ctx, p, 52);
  if (p.kind === 'edge') ctx.rotate(Math.sin(p.t / 4) * 0.12 * p.face);
  const step = p.kind === 'walk' ? Math.sin(p.ph * Math.PI * 2) * 2.2 : 0;
  const hang = p.kind === 'air' ? 2 : 0;
  // back legs (darker), then the front legs: the pairs move in turn
  ctx.save();
  for (const [x, dy, dark] of [[-4 * u, -step + hang, 1], [0, step + hang, 1], [-4 * u, step, 0], [0, -step, 0]]) {
    const y = -6 * u + Math.min(0, dy) + (dark ? -1.2 : 0);
    part(ctx, x + (dark ? 1 : 0), y, 4 * u, 6 * u, (xx, yy, w, h) => { creeperSkin(ctx, xx, yy, w, h, u, dark + 3); if (dark) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(xx, yy, w, h); } }, 0);
  }
  ctx.restore();
  // about to explode (Mario "scared" pose): it swells and flashes white
  const boom = p.kind === 'scared' ? (Math.sin(p.t / 2.5) > 0 ? 1 : 0) : 0;
  ctx.save();
  if (p.kind === 'scared') { const k = 1 + 0.06 * Math.abs(Math.sin(p.t / 5)); ctx.translate(0, -6 * u); ctx.scale(k, k); ctx.translate(0, 6 * u); }
  part(ctx, -4 * u, -18 * u, 8 * u, 12 * u, (x, y, w, h) => creeperSkin(ctx, x, y, w, h, u, 1), 0);
  const look = p.kind === 'look' ? (Math.sin(p.t / 9) > 0 ? 0.7 : -0.7) : (p.kind === 'walk' ? p.face * 0.7 : 0);
  ctx.translate(look, 0);
  part(ctx, -4 * u, -26 * u, 8 * u, 8 * u, (x, y, w, h) => creeperSkin(ctx, x, y, w, h, u, 2), 0);
  pix(ctx, p.kind === 'blink' ? CREEP_FACE.map((r, j) => j === 2 ? '.KK..KK.' : j === 3 ? '........' : r) : CREEP_FACE, { K: '#0d0d0d' }, -4 * u, -26 * u, u);
  if (boom) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-4 * u, -26 * u, 8 * u, 20 * u); }
  ctx.restore();
}

// ---------------------------------------------------------------- the goat (Goat Simulator)
function drawGoat(ctx, p) {
  spin(ctx, p, 40);
  ctx.scale(p.face, 1);
  if (p.kind === 'edge') ctx.rotate(Math.sin(p.t / 4) * 0.15);
  const W = '#ece6da', Wd = '#c9c0b0', Hn = '#8b7f6c';
  const a = p.kind === 'walk' ? Math.sin(p.ph * Math.PI * 2) * 0.5 : p.kind === 'air' ? 0.6 : 0;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  const leg = (x, r, dark) => {
    ctx.save(); ctx.translate(x, -16); ctx.rotate(r);
    ctx.fillStyle = dark ? Wd : W; ctx.beginPath(); ctx.roundRect(-2.6, 0, 5.2, 16, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2c22'; ctx.fillRect(-2.6, 12.5, 5.2, 3.5);
    ctx.restore();
  };
  leg(-11, -a, 1); leg(9, a, 1);
  // tail
  ctx.fillStyle = W; ctx.beginPath(); ctx.ellipse(-19, -27, 3.5, 2.5, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // body
  ctx.fillStyle = W; ctx.beginPath(); ctx.ellipse(-1, -23, 18.5, 9.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(150,135,115,.35)'; ctx.beginPath(); ctx.ellipse(-1, -19, 15, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  leg(-8, a, 0); leg(12, -a, 0);
  // neck + head
  const bob = p.kind === 'walk' ? Math.sin(p.ph * Math.PI * 4) * 1 : 0;
  const hy = -38 + bob + (p.kind === 'look' ? Math.sin(p.t / 9) * 1.5 : 0);
  ctx.fillStyle = W; ctx.beginPath(); ctx.moveTo(8, -28); ctx.lineTo(16, hy + 3); ctx.lineTo(22, hy + 6); ctx.lineTo(16, -24); ctx.closePath(); ctx.fill();
  // horns (curved back)
  ctx.strokeStyle = INK; ctx.lineWidth = 4.6;
  const horn = dx => { ctx.beginPath(); ctx.moveTo(16 + dx, hy - 3); ctx.quadraticCurveTo(10 + dx, hy - 14, 3 + dx, hy - 9); ctx.stroke(); };
  horn(0); ctx.strokeStyle = Hn; ctx.lineWidth = 2.4; horn(0);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.fillStyle = W; ctx.beginPath(); ctx.ellipse(20, hy, 7.5, 6, 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(26.5, hy + 3.5, 4.2, 3.6, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();      // snout
  // ear
  ctx.fillStyle = Wd; ctx.beginPath(); ctx.ellipse(13.5, hy - 1, 4.5, 2, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // beard
  ctx.fillStyle = Wd; ctx.beginPath(); ctx.moveTo(22, hy + 6); ctx.lineTo(24, hy + 13); ctx.lineTo(26, hy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // the famous tongue: always out, flapping
  const tw = Math.sin(p.t / 3) * 2.5 + (p.kind === 'air' || p.kind === 'spin' ? -4 : 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(28, hy + 5); ctx.quadraticCurveTo(32, hy + 9, 30 + tw, hy + 15); ctx.stroke();
  ctx.strokeStyle = '#ff7aa8'; ctx.lineWidth = 2.4; ctx.stroke();
  // eye
  const big = p.kind === 'scared' ? 1.6 : 1;
  if (p.kind === 'blink') { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(19, hy - 1); ctx.lineTo(23, hy - 1); ctx.stroke(); }
  else {
    ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.ellipse(21, hy - 1, 2.6 * big, 2.2 * big, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(20.2, hy - 1.6, 2 * big, 1.2 * big);              // goat pupil (sideways)
  }
}

// ---------------------------------------------------------------- the crewmate (Among Us)
function drawCrew(ctx, p) {
  spin(ctx, p, 46);
  ctx.scale(p.face, 1);
  if (p.kind === 'edge') ctx.rotate(Math.sin(p.t / 4) * 0.14);
  const C = '#d6262c', Cd = '#7d0f30';
  const st = p.kind === 'walk' ? Math.sin(p.ph * Math.PI * 2) * 4 : 0;
  const lift = p.kind === 'air' ? 3 : 0;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  // legs
  ctx.fillStyle = Cd; ctx.beginPath(); ctx.roundRect(-11 + st * 0.6, -12 - Math.max(0, st) - lift, 9, 12, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C; ctx.beginPath(); ctx.roundRect(0 - st * 0.6, -12 - Math.max(0, -st) - lift, 10, 12, 3); ctx.fill(); ctx.stroke();
  // backpack
  ctx.fillStyle = Cd; ctx.beginPath(); ctx.roundRect(-17, -34, 7, 18, 3); ctx.fill(); ctx.stroke();
  // body
  ctx.fillStyle = C; ctx.beginPath(); ctx.roundRect(-12, -46, 23, 38, [11, 11, 4, 4]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.roundRect(-12, -18, 23, 7, 3); ctx.fill();
  // visor
  const big = p.kind === 'scared' ? 1.25 : 1, look = p.kind === 'look' ? Math.sin(p.t / 9) * 1.5 : 0;
  ctx.fillStyle = '#8fc6dd'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.roundRect(-1 + look, -40, 16 * big, p.kind === 'blink' ? 6 : 10 * big, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.roundRect(4 + look, -38.5, 7, 3, 1.5); ctx.fill();
}

// ---------------------------------------------------------------- Pac-Man
function drawPacman(ctx, p) {
  spin(ctx, p, 38);
  ctx.scale(p.face, 1);
  if (p.kind === 'edge') ctx.rotate(Math.sin(p.t / 4) * 0.14);
  const r = 18, cy = -r - 1 + (p.kind === 'walk' ? -Math.abs(Math.sin(p.ph * Math.PI * 2)) * 2 : 0);
  const open = p.kind === 'scared' ? 0.05 : p.kind === 'blink' ? 0.35 : 0.08 + 0.55 * Math.abs(Math.sin(p.t / 4));
  ctx.save(); ctx.translate(0, cy); if (p.kind === 'air') ctx.rotate(p.vy < 0 ? -0.5 : 0.4);
  ctx.fillStyle = '#ffd800'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, open, Math.PI * 2 - open); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-6, -9, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(3, -10, p.kind === 'scared' ? 3.4 : 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
