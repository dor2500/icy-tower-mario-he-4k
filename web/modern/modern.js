// Icy Tower - modern edition: boot, screens (HTML menus over a live demo of the tower), main loop.
// The game itself is the same as the classic HTML version (../js/game.js = the port of the original exe):
// difficulty levels, stages, characters (also the one from your picture), auto play and ads mode all come along.
import * as G from '../js/gfx.js';
import * as S from '../js/sound.js';
import * as I from '../js/input.js';
import { Game } from '../js/game.js';
import { STAGES, DIFFS, progress, markDone } from '../js/stages.js';
import { makeBot } from '../js/bot.js';
import { CHARS, getChar, setChar, prepare } from '../js/chars.js';
import * as Ads from '../js/ads.js';
import * as Custom from '../js/custom.js';
import { Renderer } from './render.js';

const TICK = 20;
const $ = s => document.querySelector(s);
const APP = !!(window.chrome && window.chrome.webview);
const toHost = m => { if (APP) window.chrome.webview.postMessage(m); };
const TOUCH = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;

// settings are shared with the classic version (same character, sound, ads ...); hq / shake are modern only
const cfg = Object.assign({ sound: true, music: true, diff: 1, char: 'mario', ads: false, hq: false, shake: true, name: '' },
  JSON.parse(localStorage.getItem('icymario.cfg') || '{}'));
const saveCfg = () => localStorage.setItem('icymario.cfg', JSON.stringify(cfg));
const diff = () => DIFFS[cfg.diff] || DIFFS[1];
const scoreKey = () => 'icymario.modern.scores.' + diff().id;
const getScores = () => JSON.parse(localStorage.getItem(scoreKey()) || '[]');

S.init(cfg);
const canvas = $('#view');
const R = new Renderer(canvas);
R.quality = cfg.hq ? 1.5 : 1;

// ------------------------------------------------------------------ layout
function resize() {
  const adH = cfg.ads ? Math.round(Math.max(46, Math.min(110, innerHeight * 0.085))) : 0;
  document.documentElement.style.setProperty('--adH', adH + 'px');
  R.resize(innerWidth, innerHeight - 2 * adH);
  for (const g of [play.game, demo.game]) if (g) g.setAhead(R.ahead);
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ assets
async function loadAll() {
  const meta = await (await fetch('../assets/assets.json')).json();
  const names = Object.keys(meta.img).filter(n => n.startsWith('MARIO_') || n.startsWith('HEROFACE'));
  const hd = {};
  await Promise.all(names.map(n => new Promise(ok => {
    const im = new Image(); im.onload = () => { hd[n] = im; ok(); }; im.onerror = ok; im.src = `../assets/hd/${n}.webp`;
  })));
  G.setAssets(meta, { '1x': {}, hd });
  const snd = meta.sfx.map(n => [n, `../assets/sfx/${n}.mp3`]).concat(meta.char.map(n => ['C_' + n, `../assets/sfx/C_${n}.mp3`]));
  if (meta.music) snd.push(['MUSIC', '../assets/sfx/MUSIC.wav']);
  await Promise.all(snd.map(([n, u]) => S.load(n, u)));
  await Custom.init();
  setChar(cfg.char);
  prepare(getChar());
  try { await document.fonts.load('900 40px Rubik'); } catch (e) { /* system font */ }
}

// ------------------------------------------------------------------ the demo behind the menus
const demo = {
  game: null, bot: null,
  start() {
    this.game = new Game({ seed: (Math.random() * 1e9) | 0, diff: diff(), silent: true, ahead: R.ahead });
    this.bot = makeBot();
    for (let k = 0; k < 150; k++) this.game.tick(this.bot(this.game));
    this.game.prev.x = this.game.p.x; this.game.prev.y = this.game.p.y; this.game.prev.S = this.game.S;
  },
  tick() {
    if (!this.game) this.start();
    this.game.tick(this.bot(this.game));
    R.tick(this.game);
    if (this.game.p.dead || this.game.ended) this.start();
  },
};

// ------------------------------------------------------------------ playing
const play = {
  game: null, stage: -1, auto: null,
  start(stage = -1, auto = false) {
    this.stage = stage;
    this.game = new Game({ diff: diff(), stage: STAGES[stage], stageNo: stage, ahead: R.ahead });
    this.auto = auto ? makeBot() : null; this.armed = false; this.handT = 0;
    if (auto) this.game.autoUsed = true;
    I.take(); show(null); setState('play');
  },
  setAuto(on) { this.auto = on ? makeBot() : null; this.armed = false; if (on) this.game.autoUsed = true; },
  tick(p) {
    if (p.has('pause') || p.has('back')) { pause(); return; }
    let inp = I.state();
    if (this.auto) {
      const any = inp.left || inp.right || inp.jump;
      if (!any) this.armed = true;
      else if (this.armed && this.game.frame > 25) { this.auto = null; this.handT = 100; S.play('S_MENU_CHOOSE'); }
    }
    if (this.handT) this.handT--;
    if (this.auto) inp = this.auto(this.game);
    this.game.tick(inp);
    R.tick(this.game);
    if (this.game.ended) gameOver();
  },
};

// ------------------------------------------------------------------ screens
let state = 'menu';
function setState(s) {
  state = s;
  I.setGestures(TOUCH && s === 'play');
  $('#pauseBtn').hidden = !(s === 'play' && TOUCH);
}
function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
  if (id) {
    const first = document.querySelector(`#${id} button.big`) || document.querySelector(`#${id} button:not(:disabled)`);   // Enter = the main action
    if (first && !TOUCH) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }
}
function menu() {
  show('menu'); setState('menu');
  if (play.game) { play.game = null; }
  demo.start();
  renderMenu();
}
function pause() {
  if (state !== 'play') return;
  setState('pause'); show('pause');
  $('#autoBtn').classList.toggle('on', !!play.auto);
  S.play('C_pause');
}
function renderMenu() {
  const c = getChar();
  $('#heroName').textContent = c.name;
  $('#heroGame').textContent = c.game === 'מתמונה' ? 'דמות מהתמונה שלך' : c.game;
  const chips = $('#diffs');
  chips.innerHTML = '';
  DIFFS.forEach((d, i) => {
    const b = document.createElement('button');
    b.textContent = d.name; b.className = i === cfg.diff ? 'on' : '';
    b.onclick = () => { cfg.diff = i; saveCfg(); demo.start(); renderMenu(); S.play('S_MENU_CHANGE'); b.focus(); };
    chips.appendChild(b);
  });
  $('#diffDesc').textContent = diff().desc;
  $('#scoreLevel').textContent = '· ' + diff().name;
  const list = $('#scoreList');
  const sc = getScores();
  list.innerHTML = sc.length ? sc.map(s => `<li><span>${esc(s.name)}</span><b>${s.score}</b><small>קומה ${s.floor} · קומבו ${s.combo}</small></li>`).join('')
    : '<div class="empty">עוד אין שיאים ברמה הזו. זה הזמן!</div>';
  $('#exitBtn').textContent = APP ? 'יציאה' : 'מסך מלא';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function renderStages() {
  const pr = progress();
  $('#stageInfo').textContent = `הושלמו ${pr.done.length} מתוך ${STAGES.length} · רמה: ${diff().name}`;
  const box = $('#stageCards');
  box.innerHTML = '';
  STAGES.forEach((st, i) => {
    const b = document.createElement('button');
    const open = i < pr.open;
    b.disabled = !open;
    if (pr.done.includes(i)) b.classList.add('done');
    b.innerHTML = `<small>שלב ${i + 1} · עד קומה ${st.goal}</small><b>${st.name}</b><small>${open ? st.desc : 'נעול: סיימו את השלב הקודם'}</small>`;
    b.onclick = () => { S.play('S_MENU_CHOOSE'); play.start(i); };
    box.appendChild(b);
  });
}
function renderSettings() {
  for (const b of document.querySelectorAll('#settings [data-set]')) b.classList.toggle('on', !!cfg[b.dataset.set]);
  const gpu = gpuName();
  $('#gpuName').textContent = gpu ? 'כרטיס מסך: ' + gpu : '';
}
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl', { powerPreference: 'high-performance' });
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    let s = String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const m = s.match(/^ANGLE \([^,]*, ([^,]+?)(?: \(0x[0-9a-f]+\))?(?: Direct3D.*)?,/i);
    return (m ? m[1] : s).trim().slice(0, 60);
  } catch (e) { return ''; }
}

function gameOver() {
  const g = play.game;
  setState('over'); show('over');
  const auto = !!g.autoUsed;
  $('#oScore').textContent = g.score; $('#oFloor').textContent = g.p.floor; $('#oCombo').textContent = g.p.best;
  let title = 'המשחק נגמר', note = 'רמה: ' + diff().name + (auto ? ' · משחק אוטומטי (בלי שיאים)' : '');
  let again = 'שחק שוב';
  if (play.stage >= 0) {
    const st = STAGES[play.stage];
    if (g.cleared) {
      markDone(play.stage, g.coins);
      title = progress().done.length === STAGES.length ? 'סיימת את כל השלבים!' : 'שלב הושלם!';
      if (play.stage < STAGES.length - 1) again = 'השלב הבא';
    } else title = 'אוי, נפלת!';
    note = `שלב ${play.stage + 1}: ${st.name} · קומה ${Math.min(g.p.floor, st.goal)} מתוך ${st.goal}` + (st.coins ? ` · מטבעות: ${g.coins}` : '');
  }
  $('#overTitle').textContent = title; $('#overNote').textContent = note; $('#againBtn').textContent = again;
  const sc = getScores();
  const qualifies = play.stage < 0 && !auto && g.score > 0 && (sc.length < 5 || g.score > sc[sc.length - 1].score);
  $('#nameBox').hidden = !qualifies;
  if (qualifies) { $('#nameIn').value = cfg.name || ''; setTimeout(() => $('#nameIn').focus(), 60); S.play('S_CHEER', 0.7); }
}
function saveName() {
  const g = play.game;
  const name = ($('#nameIn').value || '').trim().slice(0, 12) || getChar().name;
  cfg.name = name; saveCfg();
  const sc = getScores();
  sc.push({ name, score: g.score, floor: g.p.floor, combo: g.p.best });
  sc.sort((a, b) => b.score - a.score);
  localStorage.setItem(scoreKey(), JSON.stringify(sc.slice(0, 5)));
  $('#nameBox').hidden = true;
  $('#againBtn').focus();
}

// ------------------------------------------------------------------ buttons
const ACTS = {
  play() { play.start(-1, false); },
  auto() { play.start(-1, true); },
  stages() { renderStages(); show('stages'); },
  settings() { renderSettings(); show('settings'); },
  back() { menu(); },
  charPrev() { cycleChar(-1); }, charNext() { cycleChar(1); },
  async upload() { const ok = await Custom.pickImage(); if (ok) { setChar('custom'); cfg.char = 'custom'; saveCfg(); demo.start(); renderMenu(); S.play('S_CHEER', 0.6); } },
  classic() { location.href = '../index.html'; },
  exit() {
    if (APP) toHost('exit');
    else if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  },
  pause() { pause(); },
  resume() { I.take(); show(null); setState('play'); },
  restart() { play.start(play.stage, !!play.auto); },
  toggleAuto() { play.setAuto(!play.auto); $('#autoBtn').classList.toggle('on', !!play.auto); if (play.auto) ACTS.resume(); },
  toMenu() { menu(); },
  again() {
    const g = play.game;
    if (play.stage >= 0 && g.cleared && play.stage < STAGES.length - 1) play.start(play.stage + 1);
    else play.start(play.stage, !!g.autoUsed && !!play.auto);
  },
  saveName() { saveName(); },
};
function cycleChar(d) {
  const n = CHARS.length, c = CHARS[(CHARS.indexOf(getChar()) + d + n) % n];
  setChar(c.id); prepare(c); cfg.char = c.id; saveCfg();
  demo.game && (demo.game.hero = c);
  renderMenu(); S.play('S_MENU_CHANGE');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act], [data-set]');
  if (!b || b.disabled) return;
  S.unlock();
  if (b.dataset.set) {
    const k = b.dataset.set;
    cfg[k] = !cfg[k]; saveCfg(); S.refresh(); S.play('S_MENU_CHANGE');
    if (k === 'ads') { Ads.setOn(cfg.ads); resize(); }
    if (k === 'hq') { R.quality = cfg.hq ? 1.5 : 1; resize(); }
    renderSettings();
    return;
  }
  if (b.dataset.act !== 'charPrev' && b.dataset.act !== 'charNext') S.play('S_MENU_CHOOSE');
  ACTS[b.dataset.act] && ACTS[b.dataset.act]();
});
$('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });

// keyboard in the menus: arrows move between the buttons (right-to-left layout), Esc = back
addEventListener('keydown', e => {
  if (state === 'play' || e.target.tagName === 'INPUT') return;
  const scr = document.querySelector('.screen:not([hidden])');
  if (!scr) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (state === 'pause') ACTS.resume(); else if (scr.id !== 'menu') menu();
    return;
  }
  if (e.key === ' ' && document.activeElement && document.activeElement.tagName === 'BUTTON') { e.preventDefault(); document.activeElement.click(); return; }
  const dir = { ArrowDown: 1, ArrowLeft: 1, ArrowUp: -1, ArrowRight: -1 }[e.key];
  if (!dir) return;
  e.preventDefault();
  if (scr.id === 'menu' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement && document.activeElement.closest('.hero-pick')) {
    cycleChar(e.key === 'ArrowLeft' ? 1 : -1); return;
  }
  const list = [...scr.querySelectorAll('button:not(:disabled)')].filter(b => b.offsetParent);
  const i = list.indexOf(document.activeElement);
  const next = list[(i + dir + list.length) % list.length] || list[0];
  if (next) next.focus();
}, { capture: true });

// pause when the window goes to the background
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ------------------------------------------------------------------ main loop
let acc = 0, last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now;
  acc += Math.min(250, now - last); last = now;
  let n = 0;
  while (acc >= TICK && n < 6) {
    const p = I.take(); I.taps();
    if (state === 'play') play.tick(p);
    else if (state === 'menu') demo.tick();
    acc -= TICK; n++;
  }
  const a = acc / TICK;
  if (state === 'menu' && demo.game) R.draw(demo.game, a, { noHud: true });
  else if (play.game) R.draw(play.game, state === 'play' ? a : 0, {
    auto: !!play.auto,
    autoHint: play.auto ? (TOUCH ? 'הקישו כדי לשחק בעצמכם' : 'לחצו על מקש כדי לשחק בעצמכם') : play.handT ? 'השליטה אצלכם!' : '',
  });
}

// ------------------------------------------------------------------ boot
(async () => {
  Ads.init(() => { cfg.ads = false; saveCfg(); Ads.setOn(false); resize(); });
  Ads.setOn(cfg.ads);
  resize();
  I.init(canvas, () => null);
  const unlock = () => { S.unlock(); S.music(true); };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  if (APP) addEventListener('keydown', e => {
    if (e.code === 'F11' || (e.altKey && e.code === 'Enter')) { e.preventDefault(); toHost('fullscreen'); }
  }, { capture: true });
  try { await loadAll(); } catch (e) {
    $('#loading').lastElementChild.textContent = 'חסרים קבצי המשחק (assets). הריצו את tools/build_web.py';
    console.error(e); return;
  }
  $('#loading').hidden = true;
  menu();
  S.music(true);
  toHost('ready');
  requestAnimationFrame(frame);
})();

// test hooks
window.__modern = { cfg, play, demo, R, menu, ACTS, get state() { return state; } };
