// "מצב פרסומות" (Options): fake ad banners above and below the game. Every click on a banner (also on its "X")
// opens the "ad"... which is always the same video.
const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1';
const ADS = [
  { e: '📱', t: 'מזל טוב! זכית באייפון 27!', s: 'נשארו רק 2 דקות לאסוף את הפרס', b: 'לאסוף עכשיו', c: ['#ff2a6d', '#ff8a00'] },
  { e: '🍄', t: 'פטריות כוח במבצע: 1+1', s: 'מריו גדל פי 2 תוך 3 שניות. רופאים בהלם', b: 'להזמין', c: ['#e8202a', '#ffb000'] },
  { e: '💰', t: '1,000,000 מטבעות זהב בחינם', s: 'בלי כרטיס אשראי. בלי שאלות. בלי מטבעות', b: 'קבלו מטבעות', c: ['#ffb800', '#ff6a00'] },
  { e: '🐐', t: 'עז מדברת נמצאה בשכונה שלך!', s: 'לחצו כדי לראות מה היא אמרה', b: 'לצפייה', c: ['#3cba54', '#0b8a6a'] },
  { e: '🧱', t: 'מיינקראפט 2 יצא! שחקו בחינם', s: 'גרסה מלאה, בלי וירוסים (כמעט)', b: 'להורדה', c: ['#5b8731', '#2d5a1b'] },
  { e: '🏎️', t: 'מריו קארט 12 - הורדה מהירה', s: '100% חוקי, 0% אמיתי', b: 'הורידו', c: ['#1e88ff', '#7a3cff'] },
  { e: '🧊', t: 'קרח אמיתי למגדל שלך', s: 'הקומות לא נמסות! משלוח חינם לקומה 100', b: 'לקנייה', c: ['#19c3ff', '#4a6cff'] },
  { e: '👾', t: 'החללי בחללית שלך הוא מתחזה?', s: 'בדיקה חינמית ב-30 שניות', b: 'לבדיקה', c: ['#d6262c', '#5a0f3a'] },
  { e: '🦸', t: 'איך לקפוץ 500 קומות בלילה אחד', s: 'הטריק הסודי שהמגדל לא רוצה שתדעו', b: 'לגלות', c: ['#8a2be2', '#ff2a9a'] },
  { e: '🎁', t: 'אתה המבקר ה-1,000,000!', s: 'זה לא פרסומת. זה ממש לא פרסומת', b: 'לקבל מתנה', c: ['#ff4a4a', '#ffd400'] },
];

let on = false, timer = 0, k = Math.floor(Math.random() * ADS.length);
const bars = [];

function open(e) {
  e.preventDefault(); e.stopPropagation();
  // desktop app (WebView2): the host opens the link in the default browser
  if (window.chrome && window.chrome.webview) window.chrome.webview.postMessage('open:' + URL);
  else window.open(URL, '_blank', 'noopener');
}

function fill(el, ad) {
  el.style.setProperty('--a', ad.c[0]); el.style.setProperty('--b', ad.c[1]);
  el.innerHTML = `<span class="tag">פרסומת</span><span class="em">${ad.e}</span>` +
    `<span class="txt"><b>${ad.t}</b><small>${ad.s}</small></span><span class="cta">${ad.b}</span><span class="x" title="סגירה">✕</span>` +
    `<button class="off" type="button">הסרת פרסומות</button>`;
  // the one real button: turns the ads mode off (like "מצב פרסומות: לא" in the options)
  const off = el.querySelector('.off');
  off.addEventListener('pointerdown', e => e.stopPropagation());
  off.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (onClose) onClose(); });
  el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
}
function rotate() {
  bars.forEach((el, i) => fill(el, ADS[(k + i * 3) % ADS.length]));
  k = (k + 1) % ADS.length;
}

let onClose = null;
export function init(close) {
  onClose = close;
  for (const id of ['adTop', 'adBot']) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', open);
    bars.push(el);
  }
}
export function setOn(v) {
  on = !!v;
  document.body.classList.toggle('ads', on);
  bars.forEach(el => { el.hidden = !on; });
  clearInterval(timer);
  if (on) { rotate(); timer = setInterval(rotate, 7000); }
}
export const isOn = () => on;
