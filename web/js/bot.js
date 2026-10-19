// Demo player for the Icy Tower web version (records the gameplay video and screenshots).
// It plays with the real game logic: whenever Mario stands on a floor it tries a set of moves on silent copies
// of the game (run left/right, jump after n ticks) and takes the one that climbs most and keeps combos going.
// Browser: window.__icyBot = makeBot();  node: node web/js/bot.js  (headless test of a few games)
export function makeBot(opt = {}) {
  let plan = [];
  const style = opt.style || 'combo';

  // a move: run `dir` (after `turn` ticks of running the other way: turn around / bounce off the wall to gain speed),
  // jump at tick `delay`, keep the direction for `hold` ticks in the air, then steer `air` (-1 / 0 / 1 relative to dir)
  function simulate(g, dir, delay, hold, turn = 0, air = 0) {
    const s = g.clone();
    const startFloor = s.p.floor, startCombo = s.p.cFloors * (s.p.cTimer > 0);
    const acts = [];
    let jumped = false, t = 0;
    for (; t < 160; t++) {
      const d = t < turn ? -dir : dir;
      const inp = { left: d < 0, right: d > 0, jump: false };
      if (t >= delay && !jumped && s.p.state === 0) { inp.jump = true; jumped = true; }
      if (jumped && t > delay + hold) { const a = dir * air; inp.left = a < 0; inp.right = a > 0; }
      acts.push(inp);
      s.tick(inp);
      if (s.p.dead) return { score: -1e9, acts };
      if (jumped && t > delay + 2 && s.p.state === 0) break;
    }
    if (!jumped || s.p.state !== 0) return { score: -1e6, acts };
    const gain = s.p.floor - startFloor;
    let score = gain * 10;
    if (style === 'combo') {
      if (gain >= 2) score += 25 + gain * 4;                 // keeps / starts a combo
      if (gain === 1 && startCombo) score -= 30;             // would end the combo
    }
    score -= Math.max(0, s.p.y - 300) * 0.6;                 // stay away from the bottom of the screen
    score -= t * 0.05;
    // land with room to run on the next floor
    const row = s.rows[s.rowIndexAt(Math.trunc(s.p.y))];
    if (row) score += Math.min(6, (row.rt - row.l)) * 0.5;
    return { score, acts };
  }

  return function bot(g) {
    const p = g.p;
    if (p.state === 0 && !plan.length) {
      let best = null;
      const take = r => { if (!best || r.score > best.score) best = r; };
      for (const dir of [-1, 1]) {
        for (const delay of [0, 2, 4, 6, 8, 11, 14, 18, 22, 27, 33, 40]) {
          for (const hold of [200, 6]) take(simulate(g, dir, delay, hold));
        }
      }
      // the harder maps (narrow, zigzag, gaps): turn around / bounce off the wall first, steer in the air
      if (style !== 'classic' && (g.df || g.st) && best.score < 40) {
        for (const dir of [-1, 1]) {
          for (const turn of [4, 8, 13, 19, 26]) {
            for (const run of [3, 7, 11, 16, 22, 30]) {
              for (const air of [0, -1]) take(simulate(g, dir, turn + run, air ? 3 : 200, turn, air));
            }
          }
          for (const delay of [0, 4, 9, 15, 22]) for (const hold of [2, 8, 14]) take(simulate(g, dir, delay, hold, 0, -1));
        }
      }
      plan = best.acts.slice();
    }
    if (plan.length) return plan.shift();
    return { left: false, right: false, jump: false };
  };
}

// node web/js/bot.js -> plays a few games headless and prints the result
if (typeof window === 'undefined' && process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('js/bot.js')) {
  const { Game } = await import('./game.js');
  for (let s = 1; s <= 5; s++) {
    const g = new Game({ seed: s * 7919 });
    g.silent = true;
    const bot = makeBot();
    let t = 0;
    const t0 = Date.now();
    while (!g.p.dead && t < 50 * 180) { g.tick(bot(g)); t++; }
    console.log(`seed ${s}: floor ${g.p.floor} score ${g.score} best combo ${g.p.best} time ${(t / 50).toFixed(0)}s  (${Date.now() - t0} ms)`);
  }
}
