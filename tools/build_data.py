"""Build Hebrew data.dat: add Hebrew glyph ranges to the fonts and swap text bitmaps.
usage: python -I build_data.py <orig data.dat> <out data.dat> [images_dir]"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg
import gfx
import hebfont
from PIL import Image


def main(src, dst, imgdir=None):
    objs = alleg.load(src)
    rubik = lambda size: hebfont.load_font('Rubik.ttf', size, [900])
    gen = {
        'FONT1': lambda: hebfont.font1_glyphs(rubik(34)),
        'FONT2': lambda: hebfont.font2_glyphs(rubik(21)),
        'FONT3': hebfont.font3_glyphs,
    }
    for o in objs:
        n = alleg.name(o)
        if o['type'] == b'FONT' and n in gen:
            rs = gfx.read_font(o['data'])
            rs = [r for r in rs if r['begin'] != 0x5D0]
            rs.append({'mono': rs[0]['mono'], 'begin': 0x5D0, 'glyphs': gen[n]()})
            o['data'] = gfx.write_font(rs)
            print('font', n, 'ranges', len(rs))
        elif o['type'] == b'BMP ' and imgdir:
            p = os.path.join(imgdir, n + '.png')
            if os.path.exists(p):
                bits = int.from_bytes(o['data'][:2], 'big', signed=True)
                w, h = int.from_bytes(o['data'][2:4], 'big'), int.from_bytes(o['data'][4:6], 'big')
                im = Image.open(p)
                assert im.mode == 'P' and bits == 8, (n, im.mode, bits)
                o['data'] = gfx.image_to_bmp(im, bits)
                print('bitmap', n, (w, h), '->', im.size)
    alleg.save(dst, objs)
    print('saved', dst)


if __name__ == '__main__':
    main(*sys.argv[1:])
