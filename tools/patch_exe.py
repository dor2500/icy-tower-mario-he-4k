"""Patch icytower13.exe (UPX-unpacked) with Hebrew strings.
usage: python -I patch_exe.py <in.exe> <out.exe>"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bidi
from strings_he import SCROLLER, T

BASE = 0x400000
SCROLLER_EN = b'Welcome to Icy Tower!'


def sections(d):
    pe = struct.unpack_from('<I', d, 0x3C)[0]
    nsec = struct.unpack_from('<H', d, pe + 6)[0]
    opt = struct.unpack_from('<H', d, pe + 20)[0]
    sh = pe + 24 + opt
    secs = []
    for i in range(nsec):
        o = sh + 40 * i
        name = d[o:o + 8].rstrip(b'\0')
        vsize, va, rsize, raw = struct.unpack_from('<IIII', d, o + 8)
        secs.append(dict(name=name, vsize=vsize, va=va, rsize=rsize, raw=raw, hdr=o))
    return pe, sh, secs


def off2va(secs, off):
    for s in secs:
        if s['raw'] <= off < s['raw'] + s['rsize']:
            return BASE + s['va'] + off - s['raw']
    raise ValueError(hex(off))


def main(src, dst):
    d = bytearray(open(src, 'rb').read())
    pe, sh, secs = sections(d)
    # game string areas: .data head (menus/scroller) and .rdata
    data = next(s for s in secs if s['name'] == b'.data')
    rdata = next(s for s in secs if s['name'] == b'.rdata')
    text = next(s for s in secs if s['name'] == b'.text')
    areas = [(0x9C000, 0x9D200), (rdata['raw'], rdata['raw'] + rdata['rsize'])]
    ref_ranges = [(text['raw'], text['raw'] + text['rsize']), (data['raw'], data['raw'] + data['rsize'])]

    jobs = []  # (file_offset, old_len, new_bytes, label)
    for entry in T:
        en, he = entry[:2]
        opt = entry[2] if len(entry) > 2 else ''
        pat = en.encode('ascii') + b'\0'
        found = []
        for a, b in areas:
            i = a
            while True:
                i = d.find(pat, i, b)
                if i < 0:
                    break
                if d[i - 1] == 0 or opt == 'anyprev':
                    found.append(i)
                i += 1
        if not found:
            print('NOT FOUND', repr(en))
        vis = he if opt == 'logical' else bidi.visual(he)
        for i in found:
            jobs.append((i, len(en), vis.encode('utf-8') + b'\0', en))
    i = d.find(SCROLLER_EN, 0x9C000, 0x9D200)
    old = d[i:d.index(b'\0', i)]
    jobs.append((i, len(old), bidi.scroller(SCROLLER).encode('utf-8') + b'\0', 'scroller'))

    # new section for strings that do not fit
    last = secs[-1]
    new_va = (last['va'] + last['vsize'] + 0xFFF) & ~0xFFF
    new_raw = (len(d) + 0x1FF) & ~0x1FF
    blob = bytearray()
    in_menu_slot = lambda off: 0x9C0E0 <= off < 0x9D200
    for off, oldlen, nb, label in jobs:
        cap = 0x80 if in_menu_slot(off) else (0xC0 if label == 'scroller' else oldlen + 1)
        if len(nb) <= cap:
            d[off:off + len(nb)] = nb
            for k in range(off + len(nb), off + oldlen + 1):
                d[k] = 0
            continue
        va_old = off2va(secs, off)
        va_new = BASE + new_va + len(blob)
        blob += nb
        while len(blob) % 4:
            blob += b'\0'
        key = struct.pack('<I', va_old)
        nref = 0
        for a, b in ref_ranges:
            j = a
            while True:
                j = d.find(key, j, b)
                if j < 0:
                    break
                d[j:j + 4] = struct.pack('<I', va_new)
                nref += 1
                j += 4
        if nref == 0:
            print('NO REFS (left English):', label)
        else:
            print('relocated %-40s refs=%d' % (label[:40], nref))

    # append section
    rsize = (len(blob) + 0x1FF) & ~0x1FF
    d += b'\0' * (new_raw - len(d))
    d += blob + b'\0' * (rsize - len(blob))
    nsec = len(secs)
    o = sh + 40 * nsec
    assert d[o:o + 40] == b'\0' * 40, 'no room for section header'
    d[o:o + 40] = b'.heb\0\0\0\0' + struct.pack('<IIIIIIHHI', len(blob), new_va, rsize, new_raw, 0, 0, 0, 0, 0x40000040)
    struct.pack_into('<H', d, pe + 6, nsec + 1)
    struct.pack_into('<I', d, pe + 24 + 56, (new_va + rsize + 0xFFF) & ~0xFFF)  # SizeOfImage
    open(dst, 'wb').write(d)
    print('ok', dst, len(d))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
