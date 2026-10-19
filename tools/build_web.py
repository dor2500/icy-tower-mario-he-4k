"""Export the game's own graphics, fonts and sounds for the HTML version (web/assets, not in git).

usage: python -I build_web.py <app dir (work\\he_app)> <out dir (web\\assets)> [xbrz_cli.exe]

Everything comes from the finished Hebrew + Mario build, so the web version looks exactly like the
desktop game. Every bitmap is written twice:
  1x/NAME.png  - the original pixels (index 0 = transparent)        -> "classic pixels" mode
  hd/NAME.webp - 6x xBRZ upscale (pixel-art aware, keeps edges sharp) -> HD mode, drawn at the
                 screen's native resolution (4K / 8K).
The original Icy Tower music is not exported: the music is S_BG_MENU of the built sfx13.dat, which
set_music.py made the Super Mario theme (local builds with -MarioAudio) or silence (public builds).
"""
import glob
import io
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg
import gfx

HD = 6
SKIP = {'REPLAY_BUTTONS', 'BROWSE_BUTTON', 'SORT_BUTTON_ALL', 'SORT_BUTTON_COMBO',
        'SORT_BUTTON_FLOOR', 'SORT_BUTTON_NAME', 'SORT_BUTTON_SCORE', 'VCR', 'VCR_LEFT', 'VCR_RIGHT', 'VCR_UP',
        'BT_NO', 'BT_YES', 'HINT'}
TILE_XY = {'BGTILE'}          # wraps in x and y
TILE_Y = {'SIDEBLOCK'}        # wraps in y
BIG = {'TITLE_BG', 'INSTRUCTIONS', 'REPLAY_BG'}
MARIO_NAMES = ['IDLE1', 'WALK1', 'WALK2', 'WALK3', 'WALK4', 'JUMP1', 'JUMP2', 'JUMP3', 'JUMP', 'IDLE2', 'IDLE3',
               'CHOCK', 'ROTATE', 'EDGE2', 'EDGE1']
SFX = ['S_AIGHT', 'S_AMAZING', 'S_CHEER', 'S_EXTREME', 'S_FANTASTIC', 'S_GAMEOVER', 'S_GOOD', 'S_GREAT',
       'S_HURRYUP', 'S_MENU_CHANGE', 'S_MENU_CHOOSE', 'S_RING', 'S_SPLAT', 'S_SPLENDID', 'S_STEP', 'S_SUPER',
       'S_SWEET', 'S_TRYAGAIN', 'S_UNBELIEVABLE', 'S_WOW']
XBRZ = None


def xbrz(im, factor, wrap_x=False, wrap_y=False):
    """RGBA PIL image -> factor x RGBA, via the xBRZ command line tool. Pads 4 px (wrapped or clear)."""
    a = np.array(im.convert('RGBA'))
    p = 4
    a = np.pad(a, ((p, p), (0, 0), (0, 0)), mode='wrap' if wrap_y else 'constant')
    a = np.pad(a, ((0, 0), (p, p), (0, 0)), mode='wrap' if wrap_x else 'constant')
    h, w = a.shape[:2]
    bgra = a[:, :, [2, 1, 0, 3]].copy()
    with tempfile.TemporaryDirectory() as td:
        src, dst = os.path.join(td, 'i.raw'), os.path.join(td, 'o.raw')
        bgra.tofile(src)
        subprocess.run([XBRZ, src, str(w), str(h), str(factor), dst], check=True)
        out = np.fromfile(dst, np.uint8).reshape(h * factor, w * factor, 4)[:, :, [2, 1, 0, 3]]
    out = out[p * factor:-p * factor, p * factor:-p * factor]
    return Image.fromarray(np.ascontiguousarray(out), 'RGBA')


def rgba(pim, transparent=True):
    im = pim.convert('RGBA')
    if transparent:
        a = np.array(im)
        a[np.array(pim) == 0, 3] = 0
        im = Image.fromarray(a, 'RGBA')
    return im


def save_pair(out, name, im1, hd, lossy=False):
    im1.save(os.path.join(out, '1x', name + '.png'), optimize=True)
    if lossy:
        hd.save(os.path.join(out, 'hd', name + '.webp'), quality=92, method=6)
    else:
        hd.save(os.path.join(out, 'hd', name + '.webp'), lossless=True, quality=100, method=4)


def export_bitmaps(objs, pal, out, meta):
    for o in objs:
        if o['type'] != b'BMP ':
            continue
        n = alleg.name(o)
        if n in SKIP:
            continue
        pim, _ = gfx.bmp_to_image(o['data'], pal)
        opaque = n in ('TITLE_BG', 'INSTRUCTIONS') or n in TILE_XY   # SIDEBLOCK has a ragged transparent edge
        im = rgba(pim, transparent=not opaque)
        hd = xbrz(im, HD, wrap_x=n in TILE_XY, wrap_y=n in TILE_XY or n in TILE_Y)
        save_pair(out, n, im, hd, lossy=n in BIG)
        meta['img'][n] = [im.width, im.height]
        print(' ', n, im.size)


FLOOR_SETS = [('FLOOR01', 'FLOOR02', 'FLOOR03'), ('FLOOR04', 'FLOOR05', 'FLOOR06'), ('FLOOR07', 'FLOOR08', 'FLOOR09'),
              ('FLOOR10', 'FLOOR11', 'FLOOR12'), ('FLOOR12a', 'FLOOR12b', 'FLOOR12c'), ('FLOOR13', 'FLOOR14', 'FLOOR15'),
              ('FLOOR16', 'FLOOR17', 'FLOOR18'), ('FLOOR18a', 'FLOOR18b', 'FLOOR18c'), ('FLOOR19', 'FLOOR20', 'FLOOR21'),
              ('FLOOR22', 'FLOOR23', 'FLOOR24'), ('FLOOR25', 'FLOOR26', 'FLOOR27')]


def export_floors_seamless(out):
    """Platforms are drawn as left cap + n x middle + right cap, top-aligned. Upscaling the pieces
    one by one would round off every joint, so each set is upscaled as one platform
    (left, 3 x middle, right) and the HD pieces are cut back out of it."""
    for l, m, r in FLOOR_SETS:
        L, M, R = (Image.open(os.path.join(out, '1x', n + '.png')) for n in (l, m, r))
        H = max(L.height, M.height, R.height)
        W = L.width + 3 * M.width + R.width
        comp = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        comp.paste(L, (0, 0)); x = L.width
        for _ in range(3):
            comp.paste(M, (x, 0)); x += M.width
        comp.paste(R, (x, 0))
        hd = xbrz(comp, HD)
        cuts = [(l, 0, L), (m, L.width + M.width, M), (r, L.width + 3 * M.width, R)]
        for n, x0, im in cuts:
            piece = hd.crop((x0 * HD, 0, (x0 + im.width) * HD, im.height * HD))
            piece.save(os.path.join(out, 'hd', n + '.webp'), lossless=True, quality=100, method=4)


def export_bgstrip(objs, pal, out, meta, seed=1):
    """The tower's back wall, built like icytower13.exe does at the start of every game (0x4070b0):
    1. BGTILE bricks stretched onto a cylinder: 4 rows of 32 px, each brick 64 - d/4 px wide at distance d
       from the centre, every other row shifted half a brick;
    2. every pixel: shade index c - 8*cos(d/6 allegro-degrees) + noise(-1..1), clamped to the 16..31 ramp
       (anything outside the ramp, i.e. mortar, counts as 20);
    3. in-place 3x3 blur (centre counted twice, /10) on rows 32..95, which become the 640x64 strip."""
    import math
    import random
    rnd = random.Random(seed)
    tile = next(o for o in objs if alleg.name(o) == 'BGTILE')['data']
    tw, th = 64, 32
    tpx = np.frombuffer(tile[6:6 + tw * th], np.uint8).reshape(th, tw)
    buf = np.zeros((128, 640), np.int32)

    def stretch(x0, y0, w):
        for dx in range(w):
            x = x0 + dx
            if 0 <= x < 640:
                sx = (dx * ((tw << 16) // w)) >> 16
                col = tpx[:, sx]
                m = col != 0
                buf[y0:y0 + th, x][m] = col[m]

    for row in range(4):
        d = 32 if row % 2 == 0 else 0
        for _ in range(15):
            w = 64 - (d >> 2)
            half = w >> 1
            stretch(d - half + 320, row * 32, w)
            stretch(-d - half + 320, row * 32, w)
            d += w
    for y in range(128):
        for x in range(640):
            c = buf[y, x]
            if not 16 <= c <= 31:
                c = 20
            dist = abs(x - 320)
            a = dist // 6
            v = math.trunc(c - math.cos(a * 2 * math.pi / 256) * 8 + rnd.randrange(3) - 1)
            buf[y, x] = 31 if v > 31 else (16 if v <= 15 else v)
    for y in range(32, 96):
        for x in range(1, 639):
            s = (buf[y, x] + buf[y - 1, x + 1] + buf[y, x + 1] + buf[y + 1, x + 1] + buf[y - 1, x] + buf[y, x]
                 + buf[y + 1, x] + buf[y - 1, x - 1] + buf[y, x - 1] + buf[y + 1, x - 1])
            v = s // 10
            buf[y, x] = 16 if v <= 15 else (31 if v > 31 else v)
    strip = buf[32:96]
    lut = np.array(pal, np.uint8)
    im = Image.fromarray(lut[strip], 'RGB').convert('RGBA')
    hd = xbrz(im, HD, wrap_y=True)
    save_pair(out, 'BGSTRIP', im, hd)
    meta['img']['BGSTRIP'] = [640, 64]


def export_fonts(objs, pal, out, meta):
    """Each font -> one atlas strip (2 px gaps). Colour fonts keep their colours; FONT3 (mono) is
    written once in white (palette 15) and once in black (palette 1), the two colours the game uses."""
    for o in objs:
        if o['type'] != b'FONT':
            continue
        n = alleg.name(o)
        ranges = gfx.read_font(o['data'])
        glyphs = []
        for r in ranges:
            for i, (w, h, px) in enumerate(r['glyphs']):
                glyphs.append((r['begin'] + i, w, h, px, r['mono']))
        H = max(g[2] for g in glyphs)
        variants = [('', None)] if not glyphs[0][4] else [('_w', 15), ('_k', 1)]
        W = 600  # atlas rows (WebP max side is 16383 px, i.e. 2730 px before the 6x)
        pos, x, y = [], 2, 2
        for cp, w, h, px, mono in glyphs:
            if x + w + 2 > W:
                x, y = 2, y + H + 4
            pos.append((x, y))
            x += w + 4
        AH = y + H + 2
        for suf, col in variants:
            atlas = np.zeros((AH, W, 4), np.uint8)
            info = {}
            for (cp, w, h, px, mono), (x, y) in zip(glyphs, pos):
                if mono:
                    bpr = (w + 7) // 8
                    bits = np.unpackbits(np.frombuffer(px, np.uint8).reshape(h, bpr), axis=1)[:, :w]
                    rgb = pal[col]
                    g = np.zeros((h, w, 4), np.uint8)
                    g[bits == 1] = (*rgb, 255)
                else:
                    idx = np.frombuffer(px, np.uint8).reshape(h, w)
                    lut = np.array([(*c, 255) for c in pal], np.uint8)
                    g = lut[idx]
                    g[idx == 0, 3] = 0
                atlas[y:y + h, x:x + w] = g
                info[cp] = [x, y, w, h]
            im = Image.fromarray(atlas, 'RGBA')
            save_pair(out, n + suf, im, xbrz(im, HD))
            meta['font'][n + suf] = {'h': H, 'g': info}
            print(' ', n + suf, im.size, len(info), 'glyphs')


def export_mario(app, out, meta):
    """The 15 frames of the super_mario character. They are 2x pixel art, so xBRZ works on the
    half-resolution grid (6x) and a Lanczos 2x brings it to the same 6x-of-game size as the rest."""
    bmp = Image.open(os.path.join(app, 'characters', 'super_mario', 'super_mario.bmp'))
    import make_mario  # frame boxes = connected non-background regions
    boxes = make_mario.find_boxes(bmp)
    assert len(boxes) == 15, boxes
    for name, (bx, by, bw, bh) in zip(MARIO_NAMES, boxes):
        fr = bmp.crop((bx, by, bx + bw, by + bh))
        im = rgba(fr)
        # sample the 2x2 blocks (the art sits on an even grid inside the box: offset found per frame)
        best = None
        for ox in (0, 1):
            for oy in (0, 1):
                sub = np.array(im)[oy:, ox:]
                hh, ww = sub.shape[0] // 2 * 2, sub.shape[1] // 2 * 2
                s = sub[:hh, :ww]
                blocks = s.reshape(hh // 2, 2, ww // 2, 2, 4)
                err = int((blocks != blocks[:, :1, :, :1]).sum())
                if best is None or err < best[0]:
                    best = (err, ox, oy, blocks[:, 0, :, 0])
        _, ox, oy, g = best
        gi = Image.fromarray(np.ascontiguousarray(g), 'RGBA')
        hd = xbrz(gi, 6).resize((gi.width * 12, gi.height * 12), Image.LANCZOS)
        canvas = Image.new('RGBA', (bw * HD, bh * HD), (0, 0, 0, 0))
        canvas.paste(hd, (ox * HD, oy * HD))
        name = 'MARIO_' + name
        save_pair(out, name, im, canvas)
        meta['img'][name] = [bw, bh]
        print(' ', name, (bw, bh), 'grid offset', ox, oy)


def export_icons(out):
    """App icons: Mario's title-screen face on the title screen's brick wall."""
    os.makedirs(os.path.join(out, 'icons'), exist_ok=True)
    bg = Image.open(os.path.join(out, 'hd', 'TITLE_BG.webp')).convert('RGBA')
    face = Image.open(os.path.join(out, 'hd', 'HEROFACE000.webp')).convert('RGBA')
    base = bg.crop((0, 0, bg.height // 2, bg.height // 2)).resize((1024, 1024), Image.LANCZOS)
    k = 900 / max(face.size)
    f = face.resize((round(face.width * k), round(face.height * k)), Image.LANCZOS)
    base.alpha_composite(f, ((1024 - f.width) // 2, (1024 - f.height) // 2 + 20))
    for s in (512, 192, 180):
        base.resize((s, s), Image.LANCZOS).convert('RGB').save(os.path.join(out, 'icons', 'icon-%d.png' % s), optimize=True)


def ffmpeg(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)


def export_sounds(app, out, meta):
    sfx = {alleg.name(o): o['data'] for o in alleg.load(os.path.join(app, 'data', 'sfx13.dat'))
           if o['type'] == b'OGG '}
    with tempfile.TemporaryDirectory() as td:
        for n in SFX:
            src = os.path.join(td, n + '.ogg')
            open(src, 'wb').write(sfx[n])
            ffmpeg(['-i', src, '-ac', '1', '-ar', '44100', '-b:a', '96k', os.path.join(out, 'sfx', n + '.mp3')])
            meta['sfx'].append(n)
    # extra Hebrew voice lines of the stage mode (tools/voice/V_*.ogg, made by make_voice.py)
    vdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voice')
    for f in sorted(glob.glob(os.path.join(vdir, 'V_*.ogg'))):
        n = os.path.splitext(os.path.basename(f))[0]
        ffmpeg(['-i', f, '-ac', '1', '-ar', '44100', '-b:a', '96k', os.path.join(out, 'sfx', n + '.mp3')])
        meta['sfx'].append(n)
    # the character's own sounds (smb_*.wav when the user's recordings were imported, else the synth ones)
    d = os.path.join(app, 'characters', 'super_mario')
    txt = open(os.path.join(d, 'super_mario.txt'), encoding='utf-8').read()
    keys = {}
    for line in txt.splitlines():
        line = line.strip()
        if line.startswith('[') and ']' in line:
            k, v = line[1:].split(']', 1)
            keys[k.strip()] = v.strip()
    for k in ['jumplo', 'jumpmed', 'jumphi', 'pause', 'death', 'greeting', 'edge']:
        if k in keys:
            ffmpeg(['-i', os.path.join(d, keys[k]), '-ac', '1', '-ar', '44100', '-b:a', '128k',
                    os.path.join(out, 'sfx', 'C_' + k + '.mp3')])
            meta['char'].append(k)
    # music = the game's S_BG_MENU, which set_music.py made the Mario theme (or 1 s of silence = no music)
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, 'm.ogg')
        open(src, 'wb').write(sfx['S_BG_MENU'])
        wav = os.path.join(out, 'sfx', 'MUSIC.wav')
        # WAV on purpose: decoded sample-exact, so the loop is seamless in every browser
        ffmpeg(['-i', src, '-ac', '1', '-ar', '22050', '-sample_fmt', 's16', wav])
        with wave.open(wav) as w:
            dur = w.getnframes() / w.getframerate()
        if dur > 2:
            meta['music'] = dur
            print('  music: Super Mario theme', round(dur, 2), 's')
        else:
            os.remove(wav)
            print('  music: none (public build)')


def main(app, out, xbrz_exe):
    global XBRZ
    XBRZ = xbrz_exe
    if os.path.isdir(out):
        import shutil
        shutil.rmtree(out)                 # generated folder: start clean (e.g. no music left from a local build)
    for sub in ('1x', 'hd', 'sfx'):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    objs = alleg.load(os.path.join(app, 'data', 'data.dat'))
    # the game runs with the selected character's palette (super_mario.bmp): same colours outside 144-223
    cpal = Image.open(os.path.join(app, 'characters', 'super_mario', 'super_mario.bmp')).getpalette()
    pal = [tuple(cpal[i * 3:i * 3 + 3]) for i in range(256)]
    meta = {'hd': HD, 'img': {}, 'font': {}, 'sfx': [], 'char': [], 'music': 0,
            'pal': {'1': pal[1], '15': pal[15]}}
    print('bitmaps'); export_bitmaps(objs, pal, out, meta)
    export_floors_seamless(out)
    export_bgstrip(objs, pal, out, meta)
    print('fonts'); export_fonts(objs, pal, out, meta)
    print('mario'); export_mario(app, out, meta)
    print('sounds'); export_sounds(app, out, meta)
    export_icons(out)
    with open(os.path.join(out, 'assets.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, separators=(',', ':'))
    print('done', out)


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], sys.argv[2],
         sys.argv[3] if len(sys.argv) > 3 else os.path.join(here, '..', 'work', 'bin', 'xbrz_cli.exe'))
