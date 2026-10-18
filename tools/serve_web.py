"""Serve web/ locally (also to phones on the same Wi-Fi) without browser caching.
usage: python -I tools/serve_web.py [port]   -> prints the addresses to open"""
import functools
import http.server
import os
import socket
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# in the repo: tools/serve_web.py serves ../web; in the release zip it sits next to index.html (serve.py)
ROOT = HERE if os.path.exists(os.path.join(HERE, 'index.html')) else os.path.join(HERE, '..', 'web')


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
                      '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


def main(port=8765):
    ips = {i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)}
    print('open:', ' | '.join(f'http://{ip}:{port}/' for ip in ['127.0.0.1', *sorted(ips)]))
    http.server.ThreadingHTTPServer(('0.0.0.0', port), functools.partial(Handler, directory=ROOT)).serve_forever()


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 8765)
