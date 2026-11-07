// Loopback only: /auth/v1 + /rest/v1 proxy with CORS, and a static server for apps/backoffice/out.
import http from 'node:http';
import readPreviewFile from '../../../../scripts/read-preview-file.cjs';
import { join, extname, normalize } from 'node:path';
const auth = Number(process.env.AUTH_PORT), rest = Number(process.env.REST_PORT), out = process.env.OUT_DIR;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
const proxy = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  const route = [['/auth/v1', auth], ['/rest/v1', rest]].find(([p]) => req.url === p || req.url.startsWith(p + '/'));
  if (!route) { res.writeHead(404, cors); res.end(); return; }
  const [prefix, port] = route;
  const up = http.request({ hostname: '127.0.0.1', port, path: req.url.slice(prefix.length) || '/', method: req.method, headers: { ...req.headers, host: '127.0.0.1' } }, r => {
    const h = { ...r.headers }; for (const k of Object.keys(h)) if (k.startsWith('access-control-')) delete h[k];
    res.writeHead(r.statusCode, { ...h, ...cors }); r.pipe(res);
  });
  up.on('error', () => { res.writeHead(502, cors); res.end(); }); req.pipe(up);
});
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const statics = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const c of [path, path + '.html', join(path, 'index.html')]) {
    try { const body = readPreviewFile(out, c); if (body) { res.writeHead(200, { 'content-type': types[extname(c)] ?? 'application/octet-stream' }); res.end(body); return; } } catch {}
  }
  res.writeHead(404); res.end('not found');
});
// C07: random free loopback ports so parallel agents do not collide.
await new Promise(r => proxy.listen(0, '127.0.0.1', r));
await new Promise(r => statics.listen(0, '127.0.0.1', r));
console.log(JSON.stringify({ proxy: proxy.address().port, static: statics.address().port }));
