import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg, gfx, hebfont
from PIL import Image
import numpy as np
objs = alleg.load(sys.argv[1])
pal = gfx.pal_from(objs[0]['data'])
flat = [c for t in pal for c in t]

def strip(glyphs, text, bg=(120, 20, 30)):
    gm = {ch: g for ch, g in zip(hebfont.LETTERS, glyphs)}
    seq = [gm[c] for c in text[::-1] if c in gm]
    W = sum(g[0] for g in seq) + 20; H = seq[0][1]
    out = Image.new('RGB', (W, H), bg); x = 10
    for w, h, px in seq:
        g = Image.frombytes('P', (w, h), px); g.putpalette(flat)
        m = Image.frombytes('L', (w, h), bytes(255 if b else 0 for b in px))
        out.paste(g.convert('RGB'), (x, 0), m); x += w
    return out

rows = []
cands = [(n, s, v) for n, s, v in [('Rubik.ttf', 34, [900]), ('SecularOne.ttf', 34, None), ('Fredoka.ttf', 34, [100, 700]), ('SuezOne.ttf', 32, None)]]
txt = 'התחל משחק אבגדהוזחטיךכלםמןנסעףפץצקרשת'
for n, s, v in cands:
    rows.append(strip(hebfont.font1_glyphs(hebfont.load_font(n, s, v)), txt))
    rows.append(strip(hebfont.font2_glyphs(hebfont.load_font(n, int(s * 0.62), v)), txt))
W = max(r.size[0] for r in rows); H = sum(r.size[1] + 4 for r in rows)
sheet = Image.new('RGB', (W, H), (0, 0, 0)); y = 0
for r in rows:
    sheet.paste(r, (0, y)); y += r.size[1] + 4
sheet = sheet.resize((sheet.size[0] * 2, sheet.size[1] * 2), Image.NEAREST)
sheet.save(sys.argv[2]); print(sheet.size)
