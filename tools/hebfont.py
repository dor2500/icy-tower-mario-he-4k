"""Generate Hebrew glyph ranges (U+05D0..U+05EA) styled like the Icy Tower fonts."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
LETTERS = [chr(c) for c in range(0x5D0, 0x5EB)]
DESC = set('ךןףץק')
ASC = set('ל')


def load_font(name, size, var=None):
    f = ImageFont.truetype(os.path.join(HERE, 'fonts', name), size)
    if var:
        try:
            f.set_variation_by_axes(var)
        except Exception:
            pass
    return f


def mask_for(ch, font, base_y, body_h, thresh=110):
    """Binary mask (H x W) of a letter with its baseline at base_y."""
    im = Image.new('L', (font.size * 3, font.size * 3), 0)
    d = ImageDraw.Draw(im)
    d.text((font.size, font.size), ch, font=font, fill=255, anchor='ls')
    a = np.array(im) >= thresh
    ys, xs = np.nonzero(a)
    if not len(xs):
        return None, 0
    x0, x1 = xs.min(), xs.max() + 1
    # baseline is at row font.size in the canvas
    return a[:, x0:x1], font.size


def dilate(a, r):
    out = a.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + r:
                out |= np.roll(np.roll(a, dy, 0), dx, 1)
    return out


def place(ch, font, H, base_y, pad):
    m, base = mask_for(ch, font, base_y, 0)
    h, w = m.shape
    canvas = np.zeros((H, w + 2 * pad), bool)
    # canvas row y corresponds to mask row y - base_y + base
    for y in range(H):
        sy = y - base_y + base
        if 0 <= sy < h:
            canvas[y, pad:pad + w] = m[sy]
    return canvas


def font1_glyphs(font):
    """40px tall, black outline (1), rainbow fill 237 (top) .. 224 (bottom)."""
    H, base_y, pad, out_r = 40, 35, 3, 2
    glyphs = []
    for ch in LETTERS:
        body = place(ch, font, H, base_y, pad)
        outline = dilate(body, out_r)
        px = np.zeros(body.shape, np.uint8)
        px[outline] = 1
        for y in range(H):
            t = min(max((y - 9) / 27.0, 0), 1)
            px[y][body[y]] = int(round(237 - t * 13))
        # light top-left highlight like the originals' shading
        glyphs.append(trim(px, 1))
    return glyphs


def font2_glyphs(font):
    """26px tall, white fill (15) with grey/dark outline."""
    H, base_y, pad = 26, 21, 2
    glyphs = []
    for ch in LETTERS:
        body = place(ch, font, H, base_y, pad)
        o1 = dilate(body, 1)
        px = np.zeros(body.shape, np.uint8)
        px[o1] = 2
        px[body] = 15
        # inner shade on bottom-right edges
        edge = body & ~np.roll(np.roll(body, -1, 0), -1, 1)
        px[edge] = 11
        glyphs.append(trim(px, 1))
    return glyphs


def trim(px, space):
    cols = np.nonzero(px.any(0))[0]
    px = px[:, cols.min():cols.max() + 1]
    px = np.pad(px, ((0, 0), (0, space)))
    h, w = px.shape
    return (w, h, px.astype(np.uint8).tobytes())


# 7x11 hand-made pixel glyphs for the mono loading font (FONT3, 16px tall).
F3 = {
 'א': ["#...#", "#...#", ".#..#", "..##.", ".#.#.", "#...#", "#...#"],
 'ב': ["####.", "...#.", "...#.", "...#.", "...#.", "...#.", "#####"],
 'ג': [".##..", "..#..", "..#..", "..#..", ".##..", "#..#.", "#..#."],
 'ד': ["#####", "...#.", "...#.", "...#.", "...#.", "...#.", "...#."],
 'ה': ["#####", "....#", "....#", "#...#", "#...#", "#...#", "#...#"],
 'ו': ["##", ".#", ".#", ".#", ".#", ".#", ".#"],
 'ז': ["####", "..#.", "..#.", "..#.", "..#.", "..#.", "..#."],
 'ח': ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#"],
 'ט': ["#..##", "#.#.#", "#...#", "#...#", "#...#", "#...#", "#####"],
 'י': ["##", ".#", ".#", "..", "..", "..", ".."],
 'ך': ["####.", "...#.", "...#.", "...#.", "...#.", "...#.", "...#.", "...#.", "...#."],
 'כ': ["####", "...#", "...#", "...#", "...#", "...#", "####"],
 'ל': ["#....", "#....", "#####", "....#", "....#", "...#.", "..#..", ".#...", ".#..."],
 'ם': ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "#####"],
 'מ': ["#.##.", ".#..#", "#...#", "#...#", "#...#", "#...#", "#.###"],
 'ן': ["##", ".#", ".#", ".#", ".#", ".#", ".#", ".#", ".#"],
 'נ': [".##", "..#", "..#", "..#", "..#", "..#", "###"],
 'ס': ["#####", "#...#", "#...#", "#...#", "#...#", "#..#.", ".##.."],
 'ע': ["#...#", "#...#", ".#..#", "..#.#", "...#.", "..#..", "##..."],
 'ף': ["#####", "#...#", "#...#", "##..#", "....#", "....#", "....#", "....#", "....#"],
 'פ': ["#####", "#...#", "#...#", "##..#", "....#", "....#", "#####"],
 'ץ': ["#...#", ".#..#", "..#.#", "...#.", "..#..", "..#..", "..#..", "..#..", "..#.."],
 'צ': ["#...#", ".#..#", "..#.#", "...#.", "....#", ".....", "#####"],
 'ק': ["#####", "....#", "....#", "#...#", "#..#.", "#....", "#....", "#....", "#...."],
 'ר': ["####.", "....#", "....#", "....#", "....#", "....#", "....#"],
 'ש': ["#.#.#", "#.#.#", "#.#.#", "#.#.#", "#.##.", "#....", "#####"],
 'ת': ["####.", ".#..#", ".#..#", ".#..#", ".#..#", ".#..#", "##..#"],
}


def font3_glyphs():
    """Mono glyphs, 16px tall. Body rows 4..10 to match the Latin caps (rows ~4-11)."""
    glyphs = []
    for ch in LETTERS:
        rows = F3[ch]
        w = len(rows[0])
        top = 2 if ch == 'ל' else 4
        H, W = 16, w + 2
        a = np.zeros((H, W), bool)
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c == '#':
                    a[top + y, x] = True
        if ch == 'ל':
            pass
        packed = np.packbits(a, axis=1)
        glyphs.append((W, H, packed.tobytes()))
    return glyphs
