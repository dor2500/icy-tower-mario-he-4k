// Web Audio: the game's own effects (sfx13.dat), Mario's character sounds and - the only music -
// the Super Mario theme (when the local build has it). The original Icy Tower music is not included.
let ac = null, sfxGain = null, musicGain = null;
const buffers = {};
let musicSrc = null, wantMusic = false;
let opts = { sound: true, music: true };

export function init(o) { opts = o; }

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0.55; musicGain.connect(ac.destination);
  }
  return ac;
}

// browsers only start audio after a user gesture
export function unlock() {
  const a = ctx();
  if (a && a.state !== 'running') a.resume().catch(() => {});
  if (wantMusic && !musicSrc) startMusic();
}

export async function load(name, url) {
  try {
    const a = ctx();
    const data = await (await fetch(url)).arrayBuffer();
    buffers[name] = await new Promise((ok, bad) => a.decodeAudioData(data, ok, bad));
  } catch (e) { console.warn('sound', name, e); }
}

export function play(name, vol = 1) {
  if (!opts.sound || !ac || ac.state !== 'running' || !buffers[name]) return;
  const s = ac.createBufferSource();
  s.buffer = buffers[name];
  if (vol !== 1) {
    const g = ac.createGain(); g.gain.value = vol; s.connect(g); g.connect(sfxGain);
  } else s.connect(sfxGain);
  s.start();
}

function startMusic() {
  if (!ac || ac.state !== 'running' || !buffers.MUSIC || !opts.music) return;
  musicSrc = ac.createBufferSource();
  musicSrc.buffer = buffers.MUSIC;
  musicSrc.loop = true;                  // the file is exactly one period of the theme -> seamless
  musicSrc.connect(musicGain);
  musicSrc.start();
}

export function music(on) {
  wantMusic = on;
  if (on && !musicSrc) startMusic();
  if ((!on || !opts.music) && musicSrc) { try { musicSrc.stop(); } catch (e) {} musicSrc = null; }
}

export function hasMusic() { return !!buffers.MUSIC; }
export function refresh() { music(wantMusic); }
