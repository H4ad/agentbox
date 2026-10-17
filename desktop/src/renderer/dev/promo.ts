// ?promo=<scene>: the app as the promo video films it (promo/README.md), on a
// made-up online grocery, FreshCart, and its neighbours in the sidebar. With
// &app=project&v2=1 it replaces the overflow fixtures with believable ones,
// and plays what a scene needs:
//   spawn    the lead's chat before the ask: sending a message makes the lead
//            answer and start three agents, which join the sidebar
//   work     those three agents at work, each chat streaming its steps;
//            agent-14's Desktop is a real display (VNC on :101) and
//            agent-15's Terminal a scripted shell, both through
//            promo/backend.mjs on :7802
//   review   all five finished, with pull requests, screenshots and
//            recordings, for the review modal, Media and Pages
// Nothing here ships: like the rest of dev/, the build never bundles it.
import type { QueryClient } from '@tanstack/react-query';
import type * as T from '../../shared/api';
import { HomeProject } from '../../shared/api';
import { leadOptions, pageOf, patchDevAgent, PROJECT, setDevMedia, setMediaFile } from './fixtures';

const BACKEND = 'http://localhost:7802';
const min = 60_000;
const hour = 60 * min;
const day = 24 * hour;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const now = () => new Date().toISOString();
const json = (v: unknown, status = 200) => ({ status, body: JSON.stringify(v), contentType: 'application/json' });

let qc: QueryClient;
const ref = (name: string) => `${PROJECT}/${name}`;

// ---- Projects -----------------------------------------------------------

const svg = (body: string) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`)}`;
const freshcartLogo = svg('<rect width="32" height="32" rx="8" fill="#16a34a"/><path d="M9 11h2.2l2.2 9.2h8.4l1.9-6.6H12.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14.6" cy="24" r="1.6" fill="#fff"/><circle cx="20.8" cy="24" r="1.6" fill="#fff"/>');

const others: { name: string; displayName: string; said: number; icon: T.ProjectIcon; last?: [string, string]; running?: boolean }[] = [
  { name: 'courier', displayName: 'Courier', said: 6 * min, icon: { source: 'chosen', emoji: '📦', hasDetected: false }, last: ['assistant', 'agent-7 is mapping the delivery zones; agent-8 is on the driver app’s offline mode.'], running: true },
  { name: 'docs', displayName: 'Docs', said: 50 * min, icon: { source: 'chosen', emoji: '📚', hasDetected: false }, last: ['assistant', 'Published the API reference on Hatch.'] },
  { name: 'billing', displayName: 'Billing', said: 3 * hour, icon: { source: 'chosen', emoji: '💳', hasDetected: false }, last: ['user', 'Retry the failed webhooks from last night'] },
  { name: 'dotfiles', displayName: 'dotfiles', said: 12 * day, icon: { source: 'chosen', emoji: '⚙️', hasDetected: false }, last: ['assistant', 'Moved the Neovim config to lazy.nvim.'] },
  { name: 'landing', displayName: 'Landing page', said: 18 * day, icon: { source: 'chosen', emoji: '🚀', hasDetected: false }, last: ['assistant', 'Merged #12: the pricing table is responsive.'] },
  { name: 'old-blog', displayName: 'Old blog', said: 34 * day, icon: { source: 'chosen', emoji: '📝', hasDetected: false }, last: ['assistant', 'Archived the drafts.'] },
];

function projects(): T.Project[] {
  const base = qc.getQueryData<T.Project[]>(['projects'])!.find((p) => p.name === PROJECT)!;
  const mine: T.Project = { ...base, displayName: 'FreshCart', root: '/home/sam/src/freshcart', section: '', position: 0, iconVersion: 1, createdAt: ago(40 * day) };
  return [mine, ...others.map((o, i) => ({ ...mine, name: o.name, displayName: o.displayName, root: `/home/sam/src/${o.name}`, position: i + 1 }))];
}

// ---- Agents -------------------------------------------------------------

interface Task {
  name: string;
  title: string;
  branch: string;
  ai: string;
  pr: number;
  prTitle: string;
  summary: string;
  changes: T.AgentChanges;
  media: [kind: 'screenshot' | 'recording' | 'report' | 'log' | 'note', file: string, minutesAgo: number][];
}

const tasks: Record<string, Task> = {
  'agent-11': {
    name: 'agent-11', title: 'End-to-end tests for checkout', branch: 'agentbox/checkout-e2e', ai: 'claude', pr: 41,
    prTitle: 'test: end-to-end tests for checkout',
    summary: 'Added **12 end-to-end tests** for checkout: cart, the APPLEPAY5 code, the payment sheet, the webhook, the email and the stock. All green on CI, with the run recorded.',
    changes: { files: 6, insertions: 412, deletions: 8, dirty: false },
    media: [['recording', 'checkout-e2e.mp4', 9], ['screenshot', 'checkout-paid.png', 8], ['report', 'e2e-report.html', 7]],
  },
  'agent-12': {
    name: 'agent-12', title: 'Discount codes page', branch: 'agentbox/discount-codes', ai: 'claude', pr: 42,
    prTitle: 'feat: a page to manage discount codes',
    summary: 'A **Discounts** page to create, pause and expire codes, linked from the sidebar. Usage counts come from the orders API.',
    changes: { files: 5, insertions: 268, deletions: 14, dirty: false },
    media: [['screenshot', 'discounts-page.png', 6], ['recording', 'discounts-navigation.mp4', 4]],
  },
  'agent-14': {
    name: 'agent-14', title: 'Dark mode for the orders dashboard', branch: 'agentbox/dark-mode', ai: 'claude', pr: 43,
    prTitle: 'feat: dark mode for the orders dashboard',
    summary: 'Dark mode for the whole dashboard, with a toggle in the header. It follows the system by default and remembers your choice. Every color passes **WCAG AA**.',
    changes: { files: 7, insertions: 186, deletions: 41, dirty: false },
    media: [['recording', 'dark-mode-toggle.mp4', 2], ['screenshot', 'orders-dark-mode.png', 3], ['screenshot', 'discounts-dark-mode.png', 3], ['screenshot', 'orders-before.png', 30]],
  },
  'agent-15': {
    name: 'agent-15', title: 'Export orders to CSV', branch: 'agentbox/export-orders-csv', ai: 'claude', pr: 44,
    prTitle: 'feat: export orders to CSV',
    summary: '**Export CSV** on the orders table downloads what the filters show, streamed so 10,000 orders don’t block the page. 48 tests pass.',
    changes: { files: 4, insertions: 158, deletions: 3, dirty: false },
    media: [['recording', 'export-csv.mp4', 18], ['screenshot', 'csv-exported.png', 17], ['log', 'vitest.log', 16]],
  },
  'agent-16': {
    name: 'agent-16', title: 'Fix Google sign-in on Safari', branch: 'agentbox/safari-google-signin', ai: 'codex', pr: 45,
    prTitle: 'fix: Google sign-in works on Safari',
    summary: 'Safari blocked the Google popup because `window.open` ran after an `await`. The popup now opens straight from the click, and the token comes back through `postMessage`.',
    changes: { files: 2, insertions: 37, deletions: 19, dirty: false },
    media: [['recording', 'google-signin-safari.mp4', 12], ['screenshot', 'google-signin-ok.png', 11], ['screenshot', 'signin-before.png', 16]],
  },
};

function agent(name: string, over: Partial<T.Agent> = {}, project = PROJECT): T.Agent {
  const t = tasks[name];
  return {
    project, name, ref: `${project}/${name}`, title: t?.title ?? '', instance: '', ai: t?.ai ?? 'claude', autonomous: true,
    branch: t?.branch ?? `agentbox/${name}`, baseRef: 'main', baseCommit: '8c1f2e0', worktree: `/home/sam/.local/share/agentbox/worktrees/${project}/${name}`,
    source: 'main', claudeAccount: '', githubAccount: '', codexAccount: '', openCodeAccounts: {}, cursorAccount: '',
    interface: 'chat', state: 'running', ip: '10.8.8.14', createdAt: ago(25 * min), ...over,
  };
}

const otherAgents = (): T.Agent[] => [
  agent('agent-7', { title: 'Delivery zones on the map', chat: 'running' }, 'courier'),
  agent('agent-8', { title: 'Offline mode for the driver app', ai: 'codex', chat: 'running' }, 'courier'),
  agent('agent-3', { title: 'Examples for every API endpoint', chat: 'running' }, 'docs'),
  agent('agent-5', { title: 'Retry last night’s failed webhooks', chat: 'running' }, 'billing'),
];

function setAgents(list: T.Agent[]) {
  qc.setQueryData(['agents'], list);
  qc.setQueryData<T.Fleet>(['fleet', PROJECT], (f) => ({
    ...(f ?? { project: PROJECT, creating: [], idle: 0 }),
    agents: list.filter((a) => a.project === PROJECT).map((a) => ({ ...a, chat: undefined, changes: tasks[a.name]?.changes ?? { files: 0, insertions: 0, deletions: 0, dirty: false }, media: 0, retire: { safe: false } })),
  }) as T.Fleet);
}
function patchAgent(name: string, over: Partial<T.Agent>) {
  patchDevAgent(ref(name), over);
  setAgents((qc.getQueryData<T.Agent[]>(['agents']) ?? []).map((a) => (a.ref === ref(name) ? { ...a, ...over } : a)));
}
function addAgent(a: T.Agent) {
  setAgents([...(qc.getQueryData<T.Agent[]>(['agents']) ?? []), a]);
}

// ---- Chats --------------------------------------------------------------

const claudeOptions = (): T.ChatOption[] => leadOptions().map((o) => (o.id === 'context_window' ? { ...o, value: '1m' } : o.id === 'effort' ? { ...o, value: 'medium' } : o.id === 'mode' ? { ...o, value: 'acceptEdits' } : o));
const thread = (agentRef: string, items: T.ChatItem[], state = 'ready', tool = 'claude'): T.ChatThread => ({
  agent: agentRef, seq: 1, session: { state, tool, options: tool === 'claude' ? claudeOptions() : [], commands: [], contextUsed: 61_000, contextSize: 1_000_000 }, items,
});
let seq = 0;
const item = (kind: string, over: Partial<T.ChatItem> = {}, at = now()): T.ChatItem => ({ id: `p${++seq}`, turn: over.turn ?? `t${seq}`, kind, createdAt: at, updatedAt: at, ...over });

function setChat(r: string, f: (t: T.ChatThread) => T.ChatThread) {
  qc.setQueryData<T.ChatThread>(['chat', r], (t) => f(t ?? thread(r, [])));
}
function upsert(r: string, it: T.ChatItem) {
  setChat(r, (t) => ({ ...t, items: t.items.some((i) => i.id === it.id) ? t.items.map((i) => (i.id === it.id ? it : i)) : [...t.items, it] }));
}
function session(r: string, state: string) {
  setChat(r, (t) => ({ ...t, session: { ...t.session, state, turnStartedAt: state === 'running' ? now() : undefined } }));
}
function lastLine(project: string, kind: string, text: string, chat?: string) {
  qc.setQueryData<T.ProjectChat>(['projectChat', project], (p) => ({ ...(p ?? { project, ref: `${project}/lead`, started: true, chat: 'ready' }), ...(chat ? { chat } : {}), last: { kind, text, at: now() } }));
}

// stream writes text into an item a few characters at a time, the way the
// adapter's chunks arrive, and resolves when it's all there.
function stream(r: string, it: T.ChatItem, text: string, cps = 90): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      n = Math.min(text.length, n + Math.ceil(cps / 30) + Math.floor(Math.random() * 2));
      upsert(r, { ...it, text: text.slice(0, n), streaming: n < text.length, updatedAt: now() });
      if (n < text.length) setTimeout(tick, 33);
      else resolve();
    };
    tick();
  });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// tool runs a tool call: pending, then completed with its output.
async function tool(r: string, turn: string, t: Omit<T.ChatTool, 'callId' | 'status'>, ms: number) {
  const it = item('tool', { turn, tool: { ...t, callId: `c${seq}`, status: 'in_progress', output: undefined } });
  upsert(r, it);
  await wait(ms);
  upsert(r, { ...it, tool: { ...t, callId: it.tool!.callId, status: 'completed' }, updatedAt: now() });
}

// ---- The lead -----------------------------------------------------------

const earlier = (): T.ChatItem[] => [
  item('user', { turn: 'e1', text: 'Are the checkout tests and the discount codes page done?', result: { state: 'completed', stopReason: 'end_turn', endedAt: ago(4 * min) } }, ago(5 * min)),
  item('assistant', { turn: 'e1', text: 'Both are ready to review:\n\n- **agent-11** added 12 end-to-end tests for checkout. PR #41 is green, with the run recorded.\n- **agent-12** built the discount codes page. PR #42, with screenshots in Media.' }, ago(4 * min)),
];

export const promoAsk = 'Three things for FreshCart: dark mode for the orders dashboard, CSV export on the orders table, and fix Google sign-in on Safari. One agent each.';

const spawned: [name: string, task: string][] = [
  ['agent-14', 'Add dark mode to the orders dashboard: a toggle in the header that follows the system by default and remembers the choice. Check every color for WCAG AA contrast. Record the toggle as proof and open a PR.'],
  ['agent-15', 'Add "Export CSV" to the orders table: export what the filters show, stream it so large exports don’t block the page, and test it. Record the export and open a PR.'],
  ['agent-16', 'Google sign-in fails on Safari. Find out why, fix it, and record it working in WebKit. Open a PR. Use Codex.'],
];

async function leadAnswers(text: string) {
  const r = ref('lead');
  const turn = `ask${seq}`;
  upsert(r, item('user', { turn, text }));
  session(r, 'running');
  lastLine(PROJECT, 'user', text, 'running');
  qc.setQueryData<T.ProjectChat>(['projectChat', PROJECT], (p) => p && { ...p, chat: 'running' });
  await wait(900);
  const intro = item('assistant', { turn });
  await stream(r, intro, 'Three independent changes, so three agents, each on its own machine and branch, working in parallel.', 110);
  for (const [name, task] of spawned) {
    await wait(250);
    const t = tasks[name];
    const call = tool(r, turn, { name: 'mcp__agentbox__create_agent', title: `Create ${name}: ${t.title}`, kind: 'other' }, 700);
    await wait(350);
    addAgent(agent(name, { state: 'initializing', createdAt: now() }));
    qc.setQueryData(['chat', ref(name)], thread(ref(name), [item('user', { turn: 'w0', text: task })], 'ready', t.ai === 'codex' ? 'codex' : 'claude'));
    lastLine(PROJECT, 'assistant', `Starting ${name}: ${t.title.toLowerCase()}`);
    await call;
    setTimeout(() => patchAgent(name, { state: 'running', chat: 'running' }), 1400);
  }
  await wait(500);
  const done = item('assistant', { turn });
  const summary = 'Started:\n\n- **agent-14** dark mode for the orders dashboard\n- **agent-15** CSV export for the orders table\n- **agent-16** Google sign-in on Safari, on Codex\n\nEach one tests its change in its own browser, records it as proof, and opens a PR. I’ll tell you when they’re ready to review.';
  await stream(r, done, summary, 140);
  upsert(r, { ...done, text: summary, result: { state: 'completed', stopReason: 'end_turn', endedAt: now() } });
  session(r, 'ready');
  lastLine(PROJECT, 'assistant', 'Started agent-14, agent-15 and agent-16. I’ll tell you when they’re ready to review.', 'ready');
}

function leadAfter(): T.ChatItem[] {
  const turn = 'ask';
  return [
    ...earlier(),
    item('user', { turn, text: promoAsk, result: { state: 'completed', stopReason: 'end_turn', endedAt: ago(9 * min) } }, ago(10 * min)),
    item('assistant', { turn, text: 'Three independent changes, so three agents, each on its own machine and branch, working in parallel.' }, ago(10 * min)),
    ...spawned.map(([name]) => item('tool', { turn, tool: { callId: name, name: 'mcp__agentbox__create_agent', title: `Create ${name}: ${tasks[name].title}`, kind: 'other', status: 'completed' } }, ago(10 * min))),
    item('assistant', { turn, text: 'Started agent-14, agent-15 and agent-16. Each one tests its change in its own browser, records it as proof, and opens a PR. I’ll tell you when they’re ready to review.' }, ago(9 * min)),
  ];
}

// ---- The agents at work -------------------------------------------------

type Step = (r: string, turn: string) => Promise<void>;
const say = (text: string, cps = 120): Step => async (r, turn) => { await stream(r, item('assistant', { turn }), text, cps); };
const run = (title: string, kind: string, ms: number, more: Partial<T.ChatTool> = {}): Step => (r, turn) => tool(r, turn, { title, kind, ...more }, ms);

const work: Record<string, Step[]> = {
  'agent-14': [
    say('Looking at how the dashboard picks its colors first.'),
    run('Read src/styles/theme.css', 'read', 600, { paths: ['src/styles/theme.css'] }),
    run('grep -rn "#fff\\|bg-white" src/', 'search', 700, { command: 'grep -rn "#fff\\|bg-white" src/', output: 'src/pages/Orders.tsx:48:  <div className="bg-white rounded-xl">\nsrc/components/Header.tsx:12: background: #fff;\nsrc/components/Chart.tsx:31: fill="#fff"' }),
    say('Seven hard-coded colors. Moving them to tokens with a dark set.'),
    run('Edit src/styles/theme.css', 'edit', 900, { paths: ['src/styles/theme.css'], diffs: [{ path: 'src/styles/theme.css', oldText: ':root {\n  --bg: #ffffff;\n  --surface: #f6f7f9;\n  --text: #111827;\n}', newText: ':root {\n  --bg: #ffffff;\n  --surface: #f6f7f9;\n  --text: #111827;\n}\n\n:root[data-theme="dark"] {\n  --bg: #0b0f14;\n  --surface: #121820;\n  --text: #e6edf3;\n  --accent: #34d399;\n}' }] }),
    run('Edit src/components/Header.tsx', 'edit', 800, { paths: ['src/components/Header.tsx'], diffs: [{ path: 'src/components/Header.tsx', oldText: '      <SearchBox />', newText: '      <SearchBox />\n      <ThemeToggle\n        value={theme}\n        onChange={setTheme}\n      />' }] }),
    run('npx vitest run src/theme', 'execute', 1400, { command: 'npx vitest run src/theme', output: ' ✓ src/theme/contrast.test.ts (21 tests) 18ms\n ✓ src/theme/theme.test.ts (6 tests) 9ms\n\n Test Files  2 passed (2)\n      Tests  27 passed (27)' }),
    say('All 21 color pairs pass AA. Trying it in the browser now, and recording it.'),
    run('agentbox media record start --name dark-mode-toggle', 'execute', 900, { command: 'agentbox media record start --name dark-mode-toggle', output: 'Recording the desktop as dark-mode-toggle' }),
  ],
  'agent-15': [
    say('Reading the orders table and its filters.'),
    run('Read src/pages/Orders.tsx', 'read', 600, { paths: ['src/pages/Orders.tsx'] }),
    run('Read src/api/orders.ts', 'read', 500, { paths: ['src/api/orders.ts'] }),
    say('I’ll stream rows to a Blob so a big export never blocks the page.'),
    run('Write src/export/csv.ts', 'edit', 1000, { paths: ['src/export/csv.ts'], diffs: [{ path: 'src/export/csv.ts', created: true, oldText: '', newText: 'export async function* toCSV(orders: AsyncIterable<Order>) {\n  yield header(columns) + "\\n";\n  for await (const o of orders) {\n    yield columns.map((c) => quote(c.value(o))).join(",") + "\\n";\n  }\n}' }] }),
    run('Write src/export/csv.test.ts', 'edit', 800, { paths: ['src/export/csv.test.ts'], diffs: [{ path: 'src/export/csv.test.ts', created: true, oldText: '', newText: 'test("quotes fields with commas and quotes", async () => {\n  const csv = await collect(toCSV(from([order({ note: \'Leave at "door", please\' })])));\n  expect(csv).toContain(\'"Leave at ""door"", please"\');\n});' }] }),
    run('npm test -- src/export', 'execute', 1800, { command: 'npm test -- src/export', output: ' ✓ src/export/csv.test.ts (9 tests) 41ms\n ✓ src/pages/Orders.test.tsx (14 tests) 212ms\n ✓ src/api/orders.test.ts (25 tests) 88ms\n\n Test Files  3 passed (3)\n      Tests  48 passed (48)' }),
    say('48 tests pass. Recording the export in the browser.'),
  ],
  'agent-16': [
    say('Reproducing it in WebKit first.'),
    run('npx playwright test signin --project=webkit', 'execute', 1500, { command: 'npx playwright test signin --project=webkit', output: '  ✘ 1 [webkit] › signin.spec.ts:8 › Google sign-in opens the popup (5.1s)\n\n    Error: popup was blocked' }),
    say('Reproduced. Safari blocks a popup opened after an `await`, and this one opens after fetching the config.'),
    run('Read src/auth/google.ts', 'read', 600, { paths: ['src/auth/google.ts'] }),
    run('Edit src/auth/google.ts', 'edit', 1000, { paths: ['src/auth/google.ts'], diffs: [{ path: 'src/auth/google.ts', oldText: 'const config = await fetchConfig();\nconst popup = window.open(authUrl(config));', newText: 'const popup = window.open("about:blank");\nconst config = await fetchConfig();\npopup.location = authUrl(config);' }] }),
    run('npx playwright test signin --project=webkit', 'execute', 1500, { command: 'npx playwright test signin --project=webkit', output: '  ✓ 1 [webkit] › signin.spec.ts:8 › Google sign-in opens the popup (2.3s)\n  ✓ 2 [webkit] › signin.spec.ts:21 › the token comes back (1.9s)\n\n  2 passed (4.6s)' }),
    say('Fixed: the popup opens straight from the click now.'),
  ],
};

async function playWork(name: string, delay: number) {
  const r = ref(name);
  await wait(delay);
  session(r, 'running');
  for (const step of work[name]) {
    await step(r, 'w1');
    await wait(500 + Math.random() * 500);
  }
}

// The agents' chats at the start of the work scene: their task, and a first
// step already done.
function workChat(name: string): T.ChatThread {
  const task = spawned.find(([n]) => n === name)![1];
  return thread(ref(name), [item('user', { turn: 'w0', text: task }, ago(4 * min))], 'running', tasks[name].ai === 'codex' ? 'codex' : 'claude');
}

// ---- Review -------------------------------------------------------------

const pr = (t: Task, state = 'open'): T.PullRequest => ({
  number: t.pr, title: t.prTitle, state, checks: 'passing', url: `https://github.com/freshcart/freshcart/pull/${t.pr}`,
  additions: t.changes.insertions, deletions: t.changes.deletions, baseBranch: 'main', headBranch: t.branch, headSha: `a1b2c${t.pr}`, author: 'sam-freshcart', agent: t.name, updatedAt: ago(3 * min),
});
const reviewOrder = ['agent-14', 'agent-15', 'agent-16', 'agent-11', 'agent-12'];
const finishedAgo: Record<string, number> = { 'agent-14': 1 * min, 'agent-15': 3 * min, 'agent-16': 6 * min, 'agent-11': 40 * min, 'agent-12': 55 * min };
let waiting: T.ReviewItem[] = [];
let decided: T.ReviewItem[] = [];
const reviewItem = (name: string): T.ReviewItem => {
  const t = tasks[name];
  return { project: PROJECT, agent: name, ref: ref(name), title: t.title, branch: t.branch, ai: t.ai, summary: t.summary, changes: t.changes, pr: pr(t), finishedAt: ago(finishedAgo[name]), fingerprint: `{"f":"${name}"}` };
};

const patches: Record<number, [string, string, number, number, string][]> = {
  43: [
    ['src/styles/theme.css', 'modified', 22, 4, '@@ -1,6 +1,18 @@\n :root {\n   --bg: #ffffff;\n   --surface: #f6f7f9;\n   --text: #111827;\n+  --accent: #16a34a;\n }\n+\n+:root[data-theme="dark"] {\n+  --bg: #0b0f14;\n+  --surface: #121820;\n+  --text: #e6edf3;\n+  --accent: #34d399;\n+}\n+\n+@media (prefers-color-scheme: dark) {\n+  :root:not([data-theme]) { color-scheme: dark; }\n+}'],
    ['src/components/ThemeToggle.tsx', 'added', 48, 0, '@@ -0,0 +1,12 @@\n+export function ThemeToggle({ value, onChange }: Props) {\n+  return (\n+    <button\n+      aria-label="Dark mode"\n+      aria-pressed={value === "dark"}\n+      onClick={() => onChange(value === "dark" ? "light" : "dark")}\n+      className="theme-toggle"\n+    >\n+      {value === "dark" ? <Moon /> : <Sun />}\n+    </button>\n+  );\n+}'],
    ['src/components/Header.tsx', 'modified', 9, 2, '@@ -10,7 +10,14 @@ export function Header() {\n   const [theme, setTheme] = useTheme();\n   return (\n     <header>\n       <SearchBox />\n+      <ThemeToggle\n+        value={theme}\n+        onChange={setTheme}\n+      />'],
  ],
};
function pullFiles(number: number): T.PullFile[] {
  const list = patches[number] ?? [['src/index.ts', 'modified', 12, 3, '@@ -1,3 +1,12 @@\n+// changed']];
  return list.map(([path, status, additions, deletions]) => ({ path, status, additions, deletions, hasDiff: true }));
}

// ---- Media and pages ----------------------------------------------------

const meta: Record<string, T.MediaMeta> = {};
function mediaFor(name: string): T.MediaItem[] {
  const t = tasks[name];
  return t.media.map(([kind, file, minutesAgo], i) => {
    const id = `pm-${name}-${i}`;
    const mime = kind === 'recording' ? 'video/mp4' : kind === 'report' ? 'text/html' : kind === 'log' ? 'text/plain' : 'image/png';
    setMediaFile(id, `${BACKEND}/media-en/${file}`);
    const m: T.MediaMeta = meta[file] ?? (kind === 'recording' ? { width: 1280, height: 800, duration: 14, target: 'browser' } : kind === 'screenshot' ? { width: 1440, height: 900, url: 'http://localhost:5173/' } : kind === 'report' ? { entry: '', tests: { passed: 12, failed: 0, skipped: 0 } } : {});
    return { id, agent: ref(name), agentName: name, agentTitle: t.title, kind, name: file.replace(/\.\w+$/, ''), file, mime, size: 180_000 + i * 90_000, source: 'agent', meta: m, createdAt: ago(minutesAgo * min) };
  });
}

const pages: [id: string, title: string, agent: string, minutes: number, file: string][] = [
  ['fcWeek42', 'FreshCart: this week’s changes', 'lead', 2, 'week.html'],
  ['darkBA14', 'Dark mode: before and after', 'agent-14', 4, 'dark-mode.html'],
  ['e2eRep11', 'Checkout E2E report', 'agent-11', 9, 'e2e.html'],
  ['safari16', 'Safari sign-in: root cause', 'agent-16', 14, 'safari.html'],
  ['csvSpec15', 'CSV export: columns and format', 'agent-15', 40, 'csv.html'],
];
const artifacts = (): T.Artifact[] =>
  pages.map(([id, title, agent, minutes]) => ({
    id, title, url: `https://usehatch.dev/p/${id}`, agent: ref(agent), item: `${agent}-${id}`, agents: [ref(agent)], version: 1,
    createdAt: ago((minutes + 5) * min), updatedAt: ago(minutes * min), expiresAt: new Date(Date.now() + 23 * hour).toISOString(),
  }));
const pageFile = (path: string) => {
  const m = /\/artifacts\/([^/]+)\/page$/.exec(path);
  return m && pages.find(([id]) => id === decodeURIComponent(m[1]));
};

// ---- Files --------------------------------------------------------------

const tree: Record<string, [string, boolean][]> = {
  '': [['e2e', true], ['public', true], ['src', true], ['package.json', false], ['README.md', false], ['tsconfig.json', false], ['vite.config.ts', false]],
  src: [['api', true], ['components', true], ['export', true], ['pages', true], ['styles', true], ['App.tsx', false], ['main.tsx', false]],
  'src/components': [['Chart.tsx', false], ['Header.tsx', false], ['ThemeToggle.tsx', false]],
  'src/styles': [['theme.css', false], ['tokens.css', false]],
  'src/pages': [['Checkout.tsx', false], ['Discounts.tsx', false], ['Orders.tsx', false]],
  'src/api': [['orders.ts', false]],
  'src/export': [['csv.ts', false], ['csv.test.ts', false]],
};
const texts: Record<string, string> = {
  'src/components/ThemeToggle.tsx': `import { Moon, Sun } from './icons';
import type { Theme } from '../theme';

interface Props {
  value: Theme;
  onChange: (next: Theme) => void;
}

// ThemeToggle switches the dashboard between light and dark. The choice is
// saved; until there is one, the dashboard follows the system.
export function ThemeToggle({ value, onChange }: Props) {
  return (
    <button
      aria-label="Dark mode"
      aria-pressed={value === 'dark'}
      onClick={() => onChange(value === 'dark' ? 'light' : 'dark')}
      className="theme-toggle"
    >
      {value === 'dark' ? <Moon /> : <Sun />}
    </button>
  );
}
`,
  'src/styles/theme.css': `:root {
  --bg: #ffffff;
  --surface: #f6f7f9;
  --text: #111827;
  --muted: #6b7280;
  --accent: #16a34a;
}

:root[data-theme='dark'] {
  --bg: #0b0f14;
  --surface: #121820;
  --text: #e6edf3;
  --muted: #8b98a5;
  --accent: #34d399;
}
`,
};
const fileStatus: Record<string, Record<string, string>> = {
  'agent-14': { 'src/styles/theme.css': 'M', 'src/components/Header.tsx': 'M', 'src/components/ThemeToggle.tsx': 'A' },
  'agent-15': { 'src/export/csv.ts': 'A', 'src/export/csv.test.ts': 'A', 'src/pages/Orders.tsx': 'M' },
};

function filesRequest(method: string, path: string) {
  if (method !== 'GET') return undefined;
  const url = new URL(path, 'http://dev');
  const at = url.pathname.match(/^\/v1\/(?:agents\/[^/]+\/([^/]+)|projects\/[^/]+)\/files(\/list|\/status|\/read)?$/);
  if (!at) return undefined;
  const dir = url.searchParams.get('path') ?? '';
  if (at[2] === '/list') return json({ path: dir, entries: (tree[dir] ?? []).map(([name, isDir]) => ({ name, path: dir ? `${dir}/${name}` : name, dir: isDir })), truncated: false } satisfies T.FileList);
  if (at[2] === '/status') return json({ base: 'main', changes: fileStatus[at[1] ?? ''] ?? {}, truncated: false } satisfies T.FileStatus);
  if (at[2] === '/read') {
    const text = texts[dir] ?? `// ${dir}\n`;
    return json({ path: dir, text, size: text.length } satisfies T.FileContent);
  }
  return json({ files: Object.entries(tree).flatMap(([d, es]) => es.filter(([, isDir]) => !isDir).map(([n]) => (d ? `${d}/${n}` : n))), truncated: false } satisfies T.WorktreeFiles);
}

// ---- The bridge ---------------------------------------------------------

function promoRequest(method: string, path: string, body?: unknown) {
  const [route, query] = path.split('?');
  const files = filesRequest(method, path);
  if (files) return files;
  if (method === 'GET' && route === '/v1/projects') return json(qc.getQueryData(['projects']));
  if (method === 'GET' && route === '/v1/agents') return json(qc.getQueryData(['agents']));
  if (method === 'GET' && route === '/v1/project-activity') {
    const said: Record<string, number> = { [PROJECT]: 1 * min, ...Object.fromEntries(others.map((o) => [o.name, o.said])) };
    return json(Object.keys(said).map((p) => ({ project: p, lastActivity: ago(said[p]), lastMessage: ago(said[p]) })));
  }
  const icon = /^\/v1\/projects\/([^/]+)\/icon$/.exec(route);
  if (method === 'GET' && icon) {
    const name = decodeURIComponent(icon[1]);
    return json(name === PROJECT ? { source: 'detected', image: freshcartLogo, detectedFrom: 'public/logo.svg', hasDetected: true } : (others.find((o) => o.name === name)?.icon ?? { source: 'none' }));
  }
  // A chat read again gets what the scene holds.
  const chat = method === 'GET' && /^\/v1\/(?:projects\/([^/]+)\/chat|agents\/([^/]+)\/([^/]+)\/chat)$/.exec(route);
  if (chat) {
    const r = chat[1] ? `${decodeURIComponent(chat[1])}/lead` : `${decodeURIComponent(chat[2])}/${decodeURIComponent(chat[3])}`;
    return json(qc.getQueryData(['chat', r]) ?? thread(r, []));
  }
  const lead = method === 'GET' && /^\/v1\/projects\/([^/]+)\/lead$/.exec(route);
  if (lead) {
    const p = decodeURIComponent(lead[1]);
    return json(qc.getQueryData(['projectChat', p]) ?? { project: p, ref: `${p}/lead`, started: true, chat: 'ready' });
  }
  // Sending to the lead plays the spawn scene's answer.
  if (method === 'POST' && route === `/v1/projects/${PROJECT}/chat/messages`) {
    const text = (body as T.ChatMessageRequest).text;
    void leadAnswers(text);
    return json(item('user', { text, hidden: true }), 202);
  }
  if (method === 'GET' && /^\/v1\/projects\/[^/]+\/chat\/runners$/.test(route))
    return json({ tool: 'claude', account: 'default', runners: [{ tool: 'claude', name: 'Claude Code', ready: true, installed: true }] } satisfies T.LeadRunners);
  const browser = method === 'GET' && /^\/v1\/agents\/[^/]+\/([^/]+)\/browser$/.exec(route);
  if (browser) return json({ display: true, running: true, version: 'Chromium 141', pages: [{ id: 'p1', url: 'http://localhost:5173/#orders', title: 'FreshCart · Orders' }] } satisfies T.BrowserStatus);
  // Review.
  if (method === 'GET' && (route === '/v1/review' || route === `/v1/projects/${PROJECT}/review`)) return json(pageOf(query?.includes('reviewed') ? decided : waiting, query));
  if (method === 'GET' && /^\/v1\/projects\/[^/]+\/review$/.test(route)) return json(pageOf([]));
  const media = method === 'GET' && /^\/v1\/agents\/[^/]+\/([^/]+)\/media$/.exec(route);
  if (media) return json(tasks[media[1]] ? mediaFor(media[1]) : []);
  if (method === 'GET' && route === `/v1/projects/${PROJECT}/pulls`)
    return json({ project: PROJECT, github: 'freshcart/freshcart', githubAccount: 'default', fetchedAt: now(), canMerge: true, canMergeKnown: true, mergeMethods: ['squash', 'merge', 'rebase'], pullRequests: [...waiting, ...decided].flatMap((i) => (i.pr ? [i.pr] : [])) } satisfies T.ProjectPullRequests);
  const detail = method === 'GET' && /^\/v1\/projects\/[^/]+\/pulls\/(\d+)$/.exec(route);
  if (detail) {
    const it = [...waiting, ...decided].find((i) => i.pr?.number === Number(detail[1]));
    if (it?.pr) return json({ ...it.pr, body: it.summary ?? '', checkRuns: [{ name: 'Unit tests', status: 'completed', conclusion: 'success' }, { name: 'E2E (Chromium, WebKit)', status: 'completed', conclusion: 'success' }, { name: 'Lint', status: 'completed', conclusion: 'success' }], changedFiles: it.changes?.files ?? 1 } satisfies T.PullRequestDetail);
  }
  const prFiles = method === 'GET' && /^\/v1\/projects\/[^/]+\/pulls\/(\d+)\/files$/.exec(route);
  if (prFiles) return json({ files: pullFiles(Number(prFiles[1])) } satisfies T.PullRequestFiles);
  const prDiff = method === 'GET' && /^\/v1\/projects\/[^/]+\/pulls\/(\d+)\/diff$/.exec(route);
  if (prDiff) {
    const p = new URLSearchParams(query).get('path') ?? '';
    const found = (patches[Number(prDiff[1])] ?? []).find(([f]) => f === p);
    return json({ path: p, patch: found?.[4] ?? '@@ -1,1 +1,1 @@\n-old\n+new' } satisfies T.PullFileDiff);
  }
  const merge = method === 'POST' && /^\/v1\/projects\/[^/]+\/pulls\/(\d+)\/merge$/.exec(route);
  if (merge) {
    let merged: T.PullRequest | undefined;
    for (const i of [...waiting, ...decided]) if (i.pr?.number === Number(merge[1])) merged = i.pr = { ...i.pr, state: 'merged' };
    return json(merged ?? {});
  }
  const changes = method === 'POST' && /^\/v1\/agents\/[^/]+\/([^/]+)\/request-changes$/.exec(route);
  if (changes) {
    const name = changes[1];
    const text = (body as T.RequestChangesRequest | undefined)?.text ?? '';
    const it = waiting.find((i) => i.agent === name);
    waiting = waiting.filter((i) => i.agent !== name);
    if (it) decided = [{ ...it, verdict: 'changes', reviewedAt: now() }, ...decided];
    patchAgent(name, { chat: 'running', outcome: undefined, changesRequested: text });
    lastLine(PROJECT, 'assistant', `Sent your changes to ${name}.`);
    return json(item('user', { text }), 202);
  }
  const verdict = method === 'POST' && /^\/v1\/agents\/[^/]+\/([^/]+)\/review$/.exec(route);
  if (verdict) {
    const it = waiting.find((i) => i.agent === verdict[1]);
    waiting = waiting.filter((i) => i.agent !== verdict[1]);
    if (it) decided = [{ ...it, verdict: (body as T.ReviewRequest | undefined)?.verdict ?? 'reviewed', reviewedAt: now() }, ...decided];
    return { status: 204, body: '', contentType: 'application/json' };
  }
  // Pages.
  if (method === 'GET' && route === `/v1/projects/${PROJECT}/artifacts`) return json({ connector: 'hatch', artifacts: artifacts() } satisfies T.Artifacts);
  const art = method === 'GET' && new RegExp(`^/v1/projects/${PROJECT}/artifacts/([^/]+)$`).exec(route);
  if (art) {
    const a = artifacts().find((x) => x.id === decodeURIComponent(art[1]));
    if (a) return json({ artifact: a, status: 'active', page: true } satisfies T.ArtifactPreview);
  }
  if (method === 'GET' && route === '/v1/limits') return json([]);
  return undefined;
}

// installPromoBridge goes in before the app's modules open any stream.
export function installPromoBridge(): void {
  const bridge = (window as unknown as { agentbox: Record<string, unknown> }).agentbox;
  // promoStreams.ts made it before the app's modules subscribed to it.
  bridge.stream = (window as unknown as { promoStreams: unknown }).promoStreams;
  const thumb = bridge.pageThumb as (path: string) => Promise<string | null>;
  bridge.pageThumb = async (path: string) => {
    const p = pageFile(path);
    return p ? `${BACKEND}/pages/${p[4].replace('.html', '.png')}` : thumb(path);
  };
  const page = bridge.chatImageUrl as (path: string) => string;
  bridge.chatImageUrl = (path: string) => {
    const p = pageFile(path);
    return p ? `${BACKEND}/pages/${p[4]}` : page(path);
  };
  // Ahead of everything the dev bridge answers, its own files and pages too.
  const inner = bridge.request as (method: string, path: string, body?: unknown) => Promise<unknown>;
  bridge.request = async (method: string, path: string, body?: unknown) => (qc && promoRequest(method, path, body)) || inner(method, path, body);
}

// seedPromo replaces the fixtures with the scene's, after everything else
// the preview seeds.
export function seedPromo(queryClient: QueryClient, scene: string): void {
  qc = queryClient;
  const list = projects();
  qc.setQueryData(['projects'], list);
  qc.setQueryData(['sections'], []);
  qc.setQueryData(['questions', PROJECT], []);
  qc.setQueryData(['agentEvents', PROJECT], []);
  qc.setQueryData(['claudeLimits'], []);
  qc.setQueryData(['usage'], { host: { cpu: 38, cores: 16, memUsed: 14 * 1024 ** 3, memTotal: 32 * 1024 ** 3, poolUsed: 0, poolTotal: 0, diskRead: 0, diskWrite: 0 }, agents: [] });
  localStorage.setItem('agentbox.v2.projects', JSON.stringify({ pins: [PROJECT, 'courier'] }));
  qc.setQueryData(['projectChat', HomeProject], { project: HomeProject, ref: `${HomeProject}/lead`, started: true, chat: 'ready', last: { kind: 'assistant', text: 'FreshCart has agents ready to review; Courier’s two are still working.', at: ago(2 * min) } });
  for (const o of others) {
    qc.setQueryData(['projectChat', o.name], { project: o.name, ref: `${o.name}/lead`, started: true, chat: o.running ? 'running' : 'ready', last: o.last && { kind: o.last[0], text: o.last[1], at: ago(o.said) } });
    qc.setQueryData(['pages', o.name], { connector: 'hatch', artifacts: [] });
  }
  qc.setQueryData(['pages', PROJECT], { connector: 'hatch', artifacts: artifacts() } satisfies T.Artifacts);
  const done = (name: string, over: Partial<T.Agent> = {}) => agent(name, { chat: 'ready', outcome: 'done', ...over });
  const all = Object.keys(tasks);
  for (const name of all) qc.setQueryData(['media', ref(name)], mediaFor(name));
  setDevMedia(all.flatMap(mediaFor));
  waiting = [];
  decided = [];

  if (scene === 'spawn') {
    setAgents([done('agent-11'), done('agent-12'), ...otherAgents()]);
    qc.setQueryData(['chat', ref('lead')], thread(ref('lead'), earlier()));
    lastLine(PROJECT, 'assistant', 'agent-11 and agent-12 are ready to review: PRs #41 and #42 are green.', 'ready');
    waiting = ['agent-11', 'agent-12'].map(reviewItem);
  } else if (scene === 'work') {
    setAgents([done('agent-11'), done('agent-12'), ...['agent-14', 'agent-15', 'agent-16'].map((n) => agent(n, { chat: 'running' })), ...otherAgents()]);
    qc.setQueryData(['chat', ref('lead')], thread(ref('lead'), leadAfter()));
    lastLine(PROJECT, 'assistant', 'Started agent-14, agent-15 and agent-16. I’ll tell you when they’re ready to review.', 'ready');
    waiting = ['agent-11', 'agent-12'].map(reviewItem);
    ['agent-14', 'agent-15', 'agent-16'].forEach((n, i) => {
      qc.setQueryData(['chat', ref(n)], workChat(n));
      void playWork(n, 1200 + i * 700);
    });
  } else {
    setAgents([...reviewOrder.map((n) => done(n)), ...otherAgents()]);
    qc.setQueryData(['chat', ref('lead')], thread(ref('lead'), [...leadAfter(), item('assistant', { turn: 'ask', text: 'All three are done and ready to review, with recordings in Media:\n\n- **agent-14** dark mode, PR #43\n- **agent-15** CSV export, PR #44\n- **agent-16** Safari sign-in, PR #45' }, ago(1 * min))]));
    lastLine(PROJECT, 'assistant', 'All three are ready to review: PRs #43, #44 and #45 are green.', 'ready');
    waiting = reviewOrder.map(reviewItem);
  }
  void qc.invalidateQueries({ queryKey: ['review'] });
}
