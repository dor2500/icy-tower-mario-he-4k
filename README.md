# Icy Tower 1.3.1: Super Mario Edition (עברית, HD עד 8K, מחשב + דפדפן + טלפון)

## ▶️ [לשחק עכשיו בדפדפן או בטלפון](https://dor2500.github.io/icy-tower-mario-he-4k/)
**https://dor2500.github.io/icy-tower-mario-he-4k/** · בטלפון אפשר "להוסיף למסך הבית" ולשחק כמו באפליקציה, גם בלי אינטרנט.

גרסת מעריצים לא רשמית של המשחק החינמי **Icy Tower 1.3.1** מאת Free Lunch Design:

- **סופר מריו כדמות הראשית**: דמות משחק מלאה (15 תנועות), פרצוף ענק במסך הפתיחה (3 הבעות), סמן התפריט, מסך ההוראות, אייקון.
- **עברית מלאה**: תפריטים, הודעות, גרפיקה, הוראות ומסמכים (RTL).
- **רק מוזיקה של מריו**: המוזיקה המקורית של Icy Tower (מסך הפתיחה והמשחק) הוסרה.
- **HD עד 8K**: במחשב דרך [cnc-ddraw](https://github.com/FunkyFr3sh/cnc-ddraw) עם שיידר xBRZ. בדפדפן כל הגרפיקה מוגדלת פי 6 ב-xBRZ ומצוירת ברזולוציה של המסך.
- **גרסת HTML לדפדפן ולטלפון**: אותו משחק ואותו עיצוב, עם כפתורי מגע בתחתית המסך.

![gameplay](docs/gameplay.gif)

🎬 **[סרטון גיימפליי מלא (44 שניות, 50fps)](docs/gameplay.mp4)**. הסרטון הוקלט מגרסת ה-HTML, מריו משוחק על ידי שחקן אוטומטי, והוא בלי קול.

## גרסת HTML (דפדפן + טלפון)

| מסך פתיחה | קומבו | אחרי קומה 200 |
|---|---|---|
| ![menu](docs/web_menu.jpg) | ![combo](docs/web_combo.jpg) | ![floor200](docs/web_floor200.jpg) |
| **פרס על קומבו + גלגלון** | **אפשרויות** | **הוראות** |
| ![reward](docs/web_reward.jpg) | ![options](docs/web_options.png) | ![instructions](docs/web_instructions.jpg) |

| טלפון לאורך | טלפון לרוחב |
|---|---|
| <img src="docs/web_mobile.jpg" width="300"> | ![landscape](docs/web_mobile_landscape.jpg) |

| HD (xBRZ פי 6) | פיקסלים קלאסיים (אפשרות בתפריט) |
|---|---|
| ![hd](docs/web_floor100.jpg) | ![classic](docs/web_classic.png) |

**זה אותו משחק, לא חיקוי.** המשחקיות הועברה מתוך קוד ה-exe המקורי (דיסאסמבלי של `icytower13.exe`), עם כל הקבועים המקוריים:
50 טיקים בשנייה, תאוצה 0.3, חיכוך 0.9, קפיצה `-max(12, 2·|מהירות|)`, כוח משיכה 0.8, קירות ב-x=85/555 עם קפיצה מהקיר ×0.9,
קומה כל 80 פיקסלים ורוחב קומות לפי הגובה, קומה מלאה כל 50 קומות, האצת הגלילה כל 30 שניות (0.5→5 פיקסלים לטיק),
גלילה מהירה כשמריו בראש המסך, קומבו (טיימר של 100 טיקים, ניקוד קומות²) ו-10 דרגות פרס. גם הגרפיקה, הפונטים והצלילים
נלקחים ישר מקבצי המשחק, והקיר האחורי המעוקל נבנה באותו אלגוריתם כמו במקור.

- **מקשים**: חצים או A/D לריצה, רווח או חץ למעלה לקפיצה, Esc או P להשהיה. יש תמיכה בגיימפד.
- **טלפון**: כפתורי שמאלה, ימינה וקפיצה בתחתית המסך, וכפתור השהיה. לאורך: התמונה למעלה והכפתורים למטה. לרוחב: כפתורים עגולים בפינות.
- **אפשרויות**: גרפיקה HD או פיקסלים, רזולוציית ציור (מסך / 4K / 8K), צלילים, מוזיקה, קפיצה חוזרת (מחזיקים את הקפיצה), כפתורי מגע.
- **שיאים** נשמרים בדפדפן. אפשר להתקין כאפליקציה (PWA), והמשחק עובד גם בלי אינטרנט.

**הפעלה**: פשוט פותחים את **[dor2500.github.io/icy-tower-mario-he-4k](https://dor2500.github.io/icy-tower-mario-he-4k/)**.
האתר מתעדכן לבד: הקוד נלקח מ-`web/` והנכסים מה-zip שבשחרור האחרון (`.github/workflows/pages.yml`).
להרצה מקומית: מורידים את `icytower13_mario_he_web.zip` מה-[Releases](../../releases), מחלצים ומריצים `python serve.py`.

## גרסת המחשב (Windows)

| משחק ב-4K (שיידר xBRZ) | מסך פתיחה |
|---|---|
| ![desktop](docs/desktop_hd_4k.jpg) | ![title](docs/title_4k.png) |

מורידים את `icytower13_mario_he_hd_install.exe` מה-[Releases](../../releases) ומריצים. אפשר גם להוריד את ה-zip הנייד ולהריץ ישר את `icytower13.exe`.
Alt+Enter עובר בין מסך מלא לחלון. הגדרות התצוגה נמצאות ב-`ddraw.ini`:
- `shader=Shaders\xbrz\xbrz-freescale-multipass.glsl` (ברירת מחדל): HD חלק בכל רזולוציה (4K, 8K).
- `shader=Shaders\nearest-neighbor.glsl`: הפיקסלים המקוריים, חדים ומרובעים.
- `boxing=true`: הגדלה בכפולות שלמות בלבד. `maintas=false`: מתיחה לכל רוחב המסך.

**מוזיקה**: המוזיקה המקורית של Icy Tower הוסרה (`tools/set_music.py`). קובצי ההקלטה של מריו לא מופצים כאן (Nintendo).
מי שיש לו הקלטות משלו בונה עם `build.ps1 -MarioAudio <תיקייה>`, ואז נושא מריו מתנגן במסך הפתיחה ובמשחק, וגם בגרסת ה-HTML.
בלי ההקלטות המשחק שקט (רק אפקטים).

## בנייה מהמקור
`build.ps1` בונה הכול: תיקיית המשחק `work\he_app`, ההתקנה ב-`output\` וגרסת ה-HTML ב-`web\assets`.
צריך Windows, Python 3 (pillow, numpy, scipy, pefile; ל-`record_media.py` גם playwright), Inno Setup 6 ו-ffmpeg.
לגרפיקת ה-HD צריך גם להריץ פעם אחת את `tools\xbrz\build_xbrz.ps1` (דורש Visual Studio Build Tools).

קבצי המשחק המקוריים, והנכסים של גרסת ה-HTML שנגזרים מהם (`web/assets`), לא נשמרים ב-git. לפני הבנייה צריך להכין:

| נתיב | מה זה |
|---|---|
| `work\extract\app\` | קבצי המשחק המקוריים (מחולצים מ-`icytower13_install.exe`) |
| `work\unpacked\icytower13.exe` | ה-exe המקורי אחרי `upx -d` |
| `work\dl\cnc-ddraw\x\` | שחרור cnc-ddraw (`cnc-ddraw.zip`) |
| `work\tower.cfg.bak` | קובץ הגדרות ברירת מחדל (נוצר בהרצה הראשונה של המשחק) |

| כלי | תפקיד |
|---|---|
| `tools/make_mario.py` | דמות סופר מריו (ספרייטים מרשתות פיקסלים + צלילים) |
| `tools/make_mario_gui.py` | פרצוף הפתיחה, סמן התפריט, מריו במסך ההוראות, אייקון |
| `tools/make_images.py`, `build_data.py`, `hebfont.py` | גרפיקה ופונטים בעברית בתוך `data.dat` |
| `tools/patch_exe.py`, `strings_he.py`, `bidi.py` | מחרוזות עבריות ב-exe (בסדר תצוגה, בסקשן `.heb` חדש) |
| `tools/set_icon.py` | אייקון מריו ב-exe (חייב לרוץ **לפני** `patch_exe.py`) |
| `tools/set_default_char.py` | קביעת הדמות שנבחרת כברירת מחדל ב-`tower.cfg` |
| `tools/set_music.py` | הסרת המוזיקה המקורית מ-`sfx13.dat` (או החלפתה בנושא של מריו) |
| `tools/import_mario_audio.ps1` | חיתוך ההקלטות שלכם לאפקטים ולנושא בלולאה מדויקת |
| `tools/ddraw.ini` | הגדרות התצוגה (HD / 4K / 8K) של cnc-ddraw |
| `tools/build_web.py` | ייצוא הגרפיקה, הפונטים והצלילים לגרסת ה-HTML, כולל HD פי 6 ב-xBRZ והקיר האחורי |
| `tools/xbrz/` | כלי שורת פקודה ל-xBRZ ותסריט שבונה אותו |
| `tools/serve_web.py` | שרת מקומי בלי מטמון (גם לטלפון ברשת המקומית) |
| `tools/record_media.py` | צילומי המסך והסרטון שב-`docs/` (צעד-אחר-צעד, 50fps) |
| `web/` | גרסת ה-HTML: `js/game.js` (המשחקיות מהמקור), `gfx.js` (ציור עד 8K ופונטים), `main.js` (מסכים ופריסה), `bot.js` (שחקן הדגמה) |

## זכויות
- Icy Tower: © Free Lunch Design (freeware). http://www.freelunchdesign.com
- Mario הוא סימן מסחרי של Nintendo. זוהי עבודת מעריצים שאינה למטרות רווח, ואין לה קשר ל-Nintendo או ל-Free Lunch Design. הספרייטים והפרצוף צוירו מחדש בקוד.
- cnc-ddraw: רישיון MIT, © FunkyFr3sh. השיידרים (xBRZ freescale ועוד): libretro/glsl-shaders.
- xBRZ: © Zenju, רישיון GPL-3.0. משמש רק בזמן הבנייה ליצירת גרפיקת ה-HD, והקוד שלו לא נכלל כאן.
- הפונטים Rubik, Fredoka, Secular One ו-Suez One: רישיון SIL Open Font License.
