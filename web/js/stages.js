// "שלבים" - stage mode: 10 Mario-flavoured stages on top of the original Icy Tower game.
// Each stage = a target floor (with a flagpole) + a twist. Classic mode (no stage) is untouched.
//   set:      floor graphics (0 ice, 1 icicles, 2 wood, 3 metal, 4 gum, 5 bone, 6 vines, 7 ?-blocks, 8 clouds, 9 rainbow)
//   coins / moving / springs / crumble: share of the normal floors that get it
//   slippery: ice physics, wind: gusts that push Mario, dark: only the area around Mario is lit,
//   lava + fastStart + step: Bowser's castle (the tower starts fast and speeds up every `step` ticks)
export const STAGES = [
  { name: 'ההתחלה', desc: 'מטפסים עד הדגל בקומה 30', goal: 30, set: 0 },
  { name: 'מטבעות זהב', desc: 'אספו כמה שיותר מטבעות בדרך', goal: 40, set: 1, coins: 0.75 },
  { name: 'קומות נעות', desc: 'הקומות זזות מצד לצד', goal: 40, set: 3, moving: 0.65 },
  { name: 'קפיצים', desc: 'קפיץ זורק את מריו גבוה', goal: 60, set: 2, springs: 0.35, coins: 0.3 },
  { name: 'קרח חלקלק', desc: 'קשה לעצור על הקרח', goal: 50, set: 1, slippery: true },
  { name: 'קומות מתפוררות', desc: 'אל תתעכבו, הקומות נופלות', goal: 50, set: 7, crumble: 0.6 },
  { name: 'רוח חזקה', desc: 'משבי רוח דוחפים את מריו', goal: 50, set: 8, wind: true },
  { name: 'מגדל בחושך', desc: 'רואים רק את מה שליד מריו', goal: 50, set: 6, dark: true, coins: 0.4 },
  { name: 'טירת באוזר', desc: 'לבה למטה והמגדל מאיץ מהר', goal: 60, set: 5, lava: true, fastStart: 1, step: 900 },
  { name: 'הכל ביחד', desc: 'האתגר הגדול: כל ההפתעות', goal: 100, set: 9, moving: 0.3, crumble: 0.25, springs: 0.15, coins: 0.4, wind: true },
];

// difficulty levels: they change the map (floor width, full floors), the tower's speed and the combo time.
//   widen: tiles added to every floor (negative = narrower), minW/maxW: limits (floor = w+1 tiles)
//   full: a full-width floor every `full` rows (0 = only floor 0), step: ticks between speed-ups,
//   maxL: top speed (px per tick), startL: speed when the tower starts, combo: combo timer (ticks)
//   moving / crumble: share of floors that move / crumble, skip: share of floors left out (never 2 in a row)
//   zigzag: each floor on the other side of the tower from the one below.  "בינוני" is the original game, untouched.
export const DIFFS = [
  { id: 'easy', name: 'קל', desc: 'קומות רחבות, ומגדל איטי ונינוח', widen: 4, minW: 9, full: 125, step: 2250, maxL: 3, startL: 0, combo: 140 },
  { id: 'normal', name: 'בינוני', desc: 'המשחק המקורי בדיוק', original: true },
  { id: 'hard', name: 'קשה', desc: 'קומות צרות, חסרות קומות, מאיץ כל 20 שניות', widen: -2, minW: 4, full: 500, step: 1000, maxL: 6, startL: 0, combo: 90, skip: 0.1 },
  { id: 'expert', name: 'מומחה', desc: 'זיגזג של קומות צרות מאוד, חלקן זזות', widen: -4, minW: 3, full: 1000, step: 750, maxL: 7, startL: 1, combo: 80, moving: 0.15, skip: 0.2, zigzag: true },
  { id: 'insane', name: 'בלתי אפשרי', desc: 'קומות זעירות שזזות ומתפוררות, מהירות מטורפת', minW: 2, maxW: 3, full: 0, step: 500, maxL: 8, startL: 2, combo: 70, moving: 0.25, crumble: 0.2, skip: 0.3, zigzag: true },
];

const KEY = 'icymario.stages';
export function progress() {
  try { return Object.assign({ open: 1, done: [], coins: {} }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { return { open: 1, done: [], coins: {} }; }
}
export function markDone(i, coins) {
  const p = progress();
  if (!p.done.includes(i)) p.done.push(i);
  p.open = Math.max(p.open, Math.min(STAGES.length, i + 2));
  p.coins[i] = Math.max(p.coins[i] || 0, coins || 0);
  localStorage.setItem(KEY, JSON.stringify(p));
}
