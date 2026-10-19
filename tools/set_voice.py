"""Replace the game's English voice lines in sfx13.dat with the Hebrew ones from make_voice.py.

usage: python -I set_voice.py <sfx13.dat (changed in place)> [voice dir (tools/voice)]
Every <NAME>.ogg in the voice dir replaces the sfx13.dat object of the same name (S_GOOD, S_HURRYUP, ...).
"""
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alleg


def main(dat, vdir):
    new = {os.path.splitext(os.path.basename(f))[0]: open(f, 'rb').read() for f in glob.glob(os.path.join(vdir, '*.ogg'))}
    objs = alleg.load(dat)
    done = []
    for o in objs:
        n = alleg.name(o)
        if n in new:
            o['data'] = new[n]
            o['props'] = [(t, v) for t, v in o['props'] if t != b'ORIG']
            done.append(n)
    # V_* lines are extras for the HTML version only (build_web.py exports them from the voice dir)
    missing = sorted(n for n in set(new) - set(done) if not n.startswith('V_'))
    assert not missing, missing
    alleg.save(dat, objs)
    print('voice: %d Hebrew lines -> %s' % (len(done), dat))


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, 'voice'))
