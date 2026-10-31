"""Local review server with byte ranges for reliable video seeking. No database access."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[5]

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.byte_range = None
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        path = Path(self.translate_path(self.path))
        requested = self.headers.get('Range')
        if requested and path.is_file():
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested.strip())
            size = path.stat().st_size
            if match and size:
                a, b = match.groups()
                if not a and b:
                    start, end = max(0, size - int(b)), size - 1
                elif a:
                    start, end = int(a), min(int(b) if b else size - 1, size - 1)
                else:
                    self.send_error(416)
                    return None
                if start > end or start >= size:
                    self.send_error(416)
                    return None
                self.send_response(206)
                self.send_header('Content-Type', self.guess_type(str(path)))
                self.send_header('Content-Length', str(end-start+1))
                self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
                self.end_headers()
                source = path.open('rb')
                source.seek(start)
                self.byte_range = end-start+1
                return source
        return super().send_head()

    def copyfile(self, source, output):
        if self.byte_range is None:
            return super().copyfile(source, output)
        remaining = self.byte_range
        while remaining:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            output.write(chunk)
            remaining -= len(chunk)

    def log_message(self, *_):
        pass

if __name__ == '__main__':
    print('http://127.0.0.1:8772/docs/design/screens/child/cat-motion-v5/index.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8772), Handler).serve_forever()
