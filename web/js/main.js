// Icy Tower: Super Mario Edition - HTML version. Boot, layout (mobile + desktop, up to 8K), screens, main loop.
import * as G from './gfx.js';
import * as S from './sound.js';
import * as I from './input.js';
import { Game } from './game.js';

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

// ------------------------------------------------------------------ layout
let rect = { x: 0, y: 0, w: 640, h: 480 };
function touchUI() {
  if (cfg.touch === 'on') return true;
  if (cfg.touch === 'off') return false;
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
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
  Object.assign(canvas.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  // render resolution: the screen's own pixels, or supersampled 4K / 8K
  let k = dpr;
  if (cfg.res === '4k') k = Math.max(dpr, 2160 / h);
  if (cfg.res === '8k') k = Math.max(dpr, 4320 / h);
  k = Math.min(k, 7680 / w, 5760 / h);
  canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
  G.layout({ x: 0, y: 0, w }, k);
  document.documentElement.style.setProperty('--gameBottom', (y + h) + 'px');
  document.documentElement.style.setProperty('--gameH', h + 'px');
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));

function toLogical(cx, cy) {
  const r = canvas.getBoundingClientRect();
  const x = (cx - r.left) / r.width * 640, y = (cy - r.top) / r.height * 480;
  return x >= 0 && y >= 0 && x < 640 && y < 480 ? { x, y } : null;
}

// ------------------------------------------------------------------ assets
async function loadAll() {
  const meta = await (await fetch('assets/assets.json')).json();
  const names = Object.keys(meta.img).concat(Object.keys(meta.font));
  const images = { '1x': {}, hd: {} };
  const bar = $('#loadBar');
  let done = 0;
  const total = names.length * 2;
  const one = (set, n) => new Promise(ok => {
    const im = new Image();
    im.onload = () => { images[set][n] = im; done++; bar.style.width = (done / total * 80) + '%'; ok(); };
    im.onerror = () => { done++; ok(); };
    im.src = `assets/${set}/${n}.${set === 'hd' ? 'webp' : 'png'}`;
  });
  await Promise.all(names.map(n => one('1x', n)).concat(names.map(n => one('hd', n))));
  G.setAssets(meta, images);
  const snd = meta.sfx.map(n => [n, `assets/sfx/${n}.mp3`]).concat(meta.char.map(n => ['C_' + n, `assets/sfx/C_${n}.mp3`]));
  if (meta.music) snd.push(['MUSIC', 'assets/sfx/MUSIC.wav']);
  let sd = 0;
  await Promise.all(snd.map(([n, u]) => S.load(n, u).then(() => { sd++; bar.style.width = (80 + sd / snd.length * 20) + '%'; })));
  return meta;
}

// ------------------------------------------------------------------ screens
let screen = null;
const go = s => { screen = s; s.enter && s.enter(); };

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
  enter() { this.list = menuList(['התחל משחק', 'הוראות', 'אפשרויות', 'מסך מלא'], 40, 270, 28); this.list.sel = this.sel || 0; },
  update(p, taps) {
    this.t++;
    this.scroll += 2;
    const r = this.list.handle(p, taps);
    this.sel = this.list.sel;
    if (r && r.pick !== undefined) {
      if (r.pick === 0) go(Play.start());
      if (r.pick === 1) go(Instructions);
      if (r.pick === 2) go(Options);
      if (r.pick === 3) toggleFullscreen();
    }
  },
  draw(a) {
    G.img('TITLE_BG', 0, 0);
    // Mario's face: blinks and looks around (HEROFACE000-002)
    const c = this.t % 260;
    const face = c > 120 && c < 128 ? 'HEROFACE001' : c > 200 && c < 240 ? 'HEROFACE002' : 'HEROFACE000';
    G.img(face, face === 'HEROFACE000' ? 40 : 39, 19);
    G.img('TITLE', 250, 20);
    G.smallText('v1.3.1', 634, 6, 'right');
    this.list.draw(this.t + a, ['התחל משחק', 'הוראות', 'אפשרויות', isFull() ? 'יציאה ממסך מלא' : 'מסך מלא']);
    drawScoreTable();
    // bottom band with the scroller
    G.rect(0, 450, 640, 6, '#101014');
    G.rect(0, 456, 640, 24, '#1c104d');
    if (!this.scrollW) this.scrollW = SCROLLER.reduce((w, s) => w + G.textWidth('FONT2', s) + 60, 0) + 640;
    const x = 640 - ((this.scroll + 2 * a) % this.scrollW);
    const ctx = G.context();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 450, 640, 30); ctx.clip();
    let xx = x;
    for (const s of SCROLLER) xx += G.text('FONT2', s, xx, 449) + 60;
    ctx.restore();
  },
};

const Instructions = {
  update(p, taps) { if (p.has('any') || p.has('back') || taps.length) { S.play('S_MENU_CHOOSE'); go(Menu); } },
  draw() { G.img('INSTRUCTIONS', 0, 0); },
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
      'כפתורי מגע: ' + ({ auto: 'אוטו', on: 'כן', off: 'לא' })[cfg.touch],
      'חזרה',
    ];
  },
  change(i, dir) {
    if (i === 0) { cfg.gfx = cfg.gfx === 'hd' ? 'classic' : 'hd'; G.setMode(cfg.gfx); }
    if (i === 1) { const o = ['auto', '4k', '8k']; cfg.res = o[(o.indexOf(cfg.res) + (dir || 1) + 3) % 3]; resize(); }
    if (i === 2) cfg.sound = !cfg.sound;
    if (i === 3) { cfg.music = !cfg.music; S.refresh(); }
    if (i === 4) cfg.rejump = !cfg.rejump;
    if (i === 5) { const o = ['auto', 'on', 'off']; cfg.touch = o[(o.indexOf(cfg.touch) + (dir || 1) + 3) % 3]; resize(); }
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
    G.img('TITLE_BG', 0, 0);
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
  start(seed) { this.game = new Game({ rejump: cfg.rejump, seed }); return this; },
  enter() { S.music(true); },
  update(p) {
    if (p.has('pause') || p.has('back')) { go(Pause); return; }
    this.game.tick(window.__icyBot ? window.__icyBot(this.game) : I.state());   // __icyBot: demo / video recording
    if (this.game.ended) go(GameOver.from(this.game));
  },
  draw(a) { this.game.draw(a); },
};

const Pause = {
  enter() { this.list = menuList(['המשך', 'התחל מחדש', 'תפריט ראשי'], 215, 210, 40); S.play('C_pause'); },
  update(p, taps) {
    if (p.has('pause') || p.has('back')) { go(Play); return; }
    const r = this.list.handle(p, taps);
    if (r && r.pick === 0) go(Play);
    if (r && r.pick === 1) go(Play.start());
    if (r && r.pick === 2) go(Menu);
  },
  draw(a) {
    Play.game.draw(0);
    G.rect(0, 0, 640, 480, '#000', 0.45);
    G.img('REPLAY_BG', 103, 25);
    G.text('FONT1', 'המשחק מושהה', 320, 90, 'center');
    G.text('FONT2', 'ESC ליציאה', 320, 140, 'center');
    this.list.draw(performance.now() / 50);
  },
};

const nameInput = $('#nameInput');
const GameOver = {
  from(game) {
    this.game = game; this.score = game.score; this.floor = game.p.floor; this.combo = game.p.best;
    this.entering = qualifies(this.score);
    this.name = cfg.name || '';
    this.t = 0;
    return this;
  },
  enter() {
    this.list = menuList(['שחק שוב', 'תפריט ראשי'], 230, 330, 42);
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
    if (r && r.pick === 0) go(Play.start());
    if (r && r.pick === 1) go(Menu);
  },
  draw(a) {
    this.game.draw(0);
    G.rect(0, 0, 640, 480, '#000', 0.35);
    G.img('REPLAY_BG', 103, 25);
    if (this.entering) {
      const [hw] = G.size('HIGHSCORE');
      G.img('HIGHSCORE', 320 - hw / 2, 50);
      G.text('FONT2', 'הקלידו את ראשי התיבות', 320, 165, 'center');
      const blink = (this.t >> 4) & 1 ? '_' : ' ';
      G.text('FONT1', this.name + blink, 320, 215, 'center', {});
      G.text('FONT2', 'ניקוד: ' + this.score, 320, 290, 'center');
      G.smallText('Enter / הקשה לשמירה', 320, 340, 'center');
      return;
    }
    G.text('FONT1', 'המשחק נגמר', 320, 60, 'center');
    G.text('FONT2', 'ניקוד: ' + this.score, 320, 140, 'center');
    G.text('FONT2', 'קומה: ' + this.floor, 320, 180, 'center');
    G.text('FONT2', 'הקומבו הטוב: ' + this.combo, 320, 220, 'center');
    this.list.draw(this.t + a);
  },
};

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (screen === GameOver && GameOver.entering) GameOver.save(); }
});

// ------------------------------------------------------------------ fullscreen
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFullscreen() {
  const el = document.documentElement;
  if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el, { navigationUI: 'hide' })?.catch?.(() => {});
}
document.addEventListener('fullscreenchange', () => setTimeout(resize, 100));

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
  const dev = /^(localhost|127\.|192\.168\.)/.test(location.hostname) || location.protocol === 'file:';
  if ('serviceWorker' in navigator && !dev) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// debug / screenshot hooks (used by tools/webshot.py)
window.__icy = {
  go, Menu, Play, Options, Instructions, GameOver, Pause, cfg, get screen() { return screen; },
  // advance n logic ticks, draw, return the picture (used with window.__icyManual = true)
  step(n = 1, type = 'image/jpeg', q = 0.93) {
    for (let i = 0; i < n; i++) screen.update(I.take(), I.taps());
    G.begin(); screen.draw(0); G.end();
    return type ? canvas.toDataURL(type, q) : null;
  },
};
