"""Screenshots + gameplay video of the HTML version, for the README (docs/).

usage: python -I tools/record_media.py [url] [out dir]
  (serve web/ first: python -I tools/serve_web.py)
The game is stepped frame by frame (window.__icyManual + __icy.step) while the demo player (js/bot.js)
plays, so the video is a perfectly smooth 50 fps no matter how fast the machine is. The video is silent.
"""
import base64
import os
import shutil
import subprocess
import sys
import tempfile

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs')
os.makedirs(OUT, exist_ok=True)

SETUP = """async ({seed, style}) => {
  await new Promise(r => { const t = () => window.__icy && window.__icy.screen ? r() : setTimeout(t, 100); t(); });
  const { makeBot } = await import('./js/bot.js');
  window.__icyManual = true;
  window.__icy.cfg.sound = false;
  window.__icyBot = makeBot({ style });
  window.__icySeed = seed;
}"""


def save_data_url(url, path):
    with open(path, 'wb') as f:
        f.write(base64.b64decode(url.split(',', 1)[1]))


def start_game(page, seed):
    page.evaluate("(seed) => { const i = window.__icy; i.go(i.Play.start(seed)); }", seed)


def run_until(page, cond, max_ticks=50 * 400, chunk=25):
    for _ in range(max_ticks // chunk):
        page.evaluate(f'() => window.__icy.step({chunk}, null)')
        if page.evaluate(cond):
            return True
    return False


def shot(page, name):
    save_data_url(page.evaluate("() => window.__icy.step(0, 'image/png')"), os.path.join(OUT, name))
    print(' ', name)


def desktop_shots(p):
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1600, 'height': 1200}, device_scale_factor=1)
    page.goto(URL)
    page.evaluate(SETUP, {'seed': 4242, 'style': 'combo'})
    page.evaluate("() => window.__icy.step(40, null)")
    shot(page, 'web_menu.png')
    page.evaluate("() => { const i = window.__icy; i.go(i.Instructions); }")
    shot(page, 'web_instructions.png')
    page.evaluate("() => { const i = window.__icy; i.go(i.Options); }")
    shot(page, 'web_options.png')
    start_game(page, 4242)
    run_until(page, "() => { const g = window.__icy.Play.game; return g.p.cTimer > 40 && g.p.cFloors >= 6 && g.p.state !== 0; }")
    shot(page, 'web_combo.png')
    run_until(page, "() => { const g = window.__icy.Play.game; return g.reward && g.reward.t > 6 && g.reward.lvl >= 1; }")
    shot(page, 'web_reward.png')
    run_until(page, "() => { const g = window.__icy.Play.game; return g.p.floor >= 105 && g.p.state === 0; }")
    shot(page, 'web_floor100.png')
    run_until(page, "() => { const g = window.__icy.Play.game; return g.p.floor >= 210 && g.p.state !== 0; }")
    shot(page, 'web_floor200.png')
    # classic pixels vs HD (same frame)
    page.evaluate("() => { window.__icy.cfg.gfx = 'classic'; }")
    page.evaluate("async () => { const G = await import('./js/gfx.js'); G.setMode('classic'); }")
    shot(page, 'web_classic.png')
    page.evaluate("async () => { const G = await import('./js/gfx.js'); G.setMode('hd'); }")
    b.close()


def mobile_shots(p):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(URL)
    page.evaluate(SETUP, {'seed': 777, 'style': 'combo'})
    start_game(page, 777)
    run_until(page, "() => { const g = window.__icy.Play.game; return g.p.floor >= 30 && g.p.cTimer > 30 && g.p.state !== 0; }")
    page.evaluate("() => window.__icy.step(0, null)")
    page.screenshot(path=os.path.join(OUT, 'web_mobile.png'))
    print('  web_mobile.png')
    ctx2 = b.new_context(viewport={'width': 915, 'height': 412}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
    page = ctx2.new_page()
    page.goto(URL)
    page.evaluate(SETUP, {'seed': 778, 'style': 'combo'})
    start_game(page, 778)
    run_until(page, "() => { const g = window.__icy.Play.game; return g.p.floor >= 40 && g.p.state !== 0; }")
    page.evaluate("() => window.__icy.step(0, null)")
    page.screenshot(path=os.path.join(OUT, 'web_mobile_landscape.png'))
    print('  web_mobile_landscape.png')
    b.close()


def video(p, seconds=42, w=1280, h=960, seed=31337):
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
    page.goto(URL)
    page.evaluate(SETUP, {'seed': seed, 'style': 'combo'})
    tmp = tempfile.mkdtemp()
    n = 0

    def grab(k=1):
        nonlocal n
        save_data_url(page.evaluate(f"() => window.__icy.step({k}, 'image/jpeg', 0.92)"), os.path.join(tmp, '%05d.jpg' % n))
        n += 1

    for _ in range(75):                               # 1.5 s of the title screen
        grab()
    start_game(page, seed)
    for i in range(seconds * 50):
        grab()
        if page.evaluate('() => window.__icy.screen !== window.__icy.Play'):
            break
    for _ in range(50):
        grab()
    b.close()
    mp4 = os.path.join(OUT, 'gameplay.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '50', '-i', os.path.join(tmp, '%05d.jpg'),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
    # short looping GIF for the README (plays inline on GitHub)
    gif = os.path.join(OUT, 'gameplay.gif')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '3', '-t', '14', '-i', mp4, '-vf',
                    'fps=20,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
                    gif], check=True)
    shutil.rmtree(tmp)
    print('  gameplay.mp4 (%d frames), gameplay.gif' % n)


if __name__ == '__main__':
    what = os.environ.get('ONLY', 'desktop,mobile,video').split(',')
    with sync_playwright() as p:
        if 'desktop' in what: desktop_shots(p)
        if 'mobile' in what: mobile_shots(p)
        if 'video' in what: video(p)
