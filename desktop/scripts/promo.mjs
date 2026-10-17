// Renders the showcase hero (src/renderer/dev/promo/hero.html) to PNGs: each
// layout at 1920×1080 and framed again at 1200×630 for link previews.
//
//   node scripts/promo.mjs out            every variant into out/
//   node scripts/promo.mjs out flow       only one
//
// Each is rendered at twice the size and scaled down with ffmpeg when it's
// installed, which keeps the tilted layout's small type crisp. Uses
// /usr/bin/chromium when present, like scripts/preview.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = pathToFileURL(join(desktopDir, 'src/renderer/dev/promo/hero.html')).href;
const out = resolve(process.argv[2] || 'promo-out');
const only = process.argv[3];

// Where each layout's link preview is centred, and how far it zooms in: at
// 0.625 the whole width, losing 22px top and bottom, which keeps the wordmark
// and the address in. Any closer cuts them.
const variants = {
  flow: { s: 0.625, ox: 960, oy: 540 },
  plane: { s: 0.625, ox: 960, oy: 540 },
  burst: { s: 0.625, ox: 960, oy: 534 },
};

mkdirSync(out, { recursive: true });
let ffmpeg = true;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { ffmpeg = false; }
const dpr = ffmpeg ? 2 : 1;
const browser = await chromium.launch(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {});
for (const [v, og] of Object.entries(variants)) {
  if (only && v !== only) continue;
  for (const [suffix, size, query] of [
    ['', { width: 1920, height: 1080 }, `?v=${v}`],
    ['-og', { width: 1200, height: 630 }, `?v=${v}&og=1&s=${og.s}&ox=${og.ox}&oy=${og.oy}`],
  ]) {
    const p = await browser.newPage({ viewport: size, deviceScaleFactor: dpr });
    await p.goto(page + query);
    await p.waitForSelector('body[data-ready]');
    await p.waitForTimeout(150);
    const file = join(out, `agentbox-hero-${v}${suffix}.png`);
    if (dpr === 1) await p.screenshot({ path: file });
    else {
      const big = file.replace(/\.png$/, '@2x.png');
      await p.screenshot({ path: big });
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', big, '-vf', `scale=${size.width}:${size.height}:flags=lanczos`, file]);
      rmSync(big);
    }
    await p.close();
    console.log(file);
  }
}
await browser.close();
