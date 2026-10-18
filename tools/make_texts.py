# -*- coding: utf-8 -*-
"""Write the Hebrew text files into the staging app folder.
usage: python -I make_texts.py <app dir>"""
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
app = sys.argv[1]


def w(rel, text, bom=True):
    p = os.path.join(app, rel)
    data = text.replace('\r\n', '\n').replace('\n', '\r\n').encode('utf-8')
    open(p, 'wb').write((b'\xef\xbb\xbf' if bom else b'') + data)


def keep_en(rel):
    base, ext = os.path.splitext(rel)
    dst = os.path.join(app, base + '_en' + ext)
    if not os.path.exists(dst):
        shutil.copyfile(os.path.join(app, rel), dst)


def tpl(name):
    return open(os.path.join(HERE, 'texts', name), encoding='utf-8').read()


# documentation (read by people only) -> UTF-8 with BOM, original kept as *_en.txt
keep_en('readme.txt')
w('readme.txt', tpl('readme_he.txt'))
keep_en('characters/characters.txt')
w('characters/characters.txt', tpl('characters_he.txt'))
w('replays/replays.txt', 'כדי לצפות בשידור חוזר, פשוט גררו אותו אל הסמל של Icy Tower.\n')
w('ogg_license_he.txt', """רישיון ספריית Ogg Vorbis - הסבר בעברית
==========================================

המשחק משתמש בספריות Ogg Vorbis של Xiph.org לניגון הצלילים.
הספריות מופצות ברישיון בסגנון BSD: מותר להפיץ ולהשתמש בהן, בקוד מקור
או בצורה בינארית, עם או בלי שינויים, בתנאי שנשמרת הודעת זכויות היוצרים,
רשימת התנאים והסרת האחריות, ושלא משתמשים בשם Xiph.org כדי לקדם מוצרים
בלי אישור בכתב.

הנוסח המחייב הוא הנוסח האנגלי שבקובץ ogg_license.txt.
""")

# files parsed by the game -> keep keywords, translate comments only, no BOM
w('gamepad.txt', """#
# קובץ הגדרות לבקר (GAMEPAD)
#
# בקובץ הזה קובעים מה המשחק יעשה כשלוחצים על כל לחצן בבקר.
# פשוט מחליפים את המילה שאחרי ה-= בפעולה הרצויה.
#
# הפעולות האפשריות (חייבות להישאר באנגלית):
#   left = שמאלה, right = ימינה, up = למעלה, down = למטה,
#   jump = קפיצה, none = כלום
#
# אזהרה: לשנות בזהירות!
#

""" + ''.join(l + '\n' for l in open(os.path.join(HERE, '..', 'work', 'extract', 'app', 'gamepad.txt'),
                                     encoding='ascii').read().splitlines() if l and not l.startswith('#')),
  bom=False)

w('characters/harold_the_homeboy/harold_the_homeboy.txt', """# data
[datafile] harold.dat

# info
הרולד ההומבוי הוא בזכויות יוצרים של Free Lunch Design.
אין להעתיק את הצלילים והתמונות שבקובץ הנתונים
בלי אישור מ-Free Lunch Design.
http://www.freelunchdesign.com
""", bom=False)
w('characters/disco_dave/disco_dave.txt', """# data
[datafile]\tdave.dat

# info
דיסקו דייב הוא בזכויות יוצרים של Free Lunch Design.
אין להעתיק את הצלילים והתמונות
בלי אישור מ-Free Lunch Design.
http://www.freelunchdesign.com
""", bom=False)
w('characters/template/template.txt', """דמות תבנית ל-Icy Tower.
תהנו!

# graphics (גרפיקה)
[frames] \t\ttemplate.bmp

# sound (צלילים)
[jumplo] \t\tjump_lo.wav
[jumpmed] \t\tjump_mid.wav
[jumphi]\t \tjump_hi.wav
[pause] \t \tpause.wav
[death]\t\t\tfalling.wav
[greeting]\t\thello.wav
[edge]\t\t\tedge.wav
[bgmusic]\t\tbg_beat.wav

# info (מידע)
עוד אקשן של Icy Tower באתר http://www.freelunchdesign.com .
""", bom=False)
print('texts written')
