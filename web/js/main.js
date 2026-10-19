// Icy Tower: Super Mario Edition - HTML version. Boot, layout (mobile + desktop, up to 8K), screens, main loop.
import * as G from './gfx.js';
import * as S from './sound.js';
import * as I from './input.js';
import { Game } from './game.js';
import { STAGES, DIFFS, progress, markDone } from './stages.js';
import { makeBot } from './bot.js';
import { CHARS, getChar, setChar, prepare, drawPortrait, drawCard } from './chars.js';
import * as Ads from './ads.js';

const TICK = 20;                                       // 50 logic ticks per second, like the original
const $ = s => document.querySelector(s);
const canvas = $('#game');
G.attach(canvas);

// ------------------------------------------------------------------ settings & highscores
const DEF = { gfx: 'hd', res: 'auto', sound: true, music: true, rejump: false, touch: 'auto', name: '', diff: 1, char: 'mario', ads: false };
const cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem('icymario.cfg') || '{}'));
const saveCfg = () => localStorage.setItem('icymario.cfg', JSON.stringify(cfg));
const DEFAULT_SCORES = [
  { name: 'מריו', score: 3000, floor: 150, combo: 25 }, { name: "לואיג'י", score: 2000, floor: 100, combo: 15 },
  { name: "פיץ'", score: 1000, floor: 60, combo: 10 }, { name: 'טואד', score: 500, floor: 35, combo: 7 },
  { name: 'יושי', score: 250, floor: 20, combo: 4 }];
// desktop app (IcyMario.exe = this version inside WebView2, tools/desktop): exit item, no service worker
const APP = !!(window.chrome && window.chrome.webview);
const toHost = m => { if (APP) window.chrome.webview.postMessage(m); };
if (APP) addEventListener('keydown', e => {           // the app window: F11 / Alt+Enter = full screen <-> window
  if (e.code === 'F11' || (e.altKey && e.code === 'Enter')) { e.preventDefault(); toHost('fullscreen'); }
}, { capture: true });
// a highscore table per difficulty (`בינוני` keeps the original key)
const diff = () => DIFFS[cfg.diff] || DIFFS[1];
const scoreKey = () => diff().original ? 'icymario.scores' : 'icymario.scores.' + diff().id;
let scores;
const loadScores = () => { scores = JSON.parse(localStorage.getItem(scoreKey()) || 'null') || (diff().original ? DEFAULT_SCORES : []); };
loadScores();
const saveScores = () => localStorage.setItem(scoreKey(), JSON.stringify(scores));
const qualifies = sc => sc > 0 && (scores.length < 5 || sc > scores[scores.length - 1].score);

S.init(cfg);
G.setMode(cfg.gfx);
setChar(cfg.char);

// ------------------------------------------------------------------ control mode
// phone/tablet: asks at every start "buttons" (buttons under the picture) or "touch" (full screen top to bottom,
// no buttons: hold a side to run, swipe up / second finger to jump). Computer: unchanged ('desktop').
// (some phones also report a "fine" pointer, so: primary pointer coarse + a touch screen)
const PHONE = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
let mode = PHONE ? 'buttons' : 'desktop';
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const canFull = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const standalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
function enterFull() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || isFull()) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* not allowed here */ }
}
function setMode(m) {
  mode = m;
  if (PHONE) { cfg.phoneMode = m; saveCfg(); }
  I.setGestures(m === 'touch');
  document.body.classList.toggle('gest', m === 'touch');
  if (m === 'touch') enterFull();
  else if (isFull() && PHONE) (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  resize();
}
// in touch mode a lost full screen (back button / swipe) comes back with the next tap
addEventListener('pointerdown', () => { if (mode === 'touch' && !isFull()) enterFull(); }, { capture: true });

// ------------------------------------------------------------------ layout
let rect = { x: 0, y: 0, w: 640, h: 480 };
function touchUI() {
  if (mode === 'buttons') return true;
  if (mode === 'touch') return false;
  if (cfg.touch === 'on') return true;
  if (cfg.touch === 'off') return false;
  return matchMedia('(pointer: coarse)').matches;
}
function resize() {
  const vw = innerWidth, VH = innerHeight, dpr = devicePixelRatio || 1;
  // ads mode: a banner above and one below the game; the game gets the rest of the screen
  const adH = cfg.ads ? Math.round(Math.max(46, Math.min(110, VH * 0.085))) : 0;
  document.documentElement.style.setProperty('--adH', adH + 'px');
  const vh = VH - 2 * adH;
  const touch = touchUI();
  document.body.classList.toggle('touch', touch);
  const portrait = vh > vw;
  document.body.classList.toggle('portrait', portrait);
  let w, h, x, y;
  if (portrait && touch) {
    const top = adH ? 0 : parseFloat(getComputedStyle($('#safe')).paddingTop) || 0;   // (the top ad covers the notch)
    const pad = Math.max(190, Math.min(vh * 0.36, 320));       // room for the buttons under the picture
    w = Math.min(vw, (vh - pad - top) * 4 / 3); h = w * 3 / 4;
    x = (vw - w) / 2; y = adH + top;
  } else {
    w = Math.min(vw, vh * 4 / 3); h = w * 3 / 4;
    x = (vw - w) / 2; y = adH + (vh - h) / 2;
  }
  rect = { x, y, w, h };
  // full-touch mode: the canvas is the whole screen (between the ads); otherwise just the picture
  const c = mode === 'touch' ? { x: 0, y: adH, w: vw, h: vh } : rect;
  Object.assign(canvas.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' });
  // render resolution: the screen's own pixels, or supersampled 4K / 8K
  let k = dpr;
  if (cfg.res === '4k') k = Math.max(dpr, 2160 / h);
  if (cfg.res === '8k') k = Math.max(dpr, 4320 / h);
  k = Math.min(k, 7680 / c.w, 7680 / c.h);
  canvas.width = Math.round(c.w * k); canvas.height = Math.round(c.h * k);
  view = { c, k, vh, top: adH };
  layoutView();
  document.documentElement.style.setProperty('--gameBottom', (y + h) + 'px');
  document.documentElement.style.setProperty('--gameH', h + 'px');
}
// Full touch, phone held upright: the 640x480 picture spans the screen width; in game it sits at the bottom and
// the space above shows more of the tower (Game.setAhead), in the menus it is centred. Landscape: the walls fill
// the sides. Called on every screen change.
let view = null;
function upright() { return mode === 'touch' && view && view.vh > rect.h + 1; }
function aheadPx() { return upright() ? (view.vh - rect.h) * 640 / rect.w : 0; }
function layoutView() {
  if (!view) return;
  if (upright()) rect.y = view.top + (screen === Play || screen === Pause || screen === GameOver || screen === Levels ? view.vh - rect.h : (view.vh - rect.h) / 2);
  G.layout({ x: rect.x - view.c.x, y: rect.y - view.c.y, w: rect.w }, view.k);
  if (Play.game) Play.game.setAhead(aheadPx());
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));

function toLogical(cx, cy) {
  const x = (cx - rect.x) / rect.w * 640, y = (cy - rect.y) / rect.h * 480;
  const v = G.view();                                // whole canvas (bigger than 640x480 in full-touch mode)
  return x >= v.x && y >= v.y && x < v.x + v.w && y < v.y + v.h ? { x, y } : null;
}

// ------------------------------------------------------------------ assets
async function loadAll() {
  const meta = await (await fetch('assets/assets.json')).json();
  const names = Object.keys(meta.img).concat(Object.keys(meta.font));
  const images = { '1x': {}, hd: {} };
  const bar = $('#loadBar');
  let done = 0;
  const total = names.length;
  const one = (set, n, count) => new Promise(ok => {
    const im = new Image();
    im.onload = () => { images[set][n] = im; if (count) { done++; bar.style.width = (done / total * 80) + '%'; } ok(); };
    im.onerror = () => { if (count) done++; ok(); };
    im.src = `assets/${set}/${n}.${set === 'hd' ? 'webp' : 'png'}`;
  });
  // the set for the current graphics mode first; the other one quietly afterwards (needed only on a switch)
  const first = cfg.gfx === 'hd' ? 'hd' : '1x', second = first === 'hd' ? '1x' : 'hd';
  await Promise.all(names.map(n => one(first, n, true)));
  G.setAssets(meta, images);
  Promise.all(names.map(n => one(second, n, false))).then(() => G.setAssets(meta, images));
  const snd = meta.sfx.map(n => [n, `assets/sfx/${n}.mp3`]).concat(meta.char.map(n => ['C_' + n, `assets/sfx/C_${n}.mp3`]));
  if (meta.music) snd.push(['MUSIC', 'assets/sfx/MUSIC.wav']);
  let sd = 0;
  await Promise.all(snd.map(([n, u]) => S.load(n, u).then(() => { sd++; bar.style.width = (80 + sd / snd.length * 20) + '%'; })));
  return meta;
}

// ------------------------------------------------------------------ screens
// full-screen phone: backgrounds continue (mirrored) into the side areas, overlays dim the whole screen
function wideBg(name) {
  const v = G.view();
  for (let gy = Math.floor(v.y / 480); gy * 480 < v.y + v.h; gy++) {
    for (let gx = Math.floor(v.x / 640); gx * 640 < v.x + v.w; gx++) {
      const fx = gx & 1, fy = gy & 1;
      G.img(name, gx * 640, gy * 480, fx || fy ? { flip: !!fx, flipY: !!fy } : undefined);
    }
  }
}
const dim = (color, alpha) => { const v = G.view(); G.rect(v.x, v.y, v.w, v.h, color, alpha); };
let screen = null;
const go = s => { screen = s; document.body.classList.toggle('playing', s === Play); layoutView(); s.enter && s.enter(); };

const SCROLLER = ['ברוכים הבאים לאייסי טאוור!', "עוד משחק מבית פרי לאנץ' דיזיין.",
  'עזרו לסופר מריו לטפס הכי גבוה שאפשר!', 'זזים עם החצים וקופצים עם מקש הרווח.', 'בטלפון: כפתורי החצים והקפיצה בתחתית המסך.',
  "חדש: לואיג'י, סטיב, הקריפר, העז ועוד - במסך הדמויות!", 'אין כוח לשחק? נסו את המשחק האוטומטי.', 'בהצלחה!'];

// shared menu list (FONT1 rainbow items with the Mario bullet, like the original menus)
function menuList(items, x, y0, step) {
  return {
    items, sel: 0, x, y0, step,
    handle(p, taps) {
      if (p.has('up')) { this.sel = (this.sel + this.items.length - 1) % this.items.length; S.play('S_MENU_CHANGE'); }
      if (p.has('down')) { this.sel = (this.sel + 1) % this.items.length; S.play('S_MENU_CHANGE'); }
      for (const t of taps) {
        const i = Math.floor((t.y - this.y0 + 4) / this.step);
        if (i >= 0 && i < this.items.length && t.y >= this.y0 - 4) {
          this.sel = i; S.play('S_MENU_CHOOSE'); return { pick: i, tap: true, tx: t.x };
        }
      }
      if (p.has('ok')) { S.play('S_MENU_CHOOSE'); return { pick: this.sel }; }
      if (p.has('left')) return { side: -1 };
      if (p.has('right')) return { side: 1 };
      return null;
    },
    draw(t, labels) {
      (labels || this.items).forEach((s, i) => G.text('FONT1', s, this.x, this.y0 + i * this.step));
      const by = this.y0 + this.sel * this.step - 8 + Math.sin(t / 6) * 1.5;
      G.img('MENU_BULLET', this.x - 36, by);
    },
  };
}

// highscore table, laid out like the original title screen (positions measured on the real game)
function drawScoreTable() {
  G.text('FONT2', diff().original ? 'שיאים' : 'שיאים - ' + diff().name, 470, 239, 'center');
  G.smallText('ניקוד', 618, 262, 'right');
  G.smallText('קומבו', 540, 262, 'right');
  G.smallText('קומה', 458, 262, 'right');
  G.smallText('שם', 382, 262, 'right');
  scores.slice(0, 5).forEach((s, i) => {
    const y = 275 + i * 22;
    G.text('FONT2', String(s.score), 626, y, 'right');
    G.text('FONT2', String(s.combo), 540, y, 'right');
    G.text('FONT2', String(s.floor), 466, y, 'right');
    G.text('FONT2', s.name, 418, y, 'right');
  });
}

const Menu = {
  t: 0, scroll: 0,
  labels() { return ['התחל משחק', 'שלבים', 'דמויות', 'משחק אוטומטי', 'פרסומות: ' + (cfg.ads ? 'פועל' : 'כבוי'), 'הוראות', 'אפשרויות', APP ? 'יציאה' : isFull() ? 'יציאה ממסך מלא' : 'מסך מלא']; },
  enter() { this.list = menuList(this.labels(), 40, 232, 25); this.list.sel = this.sel || 0; },
  update(p, taps) {
    this.t++;
    this.scroll += 2;
    const r = this.list.handle(p, taps);
    this.sel = this.list.sel;
    if (r && r.pick !== undefined) {
      if (r.pick === 0) { Levels.auto = false; go(Levels); }
      if (r.pick === 1) go(Stages);
      if (r.pick === 2) go(Chars);
      if (r.pick === 3) { Levels.auto = true; go(Levels); }
      if (r.pick === 4) { cfg.ads = !cfg.ads; saveCfg(); Ads.setOn(cfg.ads); resize(); }   // ads mode, right here
      if (r.pick === 5) go(Instructions);
      if (r.pick === 6) go(Options);
      if (r.pick === 7) { if (APP) toHost('exit'); else toggleFullscreen(); }
    }
  },
  draw(a) {
    wideBg('TITLE_BG');
    // the hero's face: blinks and looks around (Mario: HEROFACE000-002; the others: chars.js)
    drawPortrait(getChar(), this.t, 40, 19);
    G.img('TITLE', 250, 20);
    G.smallText('גרסה 1.3.1', 634, 6, 'right');
    this.list.draw(this.t + a, this.labels());
    drawScoreTable();
    // bottom band with the scroller
    const m = G.getMargin(), v = G.view();
    const by = Math.max(450, v.y + v.h - 30);         // phone held upright: the band sits at the bottom edge
    G.rect(-m, by, 640 + 2 * m, 6, '#101014');
    G.rect(-m, by + 6, 640 + 2 * m, Math.max(24, v.y + v.h - by - 6), '#1c104d');
    if (!this.scrollW) this.scrollW = SCROLLER.reduce((w, s) => w + G.textWidth('FONT2', s) + 60, 0) + 640 + 2 * m;
    const x = 640 + m - ((this.scroll + 2 * a) % this.scrollW);
    const ctx = G.context();
    ctx.save(); ctx.beginPath(); ctx.rect(-m, by, 640 + 2 * m, 30); ctx.clip();
    let xx = x;
    for (const s of SCROLLER) xx += G.text('FONT2', s, xx, by - 1) + 60;
    ctx.restore();
  },
};

const Instructions = {
  update(p, taps) { if (p.has('any') || p.has('back') || taps.length) { S.play('S_MENU_CHOOSE'); go(Menu); } },
  draw() { if (G.getMargin() || G.view().h > 481) wideBg('TITLE_BG'); G.img('INSTRUCTIONS', 0, 0); },
};

// difficulty select (before a classic game): קל / בינוני (the original) / קשה / אקסטרים / בלתי אפשרי.
// Behind the list Mario plays a live preview of the selected level, with that level's map and look.
// Tap a level to see it, tap it again (or "התחל!") to play; keyboard: up/down + Enter.
const Levels = {
  STEP: 42, Y0: 90,
  enter() { this.sel = cfg.diff ?? 1; this.t = 0; this.preview(this.sel); },
  preview(i) {
    if (i >= DIFFS.length || (this.pv && this.pv.i === i)) return;
    const g = new Game({ seed: 4242 + i, diff: DIFFS[i], ahead: aheadPx(), silent: true });
    g.noHud = true;
    const bot = makeBot();
    for (let k = 0; k < 120; k++) g.tick(bot(g));    // skip the slow start
    g.prev.x = g.p.x; g.prev.y = g.p.y; g.prev.S = g.S;
    this.pv = { i, g, bot };
  },
  pick(i) {
    if (i === DIFFS.length + 1) { S.play('S_MENU_CHOOSE'); go(Menu); return; }
    const d = i === DIFFS.length ? this.sel : i;
    S.play('S_MENU_CHOOSE');
    cfg.diff = d; saveCfg(); loadScores();
    go(Play.start(undefined, -1, this.auto));
  },
  move(n) { this.sel = n; S.play('S_MENU_CHANGE'); this.preview(n); },
  update(p, taps) {
    this.t++;
    const n = DIFFS.length + 2;
    if (p.has('up')) this.move((this.sel + n - 1) % n);
    if (p.has('down')) this.move((this.sel + 1) % n);
    if (p.has('back')) { go(Menu); return; }
    for (const t of taps) {
      const i = Math.floor((t.y - this.Y0 + 4) / this.STEP);
      if (i < 0 || i >= n || t.x < 300) continue;
      if (i < DIFFS.length && i !== this.sel) { this.move(i); return; }   // first tap: show that level
      this.pick(i); return;
    }
    if (p.has('ok')) this.pick(this.sel);
    // the preview plays on (and starts again when Mario falls)
    const pv = this.pv;
    if (pv) { pv.g.tick(pv.bot(pv.g)); if (pv.g.p.dead || pv.g.ended) { this.pv = null; this.preview(pv.i); } }
  },
  draw(a) {
    const v = G.view();
    if (this.pv) this.pv.g.draw(a); else wideBg('TITLE_BG');
    const ctx = G.context();
    // title band
    G.rect(v.x, v.y, v.w, 44, '#000', 0.55);
    G.text('FONT1', this.auto ? 'משחק אוטומטי: בחרו רמה' : 'בחרו רמה', 320, v.y + 2, 'center');
    // the list, on a dark glass panel on the right
    this.Y0 = Math.round(v.y + v.h / 2 - 150);
    const n = DIFFS.length + 2;
    ctx.save();
    ctx.fillStyle = 'rgba(10,4,16,0.72)'; ctx.strokeStyle = '#120818'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(302, this.Y0 - 14, 330, n * this.STEP + 18, 14); ctx.fill(); ctx.stroke();
    if (this.sel < n) {                                    // highlighted row
      ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(255,212,0,0.12)';
      ctx.beginPath(); ctx.roundRect(308, this.Y0 + this.sel * this.STEP - 6, 318, this.STEP - 2, 9); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    DIFFS.forEach((d, i) => {
      const y = this.Y0 + i * this.STEP;
      G.text('FONT1', d.name, 616, y - 8, 'right');
      for (let k = 0; k <= i; k++) G.img('STAR0' + (1 + (k + (this.t >> 3)) % 8), 316 + k * 13, y + 8);   // 1-5 stars
    });
    G.text('FONT1', 'התחל!', 616, this.Y0 + DIFFS.length * this.STEP - 8, 'right');
    G.text('FONT2', 'חזרה', 616, this.Y0 + (DIFFS.length + 1) * this.STEP - 2, 'right');
    // what the selected level is like
    const d = DIFFS[this.sel < DIFFS.length ? this.sel : cfg.diff ?? 1] || DIFFS[1];
    G.rect(v.x, v.y + v.h - 40, v.w, 40, '#000', 0.6);
    G.smallText(d.name + ': ' + d.desc, 320, v.y + v.h - 28, 'center');
  },
};

// character select: Mario's family (recoloured sprites) + guests from Minecraft, Goat Simulator, Among Us, Pac-Man.
// 5 x 2 cards, right to left (Hebrew order); arrows + Enter, or tap a card (tap again = choose)
const Chars = {
  COLS: 5, W: 118, H: 150, X0: 616, Y0: 72,
  enter() { this.sel = Math.max(0, CHARS.indexOf(getChar())); this.t = 0; prepare(CHARS[this.sel]); },
  cell(i) { return { x: this.X0 - (i % this.COLS + 1) * this.W, y: this.Y0 + Math.floor(i / this.COLS) * (this.H + 10) }; },
  move(i) { this.sel = i; S.play('S_MENU_CHANGE'); if (i < CHARS.length) prepare(CHARS[i]); },
  pick(i) {
    S.play('S_MENU_CHOOSE');
    if (i < CHARS.length) { setChar(CHARS[i].id); cfg.char = CHARS[i].id; saveCfg(); }
    go(Menu);
  },
  update(p, taps) {
    this.t++;
    const n = CHARS.length, back = n;                  // "חזרה" = index n
    if (p.has('back')) { go(Menu); return; }
    if (p.has('left')) this.move(this.sel === back ? n - 1 : (this.sel + 1) % n);   // right to left
    if (p.has('right')) this.move(this.sel === back ? 0 : (this.sel + n - 1) % n);
    if (p.has('down')) this.move(this.sel === back ? this.sel % this.COLS : this.sel + this.COLS < n ? this.sel + this.COLS : back);
    if (p.has('up')) this.move(this.sel === back ? n - this.COLS : this.sel >= this.COLS ? this.sel - this.COLS : back);
    for (const t of taps) {
      for (let i = 0; i < n; i++) {
        const c = this.cell(i);
        if (t.x >= c.x && t.x < c.x + this.W - 6 && t.y >= c.y && t.y < c.y + this.H) {
          if (i === this.sel) this.pick(i); else this.move(i);
          return;
        }
      }
      if (t.y > 400) { this.pick(back); return; }
    }
    if (p.has('ok')) this.pick(this.sel);
  },
  draw(a) {
    wideBg('TITLE_BG');
    const ctx = G.context();
    G.rect(G.view().x, 0, G.view().w, 60, '#000', 0.45);
    G.text('FONT1', 'בחרו דמות', 320, 8, 'center');
    const t = this.t + a;
    CHARS.forEach((ch, i) => {
      const c = this.cell(i), on = i === this.sel;
      ctx.save();
      ctx.fillStyle = on ? 'rgba(255,212,0,0.2)' : 'rgba(10,4,16,0.66)';
      ctx.strokeStyle = on ? '#ffd400' : '#120818'; ctx.lineWidth = on ? 3 : 2.5;
      ctx.beginPath(); ctx.roundRect(c.x + 3, c.y, this.W - 6, this.H, 12); ctx.fill(); ctx.stroke();
      ctx.restore();
      drawCard(ch, on ? t : t + i * 37, c.x + this.W / 2, c.y + 104, on ? 1.55 : 1.35, on);
      G.smallText(ch.name, c.x + this.W / 2, c.y + 112, 'center');
      G.smallText(ch.game, c.x + this.W / 2, c.y + 130, 'center');
    });
    const ch = CHARS[this.sel];
    G.text('FONT2', ch ? `${ch.name}: ${ch.desc}` : '', 320, 404, 'center');
    G.text('FONT2', 'חזרה', 320, 438, 'center', { alpha: this.sel === CHARS.length ? 1 : 0.7 });
    if (this.sel === CHARS.length) { const w = G.textWidth('FONT2', 'חזרה'); G.img('MENU_BULLET', 320 + w / 2 + 6, 430, { flip: true, scale: 0.6, cx: 336 + w / 2, cy: 456 }); }
  },
};

// stage select: 10 stages, each opens when the one before is done (progress in localStorage)
const Stages = {
  Y0: 90, STEP: 33,
  enter() { const pr = progress(); this.pr = pr; this.sel = Math.min(this.sel ?? pr.open - 1, STAGES.length); this.t = 0; },
  pick(i) {
    if (i === STAGES.length) { S.play('S_MENU_CHOOSE'); go(Menu); return; }
    if (i < this.pr.open) { S.play('S_MENU_CHOOSE'); go(Play.start(undefined, i)); }
    else S.play('S_MENU_CHANGE');                     // locked
  },
  update(p, taps) {
    this.t++;
    const n = STAGES.length + 1;
    if (p.has('up')) { this.sel = (this.sel + n - 1) % n; S.play('S_MENU_CHANGE'); }
    if (p.has('down')) { this.sel = (this.sel + 1) % n; S.play('S_MENU_CHANGE'); }
    if (p.has('back')) { go(Menu); return; }
    if (p.has('left') || p.has('right')) { cfg.diff = (cfg.diff + (p.has('left') ? -1 : 1) + DIFFS.length) % DIFFS.length; saveCfg(); loadScores(); S.play('S_MENU_CHANGE'); }
    for (const t of taps) {
      if (t.y >= 58 && t.y < 80) { cfg.diff = (cfg.diff + 1) % DIFFS.length; saveCfg(); loadScores(); S.play('S_MENU_CHANGE'); return; }
      const i = Math.floor((t.y - this.Y0 + 4) / this.STEP);
      if (i >= 0 && i < n && t.x > 110 && t.x < 530) { this.sel = i; this.pick(i); return; }
    }
    if (p.has('ok')) this.pick(this.sel);
  },
  draw(a) {
    wideBg('TITLE_BG');
    G.img('REPLAY_BG', 103, 25);
    G.text('FONT1', 'שלבים', 320, 30, 'center');
    G.smallText(`הושלמו ${this.pr.done.length} מתוך ${STAGES.length}   ·   רמה: ${diff().name} (הקישו לשינוי)`, 320, 66, 'center');
    const ctx = G.context();
    STAGES.forEach((st, i) => {
      const y = this.Y0 + i * this.STEP;
      const open = i < this.pr.open, done = this.pr.done.includes(i);
      ctx.globalAlpha = open ? 1 : 0.38;
      G.text('FONT2', `${i + 1}. ${st.name}`, 492, y, 'right');
      G.smallText(open ? `קומה ${st.goal}` : 'נעול', 196, y + 5, 'right');
      if (done) G.img('STAR0' + (1 + ((this.t >> 3) + i) % 8), 128, y + 7);
      if (done && st.coins && this.pr.coins[i]) G.smallText(`${this.pr.coins[i]} מטבעות`, 270, y + 5, 'right');
      ctx.globalAlpha = 1;
    });
    G.text('FONT2', 'חזרה', 492, this.Y0 + STAGES.length * this.STEP, 'right');
    const by = this.Y0 + this.sel * this.STEP - 6 + Math.sin(this.t / 6) * 1.5;
    G.img('MENU_BULLET', 498, by, { flip: true, scale: 0.62, cx: 516, cy: by + 26 });
  },
};

const yesNo = v => v ? 'כן' : 'לא';
// the graphics card that draws the game (WebGL renderer string, e.g. "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 ...)")
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl', { powerPreference: 'high-performance' });
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    let s = String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const m = s.match(/^ANGLE \([^,]*, ([^,]+?)(?: \(0x[0-9a-f]+\))?(?: Direct3D.*)?,/i);
    if (m) s = m[1];
    return s.replace(/\s+/g, ' ').trim().slice(0, 48);
  } catch (e) { return ''; }
}
const Options = {
  Y: 92, STEP: 34,
  // desktop app (icytower13.exe): one more item, the original 2003 engine (icytower13_classic.exe)
  get BACK() { return APP ? 9 : 8; },
  enter() { this.STEP = APP ? 31 : 34; this.list = menuList(Array(this.BACK + 1).fill(''), 140, this.Y + 4, this.STEP); this.gpu = this.gpu ?? gpuName(); },
  labels() {
    return [
      'גרפיקה: ' + (cfg.gfx === 'hd' ? 'חדה (HD)' : 'פיקסלים'),
      'רזולוציה: ' + ({ auto: 'של המסך', '4k': '4K', '8k': '8K' })[cfg.res],
      'צלילים: ' + yesNo(cfg.sound),
      'מוזיקה: ' + (S.hasMusic() ? yesNo(cfg.music) : 'אין'),
      'קפיצה חוזרת: ' + yesNo(cfg.rejump),
      PHONE ? 'שליטה: ' + (mode === 'touch' ? 'מגע מלא' : 'כפתורים')
        : 'כפתורי מגע: ' + ({ auto: 'אוטומטי', on: 'כן', off: 'לא' })[cfg.touch],
      'דמות: ' + getChar().name,
      'מצב פרסומות: ' + yesNo(cfg.ads),
      ...(APP ? ['המשחק המקורי (קלאסי)'] : []),
      'חזרה',
    ];
  },
  change(i, dir) {
    if (i === 0) { cfg.gfx = cfg.gfx === 'hd' ? 'classic' : 'hd'; G.setMode(cfg.gfx); }
    if (i === 1) { const o = ['auto', '4k', '8k']; cfg.res = o[(o.indexOf(cfg.res) + (dir || 1) + 3) % 3]; resize(); }
    if (i === 2) cfg.sound = !cfg.sound;
    if (i === 3) { cfg.music = !cfg.music; S.refresh(); }
    if (i === 4) cfg.rejump = !cfg.rejump;
    if (i === 5 && PHONE) setMode(mode === 'touch' ? 'buttons' : 'touch');
    else if (i === 5) { const o = ['auto', 'on', 'off']; cfg.touch = o[(o.indexOf(cfg.touch) + (dir || 1) + 3) % 3]; resize(); }
    if (i === 6) { const n = CHARS.length, c = CHARS[(CHARS.indexOf(getChar()) + (dir || 1) + n) % n]; setChar(c.id); prepare(c); cfg.char = c.id; }
    if (i === 7) { cfg.ads = !cfg.ads; Ads.setOn(cfg.ads); resize(); }
    saveCfg();
  },
  update(p, taps) {
    const r = this.list.handle(p, taps);
    if (p.has('back')) { go(Menu); return; }
    if (!r) return;
    const i = r.pick !== undefined ? r.pick : this.list.sel;
    if (i === this.BACK) { if (r.pick !== undefined) go(Menu); return; }
    if (APP && i === 8) { if (r.pick !== undefined) toHost('classic'); return; }
    this.change(i, r.side || 1);
  },
  draw(a) {
    wideBg('TITLE_BG');
    G.img('REPLAY_BG', 103, 18);
    G.text('FONT1', 'אפשרויות', 320, 36, 'center');
    const L = this.labels();
    L.forEach((s, i) => G.text('FONT2', s, 150, this.Y + i * this.STEP + 4));
    const by = this.Y + this.list.sel * this.STEP - 14 + Math.sin(performance.now() / 120) * 1.5;
    G.img('MENU_BULLET', 112, by);
    if (this.gpu) G.smallText('כרטיס מסך: ' + this.gpu, 320, 412, 'center');
  },
};

const Play = {
  game: null,
  stage: -1,                                         // -1 = classic game, else index into STAGES
  start(seed, stage = -1, auto = false) {
    this.stage = stage;
    this.game = new Game({ rejump: cfg.rejump, seed, ahead: aheadPx(), stage: STAGES[stage], stageNo: stage, diff: diff() });
    this.setAuto(auto);
    return this;
  },
  again() { return this.start(undefined, this.stage, !!this.auto); },
  // auto play (menu "משחק אוטומטי", or switched on in the pause menu): the demo player (bot.js) plays;
  // any key / touch after the keys were let go gives the control back to the player
  setAuto(on) {
    this.auto = on ? makeBot() : null; this.armed = false; this.handT = 0;
    if (on) this.game.autoUsed = true;
  },
  enter() { S.music(true); },
  update(p) {
    if (p.has('pause') || p.has('back')) { go(Pause); return; }
    let inp = I.state();
    if (this.auto) {
      const any = inp.left || inp.right || inp.jump;
      if (!any) this.armed = true;
      else if (this.armed && this.game.frame > 25) { this.auto = null; this.handT = 120; S.play('S_MENU_CHOOSE'); }
    }
    if (this.handT) this.handT--;
    if (window.__icyBot) inp = window.__icyBot(this.game);   // __icyBot: demo / video recording
    else if (this.auto) inp = this.auto(this.game);
    this.game.tick(inp);
    if (this.game.ended) go(GameOver.from(this.game));
  },
  draw(a) {
    this.game.draw(a);
    const T = -aheadPx();
    if (this.auto) G.smallText(PHONE ? 'משחק אוטומטי - הקישו כדי לשחק בעצמכם' : 'משחק אוטומטי - לחצו על מקש כדי לשחק בעצמכם', 320, T + (this.stage >= 0 ? 40 : 24), 'center');
    else if (this.handT) G.text('FONT2', 'השליטה אצלכם!', 320, T + 150, 'center', { alpha: Math.min(1, this.handT / 30) });
    // full-touch mode: how to play, for the first seconds of every game
    const t = this.game.frame + a - (this.stage >= 0 ? 150 : 0);   // stages: after the stage intro card
    if (mode === 'touch' && t > 0 && t < 260) {
      const al = Math.min(1, (260 - t) / 40, t / 20) * 0.9;
      const v = G.view(), my = v.y + v.h / 2;
      G.rect(v.x, v.y, 320 - v.x - 2, v.h, '#000', 0.22 * al);
      G.rect(322, v.y, v.x + v.w - 322, v.h, '#fff', 0.06 * al);
      G.text('FONT1', '<', 150, my - 60, 'center', { alpha: al, visual: true });
      G.text('FONT1', '>', 490, my - 60, 'center', { alpha: al, visual: true });
      G.text('FONT2', 'החזיקו כאן', 160, my - 10, 'center', { alpha: al });
      G.text('FONT2', 'החזיקו כאן', 480, my - 10, 'center', { alpha: al });
      G.text('FONT2', 'החלקה למעלה או אצבע שנייה: קפיצה', 320, my + 60, 'center', { alpha: al });
    }
  },
};

const Pause = {
  labels() { return ['המשך', 'התחל מחדש', 'משחק אוטומטי: ' + (Play.auto ? 'פועל' : 'כבוי'), Play.stage >= 0 ? 'שלבים' : 'תפריט ראשי']; },
  enter() { this.dy = Math.round(-aheadPx() / 2); this.list = menuList(this.labels(), 215, 196 + this.dy, 40); S.play('C_pause'); },
  update(p, taps) {
    if (p.has('pause') || p.has('back')) { go(Play); return; }
    const r = this.list.handle(p, taps);
    if (r && r.pick === 0) go(Play);
    if (r && r.pick === 1) go(Play.again());
    if (r && r.pick === 2) { Play.setAuto(!Play.auto); this.list.items = this.labels(); if (Play.auto) go(Play); }
    if (r && r.pick === 3) go(Play.stage >= 0 ? Stages : Menu);
  },
  draw(a) {
    Play.game.draw(0);
    dim('#000', 0.45);
    const ctx = G.context();
    ctx.save(); ctx.translate(0, this.dy || 0);       // phone held upright: the panel in the middle of the screen
    G.img('REPLAY_BG', 103, 25);
    G.text('FONT1', 'המשחק מושהה', 320, 90, 'center');
    G.text('FONT2', PHONE ? 'הקישו על בחירה' : 'Esc: חזרה למשחק', 320, 140, 'center');
    ctx.restore();
    this.list.draw(performance.now() / 50);
  },
};

const nameInput = $('#nameInput');
const GameOver = {
  from(game) {
    this.game = game; this.score = game.score; this.floor = game.p.floor; this.combo = game.p.best;
    this.stage = Play.stage;                          // stage mode: no highscore entry
    this.cleared = game.cleared;
    this.allDone = false;
    if (this.stage >= 0 && this.cleared) {
      markDone(this.stage, game.coins);
      this.allDone = this.stage === STAGES.length - 1 || progress().done.length === STAGES.length;
    }
    this.auto = !!game.autoUsed;                      // the computer played: no highscore
    this.entering = this.stage < 0 && !this.auto && qualifies(this.score);
    this.name = cfg.name || '';
    this.t = 0;
    return this;
  },
  items() {
    if (this.stage < 0) return ['שחק שוב', 'תפריט ראשי'];
    if (this.cleared && this.stage < STAGES.length - 1) return ['השלב הבא', 'שלבים', 'תפריט ראשי'];
    return [this.cleared ? 'שחק שוב' : 'נסה שוב', 'שלבים', 'תפריט ראשי'];
  },
  enter() {
    this.dy = Math.round(-aheadPx() / 2);
    const it = this.items();
    this.list = menuList(it, 230, (it.length > 2 ? 300 : 330) + this.dy, 42);
    if (this.allDone) setTimeout(() => S.play('V_ALL'), 400);   // "מאמא מיה! סיימת את כל השלבים!"
    if (this.entering) {
      nameInput.value = this.name;
      nameInput.hidden = false;
      setTimeout(() => nameInput.focus(), 50);
      S.play('S_CHEER', 0.7);
    }
  },
  save() {
    this.name = (nameInput.value || '').trim().slice(0, 10) || 'מריו';
    cfg.name = this.name; saveCfg();
    scores.push({ name: this.name, score: this.score, floor: this.floor, combo: this.combo });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 5); saveScores();
    this.entering = false;
    nameInput.blur(); nameInput.hidden = true;
  },
  update(p, taps) {
    this.t++;
    if (this.entering) {
      this.name = nameInput.value;
      if (p.has('enter') || taps.length && this.t > 20) this.save();
      return;
    }
    const r = this.list.handle(p, taps);
    if (!r || r.pick === undefined) return;
    if (this.stage < 0) { go(r.pick === 0 ? Play.start(undefined, -1, !!Play.auto || (this.auto && Levels.auto)) : Menu); return; }
    if (r.pick === 0) go(this.cleared && this.stage < STAGES.length - 1 ? Play.start(undefined, this.stage + 1) : Play.again());
    if (r.pick === 1) go(Stages);
    if (r.pick === 2) go(Menu);
  },
  draw(a) {
    this.game.draw(0);
    dim('#000', 0.35);
    const ctx = G.context();
    ctx.save(); ctx.translate(0, this.dy || 0);       // phone held upright: the panel in the middle of the screen
    G.img('REPLAY_BG', 103, 25);
    if (this.entering) {
      const [hw] = G.size('HIGHSCORE');
      G.img('HIGHSCORE', 320 - hw / 2, 50);
      G.text('FONT2', 'הקלידו את ראשי התיבות', 320, 165, 'center');
      const blink = (this.t >> 4) & 1 ? '_' : ' ';
      G.text('FONT1', this.name + blink, 320, 215, 'center', {});
      G.text('FONT2', 'ניקוד: ' + this.score, 320, 290, 'center');
      G.smallText(PHONE ? 'הקישו לשמירה' : 'אנטר או לחיצה לשמירה', 320, 340, 'center');
      ctx.restore();
      return;
    }
    if (this.stage >= 0) {
      const st = STAGES[this.stage];
      G.text('FONT1', this.allDone && this.cleared ? 'סיימת הכל!' : this.cleared ? 'שלב הושלם!' : 'אוי, נפלת!', 320, 50, 'center');
      G.text('FONT2', `שלב ${this.stage + 1}: ${st.name}`, 320, 115, 'center');
      G.text('FONT2', `קומה: ${Math.min(this.floor, st.goal)} מתוך ${st.goal}`, 320, 150, 'center');
      G.text('FONT2', st.coins ? `מטבעות: ${this.game.coins}   ניקוד: ${this.score}` : `ניקוד: ${this.score}`, 320, 185, 'center');
      if (this.allDone && this.cleared) G.text('FONT2', 'מאמא מיה! כל 10 השלבים!', 320, 225, 'center');
      ctx.restore();
      this.list.draw(this.t + a);
      return;
    }
    G.text('FONT1', 'המשחק נגמר', 320, 60, 'center');
    G.smallText('רמה: ' + diff().name + (this.auto ? '   ·   משחק אוטומטי (בלי שיאים)' : ''), 320, 108, 'center');
    G.text('FONT2', 'ניקוד: ' + this.score, 320, 140, 'center');
    G.text('FONT2', 'קומה: ' + this.floor, 320, 180, 'center');
    G.text('FONT2', 'הקומבו הטוב: ' + this.combo, 320, 220, 'center');
    ctx.restore();
    this.list.draw(this.t + a);
  },
};

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (screen === GameOver && GameOver.entering) GameOver.save(); }
});

// ------------------------------------------------------------------ fullscreen
function toggleFullscreen() {
  if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else enterFull();
}
const onFull = () => {
  setTimeout(resize, 100);
  if (mode === 'touch' && !isFull() && screen === Play) go(Pause);   // left full screen (back button): pause
};
document.addEventListener('fullscreenchange', onFull);
document.addEventListener('webkitfullscreenchange', onFull);

// pause when the tab / app goes to the background
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === Play) go(Pause); });

// ------------------------------------------------------------------ main loop
let acc = 0, last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (window.__icyManual) return;        // frame-by-frame recording (tools/record_video.py)
  if (!last) last = now;
  acc += Math.min(250, now - last);
  last = now;
  let n = 0;
  while (acc >= TICK && n < 6) {
    const p = I.take(), taps = I.taps();
    screen.update(p, taps);
    acc -= TICK; n++;
  }
  G.begin();
  screen.draw(acc / TICK);
  G.end();
}

// ------------------------------------------------------------------ boot
(async () => {
  Ads.init(() => { cfg.ads = false; saveCfg(); Ads.setOn(false); resize(); S.play('S_MENU_CHOOSE'); });
  Ads.setOn(cfg.ads);
  resize();
  I.init(canvas, toLogical);
  const unlock = () => { S.unlock(); S.music(true); };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  try {
    await loadAll();
  } catch (e) {
    $('#loadMsg').textContent = 'חסרים קבצי המשחק (assets). הריצו את tools/build_web.py';
    console.error(e);
    return;
  }
  $('#loading').hidden = true;
  prepare(getChar());
  go(Menu);
  toHost('ready');
  S.music(true);
  requestAnimationFrame(frame);
  if (PHONE) {
    // phone: buttons or full touch? (this tap also unlocks sound and full screen)
    const ch = $('#choose');
    ch.hidden = false;
    ch.querySelector(`[data-mode="${cfg.phoneMode || 'touch'}"]`).classList.add('last');
    $('#iosHint').hidden = canFull() || standalone();
    await new Promise(ok => ch.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      ch.hidden = true; setMode(b.dataset.mode); ok();
    })));
  }
  const dev = /^(localhost|127\.|192\.168\.)/.test(location.hostname) || location.protocol === 'file:';
  if ('serviceWorker' in navigator && !dev && !APP) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// debug / screenshot hooks (used by tools/webshot.py)
window.__icy = {
  go, Menu, Play, Options, Instructions, GameOver, Pause, Stages, Levels, Chars, cfg, Ads, setChar, get screen() { return screen; },
  // advance n logic ticks, draw, return the picture (used with window.__icyManual = true)
  step(n = 1, type = 'image/jpeg', q = 0.93) {
    for (let i = 0; i < n; i++) screen.update(I.take(), I.taps());
    G.begin(); screen.draw(0); G.end();
    return type ? canvas.toDataURL(type, q) : null;
  },
};
