"""Build the 'super_mario' custom character for Icy Tower 1.3 (frames bmp + synth sfx + script).

Sprites are hand-drawn half-resolution pixel grids, composed per frame and scaled 2x into the
15 frame boxes of characters/template/template.bmp. Colours use the free palette slots 144+.
Usage: python make_mario.py <he_app dir>
"""
import math, os, struct, sys, wave
from PIL import Image

PAL = {  # char -> (index, rgb)
    'K': (144, (20, 10, 10)),     # outline
    'R': (145, (230, 20, 30)),    # cap / shirt
    'r': (146, (165, 10, 20)),    # cap brim (dark red)
    'B': (147, (40, 80, 220)),    # overalls
    'S': (148, (255, 196, 150)),  # skin
    's': (149, (225, 145, 105)),  # skin shade / nose
    'H': (150, (90, 45, 10)),     # hair / moustache
    'W': (151, (255, 255, 255)),  # eyes / gloves / cap badge
    'Y': (152, (255, 220, 0)),    # buttons
    'N': (153, (125, 65, 20)),    # shoes
}

FRONT_HEAD = """
....KKKKKK....
...KRRRRRRK...
..KRRRRRRRRK..
..KRRWWWWRRK..
.KRRRWRRWRRRK.
.KRRRWWWWRRRK.
KrrrrrrrrrrrrK
KKrrrrrrrrrrKK
.KHSSSSSSSSHK.
KSHSWKSSKWSHSK
KSSSWKSSKWSSSK
.KSSSSssSSSSK.
.KSSHHHHHHSSK.
..KSSSSSSSSK..
...KKSSSSKK...
"""
FRONT_BODY = """
.KRRKKKKKKRRK.
KRRRBRRRRBRRRK
KRRRBYBBYBRRRK
KWWKBBBBBBKWWK
KWWKBBBBBBKWWK
.KKKBBBBBBKKK.
"""
FRONT_LEGS = """
..KBBBBBBBBK..
..KBBBKKBBBK..
..KBBBKKBBBK..
.KNNNNKKNNNNK.
KNNNNNKKNNNNNK
.KKKKK..KKKKK.
"""
FRONT_LEGS_AIR = """
..KBBBBBBBBK..
..KBBBKKBBBK..
..KBBK..KBBK..
..KNNK..KNNK..
.KNNNK..KNNNK.
.KKKKK..KKKKK.
"""
SIDE_HEAD = """
...KKKKKK.....
..KRRRRRRKK...
.KRRRRRWWRRK..
.KRRRRWRRWRK..
.KRRRRRWWRRRK.
.KrrrrrrrrrrrK
.KHHKKKKKKKKK.
.KHHSSSSSWKS..
.KHSsSSSSWKSK.
.KHSssSSSSSSSK
.KHHSSSSSHHHHK
..KHSSSSHHHHK.
..KSSSSSSSSK..
...KKSSSSKK...
....KKKKKK....
"""
SIDE_BODY_F = """
...KRRRRRK....
..KRRBBRRRK...
..KRBBYBRRRK..
..KBBBBBKWWK..
..KBBBBBKWWK..
...KBBBBBKK...
"""
SIDE_BODY_B = """
...KRRRRRK....
..KRRBBRRRK...
.KRRBBYBRK....
KWWKBBBBBK....
KWWKBBBBBK....
.KKKBBBBBK....
"""
SIDE_BODY_PUNCH = """
...KRRRRRKKKK.
..KRRBBRRRRWWK
..KRBBYBRRRWWK
..KBBBBBBKKKK.
..KBBBBBBK....
...KBBBBBK....
"""
LEGS = {
    'stand': """
...KBBBBBK....
...KBBKBBK....
...KBBKBBK....
..KNNNKNNNNK..
..KKKKKKKKKK..
""",
    'strideA': """
...KBBBBBBK...
..KBBBKKBBBK..
.KBBK...KBBK..
KNNNK...KNNNNK
KKKK.....KKKKK
""",
    'pass': """
...KBBBBBK....
...KBBBBK.....
...KBBBBK.....
...KNNNNNK....
...KKKKKKK....
""",
    'strideC': """
...KBBBBBK....
..KBBKBBBK....
.KNNK.KBBK....
.KKK..KNNNNK..
......KKKKKK..
""",
    'tuck': """
...KBBBBBBK...
..KBBBBKBBBK..
..KNNNK.KBBK..
.KNNNK...KNNNK
.KKKK....KKKK.
""",
}
GLOVE_UP = """
.KKK.
KWWWK
KWWWK
.KRK.
.KRK.
.KRK.
"""
ROTATE_BODY = """
.KK..KRRKKKKKKRRK..KK.
KWWKKRRRBRRRRBRRRKKWWK
KWWRRRRRBYBBYBRRRRRWWK
.KKKKKKKBBBBBBKKKKKKK.
......KBBBBBBBBK......
.....KBBBBBBBBBBK.....
.....KBBBKKKKBBBK.....
....KBBBK....KBBBK....
...KBBBK......KBBBK...
..KNNNNK......KNNNNK..
..KNNNNK......KNNNNK..
..KKKKKK......KKKKKK..
"""


def g(s):
    return [r for r in s.strip('\n').split('\n')]


def edit(grid, row, text):
    grid = list(grid); grid[row] = text; return grid


HEAD_BLINK = edit(edit(g(FRONT_HEAD), 9, 'KSHSSSSSSSSHSK'), 10, 'KSSSKKSSKKSSSK')
HEAD_LOOK = edit(edit(g(FRONT_HEAD), 9, 'KSHSKWSSKWSHSK'), 10, 'KSSSKWSSKWSSSK')
HEAD_CHOCK = edit(edit(g(FRONT_HEAD), 8, '.KHWWSSSSWWHK.'), 13, '..KSSKRRKSSK..')
HEAD_GRIN = edit(g(FRONT_HEAD), 13, '..KSSWWWWSSK..')
BODY_ONEARM = edit(edit(g(FRONT_BODY), 3, 'KWWKBBBBBBK...'), 4, 'KWWKBBBBBBK...')


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [['.'] * w for _ in range(h)]

    def put(self, grid, x, y):
        if isinstance(grid, str):
            grid = g(grid)
        for j, row in enumerate(grid):
            for i, c in enumerate(row):
                if c != '.' and 0 <= x + i < self.w and 0 <= y + j < self.h:
                    self.px[y + j][x + i] = c
        return self


def stack(head, body, legs, w=14):
    return Canvas(w, 26).put(head, 0, 0).put(body, 0, 15).put(legs, 0, 21)


def frames():
    side = g(SIDE_HEAD)
    f = []
    f.append(stack(g(FRONT_HEAD), FRONT_BODY, FRONT_LEGS))                # IDLE1
    f.append(stack(side, SIDE_BODY_F, LEGS['strideA']))                   # WALK1
    f.append(stack(side, SIDE_BODY_F, LEGS['pass']))                      # WALK2
    f.append(stack(side, SIDE_BODY_B, LEGS['strideC']))                   # WALK3
    f.append(stack(side, SIDE_BODY_B, LEGS['pass']))                      # WALK4
    f.append(stack(side, SIDE_BODY_PUNCH, LEGS['tuck']))                  # JUMP1
    f.append(stack(side, SIDE_BODY_PUNCH, LEGS['tuck']))                  # JUMP2
    f.append(stack(side, SIDE_BODY_F, LEGS['strideA']))                   # JUMP3
    # JUMP: the classic fist in the air (arm behind the head, glove above the cap)
    f.append(Canvas(14, 29).put(GLOVE_UP, 9, 0).put(g(FRONT_HEAD), 0, 3)
             .put(BODY_ONEARM, 0, 18).put(FRONT_LEGS_AIR, 0, 24))
    f.append(stack(HEAD_BLINK, FRONT_BODY, FRONT_LEGS))                   # IDLE2
    f.append(stack(HEAD_LOOK, FRONT_BODY, FRONT_LEGS))                    # IDLE3
    f.append(stack(HEAD_CHOCK, FRONT_BODY, FRONT_LEGS))                   # CHOCK
    f.append(Canvas(22, 27).put(HEAD_GRIN, 4, 0).put(ROTATE_BODY, 0, 15))  # ROTATE
    # EDGE2 / EDGE1: leaning over the edge, arms windmilling
    e2 = Canvas(18, 26).put(GLOVE_UP, 0, 9).put(side, 3, 0).put(SIDE_BODY_B, 2, 15).put(LEGS['stand'], 0, 21)
    e1 = Canvas(18, 26).put(GLOVE_UP, 12, 9).put(side, 3, 0).put(SIDE_BODY_PUNCH, 2, 15).put(LEGS['stand'], 0, 21)
    f += [e2, e1]
    return f


# the same colours as fixed game-palette indices, for sprites drawn into data.dat (menu, instructions),
# which must look right whatever character (and so whatever slots 144-223) is loaded
FIXED = {'K': 1, 'R': 54, 'r': 52, 'B': 234, 'S': 35, 's': 34, 'H': 43, 'W': 63, 'Y': 60, 'N': 42}


def render(cv, scale=2, idx=None):
    idx = idx or {c: v[0] for c, v in PAL.items()}
    im = Image.new('P', (cv.w, cv.h), 0)
    for y in range(cv.h):
        for x in range(cv.w):
            c = cv.px[y][x]
            if c != '.':
                im.putpixel((x, y), idx[c])
    return im.resize((cv.w * scale, cv.h * scale), Image.NEAREST)


def game_palette(app):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import alleg, gfx
    objs = alleg.load(os.path.join(app, 'data', 'data.dat'))
    return [c for rgb in gfx.pal_from(objs[0]['data']) for c in rgb]


def find_boxes(t):
    """Frame boxes = connected non-background regions in the top band of the template."""
    px, (w, h) = t.load(), t.size
    bg, seen, boxes = px[0, 0], set(), []
    for x in range(w):
        for y in range(h):
            if px[x, y] != bg and (x, y) not in seen:
                st, xs, ys = [(x, y)], [], []
                seen.add((x, y))
                while st:
                    a, b = st.pop(); xs.append(a); ys.append(b)
                    for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                        if 0 <= c < w and 0 <= d < h and (c, d) not in seen and px[c, d] != bg:
                            seen.add((c, d)); st.append((c, d))
                bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
                if bw > 10 and bh > 30:
                    boxes.append((min(xs), min(ys), bw, bh))
    return sorted(boxes)


def build_bmp(app, out):
    t = Image.open(os.path.join(app, 'characters', 'template', 'template.bmp'))
    # the game takes its palette from the selected character: keep the game's own colours outside 144-223
    pal, tpal = game_palette(app), t.getpalette()
    pal[144 * 3:224 * 3] = tpal[144 * 3:224 * 3]
    for idx, rgb in PAL.values():
        pal[idx * 3:idx * 3 + 3] = list(rgb)
    boxes = find_boxes(t)
    assert len(boxes) == 15, boxes
    im = t.copy()
    for (bx, by, bw, bh), cv in zip(boxes, frames()):
        im.paste(0, (bx, by, bx + bw, by + bh))
        fr = render(cv)
        if fr.height > bh:
            fr = fr.crop((0, fr.height - bh, fr.width, fr.height))
        assert fr.width <= bw, (bw, fr.width)
        im.paste(fr, (bx + (bw - fr.width) // 2, by + bh - fr.height))
    im.putpalette(pal)
    im.save(out)
    return im, boxes


# ---------- synthesized 8-bit sound effects (original, square-wave) ----------
RATE = 22050


def tone(segs, vol=0.35, duty=0.5):
    """segs: list of (f_start, f_end, seconds); f=0 is silence."""
    out, ph = [], 0.0
    for f0, f1, dur in segs:
        n = int(RATE * dur)
        for i in range(n):
            f = f0 + (f1 - f0) * i / max(n - 1, 1)
            if f <= 0:
                out.append(0); continue
            ph = (ph + f / RATE) % 1.0
            env = min(1.0, (n - i) / (RATE * 0.01))  # click-free tail
            out.append(vol * env * (1 if ph < duty else -1))
    return out


def write_wav(path, samples):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(s * 32767)) for s in samples))


def note(n):  # MIDI note -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


SOUNDS = {
    'jump_lo.wav': lambda: tone([(note(60), note(72), 0.12)], duty=0.25),
    'jump_mid.wav': lambda: tone([(note(64), note(79), 0.16)], duty=0.25),
    'jump_hi.wav': lambda: tone([(note(67), note(91), 0.22), (note(91), note(96), 0.06)], duty=0.25),
    'hello.wav': lambda: tone([(note(n), note(n), 0.09) for n in (72, 76, 79, 84)] + [(note(88), note(88), 0.22)]),
    'falling.wav': lambda: tone([(note(84), note(48), 0.9), (0, 0, 0.1), (note(48), note(36), 0.3)]),
    'edge.wav': lambda: tone([(note(76), note(76), 0.05), (note(71), note(71), 0.05)] * 3, vol=0.25),
    'pause.wav': lambda: tone([(note(88), note(88), 0.07), (0, 0, 0.04), (note(84), note(84), 0.07),
                               (0, 0, 0.04), (note(88), note(88), 0.07), (0, 0, 0.04), (note(84), note(84), 0.12)]),
}

SCRIPT = """סופר מריו ל-Icy Tower (דמות מעריצים).
Mario is a trademark of Nintendo. Fan-made sprites, non-commercial.

# graphics (גרפיקה)
[frames] \t\tsuper_mario.bmp

# sound (צלילים)
[jumplo] \t\tjump_lo.wav
[jumpmed] \t\tjump_mid.wav
[jumphi]\t \tjump_hi.wav
[pause] \t \tpause.wav
[death]\t\t\tfalling.wav
[greeting]\t\thello.wav
[edge]\t\t\tedge.wav

# info (מידע)
סופר מריו - דמות מעריצים. מריו הוא סימן מסחרי של Nintendo.
"""


def main(app):
    d = os.path.join(app, 'characters', 'super_mario')
    os.makedirs(d, exist_ok=True)
    im, boxes = build_bmp(app, os.path.join(d, 'super_mario.bmp'))
    for name, fn in SOUNDS.items():
        write_wav(os.path.join(d, name), fn())
    with open(os.path.join(d, 'super_mario.txt'), 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(SCRIPT)
    # 4x preview for eyeballing
    im.convert('RGB').resize((im.width * 4, im.height * 4), Image.NEAREST).save(
        os.path.join(os.path.dirname(app), 'mario_preview.png'))
    print('ok', d, len(boxes), 'frames')


if __name__ == '__main__':
    main(sys.argv[1])
