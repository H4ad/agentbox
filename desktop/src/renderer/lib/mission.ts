// Mission control (components/MissionControl): every live agent of every
// project as a card, and the last day of each as a lane. What a card says the
// agent is up to, the order the cards go in, and where a lane's segments and
// hours fall are worked out here, apart from React, so they can be tested.
import type * as T from '../../shared/api';
import { frozenTip } from './agentStatus.ts';

// MissionState is the one word a card leads with. Asking is anything waiting
// on a person; frozen is its machine paused for memory or its processes by
// idle reclaim; testing is a working agent whose step is its tests; pr is an
// agent done for now with its pull request open.
export type MissionState = 'asking' | 'testing' | 'working' | 'frozen' | 'pr' | 'idle' | 'stopped';

export const missionStates: MissionState[] = ['asking', 'testing', 'working', 'frozen', 'pr', 'idle', 'stopped'];

export function missionState(agent: T.Agent, line?: Pick<T.MissionAgent, 'working' | 'step' | 'pr'>): MissionState {
  if (agent.state !== 'running' && agent.state !== 'paused' && agent.state !== 'initializing' && agent.state !== 'queued') return 'stopped';
  if (agent.chat === 'waiting' || (agent.chat !== 'running' && agent.outcome === 'asking')) return 'asking';
  if (frozenTip(agent)) return 'frozen';
  const working = agent.chat === 'running' || agent.state === 'initializing' || agent.state === 'queued' || !!line?.working;
  if (working && line?.step?.kind === 'test' && line.step.status === 'running') return 'testing';
  if (working) return 'working';
  if (agent.state === 'paused') return 'frozen';
  if (line?.pr?.state === 'open') return 'pr';
  return 'idle';
}

// The order of the grid: what needs you, then what is busy, then the rest.
const rank: Record<MissionState, number> = { asking: 0, testing: 1, working: 1, frozen: 2, pr: 3, idle: 4, stopped: 5 };

export type MissionCard = { agent: T.Agent; line?: T.MissionAgent; state: MissionState };

// missionCards are the agents with a machine that is up (or coming up, or
// frozen), in the grid's order: by state, then the latest task first.
export function missionCards(agents: T.Agent[], mission?: T.Mission): MissionCard[] {
  const lines = new Map((mission?.agents ?? []).map((l) => [l.ref, l]));
  return agents
    .map((agent) => ({ agent, line: lines.get(agent.ref), state: missionState(agent, lines.get(agent.ref)) }))
    .filter((c) => c.state !== 'stopped')
    .sort((a, b) => rank[a.state] - rank[b.state] || at(b.line?.taskAt ?? b.agent.createdAt) - at(a.line?.taskAt ?? a.agent.createdAt) || a.agent.ref.localeCompare(b.agent.ref));
}

// laneRows are the lanes under the grid: every live agent that did anything
// since the lanes start, or is up now, busiest first within a project, the
// projects in name order, so a row stays where it was from one poll to the next.
export function laneRows(agents: T.Agent[], mission?: T.Mission): { agent: T.Agent; line: T.MissionAgent }[] {
  const byRef = new Map(agents.map((a) => [a.ref, a]));
  const rows: { agent: T.Agent; line: T.MissionAgent; busy: number }[] = [];
  for (const line of mission?.agents ?? []) {
    const agent = byRef.get(line.ref);
    if (!agent) continue;
    if (line.lane.length === 0 && missionState(agent, line) === 'stopped') continue;
    rows.push({ agent, line, busy: line.lane.reduce((n, s) => n + (at(s.end) - at(s.start)), 0) });
  }
  return rows.sort((a, b) => a.agent.project.localeCompare(b.agent.project) || b.busy - a.busy || a.agent.ref.localeCompare(b.agent.ref));
}

const at = (iso: string) => new Date(iso).getTime();

// Placed is a segment's place on its lane, as fractions of the lane's width.
export type Placed = { seg: T.MissionSegment; left: number; width: number };

// minWidth is the least a segment is drawn at, as a fraction: a minute's
// work in a day is a few hundredths of a pixel.
export const minWidth = 0.0015;

export function placeLane(lane: T.MissionSegment[], since: string, now: string): Placed[] {
  const from = at(since);
  const span = Math.max(1, at(now) - from);
  return lane.map((seg) => {
    const left = Math.min(1, Math.max(0, (at(seg.start) - from) / span));
    const right = Math.min(1, Math.max(left, (at(seg.end) - from) / span));
    return { seg, left, width: Math.min(1 - left, Math.max(minWidth, right - left)) };
  });
}

// hourTicks are the whole hours between since and now, every step hours
// (local time), each with its place along the lanes.
export function hourTicks(since: string, now: string, step = 3): { at: number; left: number; label: Date }[] {
  const from = at(since);
  const to = at(now);
  const first = new Date(from);
  first.setMinutes(0, 0, 0);
  if (first.getTime() < from) first.setHours(first.getHours() + 1);
  const out: { at: number; left: number; label: Date }[] = [];
  for (const d = first; d.getTime() <= to; d.setHours(d.getHours() + 1)) {
    if (d.getHours() % step === 0) out.push({ at: d.getTime(), left: (d.getTime() - from) / (to - from), label: new Date(d) });
  }
  return out;
}

// nights are the stretches between nightStart and nightEnd o'clock (local
// time) within the lanes, as fractions: what happened while you slept.
export function nights(since: string, now: string, nightStart = 22, nightEnd = 7): { left: number; width: number }[] {
  const from = at(since);
  const to = at(now);
  const out: { left: number; width: number }[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - 1);
  for (; day.getTime() <= to; day.setDate(day.getDate() + 1)) {
    const start = new Date(day);
    start.setHours(nightStart);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);
    end.setHours(nightEnd);
    const a = Math.max(from, start.getTime());
    const b = Math.min(to, end.getTime());
    if (b > a) out.push({ left: (a - from) / (to - from), width: (b - a) / (to - from) });
  }
  return out;
}

// elapsed is how long since iso, short: "45s", "12m", "3h 05m", "2d 4h".
export function elapsed(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at(iso)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// frameEvery is how often a card's desktop still is taken again, in ms: often
// while the agent works, rarely when it doesn't, never when its machine
// can't answer (frozen, stopped) or has no desktop to show.
export function frameEvery(state: MissionState): number | null {
  if (state === 'working' || state === 'testing') return 10_000;
  if (state === 'asking' || state === 'idle' || state === 'pr') return 60_000;
  return null;
}
