"""Create Hebrew versions of the text bitmaps in data.dat.
usage: python -I make_images.py <orig data.dat> <out dir>"""
import os
import sys

import numpy as np
import scipy.ndimage as ndi
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg
import bidi
import gfx
import hebfont

HERE = os.path.dirname(os.path.abspath(__file__))
RUBIK = os.path.join(HERE, 'fonts', 'Rubik.ttf')


# ---------------------------------------------------------------- helpers
def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r + r


def dil(m, r):
    return ndi.binary_dilation(m, structure=disk(r)) if r else m.copy()


def text_mask(text, size, thresh=128):
    """Mask of `text` (logical Hebrew) rendered with Rubik Black, tightly cropped."""
    f = ImageFont.truetype(RUBIK, size, layout_engine=ImageFont.Layout.BASIC)
    f.set_variation_by_axes([900])
    vis = bidi.visual(text)
    im = Image.new('L', (size * (len(vis) + 2), size * 3), 0)
    ImageDraw.Draw(im).text((size, size), vis, font=f, fill=255)
    a = np.array(im) >= thresh
    ys, xs = np.nonzero(a)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit_mask(text, max_w, max_h, start=120):
    for size in range(start, 6, -1):
        m = text_mask(text, size)
        if m.shape[1] <= max_w and m.shape[0] <= max_h:
            return m
    raise ValueError(text)


def blit(dst, src, x, y, transparent=0):
    h, w = src.shape
    reg = dst[y:y + h, x:x + w]
    sel = src != transparent
    reg[sel] = src[sel]


# ------------------------------------------------- big "graffiti" words
def graffiti(text, W, H, pad=10, fill=(224, 231), ring=5):
    """Rainbow letters, black outline, grey metal rim, black edge (like REWARDxxx)."""
    m = fit_mask(text, W - 2 * pad, H - 2 * pad)
    canvas = np.zeros((H, W), bool)
    h, w = m.shape
    ox, oy = (W - w) // 2, (H - h) // 2
    canvas[oy:oy + h, ox:ox + w] = m
    core = canvas
    o1 = dil(core, 2)
    rim = dil(core, 2 + ring)
    edge = dil(core, 3 + ring)
    px = np.zeros((H, W), np.uint8)
    px[edge] = 1
    yy = np.arange(H)[:, None].repeat(W, 1)
    # rim: light at the top -> dark at the bottom, shifted so it looks bevelled
    shade = (14 - (yy - oy + ring) * 9 // max(h + 2 * ring, 1)).clip(5, 14).astype(np.uint8)
    px[rim] = shade[rim]
    px[o1] = 1
    xx = np.arange(W)[None, :].repeat(H, 0)
    lo, hi = fill
    col = (lo + (xx - ox) * (hi - lo + 1) // max(w, 1)).clip(lo, hi).astype(np.uint8)
    px[core] = col[core]
    # small highlight on top edges of the letters
    top = core & ~np.roll(core, 2, 0)
    px[top] = np.minimum(col[top] + 0, 255)
    return px


# ------------------------------------------------- the title logo "אייסי טאוור"
_REF = {}


def letter_mask(ch, size):
    """One letter, cropped left/right only (rows = the font's letter band, so yod / lamed / final letters keep their place)."""
    f = ImageFont.truetype(RUBIK, size, layout_engine=ImageFont.Layout.BASIC)
    f.set_variation_by_axes([900])
    if size not in _REF:
        im = Image.new('L', (size * 30, size * 3), 0)
        ImageDraw.Draw(im).text((size, size), 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ', font=f, fill=255)
        ys = np.nonzero(np.array(im).max(1) >= 128)[0]
        _REF[size] = (ys.min(), ys.max() + 1)
    t, b = _REF[size]
    im = Image.new('L', (size * 3, size * 3), 0)
    ImageDraw.Draw(im).text((size, size), ch, font=f, fill=255)
    a = np.array(im)[t:b] >= 128
    xs = np.nonzero(a.any(0))[0]
    return a[:, xs.min():xs.max() + 1]


def graffiti_word(text, size, seed, tilt):
    """Letters each turned a little and bounced up / down, overlapping like a graffiti tag; the word tilted."""
    rng = np.random.default_rng(seed)
    parts = []
    for ch in bidi.visual(text):
        a = letter_mask(ch, size)
        im = Image.fromarray((a * 255).astype(np.uint8)).rotate(rng.uniform(-10, 10), expand=True, resample=Image.BICUBIC)
        parts.append((np.array(im) >= 128, int(rng.uniform(-0.09, 0.09) * size)))
    H = max(m.shape[0] for m, _ in parts) + size // 2
    W = sum(m.shape[1] for m, _ in parts) + size
    c = np.zeros((H, W), bool)
    x = size // 2
    for m, dy in parts:
        y = (H - m.shape[0]) // 2 + dy
        c[y:y + m.shape[0], x:x + m.shape[1]] |= m
        x += m.shape[1] + int(size * 0.07)
    im = Image.fromarray((c * 255).astype(np.uint8)).rotate(tilt, expand=True, resample=Image.BICUBIC)
    a = np.array(im) >= 128
    ys, xs = np.nonzero(a)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def title_logo(W, H, ring=7):
    """TITLE: "אייסי" above, a bigger "טאוור" below, in the original logo's style: rainbow rays (palette 224-239),
    black outline, grey bevelled metal rim (1-11), black edge; 0 = transparent."""
    pad = ring + 7
    top, bot = graffiti_word('אייסי', 120, 7, 7), graffiti_word('טאוור', 150, 11, 7)
    # scale both words so the two lines fill the box (the second line a bit bigger)
    for k in np.arange(1.0, 0.2, -0.01):
        t = np.array(Image.fromarray(top.astype(np.uint8) * 255).resize((int(top.shape[1] * k * 0.95), int(top.shape[0] * k * 0.95)), Image.LANCZOS)) >= 128
        b = np.array(Image.fromarray(bot.astype(np.uint8) * 255).resize((int(bot.shape[1] * k), int(bot.shape[0] * k)), Image.LANCZOS)) >= 128
        ov = int(b.shape[0] * 0.12)                       # the lines overlap a little, like the original
        if max(t.shape[1], b.shape[1]) <= W - 2 * pad and t.shape[0] + b.shape[0] - ov <= H - 2 * pad:
            break
    core = np.zeros((H, W), bool)
    ty = (H - (t.shape[0] + b.shape[0] - ov)) // 2
    tx = W - pad - t.shape[1] - (W - 2 * pad - t.shape[1]) // 5   # first word towards the right (Hebrew reads from the right)
    by = ty + t.shape[0] - ov
    bx = pad + (W - 2 * pad - b.shape[1]) // 2
    core[ty:ty + t.shape[0], tx:tx + t.shape[1]] |= t
    core[by:by + b.shape[0], bx:bx + b.shape[1]] |= b
    core = dil(core, 1)                               # chunky letters, like the original logo
    px = np.zeros((H, W), np.uint8)
    yy, xx = np.mgrid[0:H, 0:W]
    edge, rim, o1 = dil(core, 3 + ring), dil(core, 2 + ring), dil(core, 2)
    px[edge] = 1
    # rim: light top-left -> dark bottom-right (bevel), per line
    lit = ((xx * 0.25 + (yy - ty) * 1.0) / (H * 0.9) * 9).astype(int)
    shade = (11 - lit).clip(2, 11).astype(np.uint8)
    px[rim] = shade[rim]
    px[o1] = 1
    # fill: rainbow rays around a point under each word (like the bursts in the original logo)
    fill = np.zeros((H, W), np.uint8)
    for (cx, cy, rot, rng_) in [(tx + t.shape[1] * 0.45, ty + t.shape[0] * 1.1, 0.0, (224, 239)),
                                (bx + b.shape[1] * 0.55, by + b.shape[0] * 1.25, 1.3, (229, 239))]:
        ang = (np.arctan2(yy - cy, xx - cx) + rot) % (2 * np.pi)
        lo, hi = rng_
        n = hi - lo + 1
        idx = (lo + (ang / (2 * np.pi) * n * 2).astype(int) % n).astype(np.uint8)
        sel = (yy < by + ov // 2) if rng_[0] == 224 else (yy >= by + ov // 2)
        fill[sel] = idx[sel]
    px[core] = fill[core]
    # thin black lines inside the letters where the two words meet stay visible thanks to o1
    return px


def small_rainbow(text, max_w, max_h):
    """Small rainbow word with a 1px black outline (FLOORS label on the star)."""
    m = fit_mask(text, max_w - 2, max_h - 2, start=40)
    m = np.pad(m, 1)
    px = np.zeros(m.shape, np.uint8)
    px[dil(m, 1)] = 1
    h, w = m.shape
    xx = np.arange(w)[None, :].repeat(h, 0)
    col = (224 + xx * 8 // max(w, 1)).astype(np.uint8)
    px[m] = col[m]
    return px


# ---------------------------------------------- tiny pixel font (5x7)
EXTRA = {':': ["..", "..", "#.", "..", "..", "#.", ".."], ' ': ["..."]}


def pixel_text(text, fill, outline=None, spacing=1, rows=7):
    vis = bidi.visual(text)
    cols = []
    for ch in vis:
        g = hebfont.F3.get(ch) or EXTRA.get(ch)
        if g is None:
            raise KeyError(ch)
        top = 0
        w = len(g[0])
        a = np.zeros((9, w), bool)
        if ch == 'ל':
            g = g[2:]  # drop ascender: keep within 7 rows
        for y, row in enumerate(g):
            for x, c in enumerate(row):
                if c == '#' and y < 9:
                    a[y, x] = True
        cols.append(a)
        cols.append(np.zeros((9, spacing), bool))
    m = np.concatenate(cols[:-1], 1)
    # trim descenders unless rows > 7
    m = m[:rows]
    if outline is None:
        px = np.zeros(m.shape, np.uint8)
        px[m] = fill
        return px
    m = np.pad(m, 1)
    px = np.zeros(m.shape, np.uint8)
    px[dil(m, 1) & ~m] = outline
    px[m] = fill
    return px


def font_text(text, glyphs):
    """Compose a line with an Allegro font range dict {codepoint: (w,h,bytes)}."""
    vis = bidi.visual(text)
    parts = []
    for ch in vis:
        w, h, b = glyphs[ord(ch)]
        parts.append(np.frombuffer(b, np.uint8).reshape(h, w))
    return np.concatenate(parts, 1)


def inpaint(px, mask):
    """Replace masked pixels with the nearest unmasked pixel."""
    _, (iy, ix) = ndi.distance_transform_edt(mask, return_indices=True)
    out = px.copy()
    out[mask] = px[iy[mask], ix[mask]]
    return out


def erase_inside(px, x0, y0, x1, y1, keep=None):
    """Clear every connected non-zero component whose bbox is fully inside the rect."""
    lab, n = ndi.label(px != 0)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        ys, xs = sl
        if ys.start >= y0 and ys.stop <= y1 and xs.start >= x0 and xs.stop <= x1:
            px[sl][lab[sl] == i] = 0


# ---------------------------------------------------------------- build
def build(src, outdir):
    os.makedirs(outdir, exist_ok=True)
    objs = alleg.load(src)
    pal = gfx.pal_from(objs[0]['data'])
    flat = [c for t in pal for c in t]
    bm = {}
    for o in objs:
        if o['type'] == b'BMP ':
            im, bits = gfx.bmp_to_image(o['data'], pal)
            bm[alleg.name(o)] = np.array(im)
    fonts = {}
    for o in objs:
        if o['type'] == b'FONT':
            rs = gfx.read_font(o['data'])
            g = {}
            for r in rs:
                for k, gl in enumerate(r['glyphs']):
                    g[r['begin'] + k] = gl
            fonts[alleg.name(o)] = g
    rub = lambda s: hebfont.load_font('Rubik.ttf', s, [900])
    for k, gl in zip(range(0x5D0, 0x5EB), hebfont.font2_glyphs(rub(21))):
        fonts['FONT2'][k] = gl
    out = {}

    def save(name, px):
        assert px.shape == bm[name].shape, (name, px.shape, bm[name].shape)
        im = Image.fromarray(px.astype(np.uint8), 'P')
        im.putpalette(flat)
        im.save(os.path.join(outdir, name + '.png'))
        out[name] = px

    # big words ---------------------------------------------------------
    words = {
        'GAMEOVER': 'המשחק נגמר', 'HIGHSCORE': 'שיא חדש!', 'HURRYUP': 'מהר יותר!',
        'REWARD000': 'טוב!', 'REWARD001': 'יופי!', 'REWARD002': 'אחלה!', 'REWARD003': 'סופר!',
        'REWARD004': 'וואו!', 'REWARD005': 'מדהים!', 'REWARD006': 'אקסטרים!',
        'REWARD007': 'פנטסטי!', 'REWARD008': 'מושלם!', 'REWARD009': 'אין מצב!',
    }
    for name, t in words.items():
        h, w = bm[name].shape
        ring = max(2, min(6, h // 16))
        save(name, graffiti(t, w, h, pad=3 + ring, ring=ring))
    # the title logo "Icy Tower" -> "אייסי טאוור"
    save('TITLE', title_logo(bm['TITLE'].shape[1], bm['TITLE'].shape[0]))

    # high-score column headers ------------------------------------------
    px = bm['HISCTOP'].copy()
    colmask = (px != 0).any(0)
    runs, x = [], 0
    while x < len(colmask):
        if colmask[x]:
            s = x
            while x < len(colmask) and (colmask[x] or colmask[x:x + 4].any()):
                x += 1
            runs.append((s, x))
        x += 1
    px[:] = 0
    for (a, b), t in zip(runs, ['שם', 'קומה', 'קומבו', 'ניקוד']):
        g = pixel_text(t, 15, 1, rows=7)
        cx = (a + b) // 2 - g.shape[1] // 2
        cx = max(0, min(px.shape[1] - g.shape[1], cx))
        if t == 'שם':
            cx = a
        if t == 'ניקוד':
            cx = px.shape[1] - g.shape[1]
        blit(px, g, cx, (px.shape[0] - g.shape[0]) // 2)
    save('HISCTOP', px)

    # sort-by box + highlight overlays -----------------------------------
    px = bm['SORT_BUTTON_ALL'].copy()
    quads = {'NAME': (0, 13, 40, 23, 'שם'), 'SCORE': (40, 13, 73, 23, 'ניקוד'),
             'FLOOR': (0, 24, 40, 34, 'קומה'), 'COMBO': (40, 24, 73, 34, 'קומבו')}
    newpx = np.zeros_like(px)
    title = pixel_text('מיון לפי:', 15, 16)
    blit(newpx, title, px.shape[1] - title.shape[1], 0)
    for key, (x0, y0, x1, y1, t) in quads.items():
        reg = px[y0:y1, x0:x1]
        ys, xs = np.nonzero((reg == 9) | (reg == 15))
        fy, fx = y0 + ys.min(), x0 + xs.min()
        ov = bm['SORT_BUTTON_' + key]
        oh, ow = ov.shape
        g = pixel_text(t, 9, None, spacing=1, rows=oh)
        if g.shape[1] > ow:
            g = pixel_text(t, 9, None, spacing=0, rows=oh)
        gx = ow - g.shape[1]  # right-align inside the overlay box
        gl = np.zeros((oh, ow), np.uint8)
        gl[:, gx:gx + g.shape[1]] = g
        m = gl != 0
        o = np.zeros_like(newpx[fy - 1:fy + oh + 1, fx - 1:fx + ow + 1], bool)
        o[1:-1, 1:-1] = m
        o = dil(o, 1) & ~np.pad(m, 1)
        newpx[fy - 1:fy + oh + 1, fx - 1:fx + ow + 1][o] = 16
        newpx[fy:fy + oh, fx:fx + ow][m] = 9
        hl = np.zeros_like(ov)
        hl[m] = 15
        save('SORT_BUTTON_' + key, hl)
    save('SORT_BUTTON_ALL', newpx)

    # yes / no keycaps: letters are cut-outs (0) with black outline -------
    for name, t in [('BT_YES', 'כן'), ('BT_NO', 'לא')]:
        px = bm[name].copy()
        x0, y0, x1, y1 = 7, 8, 28, 21
        reg = px[y0:y1 + 1, x0:x1 + 1]
        txt = (reg == 0) | (reg == 1)
        px[y0:y1 + 1, x0:x1 + 1] = inpaint(reg, txt)
        # letters rendered one by one (visual order) with a 2px gap so they stay apart
        ls = [text_mask(ch, 15) for ch in bidi.visual(t)]
        hh = max(a.shape[0] for a in ls)
        parts = []
        for a in ls:
            parts += [np.pad(a, ((hh - a.shape[0], 0), (0, 0))), np.zeros((hh, 2), bool)]
        core = np.pad(np.concatenate(parts[:-1], 1), 1)
        m = dil(core, 1)
        g = np.where(core, 0, 1).astype(np.uint8)
        gy, gx = 14 - g.shape[0] // 2, 17 - g.shape[1] // 2
        px[gy:gy + g.shape[0], gx:gx + g.shape[1]][m] = g[m]
        save(name, px)

    # labels next to keycaps (white text, black outline) ------------------
    def relabel(name, boxes):
        px = bm[name].copy()
        for (x0, y0, x1, y1, t) in boxes:
            reg = px[y0:y1, x0:x1]
            white = reg >= 13
            white &= reg <= 15
            lab = white | (dil(white, 1) & (reg == 1))
            px[y0:y1, x0:x1] = inpaint(reg, lab)
            g = pixel_text(t, 15, 1)
            gx = x1 - g.shape[1]
            gy = y1 - g.shape[0]
            m = g != 0
            px[gy:gy + g.shape[0], gx:gx + g.shape[1]][m] = g[m]
        save(name, px)

    def label_boxes(name):
        """Find white label runs (rows with white pixels to the right of the key)."""
        px = bm[name]
        wh = (px >= 13) & (px <= 15)
        lab, n = ndi.label(dil(wh, 2))
        boxes = []
        for sl in ndi.find_objects(lab):
            ys, xs = sl
            if (xs.stop - xs.start) > 15 and (ys.stop - ys.start) < 14:
                boxes.append((xs.start, ys.start, xs.stop, ys.stop))
        return sorted(boxes, key=lambda b: b[1])

    bb = label_boxes('BROWSE_BUTTON')
    relabel('BROWSE_BUTTON', [b + ('עיון',) for b in bb[-1:]])
    bb = label_boxes('REPLAY_BUTTONS')
    relabel('REPLAY_BUTTONS', [b + (t,) for b, t in zip(bb, ['בחירה', 'טעינה', 'ביטול', 'מחיקה'])])
    print('label boxes', label_boxes('REPLAY_BUTTONS'), label_boxes('BROWSE_BUTTON'))

    # FLOORS on the star ---------------------------------------------------
    def star_label(px, x0, y0, x1, y1, t):
        reg = px[y0:y1, x0:x1]
        g = small_rainbow(t, x1 - x0 + 4, y1 - y0 + 4)
        # black plate under the old word, then the new word on top
        reg[reg != 0] = 1
        gy = y0 + (y1 - y0 - g.shape[0]) // 2
        gx = x0 + (x1 - x0 - g.shape[1]) // 2
        m = g != 0
        px[gy:gy + g.shape[0], gx:gx + g.shape[1]][m] = g[m]

    px = bm['COMBO_COUNT'].copy()
    star_label(px, *STAR_COMBO, 'קומות')
    save('COMBO_COUNT', px)

    # instructions screen --------------------------------------------------
    px = bm['INSTRUCTIONS'].copy()
    erase_inside(px, 125, 0, 480, 64)                      # title
    t = graffiti('הוראות', 330, 64, pad=6, ring=3)
    blit(px, t, 140, 0)
    blocks = [
        ((48, 74, 282, 140), ['עזרו למריו', 'לטפס על המגדל.']),
        ((96, 282, 384, 336), ['ככל שרצים מהר יותר,', 'קופצים גבוה יותר.']),
        ((12, 336, 262, 428), ['השתמשו במקלדת', 'או בבקר כדי', 'לשלוט במריו.']),
        ((396, 301, 636, 440), ['עשו קפיצות כפולות', 'או משולשות כדי', 'להפעיל מצב קומבו', 'ולצבור עוד נקודות.']),
    ]
    # first lines of two blocks overlap the bottom border of the screenshot
    # panels: clear them and redraw a plain border (#, #, white, #)
    for (bx0, bx1, by, rect, sides) in PANEL_FIX:
        rx0, ry0, rx1, ry1 = rect
        sub = px[ry0:ry1, rx0:rx1]
        sub[:] = 0
        for sx0, sy0, sx1, sy1 in sides:
            px[sy0:sy1, sx0:sx1] = 0
        px[by:by + 2, bx0:bx1 + 1] = 1
        px[by + 2, bx0:bx1 + 1] = 15
        px[by + 3, bx0:bx1 + 1] = 1
        px[by:by + 4, bx0] = 1
        px[by:by + 3, bx0 + 1] = 15
        px[by:by + 4, bx1] = 1
        px[by:by + 3, bx1 - 1] = 15
        px[by + 3, bx0] = 0
        px[by + 3, bx1] = 0
    for (x0, y0, x1, y1), lines in blocks:
        erase_inside(px, x0, y0, x1, y1)
        lh = (y1 - y0) // len(lines) if len(lines) > 2 else 27
        for i, line in enumerate(lines):
            g = font_text(line, fonts['FONT2'])
            if g.shape[1] > x1 - x0:
                print('WARN wide line', line, g.shape[1], x1 - x0)
            blit(px, g, x1 - g.shape[1] - 2, y0 + 2 + i * lh)
    # JUMP on the space bar
    x0, y0, x1, y1 = INSTR_JUMP
    reg = px[y0:y1, x0:x1]
    txt = (reg == 1) | (reg >= 13) & (reg <= 15)
    face = np.bincount(reg[~txt].ravel()).argmax()
    reg[txt] = face
    g = font_text('קפיצה', fonts['FONT2'])
    blit(px, g, (x0 + x1) // 2 - g.shape[1] // 2, (y0 + y1) // 2 - g.shape[0] // 2)
    star_label(px, *INSTR_STAR, 'קומות')
    save('INSTRUCTIONS', px)

    # preview sheet
    ims = [Image.fromarray(np.where(v == 0, 222, v).astype(np.uint8), 'P') for v in out.values()]
    for im in ims:
        im.putpalette(flat)
    W = 1300
    x = y = rh = 0
    pos = []
    for im in ims:
        if x + im.size[0] > W:
            x, y, rh = 0, y + rh + 4, 0
        pos.append((x, y))
        x += im.size[0] + 4
        rh = max(rh, im.size[1])
    sheet = Image.new('RGB', (W, y + rh), (30, 30, 30))
    for im, p in zip(ims, pos):
        sheet.paste(im.convert('RGB'), p)
    sheet.save(os.path.join(outdir, '_preview.png'))
    print('images:', ', '.join(out))


# text rectangles measured on the original bitmaps
STAR_COMBO = (12, 45, 89, 59)
INSTR_JUMP = (100, 436, 196, 460)
INSTR_STAR = (410, 119, 487, 133)
# (border x0, border x1, border top row, text rect below border, extra side rects)
PANEL_FIX = [
    (145, 345, 277, (95, 281, 384, 334), [(95, 268, 145, 281), (346, 268, 384, 281)]),
    (453, 588, 296, (396, 300, 636, 436), [(396, 286, 453, 300), (589, 286, 636, 300)]),
]

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2])
