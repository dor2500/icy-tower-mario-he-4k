// Icy Tower - modern edition: the renderer. Same game (../js/game.js: physics, map, combo, stages, difficulty),
// drawn new: widescreen with an open sky that changes with the height (day -> sunset -> night -> space), parallax
// mountains and clouds, a translucent ice tower, glossy floors with light and shadow, particles (snow, landing
// dust, combo trail, confetti), screen shake and a clean HUD. Everything is vector, sharp at any resolution.
import * as G from '../js/gfx.js';
import { TOP, drawCoin, drawSpring, drawFlag, drawCracks, drawLava } from '../js/game.js';
import { drawHero } from '../js/chars.js';

const REWARDS = ['טוב!', 'יופי!', 'אחלה!', 'סופר!', 'וואו!', 'מדהים!', 'אקסטרים!', 'פנטסטי!', 'מושלם!', 'אין מצב!'];
// floor looks (floor set of the map: 0 ice ... 10 fire): top / middle / bottom colours
const FLOORS = [
  ['#f4fcff', '#a8dcff', '#4f8fd8'], ['#eaf7ff', '#8cc8f5', '#3a76c8'], ['#ffdca6', '#c98544', '#77461b'],
  ['#f2f5f9', '#a8b4c4', '#5a6779'], ['#ffd3ee', '#ff79c4', '#be2a7c'], ['#fffbec', '#e7dbbd', '#a28f73'],
  ['#ccf8ab', '#5cbf3c', '#2c7620'], ['#ffe68c', '#f5b400', '#a56900'], ['#ffffff', '#e8f1ff', '#b4c6e6'],
  null, ['#fff2a8', '#ffb347', '#d8381f']];
// the sky by height (floor): top colour, horizon colour
const SKY = [[0, '#56acff', '#d2eeff'], [120, '#ff9566', '#ffe2a6'], [260, '#56398a', '#ff8db0'],
  [420, '#0b1440', '#35408f'], [700, '#02010a', '#1b0e3c']];

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    G.attach(canvas);
    this.ctx = canvas.getContext('2d');
    this.quality = 1;
    this.parts = [];          // world particles {x, y, vx, vy, life, max, r, c, kind}
    this.snow = [];           // screen-space snow (0..1 coordinates)
    for (let i = 0; i < 90; i++) this.snow.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, ph: Math.random() * 6 });
    this.shake = 0; this.flash = 0;
    this.track = null;        // the game we follow (to see landings, rewards, speed-ups)
  }

  // canvas size in device pixels; the world shows 480 units of height (more on tall screens)
  resize(cssW, cssH, top = 0) {
    const dpr = (window.devicePixelRatio || 1) * this.quality;
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    this.W = W; this.H = H; this.dpr = dpr;
    this.k = Math.min(H / 480, W / 600);               // device px per world unit
    this.ox = W / 2 - 320 * this.k;                    // world x 320 in the middle
    this.oy = H - 480 * this.k;                        // world y 480 at the bottom
    this.ahead = Math.max(0, H / this.k - 480);        // tall screens: more tower above
    // gfx.js (the characters' sprites) draws with the same transform
    G.layout({ x: this.ox / (window.devicePixelRatio || 1) / this.quality, y: this.oy / (window.devicePixelRatio || 1) / this.quality, w: 640 * this.k / dpr }, dpr);
    this.hs = Math.min(H / 900, Math.max(W / 1300, W / 760));   // HUD scale (phones: a bit bigger)
  }
  view() { return { x: -this.ox / this.k, y: -this.oy / this.k, w: this.W / this.k, h: this.H / this.k }; }

  // ---------------------------------------------------------------- per logic tick: particles + events
  tick(g) {
    if (this.track !== g) { this.track = g; this.parts = []; this.lastState = 0; this.lastL = g.L; this.lastReward = null; this.lastCoins = g.coins; }
    const p = g.p;
    // landing: a puff of snow dust
    if (this.lastState !== 0 && p.state === 0 && !p.dead) {
      for (let i = 0; i < 10; i++) this.parts.push({ x: p.x + (Math.random() - 0.5) * 22, y: p.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.6, life: 26, max: 26, r: 2.5 + Math.random() * 3, c: '255,255,255', kind: 'puff', S0: g.S });
    }
    this.lastState = p.state;
    // combo: a glowing rainbow trail while in the air
    if (p.cTimer > 0 && p.state !== 0 && !p.dead) {
      const hue = (g.frame * 9) % 360;
      for (let i = 0; i < 2; i++) this.parts.push({ x: p.x + 4 + (Math.random() - 0.5) * 10, y: p.y - 26 + (Math.random() - 0.5) * 24, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, life: 30, max: 30, r: 2.2 + Math.random() * 2.4, c: `hsl(${hue},100%,65%)`, kind: 'glow', S0: g.S });
    }
    // reward: confetti + shake
    if (g.reward && g.reward !== this.lastReward && g.reward.t <= 1) {
      const lvl = g.reward.lvl;
      for (let i = 0; i < 30 + lvl * 14; i++) {
        const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * (4 + lvl);
        this.parts.push({ x: 320, y: (480 - g.ahead) / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 70, max: 70, r: 2.5 + Math.random() * 2.5, c: `hsl(${Math.random() * 360},95%,62%)`, kind: 'confetti', rot: Math.random() * 6, S0: g.S, screen: true });
      }
      this.shake = Math.max(this.shake, 3 + lvl * 1.6);
      this.flash = 0.25 + lvl * 0.03;
    }
    this.lastReward = g.reward;
    if (g.coins !== this.lastCoins) { this.lastCoins = g.coins; this.flash = Math.max(this.flash, 0.12); }
    // speed-up: banner
    if (g.L !== this.lastL) { if (g.L > 0) this.hurryT = 110; this.lastL = g.L; }
    if (this.hurryT) this.hurryT--;
    // move particles
    for (const q of this.parts) {
      q.x += q.vx; q.y += q.vy; q.life--;
      if (q.kind === 'confetti') { q.vy += 0.18; q.vx *= 0.98; q.rot += 0.2; } else if (q.kind === 'puff') { q.vx *= 0.92; q.vy *= 0.92; }
    }
    this.parts = this.parts.filter(q => q.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const s of this.snow) { s.y += 0.0018 * s.z; s.x += Math.sin(s.ph + s.y * 6) * 0.0006; if (s.y > 1.02) { s.y = -0.02; s.x = Math.random(); } }
    this.shake *= 0.86; this.flash *= 0.9;
  }

  // ---------------------------------------------------------------- draw a frame
  draw(g, a, o = {}) {
    const ctx = this.ctx, k = this.k, W = this.W, H = this.H;
    const p = g.p;
    const Sv = g.prev.S + (g.S - g.prev.S) * a;
    const px = g.prev.x + (p.x - g.prev.x) * a, py = g.prev.y + (p.y - g.prev.y) * a;
    const tf = g.frame - 1 + a;
    const f = Sv / 80;                                  // height in floors (for the sky)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    this.sky(f, tf);
    // world transform (+ shake)
    const sx = (Math.random() - 0.5) * this.shake * k * 0.5, sy = (Math.random() - 0.5) * this.shake * k * 0.5;
    ctx.setTransform(k, 0, 0, k, this.ox + sx, this.oy + sy);
    const v = this.view();
    const look = g.look;
    this.tower(Sv, v, look, g);
    // floors
    const rFirst = Math.max(0, Math.floor((Sv + TOP - 520) / 16)), rLast = Math.ceil((Sv + TOP + 60 + this.ahead) / 16);
    for (let r = rFirst; r <= rLast; r++) {
      const row = g.rows[r];
      if (!row || row.type !== 0 || g.gone.has(r)) continue;
      this.floor(g, row, r, TOP + Sv - 16 * r, tf, look);
    }
    for (const d of g.debris) this.platform(d.x - 2, d.y + Sv - d.S0 + 2, 18, d.set, 0, d.a);
    // the game's own stars (combo rewards / cartwheels): sparkles
    for (const s of g.stars) this.sparkle(s.x, s.y, 4 + (s.t % 3), (s.life / 255));
    // world particles
    for (const q of this.parts) if (!q.screen) this.particle(q, Sv);
    // the hero
    if (py < 560) {
      if (p.cTimer > 0) {                                // combo aura
        const gr = ctx.createRadialGradient(px + 4, py - 26, 4, px + 4, py - 26, 40);
        gr.addColorStop(0, 'rgba(255,230,120,0.45)'); gr.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = gr; ctx.fillRect(px - 40, py - 70, 90, 90);
      }
      const [name, flip] = g.frameName(p);
      drawHero(g.hero, name, flip, px + 4, py, { ang: (p.ang + 8 * a) / 256 * Math.PI * 2 * (p.vx < 0 ? -1 : 1), face: p.face, walk: p.walk, t: g.frame + a, vy: p.vy });
    }
    this.walls(Sv, v);
    // stage / level atmosphere
    if (g.wind) this.wind(g, v, tf);
    if (g.st && g.st.dark) {
      const gr = ctx.createRadialGradient(px + 4, py - 26, 60, px + 4, py - 26, 210);
      gr.addColorStop(0, 'rgba(0,0,10,0)'); gr.addColorStop(0.6, 'rgba(0,0,12,0.78)'); gr.addColorStop(1, 'rgba(0,0,12,0.97)');
      ctx.fillStyle = gr; ctx.fillRect(v.x, v.y, v.w, v.h);
    }
    if ((g.st && g.st.lava) || (look && look.lava)) drawLava(ctx, v, tf);
    if (look && look.fog) this.fog(v, tf);
    // screen space: confetti, snow, HUD
    ctx.setTransform(k, 0, 0, k, this.ox, this.oy);
    for (const q of this.parts) if (q.screen) this.particle(q, Sv);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.snowfall(f);
    if (look && look.vignette) this.vignette(tf, '150,0,0');
    else this.vignette(0, '0,0,20', 0.35);
    if (this.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(0, 0, W, H); }
    if (!o.noHud) this.hud(g, a, o);
  }

  // ---------------------------------------------------------------- background
  sky(f, t) {
    const ctx = this.ctx, W = this.W, H = this.H;
    let i = 0; while (i < SKY.length - 2 && f > SKY[i + 1][0]) i++;
    const [f0, t0, b0] = SKY[i], [f1, t1, b1] = SKY[i + 1];
    const u = clamp((f - f0) / (f1 - f0), 0, 1);
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, mix(t0, t1, u)); gr.addColorStop(1, mix(b0, b1, u));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // stars (from sunset on) + the sun / moon
    const night = clamp((f - 200) / 220, 0, 1);
    if (night > 0) {
      for (let s = 0; s < 160; s++) {
        const x = rnd(s) * W, y = ((rnd(s + 500) * H * 1.4 + f * 0.6 * this.k) % (H * 1.4)) - H * 0.2;
        const tw = 0.5 + 0.5 * Math.sin(t / 18 + s);
        ctx.fillStyle = `rgba(255,255,255,${night * (0.35 + 0.65 * tw) * rnd(s + 9)})`;
        const r = (0.6 + rnd(s + 3) * 1.6) * this.hs * 1.6;
        ctx.fillRect(x, y, r, r);
      }
    }
    const day = 1 - night;
    const bx = W * 0.82, by = H * (0.16 + clamp(f / 260, 0, 1) * 0.5);
    const body = (x, y, r, c, glow) => {
      const g2 = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 4);
      g2.addColorStop(0, `rgba(${glow},0.55)`); g2.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g2; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    if (day > 0.05) { ctx.globalAlpha = day; body(bx, by, 46 * this.hs, '#fff6c8', '255,220,140'); ctx.globalAlpha = 1; }
    if (night > 0.05) { ctx.globalAlpha = night; body(W * 0.16, H * 0.2, 34 * this.hs, '#f1f3ff', '170,190,255'); ctx.globalAlpha = 1; }
    // mountains (sink away as we climb) and clouds (parallax)
    const sink = f * 80 * this.k * 0.08;
    this.mountains(H * 0.72 + sink, 0.012, 120, mix('#7d9cd0', '#26285a', clamp(f / 400, 0, 1)), 7);
    this.mountains(H * 0.84 + sink * 1.6, 0.02, 90, mix('#4d6aa3', '#141535', clamp(f / 400, 0, 1)), 3);
    const cl = clamp(1 - (f - 350) / 250, 0, 1);
    if (cl > 0) for (let c = 0; c < 9; c++) {
      const span = H * 1.6;
      const y = ((rnd(c + 40) * span + f * 80 * this.k * 0.35) % span) - H * 0.3;
      const x = ((rnd(c + 70) * W * 1.3 + t * (0.15 + rnd(c) * 0.3) * this.hs) % (W * 1.3)) - W * 0.15;
      this.cloud(x, y, (60 + rnd(c + 7) * 80) * this.hs, cl * (0.55 + 0.35 * day));
    }
  }
  mountains(base, fr, amp, col, seed) {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (base - amp * this.hs * 2 > H) return;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 18) {
      const u = x / this.hs;
      const h = (Math.sin(u * fr + seed) * 0.55 + Math.sin(u * fr * 2.3 + seed * 2) * 0.3 + Math.sin(u * fr * 5.1 + seed) * 0.15) * amp + amp;
      ctx.lineTo(x, base - h * this.hs);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  cloud(x, y, s, al) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,255,255,${al})`;
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(x - s * 0.45, y + s * 0.05, s * 0.5, s * 0.28, 0, 0, Math.PI * 2);
    ctx.ellipse(x + s * 0.2, y - s * 0.18, s * 0.45, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // the tower: translucent ice with a lit middle and darker sides (a cylinder), blocks scrolling at half speed
  tower(Sv, v, look, g) {
    const ctx = this.ctx;
    const gr = ctx.createLinearGradient(70, 0, 570, 0);
    const base = look && look.tint ? look.tint : '#7fb6ff';
    gr.addColorStop(0, 'rgba(10,22,50,0.86)'); gr.addColorStop(0.5, 'rgba(40,80,150,0.55)'); gr.addColorStop(1, 'rgba(10,22,50,0.86)');
    ctx.fillStyle = gr; ctx.fillRect(70, v.y, 500, v.h);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = base; ctx.fillRect(70, v.y, 500, v.h); ctx.restore();
    // ice blocks
    ctx.save(); ctx.beginPath(); ctx.rect(70, v.y, 500, v.h); ctx.clip();
    ctx.strokeStyle = 'rgba(200,230,255,0.13)'; ctx.lineWidth = 1.4;
    const bh = 32, off = ((Sv * 0.5) % bh + bh) % bh;
    for (let y = v.y - bh + off, j = Math.floor((v.y - Sv * 0.5) / bh); y < v.y + v.h; y += bh, j++) {
      ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(570, y); ctx.stroke();
      for (let x = 70 + ((j & 1) ? 40 : 0); x < 570; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke(); }
    }
    // a soft vertical light in the middle
    const lg = ctx.createLinearGradient(240, 0, 400, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.07)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(240, v.y, 160, v.h);
    ctx.restore();
  }

  walls(Sv, v) {
    const ctx = this.ctx;
    const seg = 62, off = ((Sv * 1.476) % seg + seg) % seg;
    for (const [x0, x1, inner] of [[22, 75, 75], [565, 618, 565]]) {
      const gr = ctx.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, '#202a40'); gr.addColorStop(0.45, '#5c6f96'); gr.addColorStop(1, '#1b2335');
      ctx.fillStyle = gr; ctx.fillRect(x0, v.y, x1 - x0, v.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      for (let y = v.y - seg + off; y < v.y + v.h; y += seg) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      for (let y = v.y - seg + off + 2; y < v.y + v.h; y += seg) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      // neon edge
      ctx.save(); ctx.shadowColor = '#7ff3ff'; ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(140,245,255,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(inner, v.y); ctx.lineTo(inner, v.y + v.h); ctx.stroke(); ctx.restore();
    }
  }

  // ---------------------------------------------------------------- floors
  floor(g, row, r, top, tf, look) {
    const ctx = this.ctx;
    const set = g.st ? g.st.set : look ? look.set : row.n >= 5000 ? 10 : Math.min(row.theme, 9);
    let ox = g.shift(row, tf);
    const ct = g.crum.get(r) || 0;
    if (ct > 12) ox += ((g.frame * 7) % 5 - 2) * (ct / 45);
    let x = row.l * 16 - 4 + ox, w = (row.rt - row.l + 1) * 16 + 8;
    if (x < 66) { w -= 66 - x; x = 66; }                // full floors end at the tower walls
    if (x + w > 574) w = 574 - x;
    ctx.save();
    if (row.crumble) ctx.globalAlpha = 1 - Math.max(0, ct - 25) / 40;
    this.platform(x, top - 4, w, set, r);
    ctx.restore();
    if (row.crumble) drawCracks(ctx, row.l * 16 + ox, top, (row.rt - row.l + 1) * 16, r);
    if (row.sign) this.badge((row.l + (row.rt - row.l + 1) / 2) * 16 + ox, top + 22, row.sign);
    if (row.spring) drawSpring(ctx, row.spring + ox, top - 1, g.springT.get(r) || 0);
    if (row.coin !== undefined && !g.got.has(r)) drawCoin(ctx, row.coin + ox, top - 22, tf * 0.12 + r);
    if (row.goal) drawFlag(ctx, 470, top, g.cleared ? Math.min(1, g.clearT / 60) : 0);
  }
  platform(x, y, w, set, seed, rot) {
    const ctx = this.ctx, h = 15;
    ctx.save();
    if (rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-x - w / 2, -y - h / 2); }
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,20,0.28)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 7, w, h, 7); ctx.fill();
    // body
    let gr;
    if (set === 9) {
      gr = ctx.createLinearGradient(x, 0, x + w, 0);
      ['#ff4d4d', '#ffa64d', '#ffe94d', '#5cff6a', '#4dc3ff', '#9b6bff'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    } else {
      const c = FLOORS[set] || FLOORS[0];
      gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, c[0]); gr.addColorStop(0.35, c[1]); gr.addColorStop(1, c[2]);
    }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(10,20,50,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    // glossy top light
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 2, w - 8, 3, 1.5); ctx.fill();
    // icicles under ice floors, little studs on ?-blocks / metal
    if (set <= 1) {
      ctx.fillStyle = 'rgba(200,235,255,0.85)';
      for (let i = 8; i < w - 6; i += 13) {
        const l = 3 + rnd(seed * 31 + i) * (set ? 9 : 5);
        ctx.beginPath(); ctx.moveTo(x + i - 2.5, y + h - 1); ctx.lineTo(x + i + 2.5, y + h - 1); ctx.lineTo(x + i, y + h + l); ctx.closePath(); ctx.fill();
      }
    } else if (set === 3 || set === 7) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 10; i < w - 6; i += 16) { ctx.beginPath(); ctx.arc(x + i, y + 10, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  badge(x, y, n) {
    const ctx = this.ctx;
    ctx.save();
    const gr = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 13);
    gr.addColorStop(0, '#fff6c4'); gr.addColorStop(1, '#f2a300');
    ctx.shadowColor = 'rgba(255,190,40,0.8)'; ctx.shadowBlur = 8;
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 12.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#4a2a00'; ctx.font = `900 ${n >= 1000 ? 7 : n >= 100 ? 9 : 11}px Rubik, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), x, y + 0.5);
    ctx.restore();
  }

  // ---------------------------------------------------------------- effects
  sparkle(x, y, r, al) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = clamp(al, 0, 1); ctx.fillStyle = '#fff7c0';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
    ctx.restore();
  }
  particle(q, Sv) {
    const ctx = this.ctx, al = q.life / q.max, y = q.screen ? q.y : q.y + Sv - q.S0;
    ctx.save();
    if (q.kind === 'confetti') {
      ctx.globalAlpha = Math.min(1, al * 2); ctx.fillStyle = q.c; ctx.translate(q.x, y); ctx.rotate(q.rot);
      ctx.fillRect(-q.r, -q.r * 0.5, q.r * 2, q.r);
    } else if (q.kind === 'glow') {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * 0.9; ctx.fillStyle = q.c;
      ctx.beginPath(); ctx.arc(q.x, y, q.r * (0.5 + al * 0.5), 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.globalAlpha = al * 0.7; ctx.fillStyle = `rgb(${q.c})`;
      ctx.beginPath(); ctx.arc(q.x, y, q.r * (1.6 - al * 0.6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  snowfall(f) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const al = f > 500 ? 0.35 : 0.8;
    ctx.fillStyle = `rgba(255,255,255,${al})`;
    for (const s of this.snow) {
      const r = (1 + s.z * 2.2) * this.hs * 1.3;
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  wind(g, v, tf) {
    const ctx = this.ctx, k = Math.abs(g.wind) / 0.16;
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const len = 26 + (i * 13) % 34;
      const x = v.x + (((i * 197 + tf * Math.sign(g.wind) * (9 + i % 5)) % v.w) + v.w) % v.w;
      const yy = v.y + ((i * 89.3) % v.h);
      ctx.globalAlpha = 0.15 + 0.3 * k * ((i % 3) / 2); ctx.lineWidth = 1.5 + (i % 2);
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - Math.sign(g.wind) * len, yy); ctx.stroke();
    }
    ctx.restore();
  }
  fog(v, t) {
    const ctx = this.ctx;
    for (let i = 0; i < 6; i++) {
      const x = v.x + ((((t * (0.35 + i * 0.12) + i * 210) % (v.w + 300)) + v.w + 300) % (v.w + 300)) - 150;
      const y = v.y + ((i * 0.23 + 0.1) % 1) * v.h;
      const gr = ctx.createRadialGradient(x, y, 10, x, y, 170);
      gr.addColorStop(0, 'rgba(190,150,255,0.25)'); gr.addColorStop(1, 'rgba(190,150,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 180, y - 180, 360, 360);
    }
  }
  vignette(t, rgb, base) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const k = base !== undefined ? base : 0.55 + 0.25 * Math.sin(t / 12);
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${k})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- HUD (screen space, crisp text)
  hud(g, a, o) {
    const ctx = this.ctx, s = this.hs, W = this.W, H = this.H, p = g.p;
    const font = (w, px) => `${w} ${Math.round(px * s)}px Rubik, system-ui, sans-serif`;
    const text = (str, x, y, px, align = 'right', color = '#fff', weight = 900) => {
      ctx.font = font(weight, px); ctx.textAlign = align; ctx.direction = 'rtl'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(5,10,30,0.85)'; ctx.lineWidth = px * s * 0.16; ctx.strokeText(str, x, y);
      ctx.fillStyle = color; ctx.fillText(str, x, y);
    };
    const pad = 34 * s, top = (o.top || 0) + pad;
    // glass card for the numbers (top right)
    this.glass(W - pad - 300 * s, top - 6 * s, 300 * s, 132 * s);
    text('קומה', W - pad - 22 * s, top + 34 * s, 26, 'right', '#bfe6ff', 700);
    text(String(p.floor), W - pad - 22 * s, top + 98 * s, 66);
    text('ניקוד', W - pad - 190 * s, top + 34 * s, 22, 'right', '#bfe6ff', 700);
    text(String(g.score), W - pad - 190 * s, top + 70 * s, 34, 'right', '#ffe27a');
    if (g.st && g.st.coins) {
      ctx.save(); ctx.translate(W - pad - 250 * s, top + 105 * s); ctx.scale(s * 1.4, s * 1.4); drawCoin(ctx, 0, 0, 0); ctx.restore();
      text('x' + g.coins, W - pad - 190 * s, top + 114 * s, 26, 'right', '#ffe27a');
    }
    // combo ring (top left)
    const cx = pad + 70 * s, cy = top + 66 * s, R = 52 * s;
    this.glass(pad, top - 6 * s, 140 * s, 210 * s);
    ctx.lineWidth = 10 * s; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    if (p.cTimer > 0) {
      const u = p.cTimer / g.comboT;
      const gr = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      gr.addColorStop(0, '#ff5ab4'); gr.addColorStop(0.5, '#ffd84a'); gr.addColorStop(1, '#4affc8');
      ctx.strokeStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); ctx.stroke();
      text(String(p.cFloors), cx, cy + 16 * s, 46, 'center');
    } else text('-', cx, cy + 14 * s, 40, 'center', 'rgba(255,255,255,0.5)');
    text('קומבו', cx, cy + R + 34 * s, 22, 'center', '#bfe6ff', 700);
    // speed: 5 pips + the time to the next speed-up
    const lv = Math.max(0, g.L), mx = g.maxL || 5;
    for (let i = 0; i < mx; i++) {
      ctx.fillStyle = i < lv ? `hsl(${120 - i * 120 / Math.max(1, mx - 1)},90%,58%)` : 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.roundRect(pad + 18 * s + i * (104 / mx) * s, top + 168 * s, (104 / mx - 4) * s, 14 * s, 4 * s); ctx.fill();
    }
    if (g.L >= 0 && g.L < mx) {
      const u = (g.timer % g.step) / g.step;
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(pad + 18 * s, top + 188 * s, 104 * s * u, 3 * s);
    }
    // middle top: level / stage / auto
    let label = g.st ? `שלב ${g.stageNo + 1}: ${g.st.name} · קומה ${Math.min(p.floor, g.st.goal)}/${g.st.goal}` : g.df ? 'רמה: ' + g.df.name : 'רמה: בינוני';
    if (o.auto) label += ' · משחק אוטומטי';
    text(label, W / 2, top + 26 * s, 24, 'center', '#e6f3ff', 700);
    if (o.autoHint) text(o.autoHint, W / 2, top + 58 * s, 20, 'center', 'rgba(230,243,255,0.8)', 500);
    // hurry up
    if (this.hurryT) {
      const t = 110 - this.hurryT, al = Math.min(1, t / 10, this.hurryT / 20);
      ctx.save(); ctx.globalAlpha = al;
      text('מהר יותר!', W / 2, H * 0.3, 70, 'center', '#ff6a4a'); ctx.restore();
    }
    // reward word
    if (g.reward && !g.cleared) {
      const t = g.reward.t + a, sc = t < 9 ? 0.4 + 0.6 * (t / 9) * (2 - t / 9) : 1, al = t > 68 ? Math.max(0, (80 - t) / 12) : 1;
      ctx.save(); ctx.globalAlpha = al; ctx.translate(W / 2, H * 0.42); ctx.scale(sc, sc); ctx.rotate(-0.06);
      ctx.font = font(900, 96 + g.reward.lvl * 6); ctx.textAlign = 'center'; ctx.direction = 'rtl';
      const word = REWARDS[g.reward.lvl];
      const gr = ctx.createLinearGradient(-300 * s, 0, 300 * s, 0);
      ['#ff4d6d', '#ffb84d', '#ffe94d', '#5cff8a', '#4dc3ff', '#b46bff'].forEach((c, i, arr) => gr.addColorStop(i / (arr.length - 1), c));
      ctx.lineJoin = 'round'; ctx.strokeStyle = '#140a2a'; ctx.lineWidth = 16 * s; ctx.strokeText(word, 0, 0);
      ctx.fillStyle = gr; ctx.fillText(word, 0, 0);
      ctx.restore();
    }
    // stage intro / cleared
    if (g.st) {
      const t = g.frame + a;
      if (t < 150 && !g.cleared) {
        const al = Math.min(1, (150 - t) / 30);
        ctx.save(); ctx.globalAlpha = al;
        text(`שלב ${g.stageNo + 1}`, W / 2, H * 0.36, 44, 'center', '#ffe27a');
        text(g.st.name, W / 2, H * 0.36 + 70 * s, 72, 'center');
        text(g.st.desc, W / 2, H * 0.36 + 120 * s, 30, 'center', '#e6f3ff', 700);
        ctx.restore();
      }
      if (g.cleared) {
        const sc = 1 + 0.05 * Math.sin((g.clearT + a) / 4);
        ctx.save(); ctx.translate(W / 2, H * 0.38); ctx.scale(sc, sc); text('שלב הושלם!', 0, 0, 90, 'center', '#7dffb0'); ctx.restore();
      }
    }
    if (p.dead) {
      const t = Math.min(1, (g.deadT + a) / 25);
      ctx.save(); ctx.globalAlpha = t; text('אוי!', W / 2, H * 0.4 - (1 - t) * 120 * s, 110, 'center', '#ff7a7a'); ctx.restore();
    }
  }
  glass(x, y, w, h) {
    const ctx = this.ctx, s = this.hs;
    ctx.save();
    ctx.fillStyle = 'rgba(10,18,40,0.42)'; ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 18 * s); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
