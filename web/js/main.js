// Icy Tower: Super Mario Edition - HTML version. Boot, layout (mobile + desktop, up to 8K), screens, main loop.
import * as G from './gfx.js';
import * as S from './sound.js';
import * as I from './input.js';
import { Game } from './game.js';
import { STAGES, progress, markDone } from './stages.js';

const TICK = 20;                                       // 50 logic ticks per second, like the original
const $ = s => document.querySelector(s);
const canvas = $('#game');
G.attach(canvas);

// ------------------------------------------------------------------ settings & highscores
const DEF = { gfx: 'hd', res: 'auto', sound: true, music: true, rejump: false, touch: 'auto', name: '' };
const cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem('icymario.cfg') || '{}'));
const saveCfg = () => localStorage.setItem('icymario.cfg', JSON.stringify(cfg));
const DEFAULT_SCORES = [
  { name: 'FLD', score: 3000, floor: 150, combo: 25 }, { name: 'FLD', score: 2000, floor: 100, combo: 15 },
  { name: 'FLD', score: 1000, floor: 60, combo: 10 }, { name: 'FLD', score: 500, floor: 35, combo: 7 },
  { name: 'FLD', score: 250, floor: 20, combo: 4 }];
let scores = JSON.parse(localStorage.getItem('icymario.scores') || 'null') || DEFAULT_SCORES;
const saveScores = () => localStorage.setItem('icymario.scores', JSON.stringify(scores));
const qualifies = sc => sc > 0 && (scores.length < 5 || sc > scores[scores.length - 1].score);

S.init(cfg);
G.setMode(cfg.gfx);

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
  const vw = innerWidth, vh = innerHeight, dpr = devicePixelRatio || 1;
  const touch = touchUI();
  document.body.classList.toggle('touch', touch);
  const portrait = vh > vw;
  document.body.classList.toggle('portrait', portrait);
  let w, h, x, y;
  if (portrait && touch) {
    const top = parseFloat(getComputedStyle($('#safe')).paddingTop) || 0;
    const pad = Math.max(190, Math.min(vh * 0.36, 320));       // room for the buttons under the picture
    w = Math.min(vw, (vh - pad - top) * 4 / 3); h = w * 3 / 4;
    x = (vw - w) / 2; y = top;
  } else {
    w = Math.min(vw, vh * 4 / 3); h = w * 3 / 4;
    x = (vw - w) / 2; y = (vh - h) / 2;
  }
  rect = { x, y, w, h };
  // full-touch mode: the canvas is the whole screen; otherwise just the picture
  const c = mode === 'touch' ? { x: 0, y: 0, w: vw, h: vh } : rect;
  Object.assign(canvas.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' });
  // render resolution: the screen's own pixels, or supersampled 4K / 8K
  let k = dpr;
  if (cfg.res === '4k') k = Math.max(dpr, 2160 / h);
  if (cfg.res === '8k') k = Math.max(dpr, 4320 / h);
  k = Math.min(k, 7680 / c.w, 7680 / c.h);
  canvas.width = Math.round(c.w * k); canvas.height = Math.round(c.h * k);
  view = { c, k, vh };
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
  if (upright()) rect.y = screen === Play || screen === Pause || screen === GameOver ? view.vh - rect.h : (view.vh - rect.h) / 2;
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

const SCROLLER = ['ברוכים הבאים ל-Icy Tower!', 'עוד משחק מבית Free Lunch Design.',
  'עזרו לסופר מריו לטפס הכי גבוה שאפשר!', 'זזים עם החצים וקופצים עם מקש הרווח.', 'בטלפון: כפתורי החצים והקפיצה בתחתית המסך.', 'בהצלחה!'];

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
  G.text('FONT2', 'שיאים', 470, 239, 'center');
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
  enter() { this.list = menuList(['התחל משחק', 'שלבים', 'הוראות', 'אפשרויות', 'מסך מלא'], 40, 270, 28); this.list.sel = this.sel || 0; },
  update(p, taps) {
    this.t++;
    this.scroll += 2;
    const r = this.list.handle(p, taps);
    this.sel = this.list.sel;
    if (r && r.pick !== undefined) {
      if (r.pick === 0) go(Play.start());
      if (r.pick === 1) go(Stages);
      if (r.pick === 2) go(Instructions);
      if (r.pick === 3) go(Options);
      if (r.pick === 4) toggleFullscreen();
    }
  },
  draw(a) {
    wideBg('TITLE_BG');
    // Mario's face: blinks and looks around (HEROFACE000-002)
    const c = this.t % 260;
    const face = c > 120 && c < 128 ? 'HEROFACE001' : c > 200 && c < 240 ? 'HEROFACE002' : 'HEROFACE000';
    G.img(face, face === 'HEROFACE000' ? 40 : 39, 19);
    G.img('TITLE', 250, 20);
    G.smallText('v1.3.1', 634, 6, 'right');
    this.list.draw(this.t + a, ['התחל משחק', 'שלבים', 'הוראות', 'אפשרויות', isFull() ? 'יציאה ממסך מלא' : 'מסך מלא']);
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
    for (const t of taps) {
      const i = Math.floor((t.y - this.Y0 + 4) / this.STEP);
      if (i >= 0 && i < n && t.x > 110 && t.x < 530) { this.sel = i; this.pick(i); return; }
    }
    if (p.has('ok')) this.pick(this.sel);
  },
  draw(a) {
    wideBg('TITLE_BG');
    G.img('REPLAY_BG', 103, 25);
    G.text('FONT1', 'שלבים', 320, 30, 'center');
    G.smallText(`הושלמו ${this.pr.done.length} מתוך ${STAGES.length}`, 320, 66, 'center');
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
const Options = {
  enter() { this.list = menuList(['', '', '', '', '', '', ''], 140, 120, 38); },
  labels() {
    return [
      'גרפיקה: ' + (cfg.gfx === 'hd' ? 'HD' : 'פיקסלים'),
      'רזולוציה: ' + ({ auto: 'מסך', '4k': '4K', '8k': '8K' })[cfg.res],
      'צלילים: ' + yesNo(cfg.sound),
      'מוזיקה: ' + (S.hasMusic() ? yesNo(cfg.music) : 'אין'),
      'קפיצה חוזרת: ' + yesNo(cfg.rejump),
      PHONE ? 'שליטה: ' + (mode === 'touch' ? 'מגע מלא' : 'כפתורים')
        : 'כפתורי מגע: ' + ({ auto: 'אוטו', on: 'כן', off: 'לא' })[cfg.touch],
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
    saveCfg();
  },
  update(p, taps) {
    const r = this.list.handle(p, taps);
    if (p.has('back')) { go(Menu); return; }
    if (!r) return;
    const i = r.pick !== undefined ? r.pick : this.list.sel;
    if (i === 6) { if (r.pick !== undefined) go(Menu); return; }
    this.change(i, r.side || 1);
  },
  draw(a) {
    wideBg('TITLE_BG');
    G.img('REPLAY_BG', 103, 30);
    G.text('FONT1', 'אפשרויות', 320, 50, 'center');
    const L = this.labels();
    L.forEach((s, i) => G.text('FONT2', s, 150, 116 + i * 38 + 4));
    const by = 116 + this.list.sel * 38 - 14 + Math.sin(performance.now() / 120) * 1.5;
    G.img('MENU_BULLET', 112, by);
  },
};

const Play = {
  game: null,
  stage: -1,                                         // -1 = classic game, else index into STAGES
  start(seed, stage = -1) {
    this.stage = stage;
    this.game = new Game({ rejump: cfg.rejump, seed, ahead: aheadPx(), stage: STAGES[stage], stageNo: stage });
    return this;
  },
  again() { return this.start(undefined, this.stage); },
  enter() { S.music(true); },
  update(p) {
    if (p.has('pause') || p.has('back')) { go(Pause); return; }
    this.game.tick(window.__icyBot ? window.__icyBot(this.game) : I.state());   // __icyBot: demo / video recording
    if (this.game.ended) go(GameOver.from(this.game));
  },
  draw(a) {
    this.game.draw(a);
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
  enter() { this.dy = Math.round(-aheadPx() / 2); this.list = menuList(['המשך', 'התחל מחדש', Play.stage >= 0 ? 'שלבים' : 'תפריט ראשי'], 215, 210 + this.dy, 40); S.play('C_pause'); },
  update(p, taps) {
    if (p.has('pause') || p.has('back')) { go(Play); return; }
    const r = this.list.handle(p, taps);
    if (r && r.pick === 0) go(Play);
    if (r && r.pick === 1) go(Play.again());
    if (r && r.pick === 2) go(Play.stage >= 0 ? Stages : Menu);
  },
  draw(a) {
    Play.game.draw(0);
    dim('#000', 0.45);
    const ctx = G.context();
    ctx.save(); ctx.translate(0, this.dy || 0);       // phone held upright: the panel in the middle of the screen
    G.img('REPLAY_BG', 103, 25);
    G.text('FONT1', 'המשחק מושהה', 320, 90, 'center');
    G.text('FONT2', PHONE ? 'הקישו על בחירה' : 'ESC ליציאה', 320, 140, 'center');
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
    this.entering = this.stage < 0 && qualifies(this.score);
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
    if (this.stage < 0) { go(r.pick === 0 ? Play.start() : Menu); return; }
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
      G.smallText('Enter / הקשה לשמירה', 320, 340, 'center');
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
  go(Menu);
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
  if ('serviceWorker' in navigator && !dev) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// debug / screenshot hooks (used by tools/webshot.py)
window.__icy = {
  go, Menu, Play, Options, Instructions, GameOver, Pause, Stages, cfg, get screen() { return screen; },
  // advance n logic ticks, draw, return the picture (used with window.__icyManual = true)
  step(n = 1, type = 'image/jpeg', q = 0.93) {
    for (let i = 0; i < n; i++) screen.update(I.take(), I.taps());
    G.begin(); screen.draw(0); G.end();
    return type ? canvas.toDataURL(type, q) : null;
  },
};
