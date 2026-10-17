// Seeds the app's local state (tours done, FreshCart pinned) and reloads.
import { appPage } from './cdp.mjs';
const { browser, page } = await appPage();
const ids = process.argv[2].split(',');
await page.evaluate((ids) => {
  localStorage.setItem('agentbox.tours', JSON.stringify({ seen: ids, dismissed: ids, playing: null }));
  localStorage.setItem('agentbox.whatsnew.lastSeenVersion', '0.14.0');
  localStorage.setItem('agentbox.v2.projects', JSON.stringify({ pins: ['freshcart'], hiddenOpen: false }));
  localStorage.setItem('agentbox.ui.v2.panel', JSON.stringify({ width: 720 }));
}, ids);
await page.reload();
await page.waitForTimeout(2500);
await browser.close();
