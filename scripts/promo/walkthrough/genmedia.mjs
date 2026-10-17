// Makes the demo agents' media: screenshots and recordings of the demo app,
// a test report, a log and notes, plus manifest.json for the mock daemon.
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../../desktop/package.json', import.meta.url))('playwright-core');
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const OUT = `${process.env.PROMO_WORK || `${process.env.HOME}/promo`}/media`;
const APP = 'http://localhost:5173/';
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
let n = 0;
const add = (o) => manifest.push({ id: `m${String(++n).padStart(2, '0')}`, source: 'agent', meta: {}, ...o });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--font-render-hinting=none'] });

async function shot(agentName, name, hash, minutesAgo, act) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${APP}#${hash}`);
  if (act) await act(page);
  await page.waitForTimeout(700);
  const file = `${name}.png`;
  await page.screenshot({ path: `${OUT}/${file}` });
  await page.close();
  add({ agentName, kind: 'screenshot', name, file, mime: 'image/png', size: fs.statSync(`${OUT}/${file}`).size, meta: { width: 1440, height: 900, url: `http://localhost:5173/${hash.split('+')[0]}` }, minutesAgo });
}

async function rec(agentName, name, hash, minutesAgo, act) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: `/t/demo/vid`, size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  await page.goto(`${APP}#${hash}`);
  await page.waitForTimeout(800);
  await act(page);
  await page.waitForTimeout(1200);
  const v = await page.video().path();
  await ctx.close();
  const file = `${name}.mp4`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', v, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${OUT}/${file}`]);
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${OUT}/${file}`]).toString());
  add({ agentName, kind: 'recording', name, file, mime: 'video/mp4', size: fs.statSync(`${OUT}/${file}`).size, meta: { width: 1280, height: 800, duration: dur, target: 'browser' }, minutesAgo });
}
const slow = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
  await page.waitForTimeout(300);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};

// agent-01: dark mode
await shot('agent-01', 'orders-before', 'orders', 30);
await rec('agent-01', 'dark-mode-toggle', 'orders', 2, async (p) => { await slow(p, '#darkToggle'); await p.waitForTimeout(1500); await slow(p, '#darkToggle'); await p.waitForTimeout(900); await slow(p, '#darkToggle'); });
await shot('agent-01', 'orders-dark-mode', 'orders+dark', 3);
await shot('agent-01', 'discounts-dark-mode', 'discounts+dark', 20);
// agent-02: CSV
await rec('agent-02', 'export-csv', 'orders', 18, async (p) => { await slow(p, '#csvBtn'); await p.waitForTimeout(2200); });
await shot('agent-02', 'csv-exported', 'orders+toast', 17);
// agent-03: login
await shot('agent-03', 'signin-before', 'login', 16);
await rec('agent-03', 'google-signin-safari', 'login', 12, async (p) => { await slow(p, '#gbtn'); await p.waitForTimeout(2000); });
await shot('agent-03', 'google-signin-ok', 'login', 11, async (p) => { await p.click('#gbtn'); await p.waitForTimeout(1500); });
// agent-04: checkout E2E
await rec('agent-04', 'checkout-e2e', 'checkout', 9, async (p) => { await p.waitForTimeout(1500); await p.evaluate(() => { location.hash = 'checkout+paid'; }); await p.waitForTimeout(1500); });
await shot('agent-04', 'checkout-paid', 'checkout+paid', 8);
// agent-05: coupons
await shot('agent-05', 'discounts-page', 'discounts', 6);
await rec('agent-05', 'discounts-navigation', 'orders', 4, async (p) => { await slow(p, '[data-nav=discounts]'); await p.waitForTimeout(1500); await slow(p, '[data-nav=checkout]'); await p.waitForTimeout(1200); await slow(p, '[data-nav=discounts]'); });
await browser.close();

// A test report, a log and notes.
fs.writeFileSync(`${OUT}/e2e-report.html`, `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;padding:32px"><h1>E2E report: checkout</h1><p>12 passed · 0 failed · 0 skipped</p><ul>${['cart with 4 items', 'APPLEPAY5 code applied', 'payment sheet shown', 'webhook confirms payment', 'confirmation email', 'stock updated'].map((t) => `<li>✅ ${t}</li>`).join('')}</ul></body>`);
add({ agentName: 'agent-04', kind: 'report', name: 'e2e-report', file: 'e2e-report.html', mime: 'text/html', size: fs.statSync(`${OUT}/e2e-report.html`).size, meta: { entry: '', tests: { passed: 12, failed: 0, skipped: 0 } }, minutesAgo: 7 });
fs.writeFileSync(`${OUT}/vitest.log`, ` ✓ src/export/csv.test.ts (9 tests) 41ms\n ✓ src/pages/Orders.test.tsx (14 tests) 212ms\n ✓ src/api/orders.test.ts (25 tests) 88ms\n\n Test Files  3 passed (3)\n      Tests  48 passed (48)\n   Duration  1.94s\n`);
add({ agentName: 'agent-02', kind: 'log', name: 'vitest', file: 'vitest.log', mime: 'text/plain', size: fs.statSync(`${OUT}/vitest.log`).size, minutesAgo: 16 });
add({ agentName: 'agent-03', kind: 'note', name: 'root-cause', text: 'Cause: Safari blocked the Google popup because window.open ran after an await. The popup now opens straight from the click, and the token comes back through postMessage.', size: 0, minutesAgo: 10 });
add({ agentName: 'agent-01', kind: 'note', name: 'contrast', text: 'Every dark mode color passes WCAG AA contrast. The choice is saved, and follows the system by default.', size: 0, minutesAgo: 19 });

fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log(manifest.length, 'items');
