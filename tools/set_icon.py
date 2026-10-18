"""Put a multi-size .ico into an exe as the ALLEGRO_ICON group (the one Allegro uses for its window)
and as the first group (Explorer / taskbar icon). Windows only.
usage: python -I set_icon.py <exe> <ico>"""
import ctypes
import struct
import sys
from ctypes import wintypes

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
k32.BeginUpdateResourceW.restype = wintypes.HANDLE
k32.BeginUpdateResourceW.argtypes = [wintypes.LPCWSTR, wintypes.BOOL]
k32.UpdateResourceW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p, wintypes.WORD, ctypes.c_void_p, wintypes.DWORD]
k32.EndUpdateResourceW.argtypes = [wintypes.HANDLE, wintypes.BOOL]
RT_ICON, RT_GROUP_ICON, LANG = 3, 14, 1033


def main(exe, ico):
    d = open(ico, 'rb').read()
    _, _, n = struct.unpack('<HHH', d[:6])
    entries = [struct.unpack('<BBBBHHII', d[6 + 16 * i:22 + 16 * i]) for i in range(n)]
    h = k32.BeginUpdateResourceW(exe, False)
    if not h:
        raise ctypes.WinError(ctypes.get_last_error())
    group = struct.pack('<HHH', 0, 1, n)
    for i, (w, hh, cc, r, planes, bpp, size, off) in enumerate(entries, 1):
        img = ctypes.create_string_buffer(d[off:off + size], size)
        assert k32.UpdateResourceW(h, RT_ICON, i, LANG, img, size)
        group += struct.pack('<BBBBHHIH', w, hh, cc, r, planes, bpp, size, i)
    gb = ctypes.create_string_buffer(group, len(group))
    assert k32.UpdateResourceW(h, RT_GROUP_ICON, ctypes.c_wchar_p('ALLEGRO_ICON'), LANG, gb, len(group))
    assert k32.UpdateResourceW(h, RT_GROUP_ICON, 1, LANG, gb, len(group))
    if not k32.EndUpdateResourceW(h, False):
        raise ctypes.WinError(ctypes.get_last_error())
    print('icon set:', exe, n, 'sizes')


if __name__ == '__main__':
    main(*sys.argv[1:])
