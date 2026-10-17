// A scripted stand-in for the AgentBox daemon, for recording a "just using it"
// walkthrough of the real desktop app (UI v2, built from main). It answers the
// app's API on a unix socket with believable fixture data, and plays the story
// from a control port: the lead starts two agents, they work, finish, and one
// is merged and goes to Past agents. No real secrets, machines or GitHub.
// Control: http://127.0.0.1:7788/ctl/<action>
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const { WebSocketServer } = createRequire(new URL('../../../desktop/package.json', import.meta.url))('ws');
const WORK = process.env.PROMO_WORK || path.join(process.env.HOME, 'promo');

const SOCK = process.env.AGENTBOX_SOCKET || '/t/demo/agentbox.sock';
const VM_SOCK = process.env.VM_SOCK || path.join(WORK, 'home/.local/share/agentbox/run/vm.sock');
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(WORK, 'media');
const LOG = fs.createWriteStream('/t/demo/requests.log', { flags: 'a' });
const P = 'freshcart';
const now = () => new Date().toISOString();
const min = 60_000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
let FAST = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 0 : ms));

// ---------- seed data ----------
const projects = [
  proj('freshcart', 'FreshCart', 0, '🛒'),
  proj('payments-api', 'payments-api', 1, '💳'),
  proj('marketing-site', 'marketing-site', 2, '🌐'),
];
function proj(name, displayName, position, emoji) {
  return {
    name, displayName, root: `/home/ana/code/${name}`, branch: 'main', envFiles: ['.env'], android: false,
    claudeAccount: 'Work', claudeAccounts: [], githubAccount: 'ana-dev', codexAccount: '', openCodeAccounts: {}, cursorAccount: '',
    autonomy: 'auto', agentModel: 'auto', branchPrefix: 'agentbox/', finishNotices: 'chat', rolloverThreshold: 0, contextBudget: 0,
    consolidation: 0, consolidationModel: 'cheap', section: '', position, nesting: false, agentPRs: true, prWatch: '', syncBase: false,
    prWatching: false, createdAt: ago(40 * 24 * 60 * min), iconVersion: 1, emoji,
  };
}
const auth = {
  claude: true, codex: true, opencode: true, cursor: false,
  claudeAccounts: [{ name: 'Work', default: true, savedAt: ago(20 * 24 * 60 * min), valid: 'ok' }],
  codexAccounts: [], openCodeAccounts: [], cursorAccounts: [],
  github: true, githubAccounts: [{ name: 'ana-dev', default: true, savedAt: ago(20 * 24 * 60 * min), login: 'ana-dev' }], githubUser: 'ana-dev',
};
const limits = { cpu: '2', allowance: '200%', memory: '6GiB', configuredCPU: '2' };
function mkAgent(project, name, title, branch, o = {}) {
  return {
    ref: `${project}/${name}`, project, name, title, instance: `ab-${project}-${name}`, ai: 'claude', autonomous: true,
    branch, baseRef: 'main', baseCommit: '4f2c9a1', worktree: `/home/ana/.local/share/agentbox/worktrees/${project}/${name}`,
    source: 'main', claudeAccount: 'Work', githubAccount: 'ana-dev', interface: 'chat', chat: 'ready',
    state: 'running', ip: `10.88.8.${20 + parseInt(name.slice(-2), 10)}`, createdAt: now(), limits, ...o,
  };
}

// The two agents the lead starts.
const plan = [
  { name: 'agent-05', title: 'Dark mode for the orders page', branch: 'agentbox/orders-dark-mode', pr: 142, media: 'agent-01' },
  { name: 'agent-06', title: 'Export orders to CSV', branch: 'agentbox/export-orders-csv', pr: 143, media: 'agent-02' },
];

let agents = [
  mkAgent('payments-api', 'agent-03', 'Retry failed payment webhooks', 'agentbox/webhook-retry', { chat: 'running', createdAt: ago(50 * min) }),
  mkAgent('marketing-site', 'agent-02', 'New pricing page', 'agentbox/pricing-page', { state: 'stopped', chat: '', createdAt: ago(26 * 60 * min) }),
];
let archived = [
  past('agent-04', 'Paginate the orders table', 'agentbox/orders-pagination', 138, 'feat: paginate the orders table', 26 * 60),
  past('agent-03', 'Fix the flaky checkout test', 'agentbox/flaky-checkout', 136, 'fix: the checkout test waits for the payment sheet', 2 * 24 * 60),
  past('agent-02', 'Low-stock badge on products', 'agentbox/low-stock-badge', 133, 'feat: a low-stock badge on product cards', 3 * 24 * 60),
  past('agent-01', 'Upgrade to React 20', 'agentbox/react-20', 131, 'chore: upgrade to React 20', 5 * 24 * 60),
];
function past(name, title, branch, number, prTitle, minutesAgo) {
  return {
    ref: `${P}/${name}`, project: P, name, title, task: title, ai: 'claude', interface: 'chat', branch, baseRef: 'main', baseCommit: '9d1e0b2',
    createdAt: ago((minutesAgo + 90) * min), archivedAt: ago(minutesAgo * min),
    pr: pr(number, prTitle, branch, name, 'passing', 120, 14, minutesAgo, 'merged'), tokens: 1_200_000 + ((number * 7919) % 23) * 130_000, costUsd: 1.4 + ((number * 31) % 17) / 5,
  };
}
let agentEvents = { [P]: [], 'payments-api': [], 'marketing-site': [] };
let jobs = [];
let media = [];
let pulls = [];
let review = []; // ReviewItem[] waiting
let reviewed = [];
const chats = new Map();
function thread(ref) {
  if (!chats.has(ref)) chats.set(ref, { agent: ref, seq: 0, session: { state: 'ready', tool: 'claude', options: sessionOptions(), commands: [], contextUsed: 18_000, contextSize: 1_000_000 }, items: [] });
  return chats.get(ref);
}
function sessionOptions() {
  return [
    { id: 'model', name: 'Model', category: 'model', type: 'select', value: 'claude-opus-5-5', choices: [{ value: 'claude-opus-5-5', name: 'Opus 5.5' }, { value: 'claude-sonnet-5-5', name: 'Sonnet 5.5' }] },
    { id: 'effort', name: 'Effort', category: 'thought_level', type: 'select', value: 'medium', choices: [{ value: 'low', name: 'Low' }, { value: 'medium', name: 'Medium' }, { value: 'high', name: 'High' }] },
  ];
}

// An earlier exchange in each lead chat, so they aren't empty.
function seedChats() {
  const lead = thread(`${P}/lead`);
  const at = (m) => ago(m * min);
  lead.items = [
    { id: 'h1', turn: 'h1', kind: 'user', text: 'The orders table gets slow with a few thousand orders. Can we paginate it?', createdAt: at(27 * 60), updatedAt: at(27 * 60), result: { state: 'completed', stopReason: 'end_turn', endedAt: at(27 * 60 - 0.3) } },
    { id: 'h1a', turn: 'h1', kind: 'assistant', text: 'Started **agent-04** on it, on `agentbox/orders-pagination`. I\'ll tell you when it\'s ready to review.', createdAt: at(27 * 60 - 0.3), updatedAt: at(27 * 60 - 0.3) },
    { id: 'h2', turn: 'h2', kind: 'user', hidden: true, text: '[AgentBox: agent-04 finished]', createdAt: at(26 * 60), updatedAt: at(26 * 60), result: { state: 'completed', stopReason: 'end_turn', endedAt: at(26 * 60 - 0.2) } },
    { id: 'h2a', turn: 'h2', kind: 'assistant', text: 'agent-04 finished: the orders table shows 50 orders a page, with the page in the URL. PR #138 is merged.', createdAt: at(26 * 60 - 0.2), updatedAt: at(26 * 60 - 0.2) },
  ];
  lead.seq = 4;
  const pay = thread('payments-api/lead');
  pay.items = [
    { id: 'p1', turn: 'p1', kind: 'user', text: 'Webhooks from the payment provider fail now and then. Retry them with backoff.', createdAt: at(52), updatedAt: at(52), result: { state: 'completed', stopReason: 'end_turn', endedAt: at(51.8) } },
    { id: 'p1a', turn: 'p1', kind: 'assistant', text: 'Started **agent-03** on it.', createdAt: at(51.8), updatedAt: at(51.8) },
  ];
  const mk = thread('marketing-site/lead');
  mk.items = [
    { id: 'm1', turn: 'm1', kind: 'user', text: 'Stop agent-02 for tonight, we\'ll pick the pricing page up tomorrow.', createdAt: at(20 * 60), updatedAt: at(20 * 60), result: { state: 'completed', stopReason: 'end_turn', endedAt: at(20 * 60 - 0.2) } },
    { id: 'm1a', turn: 'm1', kind: 'assistant', text: 'Stopped agent-02. The pricing page draft is on its branch.', createdAt: at(20 * 60 - 0.2), updatedAt: at(20 * 60 - 0.2) },
  ];
  const w = thread('payments-api/agent-03');
  w.session.state = 'running';
  w.session.turnStartedAt = at(4);
  w.items = [{ id: 'u1', turn: 'u1', kind: 'user', text: 'Retry failed payment webhooks with exponential backoff.', createdAt: at(50), updatedAt: at(50) }];
}
seedChats();

// ---------- events ----------
const clients = new Set();
function emit(type, data) {
  const line = `event: ${type}\ndata: ${JSON.stringify({ type, time: now(), data })}\n\n`;
  for (const c of clients) c.write(line);
}
function chatEmit(ref, patch) {
  const t = thread(ref);
  t.seq++;
  emit('chat', { agent: ref, seq: t.seq, ...patch });
}
function chatItem(ref, item) {
  const t = thread(ref);
  const full = { createdAt: now(), updatedAt: now(), ...item };
  const i = t.items.findIndex((x) => x.id === full.id);
  if (i >= 0) t.items[i] = { ...t.items[i], ...full, updatedAt: now() };
  else t.items.push(full);
  chatEmit(ref, { item: i >= 0 ? t.items[i] : full });
}
function chatSession(ref, s) {
  const t = thread(ref);
  t.session = { ...t.session, ...s };
  for (const k of Object.keys(s)) if (s[k] === undefined) delete t.session[k];
  chatEmit(ref, { session: t.session });
}
function agentEvent(project, e) {
  const full = { id: 'ev-' + Math.random().toString(36).slice(2), project, at: now(), ...e };
  agentEvents[project] = [full, ...(agentEvents[project] || [])];
  emit('agent.event', full);
}
function refreshAll() {
  emit('job', { id: 'job-refresh-' + Date.now(), kind: 'refresh', target: P, status: 'succeeded', createdAt: now(), finishedAt: now() });
}
async function stream(ref, id, turn, text, cps = 70) {
  chatItem(ref, { id, turn, kind: 'assistant', text: '', streaming: true });
  const words = text.split(/(?<=\s)/);
  let chunk = '';
  const item = () => thread(ref).items.find((x) => x.id === id);
  for (const w of words) {
    chunk += w;
    if (chunk.length >= 8) {
      item().text += chunk;
      chatEmit(ref, { append: { id, text: chunk } });
      await sleep((chunk.length / cps) * 1000);
      chunk = '';
    }
  }
  if (chunk) {
    item().text += chunk;
    chatEmit(ref, { append: { id, text: chunk } });
  }
  chatItem(ref, { ...item(), streaming: false });
}

// ---------- the lead scene ----------
let leadBusy = false;
async function leadScene(text) {
  const ref = `${P}/lead`;
  const turn = 'turn-' + Date.now();
  chatItem(ref, { id: turn, turn, kind: 'user', text, delivery: 'delivered' });
  chatSession(ref, { state: 'running', turnStartedAt: now() });
  await sleep(1400);
  chatItem(ref, { id: turn + '-th', turn, kind: 'thought', text: 'Two independent changes to the orders page. They touch different files, so two agents can run side by side.' });
  await sleep(900);
  await stream(ref, turn + '-a1', turn, 'Two independent changes, so I\'ll run them **in parallel**: one agent each, on its own machine and branch.');
  await sleep(500);
  for (const [i, s] of plan.entries()) {
    const callId = `${turn}-c${i}`;
    const input = { title: s.title, task: taskText(s), branch: s.branch };
    chatItem(ref, { id: callId, turn, kind: 'tool', tool: { callId, name: 'mcp__agentbox__create_agent', title: `create_agent: ${s.title}`, kind: 'other', status: 'in_progress', input } });
    const job = { id: `job-create-${s.name}`, kind: 'create', target: `${P}/${s.name}`, status: 'running', createdAt: now() };
    jobs = [job, ...jobs];
    emit('job', job);
    await sleep(900);
    const a = mkAgent(P, s.name, s.title, s.branch, { state: 'running', chat: 'running' });
    agents.push(a);
    agentEvent(P, { agent: s.name, ref: a.ref, title: s.title, kind: 'created' });
    job.status = 'succeeded';
    job.finishedAt = now();
    emit('job', job);
    emit('agent', { ref: a.ref, state: 'running', ip: a.ip });
    chatItem(ref, { id: callId, turn, kind: 'tool', tool: { callId, name: 'mcp__agentbox__create_agent', title: `create_agent: ${s.title}`, kind: 'other', status: 'completed', input, output: `Created ${s.name} on ${s.branch}.` } });
    agentWork(a, s);
    await sleep(700);
  }
  await sleep(400);
  await stream(ref, turn + '-a2', turn, '**agent-05** is on the dark mode and **agent-06** on the CSV export. Each one tests its change in its own browser, records it, and opens a PR. I\'ll tell you when they\'re ready to review.');
  const u = thread(ref).items.find((x) => x.id === turn);
  chatItem(ref, { ...u, result: { state: 'completed', stopReason: 'end_turn', endedAt: now() } });
  chatSession(ref, { state: 'ready', turnStartedAt: undefined });
}
function taskText(s) {
  return s.name === 'agent-05'
    ? 'Add a dark mode to the orders page: a toggle in the header, saved per user, following the system by default. Every color must pass WCAG AA. Record it working and open a PR.'
    : 'Add an "Export CSV" button to the orders page that downloads the filtered orders (id, customer, total, status, date). Test it, record it working and open a PR.';
}

// ---------- the agents' own chats ----------
const steps = {
  'agent-05': [
    { t: 'tool', kind: 'search', title: 'Grep "#fff|#111|color:" src/pages', output: '23 matches in 4 files' },
    { t: 'tool', kind: 'read', title: 'Read src/pages/Orders.tsx', paths: ['src/pages/Orders.tsx'] },
    { t: 'tool', kind: 'read', title: 'Read src/styles/theme.css', paths: ['src/styles/theme.css'] },
    { t: 'assistant', text: 'The page has 23 hard-coded colors. I\'ll move them to theme variables, then add a dark palette and a toggle in the header.' },
    { t: 'tool', kind: 'edit', title: 'Edit src/styles/theme.css', paths: ['src/styles/theme.css'] },
    { t: 'tool', kind: 'edit', title: 'Write src/components/ThemeToggle.tsx', paths: ['src/components/ThemeToggle.tsx'] },
    { t: 'tool', kind: 'edit', title: 'Edit src/pages/Orders.tsx', paths: ['src/pages/Orders.tsx'] },
    { t: 'tool', kind: 'execute', title: 'npm test -- --run', command: 'npm test -- --run', output: ' ✓ src/components/ThemeToggle.test.tsx (6 tests)\n ✓ src/pages/Orders.test.tsx (14 tests)\n\n Test Files  2 passed (2)\n      Tests  20 passed (20)' },
    { t: 'tool', kind: 'execute', title: 'agentbox browser open http://localhost:5173/#orders', command: 'agentbox browser open http://localhost:5173/#orders', output: 'opened' },
    { t: 'tool', kind: 'execute', title: 'agentbox media record start --input desktop --name dark-mode-toggle', command: 'agentbox media record start --input desktop --name dark-mode-toggle', output: 'recording dark-mode-toggle' },
  ],
  'agent-06': [
    { t: 'tool', kind: 'read', title: 'Read src/pages/Orders.tsx', paths: ['src/pages/Orders.tsx'] },
    { t: 'tool', kind: 'read', title: 'Read src/api/orders.ts', paths: ['src/api/orders.ts'] },
    { t: 'assistant', text: 'The table already has the filtered rows in memory, so the export can build the CSV in the browser, no new endpoint needed.' },
    { t: 'tool', kind: 'edit', title: 'Write src/export/csv.ts', paths: ['src/export/csv.ts'] },
    { t: 'tool', kind: 'edit', title: 'Write src/export/csv.test.ts', paths: ['src/export/csv.test.ts'] },
    { t: 'tool', kind: 'edit', title: 'Edit src/pages/Orders.tsx', paths: ['src/pages/Orders.tsx'] },
    { t: 'tool', kind: 'execute', title: 'npm test -- --run src/export', command: 'npm test -- --run src/export', output: ' ✓ src/export/csv.test.ts (9 tests) 41ms\n\n Test Files  1 passed (1)\n      Tests  9 passed (9)' },
  ],
};
function agentWork(a, s) {
  const ref = a.ref;
  const t = thread(ref);
  t.session = { ...t.session, state: 'running', turnStartedAt: now(), contextUsed: 24_000 };
  chatItem(ref, { id: 'u1', turn: 'u1', kind: 'user', text: taskText(s) });
  chatSession(ref, { state: 'running', turnStartedAt: now() });
  (async () => {
    for (const [i, st] of steps[a.name].entries()) {
      await sleep(1600 + Math.random() * 1400);
      if (!agents.includes(a)) return;
      if (st.t === 'tool') chatItem(ref, { id: `s${i}`, turn: 'u1', kind: 'tool', tool: { callId: `s${i}`, name: st.kind === 'execute' ? 'Bash' : st.kind === 'edit' ? 'Edit' : st.kind === 'search' ? 'Grep' : 'Read', title: st.title, kind: st.kind, status: 'completed', command: st.command, output: st.output, paths: st.paths } });
      else chatItem(ref, { id: `s${i}`, turn: 'u1', kind: st.t, text: st.text });
      chatSession(ref, { contextUsed: 24_000 + i * 9_000 });
    }
  })();
}

// ---------- finishing, review, merge ----------
const prBody = {
  142: '## Dark mode for the orders page\n\nA sun/moon toggle in the header switches the orders page between light and dark. The choice is saved per user, and follows the system until you pick one.\n\n- Colors moved to theme variables (`src/styles/theme.css`)\n- Every pair passes WCAG AA contrast\n- `ThemeToggle` has its own tests\n\nRecorded in AgentBox: `dark-mode-toggle`.',
  143: '## Export orders to CSV\n\nAn **Export CSV** button above the orders table downloads the orders as filtered on screen: id, customer, total, status and date.\n\n- Built in the browser from the rows already loaded\n- Commas, quotes and new lines in names are escaped\n- 9 tests in `src/export/csv.test.ts`\n\nRecorded in AgentBox: `export-csv`.',
};
const summaries = {
  'agent-05': 'Added a **dark mode** to the orders page: a toggle in the header, saved per user, following the system by default. All colors pass WCAG AA.\n\n20 tests pass, and the toggle is recorded in Media. PR #142 is green.',
  'agent-06': 'Added an **Export CSV** button to the orders page. It downloads the orders as filtered on screen, built in the browser.\n\n9 new tests pass, and the export is recorded in Media. PR #143 is green.',
};
const files = {
  142: [
    { path: 'src/styles/theme.css', status: 'modified', additions: 58, deletions: 4, hasDiff: true },
    { path: 'src/components/ThemeToggle.tsx', status: 'added', additions: 41, deletions: 0, hasDiff: true },
    { path: 'src/pages/Orders.tsx', status: 'modified', additions: 9, deletions: 23, hasDiff: true },
    { path: 'src/components/ThemeToggle.test.tsx', status: 'added', additions: 52, deletions: 0, hasDiff: true },
  ],
  143: [
    { path: 'src/export/csv.ts', status: 'added', additions: 34, deletions: 0, hasDiff: true },
    { path: 'src/pages/Orders.tsx', status: 'modified', additions: 12, deletions: 1, hasDiff: true },
    { path: 'src/export/csv.test.ts', status: 'added', additions: 61, deletions: 0, hasDiff: true },
  ],
};
const patches = {
  'src/styles/theme.css': `@@ -1,12 +1,66 @@
-body { background: #fff; color: #111; }
-.card { background: #f7f7f8; border: 1px solid #e4e4e7; }
-.muted { color: #71717a; }
-.badge-paid { background: #dcfce7; color: #166534; }
+:root {
+  --bg: #ffffff;
+  --surface: #f7f7f8;
+  --border: #e4e4e7;
+  --text: #111111;
+  --muted: #71717a;
+  --paid-bg: #dcfce7;
+  --paid-fg: #166534;
+  color-scheme: light;
+}
+
+:root[data-theme='dark'] {
+  --bg: #0f1115;
+  --surface: #171a21;
+  --border: #2a2f3a;
+  --text: #e8eaf0;
+  --muted: #9aa3b2;
+  --paid-bg: #12351f;
+  --paid-fg: #7ee2a1;
+  color-scheme: dark;
+}
+
+body { background: var(--bg); color: var(--text); transition: background 0.2s, color 0.2s; }
+.card { background: var(--surface); border: 1px solid var(--border); }
+.muted { color: var(--muted); }
+.badge-paid { background: var(--paid-bg); color: var(--paid-fg); }`,
  'src/components/ThemeToggle.tsx': `@@ -0,0 +1,41 @@
+import { Moon, Sun } from 'lucide-react';
+import { useEffect, useState } from 'react';
+
+type Theme = 'light' | 'dark';
+
+const saved = () => localStorage.getItem('theme') as Theme | null;
+const system = (): Theme => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
+
+// ThemeToggle switches the app between light and dark. The choice is saved;
+// until there is one, it follows the system.
+export function ThemeToggle() {
+  const [theme, setTheme] = useState<Theme>(() => saved() ?? system());
+
+  useEffect(() => {
+    document.documentElement.dataset.theme = theme;
+  }, [theme]);
+
+  const toggle = () => {
+    const next = theme === 'dark' ? 'light' : 'dark';
+    localStorage.setItem('theme', next);
+    setTheme(next);
+  };
+
+  return (
+    <button className="icon-button" onClick={toggle} aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
+      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
+    </button>
+  );
+}`,
  '142:src/pages/Orders.tsx': `@@ -3,6 +3,7 @@ import { useOrders } from '../api/orders';
 import { OrdersTable } from '../components/OrdersTable';
+import { ThemeToggle } from '../components/ThemeToggle';
 
 export function Orders() {
   const { orders, filter } = useOrders();
@@ -18,9 +19,10 @@ export function Orders() {
     <section className="card">
-      <header style={{ background: '#fff', borderBottom: '1px solid #e4e4e7' }}>
-        <h1 style={{ color: '#111' }}>Orders</h1>
+      <header>
+        <h1>Orders</h1>
+        <ThemeToggle />
       </header>
-      <OrdersTable rows={filter(orders)} stripe="#f7f7f8" />
+      <OrdersTable rows={filter(orders)} />
     </section>`,
  '143:src/pages/Orders.tsx': `@@ -3,6 +3,7 @@ import { useOrders } from '../api/orders';
 import { OrdersTable } from '../components/OrdersTable';
+import { exportCSV } from '../export/csv';
 
 export function Orders() {
   const { orders, filter } = useOrders();
@@ -18,7 +19,10 @@ export function Orders() {
     <section className="card">
       <header>
         <h1>Orders</h1>
+        <button className="secondary" onClick={() => exportCSV(filter(orders))}>
+          Export CSV
+        </button>
       </header>`,
  'src/components/ThemeToggle.test.tsx': `@@ -0,0 +1,52 @@
+import { fireEvent, render, screen } from '@testing-library/react';
+import { beforeEach, expect, test } from 'vitest';
+import { ThemeToggle } from './ThemeToggle';
+
+beforeEach(() => localStorage.clear());
+
+test('follows the system until a choice is saved', () => {
+  matchMedia.mockDark(true);
+  render(<ThemeToggle />);
+  expect(document.documentElement.dataset.theme).toBe('dark');
+});
+
+test('saves the choice', () => {
+  render(<ThemeToggle />);
+  fireEvent.click(screen.getByRole('button'));
+  expect(localStorage.getItem('theme')).toBe('dark');
+});`,
  'src/export/csv.ts': `@@ -0,0 +1,34 @@
+import type { Order } from '../api/orders';
+
+const columns = ['id', 'customer', 'total', 'status', 'date'] as const;
+
+// cell quotes a value when it holds a comma, a quote or a new line.
+const cell = (v: string) => (/[",\\n]/.test(v) ? \`"\${v.replaceAll('"', '""')}"\` : v);
+
+export function toCSV(orders: Order[]): string {
+  const rows = orders.map((o) => [o.id, o.customer, o.total.toFixed(2), o.status, o.date.slice(0, 10)].map(String).map(cell));
+  return [columns.join(','), ...rows.map((r) => r.join(','))].join('\\n');
+}
+
+// exportCSV downloads the orders as shown, filters and all.
+export function exportCSV(orders: Order[]) {
+  const blob = new Blob([toCSV(orders)], { type: 'text/csv' });
+  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'orders.csv' });
+  a.click();
+  URL.revokeObjectURL(a.href);
+}`,
  'src/export/csv.test.ts': `@@ -0,0 +1,61 @@
+import { expect, test } from 'vitest';
+import { toCSV } from './csv';
+
+const order = { id: '1042', customer: 'Lee, Ana', total: 42.5, status: 'paid', date: '2026-10-16T10:00:00Z' };
+
+test('has a header row', () => {
+  expect(toCSV([]).split('\\n')[0]).toBe('id,customer,total,status,date');
+});
+
+test('quotes names with commas', () => {
+  expect(toCSV([order]).split('\\n')[1]).toBe('1042,"Lee, Ana",42.50,paid,2026-10-16');
+});`,
};

for (const [number, list] of Object.entries(files)) {
  for (const f of list) {
    const key = patches[`${number}:${f.path}`] !== undefined ? `${number}:${f.path}` : f.path;
    const lines = (patches[key] ?? '').split('\n');
    f.additions = lines.filter((l) => l.startsWith('+')).length;
    f.deletions = lines.filter((l) => l.startsWith('-')).length;
    if (f.status === 'added') patches[key] = patches[key].replace(/^@@ -0,0 \+1,\d+ @@/, `@@ -0,0 +1,${f.additions} @@`);
  }
}

function pr(number, title, head, agentName, checks, add, del, agoMin, state = 'open') {
  return {
    number, title, state, checks, url: `https://github.com/freshcart/freshcart/pull/${number}`, draft: false, additions: add, deletions: del, comments: 0,
    updatedAt: ago(agoMin * min), baseBranch: 'main', headBranch: head, headSha: `c0ffee${number}`, author: 'ana-dev', agent: `${P}/${agentName}`,
  };
}
const prTitles = { 142: 'feat: dark mode for the orders page', 143: 'feat: export orders to CSV' };

function loadMedia(s, a) {
  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(MEDIA_DIR, 'manifest.json'), 'utf8'));
  } catch {}
  return manifest
    .filter((m) => m.agentName === s.media && m.kind !== 'note' && m.name !== 'discounts-dark-mode')
    .map((m, i, all) => ({ ...m, id: `${s.name}-${m.id}`, agent: a.ref, agentName: s.name, agentTitle: s.title, createdAt: ago((2 + (all.length - i) * 3) * min) }));
}

// finish: an agent ends its turn, with its PR open and green.
async function finish(name) {
  const s = plan.find((x) => x.name === name);
  const a = agents.find((x) => x.ref === `${P}/${name}`);
  if (!a || review.some((r) => r.agent === name)) return;
  const fs_ = files[s.pr];
  const add = fs_.reduce((n, f) => n + f.additions, 0);
  const del = fs_.reduce((n, f) => n + f.deletions, 0);
  const p = pr(s.pr, prTitles[s.pr], s.branch, name, 'passing', add, del, 0);
  pulls = [p, ...pulls.filter((x) => x.number !== s.pr)];
  const items = loadMedia(s, a);
  media = [...items, ...media.filter((m) => m.agent !== a.ref)];
  for (const m of items) emit('media', m);
  const changes = { files: fs_.length, insertions: add, deletions: del, dirty: false };
  const ref = a.ref;
  chatItem(ref, { id: 'done', turn: 'u1', kind: 'assistant', text: summaries[name] });
  const u = thread(ref).items.find((x) => x.id === 'u1');
  chatItem(ref, { ...u, result: { state: 'completed', stopReason: 'end_turn', endedAt: now() } });
  chatSession(ref, { state: 'ready', turnStartedAt: undefined });
  a.chat = 'ready';
  review.push({ project: P, agent: name, ref, title: s.title, branch: s.branch, ai: 'claude', summary: summaries[name], changes, pr: p, finishedAt: now(), fingerprint: `{"f":"${name}"}` });
  agentEvent(P, { agent: name, ref, title: s.title, kind: 'finished', summary: summaries[name], changes, pr: p });
  emit('pulls', { project: P, github: 'freshcart/freshcart', fetchedAt: now() });
  refreshAll();
  // The lead passes it on.
  const lead = `${P}/lead`;
  const turn = 'note-' + name;
  leadNote(turn, `${name} finished ${name === 'agent-05' ? 'the **dark mode**' : 'the **CSV export**'}: PR #${s.pr} is green, with a recording in Media. It's ready to review.`);
}

// leadNote is a woken lead turn: the lead passing on news without a message from you.
function leadNote(turn, text) {
  const lead = `${P}/lead`;
  chatItem(lead, { id: turn, turn, kind: 'user', hidden: true, text: `[AgentBox: ${turn}]` });
  chatItem(lead, { id: turn + '-a', turn, kind: 'assistant', text });
  const u = thread(lead).items.find((x) => x.id === turn);
  chatItem(lead, { ...u, result: { state: 'completed', stopReason: 'end_turn', endedAt: now() } });
}

// merge: the PR merges; the agent's machine is freed and it becomes a past agent.
function merge(number) {
  const p = pulls.find((x) => x.number === number);
  if (!p) return null;
  p.state = 'merged';
  const name = p.agent.split('/')[1];
  const s = plan.find((x) => x.name === name);
  const item = review.find((r) => r.agent === name);
  review = review.filter((r) => r.agent !== name);
  if (item) reviewed.unshift({ ...item, verdict: 'reviewed', reviewedAt: now() });
  setTimeout(() => {
    emit('pulls', { project: P, github: 'freshcart/freshcart', fetchedAt: now() });
    emit('review', { project: P });
  }, 300);
  setTimeout(() => {
    const a = agents.find((x) => x.ref === p.agent);
    if (!a) return;
    agents = agents.filter((x) => x !== a);
    archived.unshift({ ...past(name, s.title, s.branch, number, p.title, 0), createdAt: a.createdAt, pr: { ...p } });
    emit('agent', { ref: a.ref, state: 'removed', removed: true });
    refreshAll();
    leadNote('merged-' + name, `PR #${number} is merged into main. ${name}'s machine is freed, and it's in Past agents.`);
  }, 1800);
  return p;
}

// ---------- usage ----------
function usage() {
  const running = agents.filter((a) => a.state === 'running');
  const t = Date.now() / 1000;
  const ag = running.map((a, i) => ({
    ref: a.ref, state: a.state, cpu: a.chat === 'running' ? 30 + 25 * Math.sin(t / 3 + i) + 10 * Math.random() : 1 + Math.random() * 2,
    memory: (1.2 + 0.3 * i + 0.1 * Math.sin(t / 7 + i)) * 2 ** 30, processes: 40 + i * 7, diskRead: 2e5 * Math.random(), diskWrite: 4e5 * Math.random(),
  }));
  const cpu = Math.min(95, 6 + ag.reduce((s, a) => s + a.cpu, 0) / 4);
  return { host: { cpu, cores: 16, memUsed: 6 * 2 ** 30 + ag.reduce((s, a) => s + a.memory, 0), memTotal: 64 * 2 ** 30, poolUsed: 180 * 2 ** 30, poolTotal: 900 * 2 ** 30, diskRead: 1.2e6, diskWrite: 2.4e6 }, agents: ag };
}
setInterval(() => emit('usage', usage()), 1000);

function fleet(project) {
  return {
    project, idle: 0, creating: jobs.filter((j) => j.kind === 'create' && j.status === 'running' && j.target.startsWith(project + '/')),
    github: `freshcart/${project}`, githubAccount: 'ana-dev', pullsFetchedAt: now(),
    agents: agents.filter((a) => a.project === project).map((a) => {
      const p = pulls.find((x) => x.agent === a.ref);
      return { ...a, changes: { files: p ? 4 : 2, insertions: p?.additions ?? 40, deletions: p?.deletions ?? 3, dirty: !p }, media: media.filter((m) => m.agent === a.ref).length, pr: p, busy: a.chat === 'running', idle: a.chat !== 'running', lastActive: ago(min), retire: { safe: false } };
    }),
  };
}
function projectChat(name) {
  const t = thread(`${name}/lead`);
  const last = [...t.items].reverse().find((x) => x.kind === 'assistant' || x.kind === 'user');
  return { project: name, ref: `${name}/lead`, started: true, chat: t.session.state === 'running' ? 'running' : 'ready', last: last ? { kind: last.kind, text: last.text, at: last.createdAt } : undefined };
}
const page = (items) => ({ items, total: items.length });

// ---------- routing ----------
const settings = {
  defaultClaudeModel: 'claude-opus-5-5', defaultAgentContextWindow: '1m', defaultLeadModel: 'claude-opus-5-5', defaultLeadContextWindow: '1m',
  claudeModelChoices: [{ value: 'claude-opus-5-5', name: 'Opus 5.5' }, { value: 'claude-sonnet-5-5', name: 'Sonnet 5.5' }], claudeContextWindows: {}, claudeMenuKnown: true,
  defaultClaudeEffort: 'medium', claudeEffortChoices: [{ value: 'medium', name: 'Medium' }], openCodeModelChoices: [], openCodeReady: true,
  defaultCPU: '2', defaultCPUAllowance: '200%', defaultMemory: '6GiB', hostCores: 16, hostMemory: 64 * 2 ** 30, seedMemory: '6GiB',
  resumeAfterLimit: true, claudeCompactWindow: 500_000, updateCheck: false, usageStats: false, mediaRetention: '30d', defaultClaudeCompactWindow: 500_000,
  neverFreezeCPU: false, keepFreeCPU: 2, autoStopIdle: false, idleTimeSeconds: 3600, language: 'en-US',
};
const setup = {
  ready: true,
  checks: [
    { id: 'incus', title: 'Incus', status: 'ok', required: true },
    { id: 'image', title: 'Base image', status: 'ok', required: true },
    { id: 'claude', title: 'Claude Code', status: 'ok', required: true },
  ],
  image: { version: '2026.10.10.1', components: { android: false, codex: true, opencode: true, devCaches: false }, installed: { android: false, codex: true, opencode: true, devCaches: false }, downloads: [], hint: '' },
};
const limitsReport = () => [{
  account: 'Work', default: true, at: ago(2 * min), status: 'allowed',
  windows: [
    { name: 'five_hour', label: '5h', utilization: 0.18, resetsAt: new Date(Date.now() + 3 * 60 * min).toISOString() },
    { name: 'seven_day', label: 'Week', utilization: 0.31, resetsAt: new Date(Date.now() + 4 * 24 * 60 * min).toISOString() },
  ],
}];
const vmStatus = { mode: 'host', driver: '', state: 'running', since: ago(3 * 60 * min), memory: { min: 0, cap: 0, granted: 0, used: 0, resident: 0 }, disk: { size: 0, allocated: 0, pool: { size: 0, allocated: 0 }, root: { size: 0, allocated: 0 } } };

function route(method, url, body) {
  const u = new URL(url, 'http://x');
  const p = decodeURIComponent(u.pathname);
  let m;
  const J = (v, status = 200) => ({ status, json: v });
  if (p === '/v1/version') return J({ version: '0.14.0', incus: true });
  if (p === '/v1/vm') return J(vmStatus);
  if (p === '/v1/projects' && method === 'GET') return J(projects);
  if (p === '/v1/sections') return J([]);
  if (p === '/v1/sidebar') return J({ hidden: [] });
  if (p === '/v1/settings') return J(settings);
  if (p === '/v1/setup') return J(setup);
  if (p === '/v1/image') return J(setup.image);
  if (p === '/v1/auth') return J(auth);
  if (p === '/v1/theme') return J({ mode: 'dark', follow: false, dark: true });
  if (p === '/v1/update') return J({ enabled: false });
  if (p === '/v1/limits') return J(limitsReport());
  if (p === '/v1/jobs' && method === 'GET') return J(jobs);
  if ((m = p.match(/^\/v1\/jobs\/([^/]+)$/))) return J(jobs.find((j) => j.id === m[1]) ?? { id: m[1], kind: 'refresh', target: '', status: 'succeeded', createdAt: now() });
  if (p.match(/^\/v1\/jobs\/[^/]+\/log$/)) return { status: 200, text: '' };
  if (p === '/v1/agents' && method === 'GET') return J(agents);
  if (p === '/v1/usage') return J(usage());
  if (p === '/v1/usage/memory') {
    const us = usage();
    return J({ hostTotal: 64 * 2 ** 30, agentsUsed: us.agents.reduce((s, a) => s + a.memory, 0), otherUsed: 6 * 2 ** 30, swapTotal: 8 * 2 ** 30, swapUsed: 0, agentsSwap: 0, agents: us.agents.map((a) => ({ ref: a.ref, title: agents.find((x) => x.ref === a.ref)?.title, state: 'running', memory: a.memory, swap: 0, limit: 6 * 2 ** 30 })) });
  }
  if (p === '/v1/usage/cpu') {
    const us = usage();
    return J({ hostCPU: us.host.cpu, hostCores: 16, otherCPU: 6, agents: us.agents.map((a) => ({ ref: a.ref, title: agents.find((x) => x.ref === a.ref)?.title, state: 'running', cpu: a.cpu, configuredCores: '2', effectiveCores: '2' })) });
  }
  if (p === '/v1/usage/disk') return J({ total: 900 * 2 ** 30, categories: [] });
  if (p === '/v1/disk') return J({ level: 'ok', disks: [], paused: [], since: '', message: '' });
  if (p === '/v1/snaps') return J([]);
  if (p === '/v1/lan') return J({ enabled: false, phones: [], addresses: [] });
  if (p === '/v1/notifications') return J(page([]));
  if (p === '/v1/project-activity') return J(projects.map((x) => ({ project: x.name, lastActivity: thread(`${x.name}/lead`).items.at(-1)?.createdAt, lastMessage: projectChat(x.name).last?.text })));
  if (p === '/v1/review' || (m = p.match(/^\/v1\/projects\/([^/]+)\/review$/))) {
    const proj = m?.[1];
    const list = u.searchParams.get('reviewed') ? reviewed : review;
    return J(page(list.filter((r) => !proj || r.project === proj)));
  }
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/review$/))) {
    const name = m[2];
    const it = review.find((r) => r.agent === name);
    review = review.filter((r) => r.agent !== name);
    if (it) reviewed.unshift({ ...it, verdict: body?.verdict || 'reviewed', reviewedAt: now() });
    setTimeout(() => emit('review', { project: m[1] }), 50);
    return { status: 204 };
  }
  if (p === '/v1/preview') return J({ domain: 'agentbox.localhost', port: 7777 });
  if (p.startsWith('/v1/usage-stats/')) return { status: 204 };
  if (p === '/v1/archived-agents') return J(archived.filter((x) => !u.searchParams.get('project') || x.project === u.searchParams.get('project')));
  if ((m = p.match(/^\/v1\/archived-agents\/([^/]+)\/([^/]+)$/))) return J(archived.find((x) => x.ref === `${m[1]}/${m[2]}`));
  if ((m = p.match(/^\/v1\/projects\/([^/]+)$/))) return J(projects.find((x) => x.name === m[1]));
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/icon$/))) {
    const pr_ = projects.find((x) => x.name === m[1]);
    return pr_ ? J({ source: 'emoji', emoji: pr_.emoji }) : { status: 404, json: { error: 'no project' } };
  }
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/chat$/))) return J(thread(`${m[1]}/lead`));
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/chat\/runners$/))) return J({ tool: 'claude', account: 'Work', runners: [{ tool: 'claude', name: 'Claude Code', ready: true, installed: true }] });
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/chat\/messages$/))) {
    if (!leadBusy && m[1] === P) {
      leadBusy = true;
      leadScene(body?.text ?? '').finally(() => (leadBusy = false));
    }
    return J({});
  }
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/chat\/cache$/))) return J({ project: m[1], due: false });
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/chat\/start$/))) return J({});
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/lead$/))) return J(projectChat(m[1]));
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/agent-events$/))) return J(agentEvents[m[1]] ?? []);
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/questions$/))) return J([]);
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/fleet$/))) return J(fleet(m[1]));
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/pulls$/))) return J({ project: m[1], github: `freshcart/${m[1]}`, githubAccount: 'ana-dev', pullRequests: m[1] === P ? pulls.filter((x) => x.state === 'open') : [], canMerge: true, canMergeKnown: true, mergeMethods: ['squash', 'merge', 'rebase'], fetchedAt: now() });
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/pulls\/(\d+)$/))) {
    const x = pulls.find((y) => y.number === +m[2]);
    return x ? J({ ...x, body: prBody[x.number] ?? '', checkRuns: [{ name: 'test', status: 'completed', conclusion: 'success' }, { name: 'lint', status: 'completed', conclusion: 'success' }, { name: 'build', status: 'completed', conclusion: 'success' }], changedFiles: files[x.number]?.length ?? 0 }) : { status: 404, json: { error: 'no such PR' } };
  }
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/pulls\/(\d+)\/files$/))) return J({ files: files[+m[2]] ?? [] });
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/pulls\/(\d+)\/diff$/))) return J({ path: u.searchParams.get('path'), patch: patches[`${m[2]}:${u.searchParams.get('path')}`] ?? patches[u.searchParams.get('path')] ?? '' });
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/pulls\/(\d+)\/merge$/))) {
    const x = merge(+m[2]);
    return x ? J(x) : { status: 404, json: { error: 'no such PR' } };
  }
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/media$/))) {
    const agent = u.searchParams.get('agent');
    return J(media.filter((x) => x.agent.startsWith(m[1] + '/') && (!agent || x.agent === agent || x.agentName === agent)));
  }
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/(notes)$/))) return J({ text: '' });
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/(secrets|labels|credentials|connectors|artifacts|skills)$/))) return J([]);
  if ((m = p.match(/^\/v1\/projects\/([^/]+)\/files/))) return J({ files: [], truncated: false });
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)$/))) return J(agents.find((a) => a.ref === `${m[1]}/${m[2]}`));
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/chat$/))) return J(thread(`${m[1]}/${m[2]}`));
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/media$/))) return J(media.filter((x) => x.agent === `${m[1]}/${m[2]}`));
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/browser$/))) return J({ display: true, running: true, version: 'Chrome/155', pages: [{ id: 'p1', url: 'http://localhost:5173/#orders', title: 'FreshCart — Orders' }] });
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/android$/))) return J({ running: false });
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/media\/record$/))) return J({ recording: false });
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/checkpoints$/))) return J([]);
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/(snapshots|secrets|connectors)$/))) return J([]);
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/files/))) return J({ files: [], truncated: false });
  if ((m = p.match(/^\/v1\/agents\/([^/]+)\/([^/]+)\/diff$/))) return J({ commits: [], files: [] });
  if ((m = p.match(/^\/v1\/media\/counts/))) return J({ total: media.length });
  if ((m = p.match(/^\/v1\/media\/([^/]+)$/))) return J(media.find((x) => x.id === m[1]));
  if (p === '/v1/media') return J(media);
  return null;
}

function serveFile(req, res, file, mime) {
  const stat = fs.statSync(file);
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': mime, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  }
}

function handler(req, res) {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {}
    if (req.url.startsWith('/v1/events')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(': hi\n\n');
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return;
    }
    const mf = req.url.match(/^\/v1\/media\/([^/?]+)\/file/);
    if (mf) {
      const item = media.find((x) => x.id === decodeURIComponent(mf[1]));
      if (!item) return res.writeHead(404).end();
      return serveFile(req, res, path.join(MEDIA_DIR, item.file), item.mime);
    }
    const out = route(req.method, req.url, body);
    LOG.write(`${now()} ${req.method} ${req.url} ${out ? out.status : 404}\n`);
    if (!out) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `mock: no route for ${req.method} ${req.url}` }));
    }
    if (out.status === 204) return res.writeHead(204).end();
    if (out.text !== undefined) return res.writeHead(out.status, { 'Content-Type': 'text/plain' }).end(out.text);
    res.writeHead(out.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out.json ?? null));
  });
}
const server = http.createServer(handler);

// An agent's desktop relays to a real VNC server; its terminal to a tmux session.
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  LOG.write(`${now()} WS ${req.url}\n`);
  if (/\/browser\/view/.test(req.url)) {
    return wss.handleUpgrade(req, socket, head, (ws) => {
      const vnc = net.connect(+(process.env.VNC_PORT || 5901), '127.0.0.1');
      vnc.on('data', (d) => ws.readyState === 1 && ws.send(d, { binary: true }));
      ws.on('message', (d) => vnc.write(d));
      ws.on('close', () => vnc.destroy());
      vnc.on('close', () => ws.close());
      vnc.on('error', () => ws.close());
    });
  }
  const tm = req.url.match(/\/v1\/agents\/[^/]+\/([^/]+)\/terminal\?cols=(\d+)&rows=(\d+)/);
  if (tm) {
    return wss.handleUpgrade(req, socket, head, (ws) => {
      const [, name, cols, rows] = tm;
      const session = name.replace('-', '');
      const pty = spawn('script', ['-qfc', `stty cols ${cols} rows ${rows}; exec tmux -L promo attach -t ${session}`, '/dev/null'], { env: { ...process.env, TERM: 'xterm-256color' } });
      pty.stdout.on('data', (d) => ws.readyState === 1 && ws.send(d, { binary: true }));
      ws.on('message', (d, isBinary) => {
        if (!isBinary) {
          try {
            const sz = JSON.parse(d.toString());
            if (sz.cols) spawn('tmux', ['-L', 'promo', 'resize-window', '-t', session, '-x', String(sz.cols), '-y', String(sz.rows)]);
            return;
          } catch {}
        }
        pty.stdin.write(d);
      });
      ws.on('close', () => pty.kill());
      pty.on('exit', () => ws.close());
    });
  }
  socket.destroy();
});

for (const s of [SOCK, VM_SOCK]) {
  fs.mkdirSync(path.dirname(s), { recursive: true });
  try {
    fs.unlinkSync(s);
  } catch {}
}
server.listen(SOCK, () => console.log('mock daemon on', SOCK));
http.createServer(handler).listen(VM_SOCK);

// Control server.
http
  .createServer(async (req, res) => {
    const a = req.url.replace(/^\/ctl\//, '');
    if (a === 'clients') return res.end(String(clients.size) + '\n');
    if (a.startsWith('finish/')) finish(a.split('/')[1]);
    else if (a.startsWith('lead/')) {
      FAST = a.includes('fast');
      if (!leadBusy) {
        leadBusy = true;
        leadScene(decodeURIComponent(a.split('/')[1].replace(/\?.*/, ''))).finally(() => ((leadBusy = false), (FAST = false)));
      }
    }
    res.end('ok ' + a + '\n');
  })
  .listen(7788, '127.0.0.1');
