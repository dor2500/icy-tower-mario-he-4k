"""Mario GUI for data.dat: title-screen face (HEROFACE000-002), menu cursor (MENU_BULLET) and the
Harold sprites on the instructions screen. Writes P-mode PNGs (game palette, fixed indices only)
into the build_data.py images folder; run after make_images.py.
usage: python -I make_mario_gui.py <orig data.dat> <images dir>"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg
import gfx
import make_mario as mm

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
S = 4  # supersampling factor: shapes are drawn at 4x and reduced by majority vote

# fixed game-palette indices
K, WHITE = 1, 63
RED, RED_D, RED_DD, RED_HI = 54, 53, 52, 55
SKIN, SKIN_D, SKIN_HI = 35, 34, 56
BLUE, BLUE_D = 33, 32
BROWN, BROWN_D, MOUSTACHE = 42, 43, 49
TONGUE = 53


class Face:
    def __init__(self, w, h):
        self.w, self.h = w * S, h * S
        self.px = np.zeros((self.h, self.w), np.uint8)
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        self.yy, self.xx = yy, xx

    def ell(self, x0, y0, x1, y1):
        cx, cy, rx, ry = (x0 + x1) / 2 * S, (y0 + y1) / 2 * S, (x1 - x0) / 2 * S, (y1 - y0) / 2 * S
        return ((self.xx - cx) / rx) ** 2 + ((self.yy - cy) / ry) ** 2 <= 1

    def poly(self, pts, kind='polygon', **kw):
        im = Image.new('L', (self.w, self.h), 0)
        d = ImageDraw.Draw(im)
        if kind in ('polygon', 'line'):
            getattr(d, kind)([(x * S, y * S) for x, y in pts], fill=255, **kw)
        else:  # chord / arc: [x0, y0, x1, y1, start, end]
            getattr(d, kind)([v * S for v in pts[:4]], pts[4], pts[5], fill=255, **kw)
        return np.array(im) > 127

    def text(self, s, cx, cy, size):
        im = Image.new('L', (self.w, self.h), 0)
        f = ImageFont.truetype(os.path.join(FONTS, 'Rubik.ttf'), size * S)
        try:
            f.set_variation_by_axes([900])
        except Exception:
            pass
        ImageDraw.Draw(im).text((cx * S, cy * S), s, font=f, fill=255, anchor='mm')
        return np.array(im) > 127

    def fill(self, m, idx, outline=0, clip=None):
        if clip is not None:
            m = m & clip
        if outline:
            o = ndi.distance_transform_edt(~m) <= outline * S
            if clip is not None:
                o &= clip
            self.px[o] = K
        self.px[m] = idx
        return m

    def reduce(self):
        h, w = self.h // S, self.w // S
        blocks = self.px.reshape(h, S, w, S).transpose(0, 2, 1, 3).reshape(h, w, S * S)
        out = np.zeros((h, w), np.uint8)
        for v in np.unique(blocks):
            cnt = (blocks == v).sum(2)
            better = cnt > (blocks == out[..., None]).sum(2)
            out[better] = v
        return out


def mario_face(mood, w, h):
    f = Face(w, h)
    ox = (w - 206) / 2  # all moods share one design, centred in the original bitmap width

    def E(x0, y0, x1, y1):
        return f.ell(x0 + ox, y0, x1 + ox, y1)

    def P(pts, kind='polygon', **kw):
        if kind in ('polygon', 'line'):
            pts = [(x + ox, y) for x, y in pts]
        else:
            pts = [pts[0] + ox, pts[1], pts[2] + ox, pts[3]] + list(pts[4:])
        return f.poly(pts, kind, **kw)

    # hair tufts and ears behind the face
    f.fill(E(16, 118, 62, 186), BROWN_D, 4)
    f.fill(E(144, 118, 190, 186), BROWN_D, 4)
    f.fill(E(10, 146, 44, 194), SKIN, 4)
    f.fill(E(162, 146, 196, 194), SKIN, 4)
    f.fill(E(20, 158, 36, 184), SKIN_D)
    f.fill(E(170, 158, 186, 184), SKIN_D)
    # face with soft cel shading (shadow on the right and under the cap brim)
    face = f.fill(E(30, 92, 176, 250), SKIN_D, 5)
    f.fill(E(26, 84, 164, 240), SKIN, clip=face)
    f.fill(E(24, 112, 182, 150), SKIN_D, clip=face)
    # mouth (under the moustache)
    if mood == 'grin':
        m = f.fill(P([62, 196, 144, 250, 0, 180], 'chord'), WHITE, 4)
        for x in range(76, 140, 12):
            f.fill(P([(x, 214), (x, 250)], 'line', width=2 * S), K, clip=m)
        f.fill(P([(62, 226), (144, 226)], 'line', width=2 * S), K, clip=m)
    elif mood == 'smile':
        f.fill(P([66, 196, 140, 244, 25, 155], 'arc', width=5 * S), K)
        f.fill(E(58, 210, 74, 226), SKIN_D)
        f.fill(E(132, 210, 148, 226), SKIN_D)
    else:  # 'oh'
        m = f.fill(E(88, 216, 118, 250), K, 3)
        f.fill(E(93, 234, 113, 252), TONGUE, clip=m)
    # moustache: bumpy black-brown band
    tache = np.zeros_like(f.px, bool)
    for box in [(38, 196, 82, 228), (58, 192, 104, 232), (102, 192, 148, 232), (124, 196, 168, 228), (78, 198, 128, 230)]:
        tache |= E(*box)
    f.fill(tache, MOUSTACHE, 4)
    f.fill(E(64, 198, 92, 210), BROWN_D, clip=tache)
    f.fill(E(114, 198, 142, 210), BROWN_D, clip=tache)
    # eyes (the eyebrows are hidden under the brim)
    for x0 in (60, 112):
        ew = f.fill(E(x0, 146, x0 + 34, 196), WHITE, 3)
        f.fill(E(x0 + 9, 156, x0 + 29, 192), BLUE, clip=ew)
        f.fill(E(x0 + 13, 162, x0 + 27, 190), K, clip=ew)
        f.fill(E(x0 + 15, 164, x0 + 21, 173), WHITE, clip=ew)
    # nose on top of the moustache
    nose = f.fill(E(72, 166, 134, 214), SKIN_D, 4)
    f.fill(E(70, 162, 126, 206), SKIN, clip=nose)
    f.fill(E(86, 174, 102, 188), SKIN_HI, clip=nose)
    # cap: dome (cut at the brim line), shading, badge, brim
    dome = E(6, 2, 200, 176) & (f.yy < 122 * S)
    f.fill(dome, RED_D, 5)
    f.fill(E(0, -6, 184, 160), RED, clip=dome)
    f.fill(E(34, 14, 74, 40), RED_HI, clip=dome)
    badge = f.fill(E(70, 26, 136, 88), WHITE, 4)
    f.fill(f.text('M', 103 + ox, 58, 46), RED, clip=badge)
    brim = E(0, 96, 206, 142) & ~E(16, 64, 190, 116)
    brim |= E(10, 100, 196, 140) & (f.yy > 112 * S)
    f.fill(brim, RED_DD, 5)
    f.fill(E(10, 104, 186, 134) & brim, RED_D, clip=brim)
    # sideburns in front of the ears
    f.fill(P([(30, 132), (54, 136), (50, 164), (40, 182), (30, 162)]), BROWN_D, 3)
    f.fill(P([(176, 132), (152, 136), (156, 164), (166, 182), (176, 162)]), BROWN_D, 3)
    return f.reduce()


def save(px, path, flat):
    im = Image.fromarray(px.astype(np.uint8), 'P')
    im.putpalette(flat)
    im.save(path)


def sprite(cv, scale):
    return np.array(mm.render(cv, scale, mm.FIXED))


def paste(px, spr, cx, bottom):
    h, w = spr.shape
    x0, y0 = int(cx - w // 2), int(bottom - h)
    reg = px[y0:y0 + h, x0:x0 + w]
    m = spr != 0
    reg[m] = spr[m]


def inpaint(px, mask):
    """Fill masked pixels from the nearest unmasked pixel."""
    idx = ndi.distance_transform_edt(mask, return_distances=False, return_indices=True)
    return px[tuple(idx)]


def main(src, outdir):
    objs = alleg.load(src)
    pal = gfx.pal_from(objs[0]['data'])
    flat = [c for t in pal for c in t]
    sizes = {}
    for o in objs:
        if o['type'] == b'BMP ':
            im, _ = gfx.bmp_to_image(o['data'], pal)
            sizes[alleg.name(o)] = im.size

    for name, mood in [('HEROFACE000', 'grin'), ('HEROFACE001', 'smile'), ('HEROFACE002', 'oh')]:
        w, h = sizes[name]
        px = mario_face(mood, w, h)
        save(px, os.path.join(outdir, name + '.png'), flat)
        if mood == 'grin':  # app icon (exe, window, installer, launcher)
            rgba = np.zeros(px.shape + (4,), np.uint8)
            rgba[..., :3] = np.array(pal, np.uint8)[px]
            rgba[..., 3] = (px != 0) * 255
            ys, xs = np.nonzero(px)
            im = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
            side = max(im.size) + 8
            sq = Image.new('RGBA', (side, side))
            sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
            sq.resize((256, 256), Image.LANCZOS).save(os.path.join(outdir, 'mario.ico'),
                                                      sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (256, 256)])

    fr = mm.frames()
    side = mm.g(mm.SIDE_HEAD)
    # menu cursor: Mario pointing right (glove at the right edge, like Harold's)
    w, h = sizes['MENU_BULLET']
    cur = mm.Canvas(w // 2, h // 2).put(side, 3, 0).put(mm.SIDE_BODY_PUNCH, 3, 15).put(mm.LEGS['stand'], 3, 21)
    save(sprite(cur, 2), os.path.join(outdir, 'MENU_BULLET.png'), flat)

    # instructions: swap each Harold for a Mario in a similar pose
    p = os.path.join(outdir, 'INSTRUCTIONS.png')
    px = np.array(Image.open(p))
    # find Harold by colours Mario does not use (hat, shirt, trousers) so re-runs are no-ops
    lab, _ = ndi.label(ndi.binary_dilation(np.isin(px, [32, 33, 36, 37, 38, 39, 40, 41]), iterations=3))
    harold = (px >= 32) & (px <= 43)
    pose = {  # by box position: big sprites at 2x, the ones inside the screenshots at 1x
        (571, 27): (fr[14], 2), (13, 77): (fr[0], 2), (59, 267): (fr[6], 2),
        (321, 241): (fr[0], 1), (513, 260): (fr[0], 1),
    }
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        ys, xs = sl
        key = (xs.start, ys.start)
        cv, sc = pose.get(key, (fr[5], 1))
        # erase Harold and his dark outline anywhere in his (dilated) area
        m = (lab == i) & (harold | np.isin(px, [1, 2, 11, 15, 16]))
        px = np.where(m, inpaint(px, m), px)
        paste(px, sprite(cv, sc), (xs.start + xs.stop) / 2, ys.stop - 3)
    save(px, p, flat)
    print('mario gui ->', outdir)


if __name__ == '__main__':
    main(*sys.argv[1:])
