// Mission control with many agents (?app=mission): 28 agents across five
// projects in every state, each with a day of work drawn from a fixed seed,
// some of it overnight, their desktops the pip scenes (dev/pipDesktops.tsx).
import type { QueryClient } from '@tanstack/react-query';
import type * as T from '../../shared/api';
import { missionKey } from '../components/MissionControl';
import { setDesktopStandIn } from '../components/pip/standIn';
import { devRequests, setMediaFile } from './fixtures';
import { shot } from './pip';
import { Desktop, type Scene } from './pipDesktops';

const min = 60_000;
const hour = 60 * min;

type Fixture = {
  project: string;
  name: string;
  title: string;
  ai: string;
  // what its card should say
  is: 'asking' | 'testing' | 'working' | 'frozen' | 'pr' | 'idle' | 'stopped';
  step: string;
  scene?: Scene;
  memoryGiB: number;
};

const fixtures: Fixture[] = [
  { project: 'agentbox', name: 'agent-541', title: 'Mission control: every agent live', ai: 'claude', is: 'working', step: 'Edit MissionControl.tsx', scene: 'dark', memoryGiB: 3.1 },
  { project: 'agentbox', name: 'agent-538', title: 'Retry flaky release uploads', ai: 'claude', is: 'testing', step: 'go test ./internal/release/...', scene: 'test', memoryGiB: 5.8 },
  { project: 'agentbox', name: 'agent-536', title: 'Windows: probe WSL with an empty tar', ai: 'codex', is: 'asking', step: 'Which WSL distro should the probe use?', scene: 'startup', memoryGiB: 1.2 },
  { project: 'agentbox', name: 'agent-533', title: 'Daemon heap: unload idle chats', ai: 'claude', is: 'pr', step: 'Opened #500', scene: 'ci', memoryGiB: 0.9 },
  { project: 'agentbox', name: 'agent-530', title: 'Lead-managed secrets', ai: 'claude', is: 'frozen', step: 'npm --prefix desktop run build', memoryGiB: 6.4 },
  { project: 'agentbox', name: 'agent-527', title: 'Faster PR open and merge', ai: 'opencode', is: 'working', step: 'Read internal/daemon/pulls.go', scene: 'docs', memoryGiB: 2.2 },
  { project: 'agentbox', name: 'agent-525', title: 'Keep Claude Code up to date by default', ai: 'claude', is: 'idle', step: 'Answered the lead', memoryGiB: 0.7 },
  { project: 'agentbox', name: 'agent-519', title: 'VM headroom only for busy agents', ai: 'claude', is: 'stopped', step: 'Opened #508', memoryGiB: 0 },
  { project: 'agentbox-landing', name: 'agent-88', title: 'Health events endpoint', ai: 'claude', is: 'working', step: 'curl -s localhost:8787/api/v1/health', scene: 'ci', memoryGiB: 1.9 },
  { project: 'agentbox-landing', name: 'agent-87', title: 'Accept the cursor tool in events', ai: 'cursor', is: 'pr', step: 'Opened #29', memoryGiB: 0.8 },
  { project: 'agentbox-landing', name: 'agent-85', title: 'Pricing page in Portuguese', ai: 'codex', is: 'asking', step: 'Should prices show in BRL?', scene: 'newproject', memoryGiB: 1.4 },
  { project: 'agentbox-landing', name: 'agent-84', title: 'OG images for the changelog', ai: 'claude', is: 'working', step: 'Check the page on the desktop', scene: 'newproject', memoryGiB: 2.6 },
  { project: 'agentbox-landing', name: 'agent-80', title: 'Lighthouse: fix CLS on the hero', ai: 'claude', is: 'stopped', step: 'Opened #24', memoryGiB: 0 },
  { project: 'pawly', name: 'agent-212', title: 'Export the reminders table as CSV', ai: 'claude', is: 'working', step: 'Edit src/reminders/export.ts', scene: 'csv', memoryGiB: 2.9 },
  { project: 'pawly', name: 'agent-211', title: 'Dark mode for Settings', ai: 'codex', is: 'testing', step: 'npx playwright test settings', scene: 'dark', memoryGiB: 4.7 },
  { project: 'pawly', name: 'agent-209', title: 'Fix the flaky reconnect test', ai: 'claude', is: 'testing', step: 'npm test -- reconnect', scene: 'test', memoryGiB: 3.3 },
  { project: 'pawly', name: 'agent-207', title: 'Vet visit reminders on Android', ai: 'claude', is: 'working', step: 'adb shell am start -n app.pawly/.Main', scene: 'startup', memoryGiB: 7.9 },
  { project: 'pawly', name: 'agent-205', title: 'Onboarding copy review', ai: 'opencode', is: 'idle', step: 'Wrote the summary', memoryGiB: 0.5 },
  { project: 'pawly', name: 'agent-204', title: 'Migrate push to FCM v1', ai: 'claude', is: 'pr', step: 'Opened #311', memoryGiB: 1.1 },
  { project: 'pawly', name: 'agent-201', title: 'Upgrade Expo SDK', ai: 'claude', is: 'frozen', step: 'npx expo prebuild', memoryGiB: 5.2 },
  { project: 'pawly', name: 'agent-199', title: 'Weekly dependency bumps', ai: 'claude', is: 'stopped', step: 'Opened #305', memoryGiB: 0 },
  { project: 'infra', name: 'agent-31', title: 'Terraform: move DNS to Cloudflare', ai: 'claude', is: 'asking', step: 'May I apply the plan to production?', scene: 'docs', memoryGiB: 0.9 },
  { project: 'infra', name: 'agent-30', title: 'Nightly backup restore drill', ai: 'codex', is: 'working', step: 'pg_restore --list backup.dump', scene: 'ci', memoryGiB: 3.8 },
  { project: 'infra', name: 'agent-28', title: 'Rotate the staging certificates', ai: 'claude', is: 'idle', step: 'Answered the lead', memoryGiB: 0.6 },
  { project: 'blog', name: 'agent-12', title: 'Post: what agents did overnight', ai: 'claude', is: 'working', step: 'Edit posts/overnight.md', scene: 'docs', memoryGiB: 1.3 },
  { project: 'blog', name: 'agent-11', title: 'RSS feed with full content', ai: 'opencode', is: 'pr', step: 'Opened #42', memoryGiB: 0.7 },
  { project: 'blog', name: 'agent-10', title: 'Image lazy-loading', ai: 'cursor', is: 'idle', step: 'Wrote the summary', memoryGiB: 0.4 },
  { project: 'blog', name: 'agent-9', title: 'Fix the broken search index', ai: 'claude', is: 'stopped', step: 'Opened #39', memoryGiB: 0 },
];

// rand is a fixed sequence, so every screenshot of the preview is the same.
function rand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const flow = ['read', 'plan', 'edit', 'test', 'edit', 'run', 'test', 'desktop', 'edit', 'test', 'pr'];

// lane is a day of sessions: each a task, then a run of steps, then idle.
// Some agents worked through the night (a schedule, or a long task).
function lane(f: Fixture, i: number, now: number): { lane: T.MissionSegment[]; taskAt: number; stepAt: number } {
  const r = rand(i * 7919 + 17);
  const since = now - 24 * hour;
  const out: T.MissionSegment[] = [];
  const night = i % 3 !== 1;
  let at = since + (night ? r() * 3 * hour + 9 * hour : r() * 6 * hour + 2 * hour);
  let taskAt = at;
  const live = f.is === 'working' || f.is === 'testing' || f.is === 'asking';
  const end = f.is === 'stopped' ? now - (4 + r() * 6) * hour : live ? now : now - (0.3 + r() * 2) * hour;
  while (at < end) {
    taskAt = at;
    out.push({ kind: 'task', start: new Date(at).toISOString(), end: new Date(at).toISOString(), steps: 1 });
    at += 2 * min;
    const len = 30 * min + r() * 3 * hour;
    const stop = Math.min(end, at + len);
    let k = Math.floor(r() * 3);
    while (at < stop) {
      const kind = flow[k % flow.length]!;
      const d = Math.min(stop - at, (kind === 'test' ? 6 : kind === 'edit' ? 14 : 8) * min * (0.5 + r()));
      const failed = kind === 'test' && r() < 0.25;
      out.push({ kind, start: new Date(at).toISOString(), end: new Date(at + d).toISOString(), steps: 1 + Math.floor(r() * 12), ...(failed ? { status: 'failed' } : {}) });
      at += d + r() * 3 * min;
      k++;
    }
    at += (0.5 + r() * 4) * hour;
  }
  // A working agent's last step runs until now; one asking stopped on it.
  if (live && f.is !== 'asking') {
    const start = now - (4 + r() * 20) * min;
    while (out.length && new Date(out.at(-1)!.end).getTime() > start) out.pop();
    out.push({ kind: f.is === 'testing' ? 'test' : stepKind(f), start: new Date(start).toISOString(), end: new Date(now).toISOString(), steps: 3, status: 'running' });
  }
  const last = out.at(-1);
  return { lane: out, taskAt, stepAt: last ? new Date(last.start).getTime() : taskAt };
}

const stepKind = (f: Fixture) =>
  f.is === 'testing' ? 'test' : f.is === 'pr' || f.is === 'stopped' ? 'pr' : f.is === 'asking' || f.is === 'idle' ? 'task' : f.step.startsWith('Edit') ? 'edit' : f.step.startsWith('Read') ? 'read' : f.step.startsWith('Check') ? 'desktop' : 'run';

function build(now: number) {
  const iso = (t: number) => new Date(t).toISOString();
  const agents: T.Agent[] = [];
  const lines: T.MissionAgent[] = [];
  fixtures.forEach((f, i) => {
    const ref = `${f.project}/${f.name}`;
    const { lane: segs, taskAt, stepAt } = lane(f, i, now);
    const running = f.is === 'working' || f.is === 'testing';
    agents.push({
      ref,
      project: f.project,
      name: f.name,
      title: f.title,
      instance: '',
      ai: f.ai,
      autonomous: true,
      branch: `agentbox/${f.name}`,
      baseRef: 'main',
      baseCommit: 'abc123',
      worktree: '',
      source: 'main',
      claudeAccount: '',
      githubAccount: '',
      interface: f.ai,
      state: f.is === 'stopped' ? 'stopped' : 'running',
      chat: running ? 'running' : f.is === 'asking' && i % 2 === 0 ? 'waiting' : 'idle',
      outcome: f.is === 'asking' ? 'asking' : f.is === 'idle' || f.is === 'pr' ? 'done' : undefined,
      ...(f.is === 'frozen' ? (i % 2 ? { reclaimed: 'frozen' } : { memory: { machine: 'paused', ahead: 1 } as T.MemoryHold }) : {}),
      ip: '',
      createdAt: iso(now - 30 * hour + i * min),
    });
    const kind = stepKind(f);
    const frame: T.MediaItem | undefined =
      f.is === 'frozen' || f.is === 'stopped' || (f.is === 'idle' && i % 2 === 0)
        ? { id: `mission-shot-${i}`, agent: ref, kind: 'screenshot', name: 'last', size: 0, source: 'agent', meta: {} as T.MediaMeta, createdAt: iso(now - (1 + i) * 23 * min) }
        : undefined;
    if (frame) setMediaFile(frame.id, shot((['csv', 'dark', 'docs', 'ci', 'newproject'] as Scene[])[i % 5]!, 7));
    lines.push({
      ref,
      task: f.title,
      taskAt: iso(taskAt),
      step: { kind, title: f.step, start: iso(stepAt), end: iso(running ? now : stepAt + 4 * min), status: f.is === 'testing' ? 'running' : undefined },
      working: running,
      lane: segs,
      frame,
      pr:
        f.is === 'pr' || f.is === 'stopped'
          ? ({ number: 300 + i, state: f.is === 'stopped' ? 'merged' : 'open', checks: i % 3 === 0 ? 'pending' : 'passing', title: f.title, url: `https://github.com/example/${f.project}/pull/${300 + i}` } as T.PullRequest)
          : undefined,
    });
  });
  const memory = {
    hostTotal: 64 * 1024 ** 3,
    agents: fixtures.filter((f) => f.memoryGiB > 0).map((f) => ({ ref: `${f.project}/${f.name}`, state: 'running', memory: f.memoryGiB * 1024 ** 3, swap: 0 })),
  } as T.MemoryUsage;
  return { agents, mission: { since: iso(now - 24 * hour), now: iso(now), agents: lines } satisfies T.Mission, memory };
}

export function seedMission(queryClient: QueryClient): void {
  // The real clock, whose last 24 hours always hold a night.
  const { agents, mission, memory } = build(Date.now());
  const scenes = new Map(fixtures.map((f) => [`${f.project}/${f.name}`, f.scene ?? 'docs']));
  setDesktopStandIn((a) => <Desktop scene={scenes.get(a.ref) ?? 'docs'} t={7} />);
  const json = (v: unknown) => ({ status: 200, body: JSON.stringify(v), contentType: 'application/json' });
  devRequests.unshift((method, path) => {
    if (method !== 'GET') return undefined;
    if (path === '/v1/agents') return json(agents);
    if (path === '/v1/mission') return json(mission);
    if (path === '/v1/usage/memory') return json(memory);
    return undefined;
  });
  queryClient.setQueryData(['agents'], agents);
  queryClient.setQueryData(missionKey, mission);
  queryClient.setQueryData(['memoryUsage'], memory);
}
