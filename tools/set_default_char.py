"""Set the selected character in an Icy Tower tower.cfg (Allegro packfile, LZSS 'slh!' or plain 'slh.').
The name sits in a fixed 32-byte field at offset 32; nothing else needs to change.
usage: python -I set_default_char.py <tower.cfg in> <tower.cfg out> <character dir name>"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg

NAME_OFF, NAME_LEN = 32, 32


def main(src, dst, name):
    raw = open(src, 'rb').read()
    d = bytearray(alleg.lzss_unpack(raw[4:]) if raw[:4] == b'slh!' else raw[4:])
    nb = name.encode('ascii')
    assert len(nb) < NAME_LEN
    d[NAME_OFF:NAME_OFF + NAME_LEN] = nb + b'\0' * (NAME_LEN - len(nb))
    open(dst, 'wb').write(b'slh.' + bytes(d))
    print('default character:', name, '->', dst)


if __name__ == '__main__':
    main(*sys.argv[1:])
