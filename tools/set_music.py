"""Remove the original Icy Tower music: S_BG_MENU (menu) and S_BG_BEAT (in game) in sfx13.dat.

usage: python -I set_music.py <sfx13.dat in> <sfx13.dat out> [theme.wav]
  S_BG_BEAT always becomes one second of silence: in game the music is the character's own [bgmusic]
  (the Mario theme of super_mario), so it can never play together with something else.
  S_BG_MENU becomes theme.wav (the user's own Super Mario theme loop) or, without it, silence too
  (public builds: no Nintendo audio, and no Icy Tower music either).
"""
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg


def ogg(src_args):
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, 'm.ogg')
        subprocess.run(['ffmpeg', '-v', 'error', '-y'] + src_args +
                       ['-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '5', out], check=True)
        return open(out, 'rb').read()


def main(src, dst, theme=None):
    objs = alleg.load(src)
    silence = ogg(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1'])
    new = {'S_BG_MENU': ogg(['-i', theme]) if theme else silence, 'S_BG_BEAT': silence}
    n = 0
    for o in objs:
        if alleg.name(o) in new:
            o['data'] = new[alleg.name(o)]
            o['props'] = [(t, v) for t, v in o['props'] if t != b'ORIG']
            n += 1
    assert n == 2, n
    alleg.save(dst, objs)
    print('music:', 'Super Mario theme' if theme else 'silence', '->', dst)


if __name__ == '__main__':
    main(*sys.argv[1:4])
