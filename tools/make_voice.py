"""Hebrew voice for the game's spoken lines ("Good!", "Hurry up!", "Game over" ...), in a Mario-like voice.

usage: python -I make_voice.py [out dir (tools/voice)] [--plain]
Text-to-speech with the Hebrew neural voice he-IL-AvriNeural (edge-tts, needs internet once), then made
higher and bouncier like a cartoon plumber (pitch +4 semitones, a bit faster). --plain skips that.
The results (OGG, small) are kept in git, so builds don't need the internet. set_voice.py puts them into
sfx13.dat, which is where the desktop game and the HTML version (build_web.py) take their sounds from.
"""
import asyncio
import os
import subprocess
import sys
import tempfile

import edge_tts

VOICE = 'he-IL-AvriNeural'
# sfx13.dat name -> what Mario says. The reward lines match the Hebrew banners (REWARD000..009).
LINES = {
    'S_GOOD': 'טוב!',
    'S_SWEET': 'יופי!',
    'S_GREAT': 'אחלה!',
    'S_SUPER': 'סופר!',
    'S_WOW': 'וואו!',
    'S_AMAZING': 'מדהים!',
    'S_EXTREME': 'אקסטרים!',
    'S_FANTASTIC': 'פנטסטי!',
    'S_SPLENDID': 'מושלם!',
    'S_UNBELIEVABLE': 'אין מצב! יאהו!',
    'S_HURRYUP': 'מהר יותר!',
    'S_GAMEOVER': 'מאמא מיה! המשחק נגמר!',
    'S_TRYAGAIN': 'נסה שוב!',
    'S_AIGHT': 'יאללה!',
}
SEMITONES = 4.0


async def tts(text, path):
    await edge_tts.Communicate(text, VOICE, rate='+12%', pitch='+12Hz', volume='+0%').save(path)


def main(out, plain=False):
    os.makedirs(out, exist_ok=True)
    k = 2 ** (SEMITONES / 12)
    for name, text in LINES.items():
        with tempfile.TemporaryDirectory() as td:
            mp3 = os.path.join(td, 'v.mp3')
            asyncio.run(tts(text, mp3))
            # higher voice: resample up (pitch + speed), give some of the speed back, trim the silences, normalise
            fx = [] if plain else [f'asetrate=24000*{k:.4f}', 'aresample=44100', f'atempo={1 / k * 1.08:.4f}']
            trim = 'silenceremove=start_periods=1:start_threshold=-45dB'      # leading silence only
            fx += [trim, 'areverse', trim, 'areverse',                         # ... and trailing (pauses inside stay)
                   'loudnorm=I=-14:TP=-1.5:LRA=7', 'aresample=44100']
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-af', ','.join(fx), '-ac', '1',
                            '-c:a', 'libvorbis', '-q:a', '5', os.path.join(out, name + '.ogg')], check=True)
        print(' ', name, text)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    here = os.path.dirname(os.path.abspath(__file__))
    main(args[0] if args else os.path.join(here, 'voice'), '--plain' in sys.argv)
