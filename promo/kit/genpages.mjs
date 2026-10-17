// The Hatch pages FreshCart's agents published, as HTML, and their thumbnails.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const OUT = `${process.env.PROMO ?? `${process.env.HOME}/promo`}/pages`;
const css = `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#0d1117;color:#e6edf3;padding:48px 56px}
h1{font-size:34px;margin:0 0 6px;letter-spacing:-.02em}.sub{color:#8b98a5;margin-bottom:28px;font-size:15px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{background:#151b23;border:1px solid #263040;border-radius:14px;padding:18px}
.card img{width:100%;border-radius:8px;display:block}.label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8b98a5;margin-bottom:10px}
.pill{display:inline-block;background:#16a34a22;color:#4ade80;border:1px solid #16a34a55;border-radius:99px;padding:3px 10px;font-size:13px;margin-right:6px}
li{margin:8px 0;font-size:16px}code{background:#1f2937;padding:2px 6px;border-radius:5px;font-size:14px}
.big{font-size:56px;font-weight:700;color:#4ade80}.row{display:flex;gap:20px}.row .card{flex:1}`;
const page = (title, sub, body) => `<!doctype html><meta charset=utf-8><title>${title}</title><style>${css}</style><h1>${title}</h1><div class=sub>${sub}</div>${body}`;
const img = (f) => `<img src="../media-en/${f}">`;
const pages = {
  'dark-mode': page('Dark mode: before and after', 'agent-14 · PR #43 · every color passes WCAG AA', `<div class=grid><div class=card><div class=label>Before</div>${img('orders-before.png')}</div><div class=card><div class=label>After</div>${img('orders-dark-mode.png')}</div></div>`),
  week: page('FreshCart: this week’s changes', 'Written by the lead · 5 pull requests · 2,061 lines', `<div class=row><div class=card><div class=label>Merged</div><div class=big>5</div></div><div class=card><div class=label>Tests added</div><div class=big>69</div></div><div class=card><div class=label>Agents</div><div class=big>5</div></div></div><br><div class=card><ul><li><span class=pill>#43</span> Dark mode for the orders dashboard</li><li><span class=pill>#44</span> Export orders to CSV</li><li><span class=pill>#45</span> Google sign-in works on Safari</li><li><span class=pill>#41</span> End-to-end tests for checkout</li><li><span class=pill>#42</span> A page to manage discount codes</li></ul></div>`),
  e2e: page('Checkout E2E report', 'agent-11 · 12 passed · 0 failed', `<div class=grid><div class=card>${img('checkout-paid.png')}</div><div class=card><ul>${['Cart with 4 items', 'APPLEPAY5 code applied', 'Payment sheet shown', 'Webhook confirms payment', 'Confirmation email', 'Stock updated'].map((t) => `<li>✅ ${t}</li>`).join('')}</ul></div></div>`),
  safari: page('Safari sign-in: root cause', 'agent-16 · Codex · PR #45', `<div class=grid><div class=card><div class=label>Cause</div><p style="font-size:17px;line-height:1.6">Safari blocks a popup that opens after an <code>await</code>. The sign-in fetched its config first, so the click's user gesture was gone.</p><div class=label>Fix</div><p style="font-size:17px;line-height:1.6">Open the popup straight from the click, then point it at Google once the config is in.</p></div><div class=card>${img('google-signin-ok.png')}</div></div>`),
  csv: page('CSV export: columns and format', 'agent-15 · PR #44 · 48 tests pass', `<div class=grid><div class=card>${img('csv-exported.png')}</div><div class=card><ul><li><code>order_id</code>, <code>customer</code>, <code>items</code></li><li><code>total</code> with two decimals</li><li><code>status</code>, <code>placed_at</code> in ISO 8601</li><li>Quotes fields with commas and quotes</li><li>Streams 10,000 orders without blocking</li></ul></div></div>`),
};
const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
for (const [name, html] of Object.entries(pages)) {
  fs.writeFileSync(`${OUT}/${name}.html`, html);
  await p.goto(`http://localhost:7802/pages/${name}.html`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}.png` });
}
await b.close();
console.log('pages done');
