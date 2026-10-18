"""Minimal Allegro 4 datafile reader/writer (password-encrypted, LZSS packed or not)."""
import struct

PASSWORD = b'florgost'
F_PACK = b'slh!'
F_NOPACK = b'slh.'
N, F, TH = 4096, 18, 2


def xor(data, pw=PASSWORD):
    if not pw:
        return bytes(data)
    k = (pw * (len(data) // len(pw) + 1))[:len(data)]
    return bytes(a ^ b for a, b in zip(data, k))


def lzss_unpack(src):
    buf = bytearray(N)
    r = N - F
    out = bytearray()
    i = 0
    flags = 0
    n = len(src)
    while True:
        flags >>= 1
        if not flags & 0x100:
            if i >= n:
                break
            flags = src[i] | 0xFF00
            i += 1
        if flags & 1:
            if i >= n:
                break
            c = src[i]; i += 1
            out.append(c); buf[r] = c; r = (r + 1) & (N - 1)
        else:
            if i + 1 >= n:
                break
            a, b = src[i], src[i + 1]; i += 2
            a |= (b & 0xF0) << 4
            b = (b & 0x0F) + TH
            for k in range(b + 1):
                c = buf[(a + k) & (N - 1)]
                out.append(c); buf[r] = c; r = (r + 1) & (N - 1)
    return bytes(out)


def mgetl(d, p):
    return struct.unpack('>i', d[p:p + 4])[0], p + 4


def tag(s):
    return s.encode() if isinstance(s, str) else s


def read_file(path, pw=PASSWORD):
    raw = open(path, 'rb').read()
    body = xor(raw[4:], pw)
    hdr = bytes(a ^ b for a, b in zip(raw[:4], b'\x06\x1c\x03\x2b')) if pw else raw[:4]  # observed mask
    if hdr == F_PACK:
        body = lzss_unpack(body)
    elif hdr != F_NOPACK:
        raise ValueError('unknown header %r' % raw[:4])
    return body


def parse_objects(d, p):
    """d starts at 'ALL.'-less position p pointing to object count. Returns (objs, p)."""
    count, p = mgetl(d, p)
    objs = []
    while len(objs) < count:
        props = []
        while True:
            t = d[p:p + 4]; p += 4
            if t == b'prop':
                pt = d[p:p + 4]; p += 4
                sz, p = mgetl(d, p)
                props.append((pt, d[p:p + sz])); p += sz
            else:
                break
        typ = t
        sz, p = mgetl(d, p)
        usz, p = mgetl(d, p)
        data = d[p:p + sz]; p += sz
        if sz != usz and sz > 0 and usz > 0:
            # nested packed chunk
            data = lzss_unpack(data)
        obj = {'type': typ, 'props': props, 'data': data}
        if typ == b'FILE':
            assert data[:0] == b''
            sub, _ = parse_objects(data, 0)
            obj['children'] = sub
        objs.append(obj)
    return objs, p


def load(path, pw=PASSWORD):
    d = read_file(path, pw)
    assert d[:4] == b'ALL.', d[:4]
    objs, _ = parse_objects(d, 4)
    return objs


def name(o):
    for t, v in o['props']:
        if t == b'NAME':
            return v.decode('latin-1')
    return ''


def ser_objects(objs):
    out = bytearray(struct.pack('>i', len(objs)))
    for o in objs:
        for t, v in o['props']:
            out += b'prop' + t + struct.pack('>i', len(v)) + v
        data = ser_objects(o['children']) if o['type'] == b'FILE' else o['data']
        out += o['type'] + struct.pack('>ii', len(data), len(data)) + data
    return bytes(out)


def save(path, objs, pw=PASSWORD):
    body = b'ALL.' + ser_objects(objs)
    hdr = bytes(a ^ b for a, b in zip(F_NOPACK, b'\x06\x1c\x03\x2b')) if pw else F_NOPACK
    open(path, 'wb').write(hdr + xor(body, pw))
