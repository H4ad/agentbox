// Run with `npm test` (node's own test runner, which strips the types).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type * as T from '../../shared/api.ts';
import { elapsed, frameEvery, hourTicks, laneRows, missionCards, missionState, nights, placeLane } from './mission.ts';

const agent = (name: string, more: Partial<T.Agent> = {}): T.Agent =>
  ({ ref: `pawly/${name}`, project: 'pawly', name, title: name, state: 'running', chat: 'idle', createdAt: '2026-10-23T10:00:00Z', ...more }) as T.Agent;
const line = (name: string, more: Partial<T.MissionAgent> = {}): T.MissionAgent => ({ ref: `pawly/${name}`, lane: [], ...more });
const step = (kind: string, status?: string): T.MissionStep => ({ kind, title: kind, start: '2026-10-24T01:00:00Z', end: '2026-10-24T01:05:00Z', status });

test('missionState says what needs you before what is busy, and frozen over idle', () => {
  assert.equal(missionState(agent('a', { chat: 'waiting' })), 'asking');
  assert.equal(missionState(agent('a', { outcome: 'asking' })), 'asking');
  assert.equal(missionState(agent('a', { chat: 'running' }), line('a', { step: step('test', 'running') })), 'testing');
  assert.equal(missionState(agent('a', { chat: 'running' }), line('a', { step: step('test', 'passed') })), 'working');
  assert.equal(missionState(agent('a', { memory: { machine: 'paused' } as T.MemoryHold })), 'frozen');
  assert.equal(missionState(agent('a', { reclaimed: 'frozen' })), 'frozen');
  assert.equal(missionState(agent('a', { state: 'paused' })), 'frozen');
  assert.equal(missionState(agent('a'), line('a', { pr: { state: 'open' } as T.PullRequest })), 'pr');
  assert.equal(missionState(agent('a'), line('a', { pr: { state: 'merged' } as T.PullRequest })), 'idle');
  assert.equal(missionState(agent('a', { state: 'stopped' })), 'stopped');
});

test('missionCards leave stopped machines out, and put asking first and the latest task first', () => {
  const agents = [agent('idle'), agent('old', { chat: 'running' }), agent('stopped', { state: 'stopped' }), agent('new', { chat: 'running' }), agent('ask', { chat: 'waiting' })];
  const mission = { since: '', now: '', agents: [line('old', { taskAt: '2026-10-24T01:00:00Z' }), line('new', { taskAt: '2026-10-24T03:00:00Z' })] };
  assert.deepEqual(
    missionCards(agents, mission).map((c) => c.agent.name),
    ['ask', 'new', 'old', 'idle'],
  );
});

test('laneRows keep a stopped agent that did something, and order by project then busiest', () => {
  const agents = [agent('a'), agent('b', { state: 'stopped' }), agent('c', { state: 'stopped' }), { ...agent('d'), project: 'blog', ref: 'blog/d' }];
  const seg = (start: string, end: string): T.MissionSegment => ({ kind: 'edit', start, end, steps: 1 });
  const mission = {
    since: '',
    now: '',
    agents: [line('a', { lane: [seg('2026-10-24T01:00:00Z', '2026-10-24T01:10:00Z')] }), line('b', { lane: [seg('2026-10-24T01:00:00Z', '2026-10-24T03:00:00Z')] }), line('c'), { ...line('d'), ref: 'blog/d' }],
  };
  assert.deepEqual(
    laneRows(agents, mission).map((r) => r.agent.ref),
    ['blog/d', 'pawly/b', 'pawly/a'],
  );
});

test('placeLane gives segments fractions of the day, with a least width, inside the lane', () => {
  const since = '2026-10-23T12:00:00Z';
  const now = '2026-10-24T12:00:00Z';
  const placed = placeLane(
    [
      { kind: 'edit', start: '2026-10-24T00:00:00Z', end: '2026-10-24T06:00:00Z', steps: 3 },
      { kind: 'task', start: '2026-10-24T06:00:00Z', end: '2026-10-24T06:00:00Z', steps: 1 },
      { kind: 'run', start: '2026-10-24T12:00:00Z', end: '2026-10-24T12:00:00Z', steps: 1 },
    ],
    since,
    now,
  );
  assert.deepEqual(
    placed.map((p) => [p.left, p.width]),
    [
      [0.5, 0.25],
      [0.75, 0.0015],
      [1, 0],
    ],
  );
});

test('hourTicks fall on whole local hours every step, and nights on 22:00 to 07:00', () => {
  const since = new Date(2026, 9, 23, 12, 30).toISOString();
  const now = new Date(2026, 9, 24, 12, 30).toISOString();
  const ticks = hourTicks(since, now, 6);
  assert.deepEqual(
    ticks.map((t) => t.label.getHours()),
    [18, 0, 6, 12],
  );
  assert.ok(Math.abs(ticks[0]!.left - 5.5 / 24) < 1e-9);
  const n = nights(since, now);
  assert.equal(n.length, 1);
  assert.ok(Math.abs(n[0]!.left - 9.5 / 24) < 1e-9 && Math.abs(n[0]!.width - 9 / 24) < 1e-9);
});

test('elapsed and frameEvery', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  assert.equal(elapsed('2026-10-24T11:59:30Z', now), '30s');
  assert.equal(elapsed('2026-10-24T11:48:00Z', now), '12m');
  assert.equal(elapsed('2026-10-24T08:55:00Z', now), '3h 05m');
  assert.equal(elapsed('2026-10-22T08:00:00Z', now), '2d 4h');
  assert.equal(frameEvery('working'), 10_000);
  assert.equal(frameEvery('frozen'), null);
});
