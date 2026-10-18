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

const TOP = 432;                                  // screen y of row 0 (floor 0) when scroll = 0
const SPEED_STEP = 1500;                           // ticks between speed-ups (30 s)
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

export class Game {
  constructor(opt = {}) {
    this.opt = opt;
    this.seed = (opt.seed ?? (Date.now() & 0x7fffffff)) >>> 0;
    this.rows = [];
    this.R = 0;                                    // rows generated
    this.S = 0;                                    // scroll (px)
    for (let i = 0; i < 30; i++) this.genRow();
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
  }

  snd(name, vol) { if (!this.silent) S.play(name, vol); }

  // a silent copy for look-ahead (demo player)
  clone() {
    const g = Object.create(Game.prototype);
    for (const k of Object.keys(this)) g[k] = this[k];
    g.p = { ...this.p }; g.prev = { ...this.prev };
    g.rows = this.rows.slice();                    // rows are never mutated once made
    g.stars = this.stars.map(s => ({ ...s }));     // stars use rand() too: keep the sequence identical
    g.reward = this.reward && { ...this.reward }; g.silent = true;
    return g;
  }

  // C rand(): 0..32767
  rand() { this.seed = (Math.imul(this.seed, 214013) + 2531011) >>> 0; return (this.seed >>> 16) & 0x7fff; }

  genRow() {
    const r = this.R;
    const row = { type: -1, l: 0, rt: 0, n: r + 1, sign: 0, theme: Math.min((r / 500) | 0, 10) };
    if ((r % 250 === 0 && ((r / 5) | 0) <= 1000) || r % 2500 === 0) {
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
      row.type = 0; row.l = this.rand() % (30 - w) + 5; row.rt = row.l + w;
    }
    if (r % 50 === 0) row.sign = ((r + 1) / 5) | 0;
    this.rows[r] = row;
    if (r > 64) this.rows[r - 64] = undefined;    // keep memory flat on long games
    this.R++;
  }

  rowIndexAt(py) { return (this.R - 3) - ((py + 1) >> 4); }

  // original 0x4118c0: 0 = no floor under this foot, else 10000 + distance to the row's top
  support(px, py) {
    const m = (py + 1) >> 4;
    if (29 - m < 0 || 29 - m > 31) return 0;
    const row = this.rows[this.R - 3 - m];
    if (!row || row.type !== 0) return 0;
    const col = Math.floor(px / 16);
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
    if (inp.left) { if (p.vx > 0) p.vx *= 0.7; p.vx -= 0.3; }
    else if (inp.right) { if (p.vx < 0) p.vx *= 0.7; p.vx += 0.3; }
    else p.vx *= 0.9;
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
      if (this.L === -1) this.L = 0;
      const k = this.L === 0 ? (this.frame & 1) : this.L;
      this.S += k; p.y += k;
    } else if (!p.dead) this.timer = 0;
    if (this.hurryY + 99 <= 578 && this.hurryY >= -99) this.hurryY -= 2;
    if (!p.dead && this.L >= 0 && this.L < 5 && this.timer > SPEED_STEP * (this.idx + 1)) {
      this.L++; this.idx++;
      this.hurryY = 479;
      this.snd('S_RING'); this.snd('S_HURRYUP');
    }
    while (this.R < 30 + Math.floor(this.S / 16)) this.genRow();

    if (!p.dead) this.collide(p);
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
          p.cTimer = 100;
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
      this.snd('C_death'); this.snd('S_GAMEOVER', 0.9);
      this.deadT = 1;
    }
    if (p.dead) {
      this.deadT++;
      if (p.y > 900 && !this.splat) { this.splat = true; this.snd('S_SPLAT', 0.6); }
      if (this.deadT > Math.min(250, Math.max(p.floor * 5, 120))) this.ended = true;
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
    for (let i = -1; i <= 7; i++) G.part('BGSTRIP', 60, 0, 520, 64, 60, i * 64 + bgOff);

    // hurry up! banner (behind the floors, like the original)
    if (this.hurryY + 99 <= 578 && this.hurryY >= -99) {
      const [hw] = G.size('HURRYUP');
      G.img('HURRYUP', 320 - (hw >> 1), this.hurryY + 2 * a * -1);
    }

    // floors
    const rFirst = Math.max(0, Math.floor((Sv + TOP - 520) / 16)), rLast = Math.ceil((Sv + TOP + 60) / 16);
    for (let r = rFirst; r <= rLast; r++) {
      const row = this.rows[r];
      if (!row || row.type !== 0) continue;
      const top = TOP + Sv - 16 * r;
      const set = row.n >= 5000 ? 10 : Math.min(row.theme, 9);
      const [L, M, Rt] = FLOOR_SETS[set];
      const y = top - 6;
      G.img(L, row.l * 16 - 5, y);
      for (let c = row.l + 1; c < row.rt; c++) G.img(M, c * 16, y);
      G.img(Rt, row.rt * 16, y);
      if (row.sign) {
        const sn = SIGNS[row.n >= 5000 ? 10 : Math.min(row.theme, 9)];
        const [sw] = G.size(sn);
        const sx = (row.l + ((row.rt - row.l) >> 1)) * 16;
        G.img(sn, sx, top + 10);
        G.smallText(String(row.sign), sx + (sw >> 1) + 1, top + 16, 'center');
      }
    }

    // stars
    const starN = ['STAR01', 'STAR02', 'STAR03', 'STAR04', 'STAR05', 'STAR06', 'STAR07', 'STAR08'];
    for (const s of this.stars) G.img(starN[s.t], s.x, s.y);

    // the player
    if (py < 560) {
      const [name, flip] = this.frameName(p);
      const [w, h] = G.size(name);
      const cx = px + 4;
      if (name === 'MARIO_ROTATE') {
        const ang = (p.ang + 8 * a) / 256 * Math.PI * 2 * (p.vx < 0 ? -1 : 1);
        G.img(name, cx - w / 2, py - 26 - h / 2, { rot: ang, cx, cy: py - 26 });
      } else {
        G.img(name, cx - w / 2, py - h + 2, flip ? { flip: true } : undefined);
      }
    }

    // walls: scroll 1.476x the floor speed (foreground parallax)
    const wallOff = (((Sv % 84) + 84) % 84) * 1.476 - 124;
    for (let k = 0; k < 5; k++) {
      G.img('SIDEBLOCK', 565, wallOff + k * 124);
      G.img('SIDEBLOCK', -57, wallOff + k * 124, { flip: true });
    }

    this.drawHud(a);
  }

  drawHud(a) {
    const p = this.p;
    // clock: one turn per speed step, shakes just before the next speed-up
    let sx = 0, sy = 0;
    const t = this.L >= 0 ? this.timer % SPEED_STEP : 0;
    if (this.L >= 0 && this.L < 5 && t > SPEED_STEP - 100) { sx = (this.frame % 3) - 1; sy = ((this.frame >> 1) % 3) - 1; }
    G.img('CLOCK', 5 + sx, 10 + sy);
    G.img('CLOCK_HAND', 41 - 8.5 + sx, 58 - 29.5 + sy, { rot: (t + a) / SPEED_STEP * Math.PI * 2, cx: 41 + sx, cy: 58 + sy });

    // combo meter + liquid
    G.img('COMBO_METER', 20, 100);
    if (p.cTimer > 0) {
      const lv = Math.min(100, p.cTimer);
      G.part('COMBO_LIQUID', 0, 100 - lv, 16, lv, 31, 219 - lv);
    }
    if (p.cTimer > 0 && p.cFloors > 0) {
      G.img('COMBO_COUNT', -10, 210);
      G.text('FONT1', String(p.cFloors), 40, 214, 'center');
    }

    // score (the Hebrew string of the patched exe: "ניקוד: %d")
    G.text('FONT1', 'ניקוד: ' + this.score, 8, 440);

    // reward
    if (this.reward) {
      const name = 'REWARD00' + this.reward.lvl;
      const [w, h] = G.size(name);
      const tt = this.reward.t + a;
      const sc = tt < 8 ? 0.3 + 0.7 * (tt / 8) * (2 - tt / 8) : 1;
      const al = tt > 70 ? Math.max(0, (80 - tt) / 10) : 1;
      G.img(name, 320 - w / 2, 200 - h / 2, { scale: sc, alpha: al, cx: 320, cy: 200 });
    }
    if (p.dead) {
      const [w, h] = G.size('GAMEOVER');
      const tt = Math.min(1, (this.deadT + a) / 25);
      G.img('GAMEOVER', 320 - w / 2, 240 - h / 2 - (1 - tt) * 300);
    }
  }
}
