"""Allegro 4 BMP / FONT object <-> Pillow helpers."""
import struct
from PIL import Image


def pal_from(obj_data):
    # PAL: 256 * (r,g,b,pad) 6-bit
    return [(obj_data[i*4] * 255 // 63, obj_data[i*4+1] * 255 // 63, obj_data[i*4+2] * 255 // 63) for i in range(256)]


def bmp_to_image(data, pal):
    bits, w, h = struct.unpack('>hhh', data[:6])
    px = data[6:]
    if bits == 8:
        im = Image.frombytes('P', (w, h), px[:w*h])
        im.putpalette([c for rgb in pal for c in rgb])
        return im, bits
    if bits in (15, 16, -15, -16):
        im = Image.new('RGB', (w, h))
        vals = struct.unpack('>%dH' % (w*h), px[:w*h*2])
        im.putdata([((v >> 11 & 31) * 255 // 31, (v >> 5 & 63) * 255 // 63, (v & 31) * 255 // 31) for v in vals])
        return im, bits
    if bits in (24, -24):
        return Image.frombytes('RGB', (w, h), px[:w*h*3]), bits
    if bits in (32, -32):
        im = Image.frombytes('RGBA', (w, h), px[:w*h*4])
        return im, bits
    raise ValueError(bits)


def image_to_bmp(im, bits):
    w, h = im.size
    if bits == 8:
        px = im.tobytes()
    elif bits in (15, 16, -15, -16):
        rgb = im.convert('RGB').getdata()
        px = struct.pack('>%dH' % (w*h), *[((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3) for r, g, b in rgb])
    elif bits in (24, -24):
        px = im.convert('RGB').tobytes()
    else:
        px = im.convert('RGBA').tobytes()
    return struct.pack('>hhh', bits, w, h) + px


def read_font(d):
    """Return list of ranges: {'mono', 'begin', 'glyphs': [(w,h,bytes)]}"""
    p = 0
    typ, = struct.unpack('>h', d[p:p+2]); p += 2
    if typ != 0:
        raise ValueError('font type %d' % typ)
    n, = struct.unpack('>h', d[p:p+2]); p += 2
    ranges = []
    for _ in range(n):
        mono = d[p]; p += 1
        begin, end = struct.unpack('>ii', d[p:p+8]); p += 8
        glyphs = []
        for _c in range(begin, end + 1):
            w, h = struct.unpack('>hh', d[p:p+4]); p += 4
            sz = ((w + 7) // 8) * h if mono else w * h
            glyphs.append((w, h, d[p:p+sz])); p += sz
        ranges.append({'mono': mono, 'begin': begin, 'glyphs': glyphs})
    assert p == len(d), (p, len(d))
    return ranges


def write_font(ranges):
    out = bytearray(struct.pack('>hh', 0, len(ranges)))
    for r in ranges:
        out += bytes([r['mono']]) + struct.pack('>ii', r['begin'], r['begin'] + len(r['glyphs']) - 1)
        for w, h, px in r['glyphs']:
            out += struct.pack('>hh', w, h) + px
    return bytes(out)
