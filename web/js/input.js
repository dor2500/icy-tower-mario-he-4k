// Keyboard, on-screen touch buttons and gamepads, merged into one state.
//   held:    left / right / jump / up / down (current state)
//   pressed: one-shot events (consumed by the screens): up down left right ok back pause any
const held = { left: false, right: false, jump: false, up: false, down: false };
const touchHeld = { left: false, right: false, jump: false };
let pressed = new Set();
let pointerTaps = [];
let lastPad = {};

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
};

export function init(canvas, toLogical) {
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = KEYS[e.code];
    if (k) { held[k] = true; e.preventDefault(); }
    if (!e.repeat) {
      pressed.add('any');
      if (e.code === 'ArrowUp' || e.code === 'KeyW') pressed.add('up');
      if (e.code === 'ArrowDown' || e.code === 'KeyS') pressed.add('down');
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') pressed.add('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') pressed.add('right');
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') pressed.add('ok');
      if (e.code === 'Escape' || e.code === 'Backspace') pressed.add('back');
      if (e.code === 'Escape' || e.code === 'KeyP') pressed.add('pause');
    }
  });
  addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) held[k] = false; });
  addEventListener('blur', () => { for (const k in held) held[k] = false; for (const k in touchHeld) touchHeld[k] = false; ptrs.clear(); updGest(); });
  initGestures();

  // taps on the game picture (menus)
  canvas.addEventListener('pointerdown', e => {
    const p = toLogical(e.clientX, e.clientY);
    if (p) pointerTaps.push(p);
    pressed.add('tap');
  });

  // on-screen buttons (multi-touch: each button tracks its own pointers)
  document.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    const ids = new Set();
    const set = () => { touchHeld[k] = ids.size > 0; b.classList.toggle('on', ids.size > 0); };
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.setPointerCapture && b.setPointerCapture(e.pointerId);
      ids.add(e.pointerId); set();
      pressed.add('any');
      if (k === 'jump') pressed.add('ok');
      if (k === 'left') pressed.add('left');
      if (k === 'right') pressed.add('right');
      if (k === 'pause') pressed.add('pause');
      if (navigator.vibrate && k === 'jump') navigator.vibrate(8);
    });
    const up = e => { ids.delete(e.pointerId); set(); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
}

// ---------------------------------------------------------------- full-touch mode (phone, no buttons)
// first finger: hold the left / right half of the screen to run (slide across to turn), swipe up = jump;
// any extra finger = jump (held = jump held), so one thumb runs while the other one jumps.
const gest = { left: false, right: false, jump: false };
const ptrs = new Map();
let gestOn = false, jumpPulse = 0;
export function setGestures(on) { gestOn = on; ptrs.clear(); updGest(); }
function updGest() {
  let l = false, r = false, j = false;
  for (const p of ptrs.values()) {
    if (p.role === 'move') { if (p.side < 0) l = true; else r = true; } else j = true;
  }
  gest.left = l && !r; gest.right = r && !l; gest.jump = j;
}
function initGestures() {
  const swipe = () => Math.max(22, innerHeight * 0.05);
  addEventListener('pointerdown', e => {
    if (!gestOn || e.pointerType === 'mouse' || (e.target.closest && e.target.closest('[data-k], input, button'))) return;
    const moving = [...ptrs.values()].some(p => p.role === 'move');
    ptrs.set(e.pointerId, { yRef: e.clientY, side: e.clientX < innerWidth / 2 ? -1 : 1, role: moving ? 'jump' : 'move' });
    updGest();
  });
  addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p || p.role !== 'move') return;
    p.side = e.clientX < innerWidth / 2 ? -1 : 1;
    if (p.yRef - e.clientY > swipe()) { jumpPulse = 5; p.yRef = e.clientY; }
    else if (e.clientY > p.yRef) p.yRef = e.clientY;          // measure the next swipe from the lowest point
    updGest();
  });
  const end = e => { if (ptrs.delete(e.pointerId)) updGest(); };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}

function pollPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const now = { left: false, right: false, jump: false, up: false, down: false, start: false, back: false };
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const b = i => p.buttons[i] && p.buttons[i].pressed;
    now.left ||= ax < -0.4 || b(14);
    now.right ||= ax > 0.4 || b(15);
    now.up ||= ay < -0.5 || b(12);
    now.down ||= ay > 0.5 || b(13);
    now.jump ||= b(0) || b(1);
    now.start ||= b(9);
    now.back ||= b(8);
  }
  for (const k of ['up', 'down', 'left', 'right']) if (now[k] && !lastPad[k]) pressed.add(k);
  if (now.jump && !lastPad.jump) { pressed.add('ok'); pressed.add('any'); }
  if (now.start && !lastPad.start) { pressed.add('pause'); pressed.add('any'); }
  if (now.back && !lastPad.back) pressed.add('back');
  lastPad = now;
  return now;
}

export function state() {
  const pad = pollPads();
  const pulse = jumpPulse > 0;
  if (jumpPulse > 0) jumpPulse--;
  return {
    left: held.left || touchHeld.left || pad.left || gest.left,
    right: held.right || touchHeld.right || pad.right || gest.right,
    jump: held.jump || held.up || touchHeld.jump || pad.jump || gest.jump || pulse,
  };
}

export function take() { const p = pressed; pressed = new Set(); return p; }
export function taps() { const t = pointerTaps; pointerTaps = []; return t; }
