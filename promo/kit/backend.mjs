// The promo's stand-in for the daemon's WebSockets and files, for the dev
// preview's ?promo scenes: agent-14's desktop (VNC on :101, port 5901),
// scripted terminals, and the demo media and pages over HTTP.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const types = { '.png': 'image/png', '.mp4': 'video/mp4', '.html': 'text/html; charset=utf-8', '.log': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(ROOT, path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  const size = fs.statSync(file).size;
  const type = types[path.extname(file)] ?? 'application/octet-stream';
  const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = +range[1], end = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
});
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/vnc') {
    const tcp = net.connect(5901, '127.0.0.1');
    tcp.on('data', (d) => ws.send(d, { binary: true }));
    tcp.on('close', () => ws.close());
    tcp.on('error', () => ws.close());
    ws.on('message', (d, bin) => bin && tcp.write(d));
    ws.on('close', () => tcp.destroy());
    return;
  }
  const term = /^\/term\/([\w-]+)$/.exec(url.pathname);
  if (term) {
    const cols = url.searchParams.get('cols') ?? '100', rows = url.searchParams.get('rows') ?? '30';
    const p = spawn('script', ['-qfec', `stty cols ${cols} rows ${rows}; exec bash ${ROOT}/term/${term[1]}.sh`, '/dev/null'], { env: { ...process.env, TERM: 'xterm-256color' } });
    p.stdout.on('data', (d) => ws.readyState === 1 && ws.send(d, { binary: true }));
    p.on('exit', () => ws.close());
    // The terminal's own replies (cursor reports) would only echo back as noise.
    ws.on('message', () => {});
    ws.on('close', () => p.kill());
  }
});
server.listen(7802, '0.0.0.0', () => console.log('promo backend on :7802'));
