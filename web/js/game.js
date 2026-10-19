// Icy Tower 1.3.1 gameplay, ported from the original icytower13.exe (disassembled), so it plays the same:
//  - 50 logic ticks per second, screen coordinates 640x480, player x = centre, y = feet
//  - run: +-0.3 per tick (x0.7 when turning), x0.9 when no key; |vx| <= 12; walls at x = 85 / 555 bounce x-0.9
//  - jump: vy = -max(12, 2*|vx|), gravity 0.8 per tick, fall speed <= 12; vy < -22 -> cartwheel
//  - floors every 80 px (rows of 16 px); floor width 6..14 tiles, narrowing with height; full floor every 50
//  - scrolling starts when the screen has moved 100 px; speed 0.5, 1, 2, 3, 4, 5 px per tick, +1 step every 30 s
//  - extra scroll when the player is near the top (y < 160 ... < 0: +1 ... +13 px per tick)
//  - combo: a jump of 2+ floors starts / extends it (100-tick timer); 1-floor jump or a drop ends it;
//    with 2+ jumps it scores floors^2 and shows a reward ("good" ... "no way")
import * as G from './gfx.js';
import * as S from './sound.js';
import { drawHero, getChar } from './chars.js';

export const TOP = 432;                                  // screen y of row 0 (floor 0) when scroll = 0
export const SPEED_STEP = 1500;                           // ticks between speed-ups (30 s)
const FLOOR_SETS = [['FLOOR01', 'FLOOR02', 'FLOOR03'], ['FLOOR04', 'FLOOR05', 'FLOOR06'], ['FLOOR07', 'FLOOR08', 'FLOOR09'],
  ['FLOOR10', 'FLOOR11', 'FLOOR12'], ['FLOOR12a', 'FLOOR12b', 'FLOOR12c'], ['FLOOR13', 'FLOOR14', 'FLOOR15'],
  ['FLOOR16', 'FLOOR17', 'FLOOR18'], ['FLOOR18a', 'FLOOR18b', 'FLOOR18c'], ['FLOOR19', 'FLOOR20', 'FLOOR21'],
  ['FLOOR22', 'FLOOR23', 'FLOOR24'], ['FLOOR25', 'FLOOR26', 'FLOOR27']];
const SIGNS = ['SIGN01', 'SIGN02', 'SIGN03', 'SIGN04', 'SIGN04a', 'SIGN05', 'SIGN06', 'SIGN06a', 'SIGN07', 'SIGN08', 'SIGN09'];
const REWARD_SFX = ['S_GOOD', 'S_SWEET', 'S_GREAT', 'S_SUPER', 'S_WOW', 'S_AMAZING', 'S_EXTREME', 'S_FANTASTIC', 'S_SPLENDID', 'S_UNBELIEVABLE'];

function rewardLevel(f) {
  if (f <= 6) return 0; if (f <= 14) return 1; if (f <= 24) return 2; if (f <= 34) return 3; if (f <= 49) return 4;
  if (f <= 69) return 5; if (f <= 99) return 6; if (f <= 139) return 7; if (f <= 199) return 8; return 9;
}

// ------------------------------------------------------------------ stage extras, drawn as vectors in the
// game's cartoon style (thick dark outline), so they are sharp at any resolution like the HD sprites
const INK = '#120818';

export function drawCoin(ctx, x, y, t) {                    // spinning Mario coin
  const w = 7.5 * Math.abs(Math.cos(t)) + 1.2, h = 10.5;
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -h, 0, h);
  g.addColorStop(0, '#fff6a0'); g.addColorStop(0.45, '#ffd21a'); g.addColorStop(1, '#d08a00');
  ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (w > 4) {
    ctx.strokeStyle = '#b06a00'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, h * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.ellipse(-w * 0.35, -h * 0.4, w * 0.18, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawSpring(ctx, x, y, t) {                  // red springboard; squashes when used
  const hgt = t > 6 ? 6 : t > 0 ? 18 : 13;
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 5;               // coil: outline then colour
  const coil = () => { ctx.beginPath(); for (let i = 0; i <= 4; i++) ctx.lineTo(i % 2 ? 6 : -6, -i * hgt / 4); ctx.stroke(); };
  coil(); ctx.strokeStyle = '#d9d9e8'; ctx.lineWidth = 2.4; coil();
  ctx.fillStyle = '#e8202a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-12, -hgt - 6, 24, 7, 2.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(-7, -hgt - 4.5, 4, 2); ctx.fillRect(3, -hgt - 4.5, 4, 2);
  ctx.restore();
}

export function drawFlag(ctx, x, y, down) {                 // Mario's goal flagpole; the flag slides down when reached
  const H = 168;
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H); ctx.stroke();
  ctx.strokeStyle = '#7fd06a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -H); ctx.stroke();
  ctx.fillStyle = '#2fb84a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(0, -H - 6, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const fy = -H + 10 + down * (H - 50);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-2, fy); ctx.lineTo(-44, fy + 16); ctx.lineTo(-2, fy + 32); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2fb84a'; ctx.beginPath(); ctx.arc(-17, fy + 16, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.fillRect(-11, -8, 22, 8);   // base block
  ctx.fillStyle = '#9b5a1e'; ctx.fillRect(-9, -6, 18, 5);
  ctx.restore();
}

export function drawCracks(ctx, x, top, w, seed) {           // crumbling floors show cracks
  ctx.save(); ctx.strokeStyle = 'rgba(18,8,24,.75)'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
  for (let i = 0; i < Math.max(2, w / 40); i++) {
    const cx = x + ((seed * 37 + i * 53) % Math.max(8, w - 8)) + 4;
    ctx.beginPath(); ctx.moveTo(cx, top - 4); ctx.lineTo(cx + 3, top + 2); ctx.lineTo(cx - 2, top + 7); ctx.lineTo(cx + 2, top + 12); ctx.stroke();
  }
  ctx.restore();
}

export function drawLava(ctx, v, t) {                        // Bowser's castle: glowing lava at the bottom of the screen
  const base = v.y + v.h - 26;
  ctx.save();
  const glow = ctx.createLinearGradient(0, base - 90, 0, base);
  glow.addColorStop(0, 'rgba(255,80,0,0)'); glow.addColorStop(1, 'rgba(255,80,0,.35)');
  ctx.fillStyle = glow; ctx.fillRect(v.x, base - 90, v.w, 90);
  const g = ctx.createLinearGradient(0, base - 8, 0, v.y + v.h);
  g.addColorStop(0, '#ffe14a'); g.addColorStop(0.3, '#ff7a00'); g.addColorStop(1, '#a00a00');
  ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(v.x, v.y + v.h);
  for (let x = v.x; x <= v.x + v.w + 8; x += 8) ctx.lineTo(x, base + Math.sin(x / 23 + t / 9) * 4 + Math.sin(x / 9 - t / 5) * 1.5);
  ctx.lineTo(v.x + v.w, v.y + v.h); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe873';
  for (let i = 0; i < 9; i++) {                       // bubbles
    const ph = ((t / 40 + i * 0.37) % 1);
    const bx = v.x + ((i * 151) % v.w), by = base + 10 - ph * 16;
    ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(bx, by, 2 + 3 * ph, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawFog(ctx, v, t) {                        // "extreme": purple fog drifting through the tower
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const x = 60 + ((((t * (0.35 + i * 0.12) + i * 210) % 760) + 760) % 760) - 120;
    const y = v.y + ((i * 0.23 + 0.1) % 1) * v.h;
    const g = ctx.createRadialGradient(x, y, 10, x, y, 150);
    g.addColorStop(0, 'rgba(190,150,255,0.28)'); g.addColorStop(1, 'rgba(190,150,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 160, y - 160, 320, 320);
  }
  ctx.restore();
}

function drawEmbers(ctx, v, t) {                     // "impossible": glowing embers rising from the lava
  ctx.save();
  for (let i = 0; i < 34; i++) {
    const sp = 0.6 + (i % 5) * 0.35;
    const y = v.y + v.h - ((t * sp + i * 97) % (v.h + 40));
    const x = 62 + ((i * 151) % 516) + Math.sin(t / 20 + i) * 10;
    const r = 1.2 + (i % 3) * 0.9;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 7 + i * 2);
    ctx.fillStyle = i % 3 ? '#ffb020' : '#ff4a10';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export class Game {
  constructor(opt = {}) {
    this.opt = opt;
    this.silent = !!opt.silent;
    this.hero = opt.hero || getChar();
    this.seed = (opt.seed ?? (Date.now() & 0x7fffffff)) >>> 0;
    // stage mode (stages.js); null = the classic game, exactly as the original
    this.st = opt.stage || null;
    this.stageNo = opt.stageNo || 0;
    // difficulty (stages.js DIFFS); null or "original" = the original game
    this.df = opt.diff && !opt.diff.original ? opt.diff : null;
    const df = this.df || {}, st = this.st || {};
    this.step = st.step || df.step || SPEED_STEP;
    this.maxL = df.maxL || 5;
    this.startL = Math.max(st.fastStart || 0, df.startL || 0);
    this.comboT = df.combo || 100;
    this.look = !this.st && this.df && this.df.look ? this.df.look : null;   // the level's own look
    // floor extras from the stage and/or the difficulty
    this.fx = this.st || this.df ? {
      moving: Math.max(st.moving || 0, df.moving || 0), crumble: Math.max(st.crumble || 0, df.crumble || 0),
      springs: st.springs || 0, coins: st.coins || 0, slippery: !!st.slippery, wind: !!st.wind,
    } : null;
    this.seed2 = (this.seed ^ 0x5bd1e995) >>> 0;    // separate random numbers for the stage extras
    this.crum = new Map();                         // row -> ticks Mario has stood on a crumbling floor
    this.gone = new Set();                         // crumbled rows
    this.got = new Set();                          // rows whose coin was taken
    this.springT = new Map();                      // row -> spring animation
    this.coins = 0;
    this.wind = 0;
    this.cleared = false; this.clearT = 0;
    this.debris = [];
    this.rows = [];
    this.ahead = opt.ahead || 0;                   // extra view above the 480 px (phone held upright)
    this.R = 0;                                    // rows generated
    this.S = 0;                                    // scroll (px)
    this.fillRows();
    this.p = {
      x: 200, y: 430, vx: 0.001, vy: 0, state: 0, latch: false, cart: false, ang: 0, floor: 0,
      cTimer: 0, cFloors: 0, cJumps: 0, bonus: 0, best: 0, dead: 0, edge: 0, edgeT: 0,
      face: 1, walk: 0, idleT: 0,
    };
    this.L = -1;                                   // scroll speed level (-1 = not started)
    this.timer = 0;                                // ticks since the scroll started (clock)
    this.idx = 0;                                  // next speed-up
    this.frame = 0;
    this.hurryY = 480;
    this.reward = null;                            // {lvl, t}
    this.stars = [];
    this.deadT = 0;
    this.splat = false;
    this.ended = false;
    this.prev = { x: 200, y: 430, S: 0 };
    this.snd('C_greeting');
    if (this.st) this.snd('V_GO', 0.9);            // "בוא נלך!"
  }

  rand2() { this.seed2 = (Math.imul(this.seed2, 1103515245) + 12345) >>> 0; return (this.seed2 >>> 8) & 0xffff; }
  chance(p) { return p && this.rand2() / 65536 < p; }

  // stage extras for a new normal floor (never floor 0-2, never the full floors)
  decorate(row, r) {
    const st = this.fx, f = r / 5;
    if (this.st && f === this.st.goal) { row.type = 0; row.l = 0; row.rt = 40; row.goal = true; return; }
    if (row.type !== 0 || row.rt - row.l > 30 || f < 3) return;
    if (this.chance(st.moving)) {
      const room = Math.min((row.l - 5) * 16, (34 - row.rt) * 16);
      if (room >= 24) { row.mA = Math.min(room, 40 + (this.rand2() % 40)); row.mW = 0.02 + (this.rand2() % 30) / 1000; row.mP = (this.rand2() % 628) / 100; }
    }
    if (this.chance(st.crumble)) row.crumble = true;
    if (!row.crumble && this.chance(st.springs)) row.spring = (row.l + 1 + this.rand2() % Math.max(1, row.rt - row.l - 1)) * 16 + 8;
    if (this.chance(st.coins)) row.coin = (row.l + this.rand2() % (row.rt - row.l + 1)) * 16 + 8;
  }

  // sideways offset of a moving floor at a (fractional) tick
  shift(row, t = this.frame) { return row && row.mA ? row.mA * Math.sin(t * row.mW + row.mP) : 0; }

  snd(name, vol) { if (!this.silent) S.play(name, vol); }

  // a silent copy for look-ahead (demo player)
  clone() {
    const g = Object.create(Game.prototype);
    for (const k of Object.keys(this)) g[k] = this[k];
    g.p = { ...this.p }; g.prev = { ...this.prev };
    g.rows = this.rows.slice();                    // rows are never mutated once made
    g.stars = this.stars.map(s => ({ ...s }));     // stars use rand() too: keep the sequence identical
    g.reward = this.reward && { ...this.reward }; g.silent = true;
    g.crum = new Map(this.crum); g.gone = new Set(this.gone); g.got = new Set(this.got);
    g.springT = new Map(this.springT); g.debris = [];
    return g;
  }

  // C rand(): 0..32767
  rand() { this.seed = (Math.imul(this.seed, 214013) + 2531011) >>> 0; return (this.seed >>> 16) & 0x7fff; }

  genRow() {
    const r = this.R;
    const row = { type: -1, l: 0, rt: 0, n: r + 1, sign: 0, theme: Math.min((r / 500) | 0, 10) };
    const df = this.df;
    const full = df ? (r === 0 || (df.full > 0 && r % df.full === 0))
      : (r % 250 === 0 && ((r / 5) | 0) <= 1000) || r % 2500 === 0;
    if (full) {
      row.type = 0; row.l = 0; row.rt = 40;
    } else if (r % 5 === 0) {
      const f = ((r + 1) / 5) | 0;
      let w;
      if (f > 599) {
        w = f < 1001 ? 6 : 5;
        if (f > 1500) w = 4; if (f > 2000) w = 3; if (f > 10000) w = 2;
      } else {
        w = this.rand() % Math.max(1, Math.trunc((300 - f) / 30)) + 6;
      }
      if (df) w = Math.max(df.minW || 1, Math.min(df.maxW || 28, w + (df.widen || 0)));
      row.type = 0; row.l = this.rand() % (30 - w) + 5; row.rt = row.l + w;
      if (df) {
        // harder maps: floors on alternate sides (zigzag), and some floors left out (never two in a row)
        // (6-11 tiles between the floors' centres: a long run-up jump, but always one that can be made)
        if (df.zigzag && this.lastC !== undefined) {
          const gap = 6 + this.rand2() % 6, c = this.lastC < 20 ? this.lastC + gap : this.lastC - gap;
          row.l = Math.max(5, Math.min(34 - w, Math.round(c - w / 2)));
        }
        row.rt = row.l + w;
        // a missing floor = a 2-floor jump, which needs speed: only above a wide floor, or one at a wall (bounce)
        const runUp = this.lastW >= 8 || (this.lastWall && this.lastW >= 5);
        if (df.skip && f >= 5 && !this.lastSkip && runUp && this.chance(df.skip)) { row.type = -1; this.lastSkip = true; }
        else { this.lastSkip = false; this.lastC = (row.l + row.rt) / 2; this.lastW = w + 1; this.lastWall = row.l <= 5 || row.rt >= 34; }
      }
    }
    if (r % 50 === 0) row.sign = ((r + 1) / 5) | 0;
    if (this.fx && r % 5 === 0) this.decorate(row, r);
    this.rows[r] = row;
    const keep = 72 + Math.ceil(this.ahead / 16);
    if (r > keep) this.rows[r - keep] = undefined; // keep memory flat on long games
    this.R++;
  }

  // row under screen row m: the original ring buffer (32 rows, newest 2 rows above the screen) as absolute rows
  base() { return 27 + Math.floor(this.S / 16); }
  rowIndexAt(py) { return this.base() - ((py + 1) >> 4); }

  // phone held upright: show more tower above the original 480 px (drawing only; the logic is unchanged)
  setAhead(px) { this.ahead = Math.max(0, px); this.fillRows(); }
  fillRows() { while (this.R < 30 + Math.floor(this.S / 16) + Math.ceil(this.ahead / 16)) this.genRow(); }

  // original 0x4118c0: 0 = no floor under this foot, else 10000 + distance to the row's top
  support(px, py) {
    const m = (py + 1) >> 4;
    if (29 - m < 0 || 29 - m > 31) return 0;
    const r = this.base() - m;
    const row = this.rows[r];
    if (!row || row.type !== 0 || this.gone.has(r)) return 0;
    const col = Math.floor((row.mA ? px - this.shift(row) : px) / 16);
    if (row.l > col || row.rt < col) return 0;
    return py - 16 * m - (this.S & 15) + 10000;
  }

  floorUnder(py) {
    const row = this.rows[this.rowIndexAt(py)];
    return row ? Math.trunc((row.n - 1) / 5) : 0;
  }

  jump(p) {
    if (p.state !== 0) return false;
    p.state = 1;
    const v = 2 * Math.abs(p.vx);
    p.vy = v <= 12 ? -12 : -v;
    p.cart = p.vy < -22;
    p.ang = 0;
    this.snd(p.vy < -22 ? 'C_jumphi' : p.vy <= -15 ? 'C_jumpmed' : 'C_jumplo');
    return true;
  }

  input(p, inp) {
    if (this.fx && this.fx.slippery && p.state === 0) {   // stage "ice": slow to speed up, slow to stop
      if (inp.left) { if (p.vx > 0) p.vx *= 0.93; p.vx -= 0.2; }
      else if (inp.right) { if (p.vx < 0) p.vx *= 0.93; p.vx += 0.2; }
      else p.vx *= 0.985;
    } else if (inp.left) { if (p.vx > 0) p.vx *= 0.7; p.vx -= 0.3; }
    else if (inp.right) { if (p.vx < 0) p.vx *= 0.7; p.vx += 0.3; }
    else p.vx *= 0.9;
    if (this.wind && !p.dead) p.vx += this.wind;          // stage "wind"
    if (inp.jump) {
      if (this.opt.rejump) this.jump(p);
      else if (!p.latch) { p.latch = true; this.jump(p); }
    } else p.latch = false;
  }

  move(p) {
    p.vy = Math.max(-100, Math.min(12, p.vy));
    p.vx = Math.max(-12, Math.min(12, p.vx));
    p.x += p.vx;
    p.y = Math.min(1000, p.y + p.vy);
    if (p.x > 555) { p.x = 555; p.vx *= -0.9; }
    if (p.x < 85) { p.x = 85; p.vx *= -0.9; }
    if (p.state !== 0) {
      p.vy += 0.8;
      if (p.state === 1 && p.vy > 0) p.state = 2;
    }
  }

  collide(p) {
    const xi = Math.trunc(p.x), yi = Math.trunc(p.y);
    const a = this.support(xi - 11, yi), b = this.support(xi + 11, yi);
    if (!a && !b) {
      if (p.state === 2 || p.state === 0) p.state = 3;
      return;
    }
    if (p.state === 1 || p.state === 2) return;   // going up, or the apex inside a floor: pass through
    if (p.state === 3) this.snd('S_STEP', 0.7);
    p.state = 0; p.vy = 0;
    p.y -= (a || b) - 9999;
    p.cart = false;
    p.edge = a === b ? 0 : (a === 0 ? 2 : 1);
  }

  addStar(x, y, vx, vy) {
    if (this.stars.length >= 512) return;
    this.stars.push({ x, y, vx, vy, life: 255, t: this.rand() % 8 });
  }

  doReward(floors) {
    const lvl = rewardLevel(floors);
    this.reward = { lvl, t: 0 };
    this.snd(REWARD_SFX[lvl]);
    if (lvl >= 7) this.snd('S_CHEER', 0.8);
    if (lvl > 2) {
      for (let i = 0; i < lvl * 16 - 32; i++) {
        this.addStar(320, 360, ((this.rand() % 1000) - 500) / 100 * (lvl - 2) / 4, -((this.rand() % 500) + 500) / 100);
      }
    }
  }

  tick(inp) {
    const p = this.p;
    this.prev.x = p.x; this.prev.y = p.y; this.prev.S = this.S;
    if (this.cleared) {                                   // stage done: the world stops, Mario celebrates
      this.clearT++;
      for (const s of this.stars) { s.x += s.vx; s.y += s.vy; s.life--; s.vy += 0.3; }
      this.stars = this.stars.filter(s => s.life > 0 && s.y < 520);
      if (this.clearT % 12 === 1 && this.clearT < 90) for (let i = 0; i < 10; i++)
        this.addStar(p.x, p.y - 30, ((this.rand2() % 1000) - 500) / 80, -((this.rand2() % 500) + 300) / 60);
      if (this.clearT > 170) this.ended = true;
      return;
    }
    this.frame++;
    this.timer++;
    if (!p.dead) this.input(p, inp); else this.input(p, {});
    this.move(p);
    if (p.cart && p.cTimer) this.addStar(p.x, p.y - 16, ((this.rand() % 50) - 25) / 5, ((this.rand() % 50) - 25) / 25);
    for (const s of this.stars) {
      s.x += s.vx; s.y += s.vy; s.life--; s.vy += 0.3;
      if (this.rand() % 5 === 1) s.t = this.rand() % 8;
    }
    this.stars = this.stars.filter(s => s.life > 0 && s.y < 520);

    // scrolling
    let n = 0;
    if (p.y < 160) {
      n = p.y < 140 ? 2 : 1;
      if (p.y < 120) n++; if (p.y < 100) n++; if (p.y < 80) n++; if (p.y < 60) n++;
      if (p.y < 40) n += 2; if (p.y < 20) n += 2; if (p.y < 0) n += 3;
    }
    this.S += n; p.y += n;
    if (this.S > 100 && !p.dead) {
      if (this.L === -1) this.L = this.startL;
      const k = this.L === 0 ? (this.frame & 1) : this.L;
      this.S += k; p.y += k;
    } else if (!p.dead) this.timer = 0;
    if (this.hurryY + 99 <= 578 && this.hurryY >= -99 - this.ahead) this.hurryY -= 2;
    if (!p.dead && this.L >= 0 && this.L < this.maxL && this.timer > this.step * (this.idx + 1)) {
      this.L++; this.idx++;
      this.hurryY = 479;
      this.snd('S_RING'); this.snd('S_HURRYUP');
    }
    this.fillRows();

    const wasAir = p.state !== 0;
    if (!p.dead) this.collide(p);
    if (this.fx && !p.dead) this.stageTick(p, wasAir);
    if (p.cart) p.ang += 8;
    if (p.cTimer) {
      p.cTimer--;
      if (p.cTimer === 0 && p.cJumps > 1) {
        p.bonus += p.cFloors * p.cFloors;
        this.doReward(p.cFloors);
        p.best = Math.max(p.best, p.cFloors);
      }
    }
    if (p.state === 0 && !p.dead) {
      const f = this.floorUnder(Math.trunc(p.y));
      if (f >= p.floor) {
        const d = f - p.floor;
        if (d > 1) {
          if (p.cTimer) { p.cFloors += d; p.cJumps++; } else { p.cFloors = d; p.cJumps = 1; }
          p.cTimer = this.comboT;
        }
        if (d === 1 && p.cTimer) p.cTimer = 1;
        p.floor = f;
      } else if (p.cTimer) p.cTimer = 1;
    }
    // edge balancing
    if (p.state === 0 && p.edge) { p.edgeT++; if (p.edgeT === 11) this.snd('C_edge'); } else p.edgeT = 0;
    // animation helpers
    if (p.state === 0) {
      p.walk += Math.abs(p.vx);
      p.idleT = Math.abs(p.vx) < 0.01 ? p.idleT + 1 : 0;
    }
    if (p.vx > 0.3) p.face = 1; else if (p.vx < -0.3) p.face = -1;
    if (this.reward && ++this.reward.t > 80) this.reward = null;

    // death
    if (p.y > 540 && !p.dead) {
      p.dead = 1; p.cTimer = 0;
      this.snd('C_death');
      this.deadT = 1;
    }
    if (p.dead) {
      this.deadT++;
      if (this.deadT === 40) this.snd('S_GAMEOVER');      // "מאמא מיה! המשחק נגמר!" after the fall sound
      if (p.y > 900 && !this.splat) { this.splat = true; this.snd('S_SPLAT', 0.6); }
      if (this.deadT > Math.min(250, Math.max(p.floor * 5, 120))) this.ended = true;
    }
  }

  // stage extras, every tick after the collision
  stageTick(p, wasAir) {
    const st = this.fx;
    const r = this.rowIndexAt(Math.trunc(p.y)), row = this.rows[r];
    if (p.state === 0 && row && row.type === 0) {
      // moving floor: Mario rides along
      if (row.mA) p.x = Math.max(85, Math.min(555, p.x + this.shift(row) - this.shift(row, this.frame - 1)));
      // spring: landing on it throws Mario up (cartwheel)
      if (wasAir && row.spring && Math.abs(p.x - (row.spring + this.shift(row))) < 15) {
        p.state = 1; p.vy = -26; p.cart = true; p.ang = 0;
        this.springT.set(r, 12);
        this.snd('C_jumphi');
      }
      // crumbling floor: 45 ticks (0.9 s) under Mario's feet, then it falls
      if (row.crumble) {
        const t = (this.crum.get(r) || 0) + 1;
        this.crum.set(r, t);
        if (t >= 45) {
          this.gone.add(r);
          const top = TOP + this.S - 16 * r;
          for (let c = row.l; c <= row.rt; c++) this.debris.push({ x: c * 16 + this.shift(row), y: top - 6, vx: (this.rand2() % 200 - 100) / 60, vy: -(this.rand2() % 100) / 50, a: 0, va: (this.rand2() % 100 - 50) / 300, S0: this.S, set: this.st ? this.st.set : this.look ? this.look.set : Math.min(row.theme, 9) });
          this.snd('S_SPLAT', 0.5);
        }
      }
    }
    for (const [k, v] of this.springT) { if (v <= 1) this.springT.delete(k); else this.springT.set(k, v - 1); }
    for (const d of this.debris) { d.x += d.vx; d.y += d.vy; d.vy += 0.5; d.a += d.va; }
    this.debris = this.debris.filter(d => d.y + this.S - d.S0 < 560);
    // coins: just above the floors
    const yi = Math.trunc(p.y);
    for (let rr = this.rowIndexAt(yi) - 6; rr <= this.rowIndexAt(yi) + 2; rr++) {
      const cr = this.rows[rr];
      if (!cr || cr.coin === undefined || this.got.has(rr) || this.gone.has(rr)) continue;
      const cx = cr.coin + this.shift(cr), cy = TOP + this.S - 16 * rr - 22;
      if (Math.abs(p.x - cx) < 18 && Math.abs(p.y - 24 - cy) < 30) {
        this.got.add(rr); this.coins++; p.bonus += 25;
        this.snd('C_edge');
        for (let i = 0; i < 6; i++) this.addStar(cx, cy, ((this.rand2() % 100) - 50) / 20, -((this.rand2() % 100) + 50) / 40);
      }
    }
    // wind: a gust every 5 seconds, changing direction
    if (st.wind && this.L >= 0) {
      const ph = Math.floor(this.timer / 250);
      if (ph !== this.windPh) { this.windPh = ph; this.windDir = this.rand2() % 2 ? 1 : -1; }
      const t = this.timer % 250;
      this.wind = t < 40 ? 0 : this.windDir * 0.16 * Math.min(1, (t - 40) / 30);
    }
    // the flag
    if (this.st && p.floor >= this.st.goal && p.state === 0) {
      this.cleared = true; this.clearT = 0;
      this.snd('V_CLEAR'); this.snd('S_CHEER', 0.8);
    }
  }

  get score() { return this.p.floor * 10 + this.p.bonus; }

  // ------------------------------------------------------------------ drawing
  frameName(p) {
    if (p.cart) return ['MARIO_ROTATE', false];
    if (p.state !== 0) {
      if (Math.abs(p.vx) < 3) return ['MARIO_JUMP', false];
      const f = p.vy < -3 ? 'MARIO_JUMP1' : p.vy > 3 ? 'MARIO_JUMP3' : 'MARIO_JUMP2';
      return [f, p.vx < 0];
    }
    if (p.edge) return [((this.frame >> 3) & 1) ? 'MARIO_EDGE1' : 'MARIO_EDGE2', p.edge === 2];
    if (Math.abs(p.vx) >= 0.02 && Math.abs(p.vx) > 0.25) {
      const k = Math.floor(p.walk / 14) % 4;
      return [['MARIO_WALK1', 'MARIO_WALK2', 'MARIO_WALK3', 'MARIO_WALK4'][k], p.vx < 0];
    }
    if (this.L >= 0 && p.y > 400) return ['MARIO_CHOCK', false];
    const c = p.idleT % 180;
    if (c >= 70 && c < 78) return ['MARIO_IDLE2', false];
    if (c >= 150) return ['MARIO_IDLE3', false];
    return ['MARIO_IDLE1', false];
  }

  draw(a) {
    const p = this.p;
    const Sv = this.prev.S + (this.S - this.prev.S) * a;
    const px = this.prev.x + (p.x - this.prev.x) * a;
    const py = this.prev.y + (p.y - this.prev.y) * a;

    // the tower's curved back wall (BGSTRIP, built like the original): half-speed parallax
    const bgOff = ((Sv % 128) + 128) % 128 / 2;
    const up = this.ahead;                            // extra view above (phone held upright)
    for (let i = -1 - Math.ceil(up / 64); i <= 7; i++) G.part('BGSTRIP', 60, 0, 520, 64, 60, i * 64 + bgOff);
    // the level's atmosphere over the back wall (easy: sky blue ... impossible: hell red)
    const look = this.look;
    if (look) {
      const ctx0 = G.context(), v0 = G.view();
      ctx0.save();
      if (look.sky) {                                   // easy: a soft light from above
        const g = ctx0.createLinearGradient(0, v0.y, 0, v0.y + v0.h);
        g.addColorStop(0, look.tint); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx0.globalAlpha = look.tintA * 1.6; ctx0.fillStyle = g; ctx0.fillRect(60, v0.y, 520, v0.h);
      }
      ctx0.globalAlpha = look.tintA; ctx0.globalCompositeOperation = 'overlay';
      ctx0.fillStyle = look.tint; ctx0.fillRect(60, v0.y, 520, v0.h);
      ctx0.globalCompositeOperation = 'source-over'; ctx0.globalAlpha = look.tintA * 0.6;
      ctx0.fillRect(60, v0.y, 520, v0.h);
      ctx0.restore();
    }

    // hurry up! banner (behind the floors, like the original)
    if (this.hurryY + 99 <= 578 && this.hurryY >= -99 - up) {
      const [hw] = G.size('HURRYUP');
      G.img('HURRYUP', 320 - (hw >> 1), this.hurryY + 2 * a * -1);
    }

    // floors
    const rFirst = Math.max(0, Math.floor((Sv + TOP - 520) / 16)), rLast = Math.ceil((Sv + TOP + 60 + up) / 16);
    const ctx = G.context();
    const tf = this.frame - 1 + a;                    // fractional tick, for smooth moving floors
    for (let r = rFirst; r <= rLast; r++) {
      const row = this.rows[r];
      if (!row || row.type !== 0 || this.gone.has(r)) continue;
      const top = TOP + Sv - 16 * r;
      const set = this.st ? this.st.set : look ? look.set : row.n >= 5000 ? 10 : Math.min(row.theme, 9);
      const [L, M, Rt] = FLOOR_SETS[set];
      let ox = this.shift(row, tf);
      const ct = this.crum.get(r) || 0;
      if (ct > 12) ox += ((this.frame * 7) % 5 - 2) * (ct / 45);   // about to fall: shakes
      const y = top - 6;
      if (row.crumble) ctx.globalAlpha = 1 - Math.max(0, ct - 25) / 40;
      G.img(L, row.l * 16 - 5 + ox, y);
      for (let c = row.l + 1; c < row.rt; c++) G.img(M, c * 16 + ox, y);
      G.img(Rt, row.rt * 16 + ox, y);
      ctx.globalAlpha = 1;
      if (row.crumble) drawCracks(ctx, row.l * 16 + ox, top, (row.rt - row.l + 1) * 16, r);
      if (row.sign) {
        const sn = SIGNS[set];
        const [sw] = G.size(sn);
        const sx = (row.l + ((row.rt - row.l) >> 1)) * 16 + ox;
        G.img(sn, sx, top + 10);
        G.smallText(String(row.sign), sx + (sw >> 1) + 1, top + 16, 'center');
      }
      if (row.spring) drawSpring(ctx, row.spring + ox, top - 1, this.springT.get(r) || 0);
      if (row.coin !== undefined && !this.got.has(r)) drawCoin(ctx, row.coin + ox, top - 22, tf * 0.12 + r);
      if (row.goal) drawFlag(ctx, 470, top, this.cleared ? Math.min(1, this.clearT / 60) : 0);
    }
    if (this.debris.length) {                        // pieces of a crumbled floor
      for (const d of this.debris) G.img(FLOOR_SETS[d.set][1], d.x, d.y + Sv - d.S0, { rot: d.a, cx: d.x + 8, cy: d.y + 8 + Sv - d.S0 });
    }

    // stars
    const starN = ['STAR01', 'STAR02', 'STAR03', 'STAR04', 'STAR05', 'STAR06', 'STAR07', 'STAR08'];
    for (const s of this.stars) G.img(starN[s.t], s.x, s.y);

    // the player (Mario, or the character chosen in "דמויות" - chars.js)
    if (py < 560) {
      const [name, flip] = this.frameName(p);
      drawHero(this.hero, name, flip, px + 4, py, {
        ang: (p.ang + 8 * a) / 256 * Math.PI * 2 * (p.vx < 0 ? -1 : 1), face: p.face, walk: p.walk, t: this.frame + a, vy: p.vy,
      });
    }

    const v = G.view();
    // stage "wind": white streaks blowing across the tower
    if (this.wind) {
      const k = Math.abs(this.wind) / 0.16;
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        const len = 22 + (i * 13) % 30;
        const x = 60 + (((i * 197 + tf * Math.sign(this.wind) * (9 + i % 5)) % 560) + 560) % 560 - 20;
        const yy = v.y + ((i * 89.3) % v.h);
        ctx.globalAlpha = 0.18 + 0.25 * k * ((i % 3) / 2);
        ctx.lineWidth = 1.5 + (i % 2);
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - Math.sign(this.wind) * len, yy); ctx.stroke();
      }
      ctx.restore();
    }
    // stage "dark": only a circle of light around Mario
    if (this.st && this.st.dark) {
      const cx = px + 4, cy = py - 26;
      const g = ctx.createRadialGradient(cx, cy, 55, cx, cy, 190);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,10,0.75)'); g.addColorStop(1, 'rgba(0,0,10,0.96)');
      ctx.fillStyle = g; ctx.fillRect(v.x, v.y, v.w, v.h);
    }

    // walls: scroll 1.476x the floor speed (foreground parallax)
    const wallOff = (((Sv % 84) + 84) % 84) * 1.476 - 124;
    const m = G.getMargin();                         // full-screen phone: the walls continue to the screen edges
    for (let k = -Math.ceil(up / 124); k < 5; k++) {
      for (let x = 565; x < 640 + m; x += 132) G.img('SIDEBLOCK', x, wallOff + k * 124);
      for (let x = -57; x + 132 > -m; x -= 132) G.img('SIDEBLOCK', x, wallOff + k * 124, { flip: true });
    }
    if (look) {
      if (look.wallA) {                                  // darker / redder walls
        ctx.save(); ctx.globalAlpha = look.wallA; ctx.fillStyle = look.wallTint || '#000';
        ctx.fillRect(v.x, v.y, 75 - v.x, v.h); ctx.fillRect(565, v.y, v.x + v.w - 565, v.h);
        ctx.restore();
      }
      if (look.fog) drawFog(ctx, v, tf);
      if (look.embers) drawEmbers(ctx, v, tf);
    }
    if ((this.st && this.st.lava) || (look && look.lava)) drawLava(ctx, v, tf);
    if (look && look.vignette) {                       // pulsing red frame
      const k = 0.55 + 0.25 * Math.sin(tf / 12);
      const g = ctx.createRadialGradient(320, v.y + v.h / 2, Math.min(v.w, v.h) * 0.35, 320, v.y + v.h / 2, Math.max(v.w, v.h) * 0.75);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(150,0,0,${k})`);
      ctx.fillStyle = g; ctx.fillRect(v.x, v.y, v.w, v.h);
    }

    if (this.noHud) return;                          // level-select preview: just the tower
    this.drawHud(a);
    if (this.st) this.drawStageHud(a);
  }

  drawStageHud(a) {
    const st = this.st, p = this.p, ctx = G.context();
    const T = -this.ahead, mid = (480 - this.ahead) / 2;
    G.smallText(`שלב ${this.stageNo + 1}: ${st.name}`, 320, T + 6, 'center');
    G.smallText(`קומה ${Math.min(p.floor, st.goal)} מתוך ${st.goal}`, 320, T + 22, 'center');
    if (st.coins) { drawCoin(ctx, 300, T + 52, 0); G.text('FONT2', 'x' + this.coins, 314, T + 38, 'left', { visual: true }); }
    // intro card
    const t = this.frame + a;
    if (t < 150 && !this.cleared) {
      const al = Math.min(1, (150 - t) / 30);
      const v = G.view();
      G.rect(v.x, mid - 100, v.w, 128, '#000', 0.5 * al);
      G.text('FONT1', `שלב ${this.stageNo + 1}`, 320, mid - 90, 'center', { alpha: al });
      G.text('FONT1', st.name, 320, mid - 55, 'center', { alpha: al });
      G.text('FONT2', st.desc, 320, mid - 8, 'center', { alpha: al });
    }
    if (this.cleared) {
      const v = G.view();
      G.rect(v.x, mid - 92, v.w, st.coins ? 112 : 78, '#000', 0.45);
      const sc = 1 + 0.06 * Math.sin((this.clearT + a) / 4);
      ctx.save(); ctx.translate(320, mid - 60); ctx.scale(sc, sc);
      G.text('FONT1', 'שלב הושלם!', 0, -20, 'center');
      ctx.restore();
      if (st.coins) G.text('FONT2', `מטבעות: ${this.coins}`, 320, mid - 10, 'center');
    }
  }

  drawHud(a) {
    const p = this.p;
    const T = -this.ahead;                            // clock + combo meter at the top of the screen
    const mid = (480 - this.ahead) / 2;              // middle of the screen
    // clock: one turn per speed step, shakes just before the next speed-up
    let sx = 0, sy = 0;
    const t = this.L >= 0 ? this.timer % SPEED_STEP : 0;
    if (this.L >= 0 && this.L < 5 && t > SPEED_STEP - 100) { sx = (this.frame % 3) - 1; sy = ((this.frame >> 1) % 3) - 1; }
    sy += T;
    G.img('CLOCK', 5 + sx, 10 + sy);
    G.img('CLOCK_HAND', 41 - 8.5 + sx, 58 - 29.5 + sy, { rot: (t + a) / SPEED_STEP * Math.PI * 2, cx: 41 + sx, cy: 58 + sy });

    // combo meter + liquid
    G.img('COMBO_METER', 20, 100 + T);
    if (p.cTimer > 0) {
      const lv = Math.min(100, Math.round(p.cTimer * 100 / this.comboT));
      G.part('COMBO_LIQUID', 0, 100 - lv, 16, lv, 31, 219 - lv + T);
    }
    if (p.cTimer > 0 && p.cFloors > 0) {
      G.img('COMBO_COUNT', -10, 210 + T);
      G.text('FONT1', String(p.cFloors), 40, 214 + T, 'center');
    }

    if (this.df && !this.st) G.smallText('רמה: ' + this.df.name, 320, T + 6, 'center');

    // score (the Hebrew string of the patched exe: "ניקוד: %d")
    G.text('FONT1', 'ניקוד: ' + this.score, 8, 440);

    // reward
    if (this.reward && !this.cleared) {
      const name = 'REWARD00' + this.reward.lvl;
      const [w, h] = G.size(name);
      const tt = this.reward.t + a;
      const sc = tt < 8 ? 0.3 + 0.7 * (tt / 8) * (2 - tt / 8) : 1;
      const al = tt > 70 ? Math.max(0, (80 - tt) / 10) : 1;
      G.img(name, 320 - w / 2, mid - 40 - h / 2, { scale: sc, alpha: al, cx: 320, cy: mid - 40 });
    }
    if (p.dead) {
      const [w, h] = G.size('GAMEOVER');
      const tt = Math.min(1, (this.deadT + a) / 25);
      G.img('GAMEOVER', 320 - w / 2, mid - h / 2 - (1 - tt) * 300);
    }
  }
}
