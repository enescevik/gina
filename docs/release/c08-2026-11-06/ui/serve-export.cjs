// C08 UI QA (C04 kopyası): loopback-only static server for an `expo export -p web` (output: static) build.
// Resolves Expo Router dynamic routes ([param].html) and falls back to index.html.
// Usage: node serve-export.cjs <export-dir> <port>
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.argv[2]), port = Number(process.argv[3]);
if (!fs.existsSync(path.join(root, 'index.html')) || !(port > 1024)) throw Error('usage: serve-export.cjs <dir> <port>');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp' };
function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\/+$/, '') || '/index';
  const direct = path.join(root, clean);
  if (!direct.startsWith(root)) return null;
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  if (fs.existsSync(direct + '.html')) return direct + '.html';
  if (fs.existsSync(path.join(direct, 'index.html'))) return path.join(direct, 'index.html');
  // Walk segments, substituting a [param] entry when the literal one is missing.
  let dir = root; const parts = clean.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1, entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    if (last) {
      const hit = entries.includes(parts[i] + '.html') ? parts[i] + '.html' : entries.find(e => /^\[[^\]]+\]\.html$/.test(e));
      if (hit) return path.join(dir, hit);
      const sub = entries.includes(parts[i]) ? parts[i] : entries.find(e => /^\[[^\]]+\]$/.test(e));
      if (sub && fs.existsSync(path.join(dir, sub, 'index.html'))) return path.join(dir, sub, 'index.html');
      return null;
    }
    const sub = entries.includes(parts[i]) ? parts[i] : entries.find(e => /^\[[^\]]+\]$/.test(e) && fs.statSync(path.join(dir, e)).isDirectory());
    if (!sub) return null; dir = path.join(dir, sub);
  }
  return null;
}
http.createServer((req, res) => {
  const file = resolve(req.url) || path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('serving ' + port));
