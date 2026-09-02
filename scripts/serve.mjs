/**
 * Purpose: optional local preview server; production hosting remains static.
 * Depends on: Node built-ins only. The console prints the exact temporary preview URL.
 * Debug: a stopped server means its localhost URL is unavailable; start npm run dev again.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Never expose repository metadata, developer scripts, tests, or hidden files.
    const parts = requested.split('/').filter(Boolean);
    if (parts.some(part => part.startsWith('.') || part.includes('\\')) || parts.some(part => ['scripts', 'tests', 'docs', 'node_modules'].includes(part))) throw new Error('Not public');
    let file = path.resolve(root, ...parts);
    if (!file.startsWith(root)) throw new Error('Not public');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const contentType = types[path.extname(file)];
    if (!contentType) throw new Error('Not public');
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
});
// Port 0 asks the OS for an available loopback-only port; no public listener is opened.
server.listen(0, '127.0.0.1', () => process.stdout.write(`Local: http://127.0.0.1:${server.address().port}\n`));
