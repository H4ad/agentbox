// Drives the walkthrough on display :99 with the real pointer and keyboard
// (xdotool). Playwright only reads where things are (the DOM), never clicks.
// Every move, click and story beat is logged for the edit.
//   node drive.mjs <events.jsonl>
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { appPage } from './cdp.mjs';

const SCALE = 1.25;
const out = fs.createWriteStream(process.argv[2] ?? '/t/demo/rec/events.jsonl');
const log = (o) => out.write(JSON.stringify({ t: Date.now() / 1000, ...o }) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = { ...process.env, DISPLAY: ':99' };
const xdo = (...a) => execFileSync('xdotool', a, { env });
const ctl = (a) => fetch(`http://127.0.0.1:7788/ctl/${a}`).then((r) => r.text());
const beat = (name) => log({ beat: name });

const { browser, page } = await appPage();

function where() {
  const s = xdo('getmouselocation', '--shell').toString();
  return { x: +/X=(\d+)/.exec(s)[1], y: +/Y=(\d+)/.exec(s)[1] };
}
// glide moves the pointer along an eased path, with a slight arc, in one xdotool run.
function glide(x, y, ms) {
  const a = where();
  const d = Math.hypot(x - a.x, y - a.y);
  ms ??= Math.min(1100, 380 + d * 0.55);
  const n = Math.max(8, Math.round(ms / 16));
  const args = [];
  const bend = Math.min(60, d * 0.08);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const off = Math.sin(Math.PI * e) * bend;
    const px = a.x + (x - a.x) * e + (-(y - a.y) / (d || 1)) * off;
    const py = a.y + (y - a.y) * e + ((x - a.x) / (d || 1)) * off;
    args.push('mousemove', String(Math.round(px)), String(Math.round(py)), 'sleep', '0.016');
  }
  spawnSync('xdotool', args, { env });
}
async function click(x, y, opts = {}) {
  glide(x, y, opts.ms);
  await sleep(opts.pause ?? 220);
  log({ click: [x, y] });
  xdo('click', '1');
  await sleep(opts.after ?? 300);
}
async function box(locator, timeout = 8000) {
  const l = locator.first();
  await l.waitFor({ state: 'visible', timeout });
  const b = await l.boundingBox();
  return { x: Math.round((b.x + b.width / 2) * SCALE), y: Math.round((b.y + b.height / 2) * SCALE), left: Math.round(b.x * SCALE), top: Math.round(b.y * SCALE), w: b.width * SCALE, h: b.height * SCALE };
}
async function clickOn(locator, opts = {}) {
  const b = await box(locator, opts.timeout);
  const x = opts.dx !== undefined ? b.left + opts.dx : b.x;
  const y = opts.dy !== undefined ? b.top + opts.dy : b.y;
  await click(x, y, opts);
}
async function type(text) {
  log({ type: text });
  // A person's rhythm: quick within a word, a beat longer at spaces and commas.
  for (const ch of text) {
    xdo('type', '--delay', '0', ch);
    await sleep(ch === ' ' ? 70 + Math.random() * 60 : /[,.:]/.test(ch) ? 160 : 34 + Math.random() * 30);
  }
}

const MESSAGE = 'Two things for the orders page: a dark mode, and an Export CSV button. One agent each, please.';

// 0. Home.
glide(960, 620, 10);
beat('start');
await sleep(1800);

// 1. Open the project.
beat('open-project');
await clickOn(page.getByRole('button', { name: /^((Show|Hide) FreshCart’s agents )?FreshCart .+/ }), { dx: 140 });
await sleep(1500);

// 2. Ask the lead for two features.
beat('ask');
await clickOn(page.getByPlaceholder(/Ask for changes/));
await sleep(350);
await type(MESSAGE);
await sleep(600);
log({ key: 'Return' });
xdo('key', 'Return');
beat('sent');
glide(980, 640, 700);
await sleep(9000);

// 3. Two agents appear: show them under the project.
beat('agents');
await clickOn(page.getByRole('button', { name: 'Show FreshCart’s agents', exact: true }));
await sleep(2200);

// 4. Open agent-05, and its desktop and terminal in the panel.
beat('agent');
await clickOn(page.getByRole('button', { name: /Dark mode for the orders page/ }).filter({ hasText: 'agent-05' }));
await sleep(3000);
beat('panel');
await clickOn(page.getByRole('button', { name: 'Open or close the panel' }));
await sleep(900);
await clickOn(page.getByRole('button', { name: /^Desktop/ }));
fs.writeFileSync('/t/demo/live.on', '');
beat('desktop');
glide(1500, 760, 800);
await sleep(6500);
beat('terminal');
await clickOn(page.getByRole('button', { name: 'New tab', exact: true }));
await sleep(700);
await clickOn(page.getByRole('button', { name: /^Terminal/ }));
await sleep(900);
spawnSync('tmux', ['-L', 'promo', 'wait-for', '-S', 'goagent-05']);
glide(1400, 820, 900);
await sleep(9500);
fs.rmSync('/t/demo/live.on', { force: true });

// 5. Back to the lead; skip the wait; the agents finish.
beat('back');
await clickOn(page.getByRole('button', { name: /^((Show|Hide) FreshCart’s agents )?FreshCart .+/ }), { dx: 140 });
await sleep(1200);
if (await page.getByRole('button', { name: 'Close the panel', exact: true }).isVisible()) await clickOn(page.getByRole('button', { name: 'Close the panel', exact: true }));
await sleep(1200);
beat('cut');
await sleep(1500);
await ctl('finish/agent-05');
beat('finished');
await sleep(2600);
await ctl('finish/agent-06');
await sleep(2400);

// 6. Review: the recording, the diff, Merge.
beat('review');
await clickOn(page.getByRole('button', { name: 'Review', exact: true }));
await sleep(2200);
await clickOn(page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }));
beat('recording');
await sleep(5200);
await clickOn(page.getByRole('dialog').getByText('PR #142', { exact: true }));
beat('pr');
await sleep(2200);
await clickOn(page.getByRole('dialog').getByText(/^Files changed/));
await sleep(1500);
await clickOn(page.getByText('ThemeToggle.tsx', { exact: true }));
beat('diff');
await sleep(2200);
glide(900, 620, 600);
for (let i = 0; i < 4; i++) {
  xdo('click', '5');
  await sleep(140);
}
await sleep(1500);
await clickOn(page.getByRole('button', { name: /Merge #142/ }));
beat('merged');
await sleep(4200);

// 7. Close; agent-05 is a past agent.
beat('close');
log({ key: 'Escape' });
xdo('key', 'Escape');
await sleep(1600);
await clickOn(page.getByRole('button', { name: 'Past agents', exact: true }));
beat('past');
await sleep(1200);
const row = await box(page.getByText('Dark mode for the orders page'));
glide(row.x + 120, row.y, 900);
await sleep(3500);
beat('end');
out.end();
await browser.close();
