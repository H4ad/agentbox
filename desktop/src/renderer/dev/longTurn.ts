// longTurnChat is one long agent turn, the kind the chat view has to make
// readable (?chat=longturn): asked to fix a bug, the agent thinks, searches,
// reads, edits three files, runs the tests, sees the new one fail, reads some
// more, fixes it, runs them again and they pass, then commits. Its tool calls
// carry what Claude Code's ACP adapter sends: titles with absolute paths in the
// worktree, a command's output, each edit's diff.
//
// &done=1 is the same turn finished; without it the agent is at the second
// test run, still going.
import type * as T from '../../shared/api';
import { PROJECT } from './fixtures';

export const LONG_TURN_ROOT = '/home/user/.local/share/agentbox/worktrees/agentbox/agent-12';

const weekBefore = `export function weekTotal(spans: Span[], week: Week): number {
  let total = 0;
  for (const span of spans) {
    if (dayOf(span.start) < week.start || dayOf(span.start) > week.end) continue;
    total += span.end - span.start;
  }
  return total;
}
`;

const weekAfter1 = `export function weekTotal(spans: Span[], week: Week): number {
  let total = 0;
  for (const span of spans) {
    // A span that crosses midnight counts in each day it ran in.
    const from = Math.max(span.start, week.start);
    const to = Math.min(span.end, week.end + DAY);
    if (to > from) total += to - from;
  }
  return total;
}
`;

const weekAfter2 = `export function weekTotal(spans: Span[], week: Week): number {
  let total = 0;
  for (const span of spans) {
    // A span that crosses midnight counts in each day it ran in. The week's
    // end is the start of the next local day, which DST can make 23 or 25 hours.
    const from = Math.max(span.start, week.start);
    const to = Math.min(span.end, startOfDay(week.end, 1));
    if (to > from) total += to - from;
  }
  return total;
}
`;

const testBefore = `test('sums a week', () => {
  assert.equal(weekTotal([span('mon 10:00', 'mon 12:00')], week), 2 * HOUR);
});
`;

const testAfter = `test('sums a week', () => {
  assert.equal(weekTotal([span('mon 10:00', 'mon 12:00')], week), 2 * HOUR);
});

test('counts a span past midnight on Sunday up to the week\\'s end', () => {
  assert.equal(weekTotal([span('sun 23:00', 'mon+1 01:00')], week), HOUR);
});

test('counts the hour DST takes away', () => {
  assert.equal(weekTotal([span('sat 23:00', 'sun 03:00')], dstWeek), 3 * HOUR);
});
`;

const cardBefore = `      <span className="tabular-nums">{formatHours(total)}</span>
`;
const cardAfter = `      <span className="tabular-nums">{formatHours(weekTotal(spans, week))}</span>
`;

const failing = `> agentbox-desktop@0.15.2 test
> node --test src/renderer/lib/week.test.ts

▶ weekTotal
  ✔ sums a week (0.41ms)
  ✔ counts a span past midnight on Sunday up to the week's end (0.12ms)
  ✖ counts the hour DST takes away (0.38ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

    14400000 !== 10800000

        at TestContext.<anonymous> (src/renderer/lib/week.test.ts:14:10)
▶ weekTotal (1.9ms)
ℹ tests 3
ℹ pass 2
ℹ fail 1`;

const passing = `> agentbox-desktop@0.15.2 test
> node --test src/renderer/lib/week.test.ts

▶ weekTotal
  ✔ sums a week (0.39ms)
  ✔ counts a span past midnight on Sunday up to the week's end (0.11ms)
  ✔ counts the hour DST takes away (0.2ms)
▶ weekTotal (1.4ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0`;

export function longTurnChat(done: boolean): T.ChatThread {
  const at = (ago: number) => new Date(Date.now() - ago * 1000).toISOString();
  const start = 312; // seconds ago the message was sent
  const p = (rel: string) => `${LONG_TURN_ROOT}/${rel}`;
  const week = p('desktop/src/renderer/lib/week.ts');
  const weekTest = p('desktop/src/renderer/lib/week.test.ts');
  const card = p('desktop/src/renderer/components/week/ShareCard.tsx');
  const time = p('desktop/src/renderer/lib/time.ts');
  let n = 0;
  const item = (ago: number, fields: Omit<T.ChatItem, 'id' | 'turn' | 'createdAt' | 'updatedAt'>): T.ChatItem => ({
    id: `lt${++n}`,
    turn: 'lt0',
    createdAt: at(ago),
    updatedAt: at(ago),
    ...fields,
  });
  const tool = (ago: number, t: Omit<T.ChatTool, 'callId' | 'status'> & { status?: string }) => item(ago, { kind: 'tool', tool: { callId: `call${n + 1}`, status: 'completed', ...t } });
  const say = (ago: number, text: string) => item(ago, { kind: 'assistant', text });
  const think = (ago: number, text: string) => item(ago, { kind: 'thought', text });

  const items: T.ChatItem[] = [
    {
      id: 'lt0',
      turn: 'lt0',
      kind: 'user',
      text: "The Week page's share card shows the wrong total when an agent ran past midnight. Fix it and add a test.",
      createdAt: at(start),
      updatedAt: at(start),
      ...(done ? { result: { state: 'completed', stopReason: 'end_turn', endedAt: at(8) } } : {}),
    },
    think(305, 'The total is probably summed per day from each span\'s start. Find where the share card gets it.'),
    tool(300, { name: 'Grep', title: 'grep -rn "weekTotal" desktop/src', kind: 'search', output: `desktop/src/renderer/lib/week.ts:12:export function weekTotal(\ndesktop/src/renderer/components/week/WeekPage.tsx:48:  const total = weekTotal(spans, week);` }),
    tool(296, { name: 'Read', title: `Read ${week}`, kind: 'read', paths: [week] }),
    tool(293, { name: 'Read', title: `Read ${weekTest}`, kind: 'read', paths: [weekTest] }),
    tool(290, { name: 'Read', title: `Read ${card}`, kind: 'read', paths: [card] }),
    say(284, "`weekTotal` only looks at the day a span **started** in, so an agent that ran from 23:00 to 01:00 on Sunday night counts two hours in a week that ended at midnight. The share card also reads a `total` computed before the week's spans were clipped. I'll clip each span to the week instead, and add tests for the midnight and DST cases."),
    tool(270, { name: 'Edit', title: `Edit \`${week}\``, kind: 'edit', paths: [week], line: 12, diffs: [{ path: week, oldText: weekBefore, newText: weekAfter1 }] }),
    tool(262, { name: 'Edit', title: `Edit \`${card}\``, kind: 'edit', paths: [card], line: 31, diffs: [{ path: card, oldText: cardBefore, newText: cardAfter }] }),
    tool(255, { name: 'Edit', title: `Edit \`${weekTest}\``, kind: 'edit', paths: [weekTest], line: 1, diffs: [{ path: weekTest, oldText: testBefore, newText: testAfter }] }),
    tool(240, { name: 'Bash', title: '`npm --prefix desktop test -- src/renderer/lib/week.test.ts`', kind: 'execute', status: 'failed', command: 'npm --prefix desktop test -- src/renderer/lib/week.test.ts', output: failing }),
    say(222, "The DST test fails: the week's end is taken as `week.end + DAY`, but the Sunday DST ends on is 25 hours long, so the hour that day adds is counted twice. `lib/time.ts` should already have a local-day helper."),
    tool(218, { name: 'Grep', title: 'grep -n "export function" desktop/src/renderer/lib/time.ts', kind: 'search', output: 'time.ts:4:export function startOfDay(t: number, offset = 0): number\ntime.ts:19:export function dayOf(t: number): string' }),
    tool(214, { name: 'Read', title: `Read ${time}`, kind: 'read', paths: [time] }),
    think(208, '`startOfDay(week.end, 1)` is the start of the next local day: that is the right end.'),
    tool(200, { name: 'Edit', title: `Edit \`${week}\``, kind: 'edit', paths: [week], line: 14, diffs: [{ path: week, oldText: weekAfter1, newText: weekAfter2 }] }),
  ];
  if (!done) {
    items.push(tool(4, { name: 'Bash', title: '`npm --prefix desktop test -- src/renderer/lib/week.test.ts`', kind: 'execute', status: 'in_progress', command: 'npm --prefix desktop test -- src/renderer/lib/week.test.ts' }));
    return thread(items, { state: 'working', tool: 'claude', turnStartedAt: at(start), options: [], commands: [] });
  }
  items.push(
    tool(190, { name: 'Bash', title: '`npm --prefix desktop test -- src/renderer/lib/week.test.ts`', kind: 'execute', command: 'npm --prefix desktop test -- src/renderer/lib/week.test.ts', output: passing }),
    tool(150, { name: 'Bash', title: '`npm --prefix desktop run typecheck`', kind: 'execute', command: 'npm --prefix desktop run typecheck', output: '> agentbox-desktop@0.15.2 typecheck\n> tsc --noEmit -p tsconfig.json' }),
    tool(30, { name: 'Bash', title: '`git commit -am "fix: the Week page counts work past midnight in the week it ran"`', kind: 'execute', command: 'git commit -am "fix: the Week page counts work past midnight in the week it ran"', output: '[agentbox/agent-12 5c1e2a9] fix: the Week page counts work past midnight in the week it ran\n 3 files changed, 17 insertions(+), 4 deletions(-)' }),
    say(10, "Fixed and committed.\n\n- `weekTotal` clips each span to the week, so work past midnight counts in the days it ran in, and the week ends at the start of the next local day, which DST can make 23 or 25 hours.\n- The share card reads the same total as the page.\n- Two new tests in `week.test.ts` cover a span past Sunday midnight and the DST week; all three pass, and the typecheck is clean."),
  );
  return thread(items, { state: 'ready', tool: 'claude', options: [], commands: [] });
}

function thread(items: T.ChatItem[], session: T.ChatSession): T.ChatThread {
  return { agent: `${PROJECT}/agent-12`, seq: 1, session, items };
}
