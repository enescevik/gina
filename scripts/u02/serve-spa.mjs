// Minimal static server with SPA fallback for local UI checks (127.0.0.1 only).
// Usage: node scripts/u02/serve-spa.mjs <dist-dir> <port>
import { createServer } from "node:http";
import readPreviewFile from "../read-preview-file.cjs";
import { extname, join, normalize } from "node:path";

const [dir, port] = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2", ".webp": "image/webp", ".mp3": "audio/mpeg", ".ico": "image/x-icon" };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const file of [path, join(path, "index.html"), path + ".html", "index.html"]) {
    try {
      const body = readPreviewFile(dir, file);
      if (!body) continue;
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
      res.end(body);
      return;
    } catch { /* Try the next candidate. */ }
  }
  res.writeHead(404); res.end();
}).listen(Number(port), "127.0.0.1");
