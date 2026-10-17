// Connects to the running Electron app over CDP and returns its page.
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../../desktop/package.json', import.meta.url))('playwright-core');
export async function appPage() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = browser.contexts().flatMap((c) => c.pages());
  const page = pages.find((p) => !p.url().startsWith('devtools')) ?? pages[0];
  return { browser, page };
}
