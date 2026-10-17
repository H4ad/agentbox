import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../../desktop/package.json', import.meta.url))('playwright-core');
const b = await chromium.connectOverCDP('http://127.0.0.1:9334');
const p = b.contexts()[0].pages().find((x) => x.url().includes('5173'));
await p.goto('http://localhost:5173/#orders'); await p.reload(); await p.waitForTimeout(500); await p.evaluate(() => (document.body.style.zoom = '0.85'));
await b.close();
