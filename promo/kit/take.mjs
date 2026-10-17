// node take.mjs <take>: films one take of the promo on display :99.
// The app runs in a kiosk Chromium (app.sh) at 4/3 scale, so a CSS pixel is
// 4/3 of a screen pixel. Playwright only finds where things are; the pointer
// and keys are the real ones (xdotool). ffmpeg grabs the display at 60 fps
// without the pointer, and rec/<take>.json logs every pointer position and
// click against the same wall clock, for the edit to draw its own cursor.
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';

const S = 4 / 3;
const DIR = `${process.env.PROMO ?? `${process.env.HOME}/promo`}/rec`;
const PREVIEW = `http://localhost:${process.env.PREVIEW_PORT}/dev/preview.html?`;
fs.mkdirSync(DIR, { recursive: true });
const name = process.argv[2];
const env = { ...process.env, DISPLAY: ':99' };
const xdo = (...a) => execFileSync('xdotool', a.map(String), { env });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
let pos = { x: 1280, y: 720 };

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages()[0];

async function load(query, settle = 2500) {
  await page.goto(PREVIEW + query);
  await page.waitForTimeout(settle);
}
async function at(locator) {
  const l = typeof locator === 'string' ? page.locator(locator).first() : locator;
  await l.waitFor({ state: 'visible', timeout: 15000 });
  const b = await l.boundingBox();
  return { x: Math.round((b.x + b.width / 2) * S), y: Math.round((b.y + b.height / 2) * S), box: b };
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
async function move(to, ms = 700) {
  const from = { ...pos };
  const steps = Math.max(8, Math.round(ms / 16));
  // A slight arc, as a hand moves.
  const bend = (Math.random() - 0.5) * 0.18;
  const nx = -(to.y - from.y) * bend, ny = (to.x - from.x) * bend;
  const t0 = Date.now();
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps), arc = Math.sin(Math.PI * (i / steps));
    const x = Math.round(from.x + (to.x - from.x) * t + nx * arc);
    const y = Math.round(from.y + (to.y - from.y) * t + ny * arc);
    xdo('mousemove', x, y);
    log.push({ t: Date.now() / 1000, k: 'm', x, y });
    const due = t0 + (i * ms) / steps - Date.now();
    if (due > 0) await sleep(due);
  }
  pos = { x: to.x, y: to.y };
}
async function click(target, ms) {
  if (target) await move(typeof target.x === 'number' ? target : await at(target), ms);
  await sleep(120);
  log.push({ t: Date.now() / 1000, k: 'c', x: pos.x, y: pos.y });
  xdo('click', 1);
  await sleep(200);
}
async function type(text, delay = 42) {
  log.push({ t: Date.now() / 1000, k: 'type', text });
  for (const ch of text) {
    xdo('type', '--delay', 0, ch);
    await sleep(delay + Math.random() * delay * 0.8);
  }
}
async function key(k) {
  log.push({ t: Date.now() / 1000, k: 'key', key: k });
  xdo('key', k);
}
async function drag(from, to, ms = 900) {
  await move(from, 600);
  xdo('mousedown', 1);
  log.push({ t: Date.now() / 1000, k: 'down', x: pos.x, y: pos.y });
  await sleep(150);
  await move(to, ms);
  await sleep(150);
  xdo('mouseup', 1);
  log.push({ t: Date.now() / 1000, k: 'up', x: pos.x, y: pos.y });
}
const mark = (label) => log.push({ t: Date.now() / 1000, k: 'mark', label });

let ff;
async function rec() {
  ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'info', '-nostats', '-y', '-f', 'x11grab', '-framerate', '60', '-video_size', '2560x1440', '-draw_mouse', '0', '-i', ':99',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-pix_fmt', 'yuv420p', `${DIR}/${name}.mp4`], { env, stdio: ['pipe', 'ignore', fs.openSync(`${DIR}/${name}.ff.log`, 'w')] });
  await sleep(1200);
  mark('rec');
}
async function stop() {
  await sleep(800);
  ff.stdin.write('q');
  await new Promise((r) => ff.on('exit', r));
  const start = Number(/start: ([\d.]+)/.exec(fs.readFileSync(`${DIR}/${name}.ff.log`, 'utf8'))[1]);
  fs.writeFileSync(`${DIR}/${name}.json`, JSON.stringify({ start, scale: S, log }, null, 0));
  console.log(name, 'saved; start', start, 'events', log.length);
}
const rest = () => ({ x: 1700, y: 900 });
const park = async (p = rest()) => {
  xdo('mousemove', p.x, p.y);
  pos = p;
  log.push({ t: Date.now() / 1000, k: 'm', x: p.x, y: p.y });
};

const takes = {
  // The lead-first sidebar, then the ask, the lead's answer and three new agents.
  async spawn() {
    await load('promo=spawn&app=project&v2=1');
    await park({ x: 1500, y: 700 });
    await rec();
    await sleep(1500);
    mark('sidebar');
    await click('button[aria-label="Show FreshCart’s agents"]', 900);
    await sleep(1200);
    const idle = await at('button:has-text("nothing running")');
    await click(idle, 900);
    await sleep(1600);
    await click('button:has-text("nothing running")', 500);
    await sleep(700);
    mark('ask');
    await click('textarea', 900);
    await sleep(300);
    await type('Three things for FreshCart: dark mode for the orders dashboard, CSV export on the orders table, and fix Google sign-in on Safari. One agent each.', 34);
    await sleep(500);
    mark('send');
    await key('Return');
    await move({ x: 1900, y: 860 }, 1200);
    await sleep(15000);
    mark('end');
    await stop();
  },
  // One agent's chat as it works, for the parallel montage.
  async work14() { await workOne('agent-14'); },
  async work15() { await workOne('agent-15'); },
  async work16() { await workOne('agent-16'); },
  // Moving between the working agents in the sidebar.
  async worknav() {
    await load('promo=work&app=project&v2=1', 1500);
    await park({ x: 1500, y: 700 });
    await rec();
    await click('button[aria-label="Show FreshCart’s agents"]', 700);
    await sleep(700);
    for (const t of ['Dark mode for the orders dashboard', 'Export orders to CSV', 'Fix Google sign-in on Safari']) {
      mark(t);
      await click(page.getByText(t).first(), 800);
      await sleep(3800);
    }
    await stop();
  },
  // The right panel: agent-14's desktop live, agent-15's terminal, agent-14's files.
  async panel() {
    await load('promo=work&app=agent-14&v2=1&panel=desktop:agent-14,terminal:agent-15,files:agent-14&first=1', 3000);
    await park({ x: 900, y: 900 });
    await rec();
    await sleep(800);
    // Widen the panel by its edge.
    const edge = await at('aside[data-right-panel] [role=separator]');
    mark('widen');
    await drag(edge, { x: edge.x - 560, y: edge.y }, 1100);
    await sleep(500);
    mark('desktop');
    await move({ x: 1900, y: 1250 }, 900);
    await sleep(6000);
    mark('terminal');
    await openTab('Terminal');
    await sleep(9000);
    mark('files');
    await openTab('Files');
    await sleep(1200);
    await click('aside[data-right-panel] >> text=src', 700);
    await sleep(500);
    await click('aside[data-right-panel] >> text=components', 600);
    await sleep(500);
    await click('aside[data-right-panel] >> text=ThemeToggle.tsx', 600);
    await sleep(3500);
    await stop();
  },
  // The review modal: slides, Merge and next, then Request changes.
  async review() {
    await load('promo=review&app=project&v2=1');
    await park({ x: 1500, y: 600 });
    await rec();
    await sleep(800);
    mark('open');
    await click('button:text-is("Review")', 900);
    await sleep(2000);
    mark('slides');
    const next = await at('[role=dialog] button[aria-label="Next"]');
    await click(next, 900);
    await sleep(1300);
    await click(next, 300);
    await sleep(1300);
    await click(next, 300);
    await sleep(1600);
    await click(next, 300);
    await sleep(3500);
    mark('merge');
    await click(page.getByRole('button', { name: /Merge #43 and next/ }), 1000);
    await sleep(3000);
    mark('changes');
    await click(page.getByRole('button', { name: /Request changes/ }).first(), 1000);
    await sleep(800);
    await type('Name the file with the store and today’s date, like freshcart-orders-2026-10-17.csv', 30);
    await sleep(500);
    await click('[role=dialog] button:has-text("Send and next")', 900);
    await sleep(3000);
    await stop();
  },
  // Media and Pages in the right panel.
  async media() {
    await load('promo=review&app=project&v2=1', 2000);
    await park({ x: 1500, y: 700 });
    await rec();
    await sleep(600);
    mark('panel');
    await click('button[aria-label="Open or close the panel"]', 900);
    await sleep(900);
    mark('media');
    await click('aside[data-right-panel] >> text=Media', 800);
    await sleep(700);
    await click('aside[data-right-panel] >> text=the lead’s checkout', 700);
    await sleep(2200);
    await move({ x: 2150, y: 900 }, 900);
    await sleep(600);
    await click('aside[data-right-panel] >> text=dark-mode-toggle', 900);
    await sleep(4500);
    await key('Escape');
    await sleep(600);
    mark('pages');
    await click('aside[data-right-panel] button[aria-label="New tab"]', 800);
    await sleep(700);
    await click('aside[data-right-panel] >> text=Pages', 700);
    await sleep(900);
    await click('aside[data-right-panel] >> text=Every page', 700);
    await sleep(1000);
    await click('aside[data-right-panel] >> text=Dark mode: before and after', 800);
    await sleep(4000);
    await stop();
  },
};

// openTab clicks a panel tab, through the "+N" menu when it's folded away.
async function openTab(label) {
  const tab = page.locator('[role=tab]', { hasText: label }).first();
  if (await tab.isVisible()) return click(tab, 900);
  await click(page.locator('button', { hasText: /^\+\d/ }).first(), 800);
  await sleep(500);
  await click(page.locator('[role=menuitem]', { hasText: label }).first(), 600);
}

async function workOne(agentName) {
  await load(`promo=work&app=${agentName}&v2=1`, 600);
  await park({ x: 2400, y: 1300 });
  await rec();
  await sleep(17000);
  await stop();
}

try {
  await takes[name]();
} catch (e) {
  console.log('FAILED after', log.filter((l) => l.k === 'mark').pop()?.label, e.message.split('\n')[0], e.message.match(/locator\('[^\n]*/)?.[0]);
  if (ff && ff.exitCode === null) ff.stdin.write('q');
}
await browser.close();
