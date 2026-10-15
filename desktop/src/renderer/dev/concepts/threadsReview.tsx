// Concept D v2: T3Code's threads, with review inside the agent's thread.
// One project at a time (the switcher), its threads in Pinned (the lead),
// Needs review, Active, Snoozed and Settled. A finished agent's thread pins
// a review card above the composer: the turn's summary, its media, files,
// checks and pull request. Opening the card puts a review pane beside the
// chat (layout=side) or over it, with the chat as a drawer
// (layout=takeover); its tabs are Media, Changes and PR. Request changes
// focuses the composer; Merge or Mark reviewed settles the thread; Review
// all, J and K step through every thread that needs review, in every
// project; the top bar's inbox (#311) deep-links to a thread's card.
//
// ?concept=d2 and, for screenshots:
//   &state=before|media|changes|pr|requested|working|updated|settled|inbox|all
//   &layout=side|takeover   &drawer=1 (takeover's chat drawer open)
//   &thread=hatch/agent-3   another thread to start on
// Mock only: nothing here ships or is translated.
import {
  AlarmClock,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  Columns2,
  Crown,
  Ellipsis,
  FileDiff,
  Film,
  GitMerge,
  GitPullRequest,
  Globe,
  Images,
  Inbox as InboxIcon,
  ListChecks,
  LoaderCircle,
  Maximize2,
  Menu,
  MessageSquareText,
  Monitor,
  Paperclip,
  PencilLine,
  Pin,
  Play,
  Search,
  Send,
  Server,
  SquarePen,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AgentCharacter, hasCharacter } from '../../components/AgentCharacter';
import { cn } from '../../lib/utils';
import { screen } from '../notifications';
import { leadLines, type MockAgent, project, projects } from './data';
import { Avatar, Dot, Kbd, ProjectMark, ProjectTag, SectionHead, Time } from './kit';
import { allAgents, type FileChange, keyOf, type Media, type Review, reviewOf } from './reviewData';

type Phase = 'review' | 'requested' | 'working' | 'updated' | 'settled';
type Tab = 'media' | 'changes' | 'pr';
type Method = 'squash' | 'merge' | 'rebase';

const methods: Record<Method, [string, string]> = {
  squash: ['Squash and merge', 'One commit on main, titled after the PR'],
  merge: ['Create a merge commit', 'Keeps every commit, joined by a merge'],
  rebase: ['Rebase and merge', 'Each commit replayed on main'],
};

interface S {
  project: string;
  open: string; // 'lead' or project/agent
  phases: Record<string, Phase>;
  settledHow: Record<string, string>;
  pane: Tab | null;
  layout: 'side' | 'takeover';
  drawer: boolean;
  media: number;
  file: number;
  method: Method;
  inbox: boolean;
  switcher: boolean;
  nav: boolean; // the sidebar, over the chat, below lg
  flash: string | null;
  draft: string;
  focus: boolean;
  all: boolean;
}

const params = new URLSearchParams(location.search);

function initial(): S {
  const state = params.get('state') ?? 'before';
  const open = params.get('thread') ?? 'agentbox/agent-12';
  const r = reviewOfKey(open);
  const s: S = {
    project: open.split('/')[0]!,
    open,
    phases: {},
    settledHow: {},
    pane: state === 'media' || state === 'changes' || state === 'pr' ? state : null,
    layout: params.get('layout') === 'takeover' ? 'takeover' : 'side',
    drawer: params.get('drawer') === '1',
    media: 0,
    file: 0,
    method: 'squash',
    inbox: state === 'inbox',
    switcher: false,
    nav: false,
    flash: null,
    draft: '',
    focus: false,
    all: state === 'all',
  };
  if (state === 'requested') Object.assign(s, { phases: { [open]: 'requested' }, draft: r?.ask ?? '', focus: true, drawer: true });
  if (state === 'working') s.phases = { [open]: 'working' };
  if (state === 'updated') s.phases = { [open]: 'updated' };
  if (state === 'settled') Object.assign(s, { phases: { [open]: 'settled' }, settledHow: { [open]: `Merged #${r?.pr.number} · squash · branch deleted` } });
  return s;
}

const byKey = (key: string) => allAgents.find((a) => keyOf(a) === key);
const reviewOfKey = (key: string) => {
  const a = byKey(key);
  return a ? reviewOf(a) : undefined;
};

// What a phase makes of an agent: working again, settled, or back in review.
function seen(a: MockAgent, phase?: Phase): MockAgent {
  if (phase === 'working') return { ...a, stage: 'working', mins: 0, note: 'Working on your changes' };
  if (phase === 'settled') return { ...a, stage: 'done', mins: 0 };
  if (phase === 'updated') return { ...a, stage: 'review', mins: 0, unseen: true };
  return a;
}

function useWidth() {
  const [w, setW] = useState(innerWidth);
  useEffect(() => {
    const f = () => setW(innerWidth);
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  return w;
}

// The review's own numbers, which change once the agent has worked again.
function facts(r: Review, phase?: Phase) {
  const updated = phase === 'updated';
  const files = r.files.filter((f) => updated || !f.later);
  const media: (Media & { fresh?: boolean })[] = updated ? [{ ...r.again.media, fresh: true }, ...r.media] : r.media;
  const checks = updated ? r.pr.checks.map((c) => (c.state === 'fail' ? { ...c, state: 'pass' as const, time: '1m 31s' } : c)) : r.pr.checks;
  const counted = checks.filter((c) => c.state !== 'skip');
  const passing = counted.filter((c) => c.state === 'pass').length;
  const failing = counted.filter((c) => c.state === 'fail').length;
  return {
    files,
    media,
    checks,
    passing,
    failing,
    total: counted.length,
    add: files.reduce((n, f) => n + f.add, 0),
    del: files.reduce((n, f) => n + f.del, 0),
    mergeable: updated || r.pr.mergeable,
    summary: updated ? r.again.summary : r.summary,
  };
}

export function ThreadsReviewConcept() {
  const [s, setS] = useState(initial);
  const set = (patch: Partial<S> | ((s: S) => Partial<S>)) => setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  const width = useWidth();
  const narrow = width < 1024;
  const phone = width < 640;
  const composer = useRef<HTMLTextAreaElement>(null);
  const asks = useRef<Record<string, string>>({}); // what the user asked for, per thread

  const view = (a: MockAgent) => seen(a, s.phases[keyOf(a)]);
  const agentsNow = allAgents.map(view);
  // Every thread that needs review, here first, then the other projects.
  const queue = useMemo(
    () =>
      agentsNow
        .filter((a) => a.stage === 'review' && reviewOf(a))
        .sort((a, b) => Number(a.project !== 'agentbox') - Number(b.project !== 'agentbox') || a.mins - b.mins)
        .map(keyOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.phases],
  );
  const current = s.open === 'lead' ? undefined : agentsNow.find((a) => keyOf(a) === s.open);
  const review = current ? reviewOf(current) : undefined;
  const phase = current ? (s.phases[s.open] ?? (current.stage === 'review' ? 'review' : undefined)) : undefined;
  const reviewing = !!review && (phase === 'review' || phase === 'requested' || phase === 'updated');
  const paneOpen = reviewing && s.pane !== null;
  const takeover = paneOpen && (s.layout === 'takeover' || width < 1180);

  const go = (key: string, flash = false) =>
    set((p) => ({ open: key, project: key === 'lead' ? p.project : key.split('/')[0]!, media: 0, file: 0, inbox: false, nav: false, switcher: false, flash: flash ? key : null, focus: false, draft: '', pane: flash ? null : p.pane }));
  const step = (by: number) => {
    if (!queue.length) return;
    const at = queue.indexOf(s.open);
    const next = queue[at < 0 ? 0 : (at + by + queue.length) % queue.length]!;
    go(next);
  };
  const settle = (how: string) => {
    if (!current) return;
    const key = s.open;
    set((p) => ({ phases: { ...p.phases, [key]: 'settled' }, settledHow: { ...p.settledHow, [key]: how }, pane: null, focus: false }));
    // In Review all, settling moves on to the next one.
    if (s.all) {
      const rest = queue.filter((k) => k !== key);
      setTimeout(() => (rest.length ? go(rest[queue.indexOf(key) % rest.length] ?? rest[0]!) : set({ all: false })), 700);
    }
  };
  const merge = () => review && settle(`Merged #${review.pr.number} · ${s.method} · branch deleted`);
  const reviewed = () => settle('Marked reviewed · PR left open');
  const requestChanges = () => {
    set((p) => ({ phases: { ...p.phases, [p.open]: 'requested' }, focus: true, drawer: true }));
    setTimeout(() => composer.current?.focus(), 0);
  };
  const send = () => {
    if (!current || phase !== 'requested') return set({ draft: '' });
    const key = s.open;
    composer.current?.blur();
    set((p) => ({ phases: { ...p.phases, [key]: 'working' }, focus: false, pane: null, draft: '' }));
    asks.current[key] = s.draft || review?.ask || '';
    setTimeout(() => set((p) => ({ phases: { ...p.phases, [key]: 'updated' }, flash: key })), 4500);
  };
  const startAll = () => {
    set({ all: true });
    if (queue[0]) go(queue[0]);
  };

  useEffect(() => {
    if (!s.flash) return;
    const t = setTimeout(() => set({ flash: null }), 1800);
    return () => clearTimeout(t);
  }, [s.flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('textarea,input');
      if (e.key === 'Escape') {
        if (typing) {
          composer.current?.blur();
          return set((p) => ({ focus: false, phases: p.phases[p.open] === 'requested' ? { ...p.phases, [p.open]: 'review' } : p.phases }));
        }
        return set((p) => (p.inbox || p.switcher || p.nav ? { inbox: false, switcher: false, nav: false } : p.pane ? { pane: null } : { all: false }));
      }
      if (typing || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'j') step(1);
      else if (k === 'k') step(-1);
      else if (!reviewing) return;
      else if (k === 'c') {
        e.preventDefault();
        requestChanges();
      }
      else if (k === 'r') reviewed();
      else if (k === 'm' && review && facts(review, phase).mergeable) merge();
      else if (k === 'enter' || k === 'o') set({ pane: s.pane ?? 'media' });
      else if (k === '1' || k === '2' || k === '3') set({ pane: (['media', 'changes', 'pr'] as const)[Number(k) - 1] });
      else if (k === 'arrowright' && s.pane === 'media') set((p) => ({ media: p.media + 1 }));
      else if (k === 'arrowleft' && s.pane === 'media') set((p) => ({ media: Math.max(0, p.media - 1) }));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const at = queue.indexOf(s.open);
  const ctx: Ctx = { s, set, go, step, queue, at, phone, merge, reviewed, requestChanges };

  const chat = (
    <ChatColumn
      ctx={ctx}
      a={current}
      review={review}
      phase={phase}
      paneOpen={paneOpen}
      composer={composer}
      send={send}
      asked={current ? asks.current[s.open] : undefined}
      compact={takeover}
    />
  );

  return (
    <div className="flex h-screen min-w-0 bg-ink text-primary">
      {(!narrow || s.nav) && (
        <>
          {narrow && <div className="fixed inset-0 z-30 bg-black/40" onClick={() => set({ nav: false })} />}
          <Sidebar ctx={ctx} agents={agentsNow} startAll={startAll} overlay={narrow} />
        </>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col bg-chat">
        <Header ctx={ctx} a={current} phase={phase} narrow={narrow} />
        {s.all && <ReviewAllBar ctx={ctx} />}
        <div className="flex min-h-0 flex-1">
          {!takeover && chat}
          {paneOpen && review && current && (
            <ReviewPane ctx={ctx} a={current} r={review} phase={phase!} takeover={takeover} forced={width < 1180} />
          )}
          {takeover && <Drawer ctx={ctx} a={current!} narrow={narrow}>{chat}</Drawer>}
        </div>
        {s.inbox && <InboxPanel ctx={ctx} agents={agentsNow} startAll={startAll} />}
      </main>
      <div className="pointer-events-none fixed bottom-3 left-3 z-50 rounded-full border border-line bg-modal/90 px-3 py-1 text-[11px] font-medium text-secondary shadow-lg backdrop-blur max-lg:hidden">
        D v2 · {takeover ? 'takeover + chat drawer' : paneOpen ? 'pane beside the chat' : 'review in the thread'}
      </div>
    </div>
  );
}

interface Ctx {
  s: S;
  set: (patch: Partial<S> | ((s: S) => Partial<S>)) => void;
  go: (key: string, flash?: boolean) => void;
  step: (by: number) => void;
  queue: string[];
  at: number;
  phone: boolean;
  merge: () => void;
  reviewed: () => void;
  requestChanges: () => void;
}

// ——— The sidebar ———

function Sidebar({ ctx, agents, startAll, overlay }: { ctx: Ctx; agents: MockAgent[]; startAll: () => void; overlay: boolean }) {
  const { s } = ctx;
  const mine = agents.filter((a) => a.project === s.project);
  const review = mine.filter((a) => a.stage === 'review').sort((a, b) => a.mins - b.mins);
  const active = mine.filter((a) => (a.stage === 'needs' || a.stage === 'working') && !a.snoozed).sort((a, b) => Number(b.stage === 'needs') - Number(a.stage === 'needs') || a.mins - b.mins);
  const snoozed = mine.filter((a) => a.snoozed);
  const settled = mine.filter((a) => a.stage === 'done').sort((a, b) => a.mins - b.mins);
  const p = project(s.project);
  return (
    <aside className={cn('flex w-[290px] shrink-0 flex-col border-r border-line bg-rail', overlay && 'fixed inset-y-0 left-0 z-40 shadow-2xl')}>
      <div className="flex h-11 shrink-0 items-center gap-2 px-3">
        <span className="text-[13px] font-semibold tracking-tight text-title">AgentBox</span>
        <SquarePen className="ml-auto size-4 text-subtle" />
      </div>
      <Switcher ctx={ctx} agents={agents} />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        <SectionHead><span className="inline-flex items-center gap-1"><Pin className="size-3" /> Pinned</span></SectionHead>
        <Row active={s.open === 'lead'} onClick={() => ctx.go('lead')}>
          <Crown className="size-3.5 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-title">Lead</span>
          {p.lead.working && <LoaderCircle className="size-3 animate-spin text-emerald-300" />}
          {p.lead.unread > 0 && <span className="shrink-0 rounded-full bg-brand-500 px-1.5 text-[10px] text-white">{p.lead.unread}</span>}
          <Time mins={p.lead.mins} />
        </Row>
        <SectionHead
          count={review.length}
          right={
            ctx.queue.length > 0 && (
              <button type="button" onClick={startAll} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-brand-300 hover:bg-surface-strong">
                <Play className="size-2.5" /> Review all{ctx.queue.length > review.length && ` ${ctx.queue.length}`}
              </button>
            )
          }
        >
          Needs review
        </SectionHead>
        {review.length === 0 && <div className="px-2.5 pb-1 text-[11.5px] text-faint">Nothing to review here.</div>}
        {review.map((a) => <ThreadRow key={keyOf(a)} ctx={ctx} a={a} />)}
        <SectionHead count={active.length}>Active</SectionHead>
        {active.map((a) => <ThreadRow key={keyOf(a)} ctx={ctx} a={a} />)}
        <SectionHead count={snoozed.length}><span className="inline-flex items-center gap-1"><AlarmClock className="size-3" /> Snoozed</span></SectionHead>
        {snoozed.map((a) => <ThreadRow key={keyOf(a)} ctx={ctx} a={a} />)}
        <SectionHead count={settled.length}><span className="inline-flex items-center gap-1"><Check className="size-3" /> Settled</span></SectionHead>
        {settled.map((a) => <ThreadRow key={keyOf(a)} ctx={ctx} a={a} />)}
      </div>
    </aside>
  );
}

function Row({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('group flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5', active ? 'bg-surface-strong' : 'hover:bg-surface')}>
      {children}
    </div>
  );
}

function ThreadRow({ ctx, a }: { ctx: Ctx; a: MockAgent }) {
  const key = keyOf(a);
  const phase = ctx.s.phases[key];
  const quiet = a.stage === 'done' || a.stage === 'stopped';
  return (
    <Row active={ctx.s.open === key} onClick={() => ctx.go(key)}>
      <Dot stage={a.stage} pulse />
      <span className={cn('min-w-0 flex-1 truncate text-[12.5px]', quiet ? 'text-subtle' : a.unseen ? 'font-semibold text-title' : 'text-primary')}>{a.title}</span>
      {phase === 'updated' && <span className="shrink-0 rounded bg-brand-500/15 px-1 text-[10px] font-medium text-brand-300">Updated</span>}
      {a.stage === 'needs' && <span className="shrink-0 rounded bg-amber-400/15 px-1 text-[10px] font-medium text-amber-300">Asks</span>}
      {phase === 'working' && <span className="shrink-0 rounded bg-emerald-400/15 px-1 text-[10px] font-medium text-emerald-300">Changing</span>}
      {a.stage === 'review' && a.pr && phase !== 'updated' && <PrChip a={a} />}
      {a.snoozed ? <span className="shrink-0 text-[10.5px] text-faint">{a.snoozed}</span> : <Time mins={a.mins} />}
    </Row>
  );
}

function PrChip({ a }: { a: MockAgent }) {
  const pr = a.pr!;
  const tone = pr.checks === 'passing' ? 'text-emerald-300' : pr.checks === 'failing' ? 'text-rose-300' : 'text-amber-300';
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-0.5 text-[10.5px] tabular-nums', tone)}>
      <GitPullRequest className="size-3" />
      {pr.number}
    </span>
  );
}

function Switcher({ ctx, agents }: { ctx: Ctx; agents: MockAgent[] }) {
  const { s, set } = ctx;
  const p = project(s.project);
  const asks = (name: string) => agents.filter((a) => a.project === name && (a.stage === 'needs' || a.stage === 'review')).length;
  return (
    <div className="relative px-2 pb-2">
      <div onClick={() => set({ switcher: !s.switcher })} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-faint px-2 py-1.5 hover:bg-surface">
        <ProjectMark name={s.project} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-title">{p.display}</div>
          <div className="flex items-center gap-1 text-[10.5px] text-subtle">{p.env === 'Local VM' ? <Monitor className="size-3" /> : <Server className="size-3" />} {p.env}</div>
        </div>
        <Kbd>⌘P</Kbd>
        <ChevronDown className="size-3.5 text-subtle" />
      </div>
      {s.switcher && (
        <div className="absolute inset-x-2 top-full z-20 mt-1 grid gap-0.5 rounded-xl border border-line bg-modal p-1.5 shadow-2xl">
          {['Local VM', 'Hetzner box'].map((env) => (
            <div key={env}>
              <div className="flex items-center gap-1 px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {env === 'Local VM' ? <Monitor className="size-3" /> : <Server className="size-3" />} {env}
              </div>
              {projects.filter((x) => x.env === env).map((x) => (
                <div
                  key={x.name}
                  onClick={() => set({ project: x.name, open: 'lead', switcher: false, pane: null })}
                  className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]', x.name === s.project ? 'bg-surface-strong text-title' : 'text-primary hover:bg-surface')}
                >
                  <ProjectMark name={x.name} className="size-4 rounded text-[9px]" /> {x.display}
                  {asks(x.name) > 0 && <span className="ml-auto rounded-full bg-surface-raised px-1.5 text-[10px] text-secondary">{asks(x.name)}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ——— The header and #311's top bar: one state badge, the PR, ⋯; then
// search, the machine's dot and the one inbox. ———

const badge: Record<MockAgent['stage'], [string, string]> = {
  needs: ['Needs you', 'bg-amber-400/15 text-amber-300'],
  review: ['Ready to review', 'bg-sky-400/15 text-sky-300'],
  working: ['Working', 'bg-emerald-400/15 text-emerald-300'],
  done: ['Settled', 'bg-surface-raised text-subtle'],
  stopped: ['Snoozed', 'bg-surface-raised text-subtle'],
};

function Header({ ctx, a, phase, narrow }: { ctx: Ctx; a?: MockAgent; phase?: Phase; narrow: boolean }) {
  const { s, set, phone } = ctx;
  const p = project(s.project);
  const [label, tone] = a ? (phase === 'updated' ? (['Updated', 'bg-brand-500/15 text-brand-300'] as [string, string]) : badge[a.stage]) : ['', ''];
  const merged = phase === 'settled' && s.settledHow[s.open]?.startsWith('Merged');
  const count = ctx.queue.length + 3; // review, plus the three questions
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line-faint px-3">
      {narrow && (
        <button type="button" onClick={() => set({ nav: true })} className="flex items-center gap-1.5 rounded-md p-1 hover:bg-surface">
          <Menu className="size-4 text-subtle" />
          <ProjectMark name={s.project} className="size-4 rounded text-[9px]" />
        </button>
      )}
      {a ? (
        <>
          <Avatar a={a} className="size-5" />
          <span className="min-w-0 truncate text-[13px] font-semibold text-title">{a.title}</span>
          {!phone && <span className={cn('shrink-0 rounded px-1.5 py-px text-[10.5px] font-medium', tone)}>{label}</span>}
          {a.pr ? (
            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-1.5 py-px text-[11px]', merged ? 'text-violet-300' : 'text-secondary')}>
              {merged ? <GitMerge className="size-3" /> : <GitPullRequest className="size-3" />}#{a.pr.number} {!phone && (merged ? 'merged' : 'open')}
            </span>
          ) : (
            !phone && <span className="truncate font-mono text-[11px] text-subtle">{a.branch}</span>
          )}
        </>
      ) : (
        <>
          <Crown className="size-4 text-amber-300" />
          <span className="text-[13px] font-semibold text-title">Lead</span>
          {!phone && <span className="text-[11.5px] text-subtle">{p.display}</span>}
        </>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <IconBtn label="More"><Ellipsis className="size-4" /></IconBtn>
        <span className="mx-1 h-5 w-px bg-line" />
        {!phone && <IconBtn label="Search ⌘K"><Search className="size-4" /></IconBtn>}
        {!phone && <span title="Machine: all well" className="flex size-8 items-center justify-center"><span className="size-2 rounded-full bg-emerald-400" /></span>}
        <button
          type="button"
          onClick={() => set({ inbox: !s.inbox })}
          aria-label={`Inbox, ${count} need you`}
          className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-faint text-muted transition hover:bg-surface-raised hover:text-primary', s.inbox && 'bg-surface-raised text-primary')}
        >
          <InboxIcon className="size-4" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-[var(--color-chat)]">{count}</span>
        </button>
      </span>
    </header>
  );
}

function IconBtn({ children, label, onClick, active }: { children: ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={cn('flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-strong hover:text-title', active && 'bg-surface-strong text-title')}>
      {children}
    </button>
  );
}

function ReviewAllBar({ ctx }: { ctx: Ctx }) {
  const { at, queue, set } = ctx;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line-faint bg-brand-500/10 px-4 py-1.5 text-[12px] text-secondary">
      <ListChecks className="size-3.5 text-brand-300" />
      {queue.length ? (
        <>
          <span className="font-medium text-title">Reviewing {at < 0 ? '–' : at + 1} of {queue.length}</span>
          <span className="hidden text-subtle sm:inline">every thread that needs review, in every project</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-subtle">
            <button type="button" onClick={() => ctx.step(-1)} className="inline-flex items-center gap-1 hover:text-title"><ArrowUp className="size-3" /><Kbd>K</Kbd></button>
            <button type="button" onClick={() => ctx.step(1)} className="inline-flex items-center gap-1 hover:text-title"><ArrowDown className="size-3" /><Kbd>J</Kbd></button>
          </span>
        </>
      ) : (
        <span className="font-medium text-title">Nothing left to review</span>
      )}
      <button type="button" onClick={() => set({ all: false })} className={cn('inline-flex items-center gap-1 text-[11px] text-subtle hover:text-title', !queue.length && 'ml-auto')}>
        Done <Kbd>Esc</Kbd>
      </button>
    </div>
  );
}

// ——— The chat, the card above its composer, and the composer ———

function ChatColumn({ ctx, a, review, phase, paneOpen, composer, send, asked, compact }: {
  ctx: Ctx;
  a?: MockAgent;
  review?: Review;
  phase?: Phase;
  paneOpen: boolean;
  composer: React.RefObject<HTMLTextAreaElement | null>;
  send: () => void;
  asked?: string;
  compact: boolean;
}) {
  const { s } = ctx;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [s.open, phase]);
  const lines = a ? threadLines(a, review, phase, asked) : leadLines(s.project).map((l) => ({ ...l }));
  return (
    <section className={cn('flex min-w-0 flex-1 flex-col', paneOpen && !compact && 'max-w-[520px] border-r border-line-faint')}>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <Lines lines={lines} ai={a?.ai ?? 'claude'} compact={compact} />
      </div>
      <div className={cn('mx-auto w-full shrink-0', compact ? 'px-3' : 'max-w-[760px] px-4')}>
        {a && review && phase && !paneOpen && <Card ctx={ctx} a={a} r={review} phase={phase} />}
        {a && review && phase && paneOpen && !compact && <OpenNote ctx={ctx} />}
      </div>
      <Composer ctx={ctx} a={a} phase={phase} composer={composer} send={send} compact={compact} />
    </section>
  );
}

type ThreadLine = { who: 'user' | 'ai' | 'tool' | 'working'; text: string };

function threadLines(a: MockAgent, r: Review | undefined, phase: Phase | undefined, asked?: string): ThreadLine[] {
  const lines: ThreadLine[] = [
    { who: 'user', text: a.title + (r ? '. Take screenshots, open a PR against main and leave a recording in Media.' : '') },
    { who: 'tool', text: r ? `Read ${r.files[0]!.path} · Edit ${r.files.filter((f) => !f.later).length} files` : 'Read README.md · Grep TODO' },
    { who: 'tool', text: a.project === 'agentbox' ? 'npm run typecheck ✓ · npm test ✓ 521 · npm run preview -- --shots out ✓' : 'go test ./... ✓ · golangci-lint run ✓' },
    { who: 'tool', text: r ? `agentbox media record stop · gh pr create → #${r.pr.number}` : 'git commit -m "wip"' },
    { who: 'ai', text: r ? r.summary : a.note },
  ];
  if (phase === 'working' || phase === 'updated') {
    lines.push({ who: 'user', text: asked || r!.ask });
    lines.push({ who: 'tool', text: `Edit ${r!.files.at(-1)!.path.split('/').at(-1)} · run the tests ✓ · git push (${r!.again.commits} commit${r!.again.commits > 1 ? 's' : ''})` });
  }
  if (phase === 'working') lines.push({ who: 'working', text: 'Working on your changes' });
  if (phase === 'updated') lines.push({ who: 'ai', text: r!.again.summary });
  return lines;
}

function Lines({ lines, ai, compact }: { lines: ThreadLine[]; ai: string; compact: boolean }) {
  return (
    <div className={cn('mx-auto grid w-full gap-3 py-5', compact ? 'px-3' : 'max-w-[720px] px-5')}>
      {lines.map((l, i) =>
        l.who === 'user' ? (
          <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-surface-strong px-3.5 py-2 text-[13px] text-primary">{l.text}</div>
        ) : l.who === 'tool' ? (
          <div key={i} className="flex min-w-0 items-center gap-2 text-[11.5px] text-subtle">
            <CircleCheck className="size-3 shrink-0" /> <span className="truncate font-mono">{l.text}</span>
          </div>
        ) : l.who === 'working' ? (
          <div key={i} className="flex items-center gap-2 text-[12px] text-emerald-300">
            <LoaderCircle className="size-3.5 animate-spin" /> {l.text}
          </div>
        ) : (
          <div key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-secondary">
            {hasCharacter(ai) && <AgentCharacter ai={ai} mood="idle" className="mt-0.5 size-5 shrink-0" />}
            <p className="min-w-0">{l.text}</p>
          </div>
        ),
      )}
    </div>
  );
}

function Composer({ ctx, a, phase, composer, send, compact }: { ctx: Ctx; a?: MockAgent; phase?: Phase; composer: React.RefObject<HTMLTextAreaElement | null>; send: () => void; compact: boolean }) {
  const { s, set } = ctx;
  const requesting = phase === 'requested';
  useEffect(() => {
    if (s.focus) composer.current?.focus();
  }, [s.focus, composer]);
  return (
    <div className={cn('mx-auto w-full shrink-0 pb-4', compact ? 'px-3' : 'max-w-[760px] px-4')}>
      {requesting && (
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[11.5px] text-amber-300">
          <PencilLine className="size-3" /> Requesting changes on #{a?.pr?.number}: the agent picks up from here
          <span className="ml-auto text-faint">Esc cancels</span>
        </div>
      )}
      <div className={cn('flex items-end gap-2 rounded-2xl border bg-composer px-3 py-2.5 shadow-sm', requesting ? 'border-amber-400/60 ring-2 ring-amber-400/20' : 'border-line')}>
        <Paperclip className="mb-1 size-4 shrink-0 text-subtle" />
        <textarea
          ref={composer}
          rows={requesting ? 2 : 1}
          value={s.draft}
          onChange={(e) => set({ draft: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={requesting ? `What should ${a?.name} change?` : a ? `Reply to ${a.name}…` : 'Message the lead…'}
          className="min-w-0 flex-1 resize-none bg-transparent text-[13px] text-primary outline-none placeholder:text-faint"
        />
        <span className="mb-1 hidden shrink-0 text-[11px] text-faint sm:inline">Opus 5.5</span>
        <button type="button" onClick={send} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-400">
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function OpenNote({ ctx }: { ctx: Ctx }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-1.5 text-[11.5px] text-subtle">
      <Columns2 className="size-3.5" /> The review is open beside the chat
      <button type="button" onClick={() => ctx.set({ pane: null })} className="ml-auto hover:text-title">Fold it back <Kbd>Esc</Kbd></button>
    </div>
  );
}

// Card is the review pinned above the composer: the summary, the media
// strip, files, checks and the PR, and the three ways out.
function Card({ ctx, a, r, phase }: { ctx: Ctx; a: MockAgent; r: Review; phase: Phase }) {
  const { s, set, phone } = ctx;
  const f = facts(r, phase);
  const ref = useRef<HTMLDivElement>(null);
  const flashing = s.flash === keyOf(a);
  useEffect(() => {
    if (flashing) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [flashing]);

  if (phase === 'working')
    return (
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-[12px]">
        <LoaderCircle className="size-3.5 shrink-0 animate-spin text-emerald-300" />
        <span className="font-medium text-title">Working on your changes</span>
        <span className="min-w-0 truncate text-subtle">The review card comes back, marked Updated, when it’s done</span>
        <span className="ml-auto shrink-0 text-[11px] text-faint">0:12</span>
      </div>
    );
  if (phase === 'settled') {
    const next = ctx.queue[0] ? allAgents.find((x) => keyOf(x) === ctx.queue[0]) : undefined;
    return (
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-faint px-3 py-2 text-[12px]">
        {s.settledHow[keyOf(a)]?.startsWith('Merged') ? <GitMerge className="size-3.5 text-violet-300" /> : <CircleCheck className="size-3.5 text-emerald-300" />}
        <span className="font-medium text-title">Settled</span>
        <span className="text-subtle">{s.settledHow[keyOf(a)]}</span>
        <button type="button" onClick={() => set((p) => ({ phases: { ...p.phases, [keyOf(a)]: 'review' } }))} className="inline-flex items-center gap-1 text-[11.5px] text-subtle hover:text-title">
          <Undo2 className="size-3" /> Undo
        </button>
        {next && (
          <button type="button" onClick={() => ctx.go(keyOf(next))} className="ml-auto inline-flex min-w-0 items-center gap-1.5 rounded-md bg-surface-strong px-2 py-1 text-[11.5px] text-primary hover:bg-surface-vivid">
            <span className="text-subtle">Next to review</span> <span className="truncate font-medium">{next.title}</span> <Kbd>J</Kbd>
          </button>
        )}
      </div>
    );
  }

  const updated = phase === 'updated';
  return (
    <div
      ref={ref}
      data-review-card
      className={cn(
        'mb-2 min-w-0 overflow-hidden rounded-xl border bg-surface-faint shadow-sm transition',
        updated ? 'border-brand-400/50' : 'border-sky-400/30',
        flashing && 'ring-2 ring-brand-400 ring-offset-2 ring-offset-[var(--color-chat)]',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 px-3 pt-2.5">
        {updated ? (
          <span className="rounded bg-brand-500/15 px-1.5 py-px text-[10.5px] font-semibold text-brand-300">Updated</span>
        ) : (
          <span className="rounded bg-sky-400/15 px-1.5 py-px text-[10.5px] font-semibold text-sky-300">Ready to review</span>
        )}
        <span className="min-w-0 truncate text-[11px] text-subtle">{updated ? `${r.again.commits} new commit${r.again.commits > 1 ? 's' : ''} since your review` : `Turn finished ${a.mins ? `${a.mins}m ago` : 'just now'}`}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-faint">
          {ctx.queue.length > 1 && !phone && (
            <>
              {ctx.at + 1} of {ctx.queue.length} <Kbd>J</Kbd><Kbd>K</Kbd>
            </>
          )}
          <IconBtn label="Open the review (Enter)" onClick={() => set({ pane: 'media' })}><Maximize2 className="size-3.5" /></IconBtn>
        </span>
      </div>
      <p className="line-clamp-2 px-3 pt-1 text-[12.5px] leading-[1.45] text-secondary">{f.summary}</p>
      <div className="flex min-w-0 gap-1.5 overflow-x-auto px-3 pt-2">
        {f.media.map((m, i) => (
          <Thumb key={m.title} m={m} hue={project(a.project).hue + i * 24} fresh={m.fresh} onClick={() => set({ pane: 'media', media: i })} className="h-[46px] w-[74px]" />
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-[11.5px]">
        <button type="button" onClick={() => set({ pane: 'changes' })} className="inline-flex items-center gap-1 text-secondary hover:text-title">
          <FileDiff className="size-3.5 text-subtle" /> {f.files.length} files <span className="tabular-nums text-emerald-300">+{f.add}</span> <span className="tabular-nums text-rose-300">−{f.del}</span>
        </button>
        <button type="button" onClick={() => set({ pane: 'pr' })} className={cn('inline-flex items-center gap-1 hover:text-title', f.failing ? 'text-rose-300' : 'text-emerald-300')}>
          {f.failing ? <CircleX className="size-3.5" /> : <CircleCheck className="size-3.5" />}
          {f.failing ? `${f.failing} of ${f.total} checks failing` : `${f.passing} of ${f.total} checks passing`}
        </button>
        <button type="button" onClick={() => set({ pane: 'pr' })} className="inline-flex items-center gap-1 text-secondary hover:text-title">
          <GitPullRequest className="size-3.5 text-subtle" />#{r.pr.number} open{!phone && (f.mergeable ? ' · ready to merge' : ' · blocked')}
        </button>
      </div>
      <Actions ctx={ctx} r={r} mergeable={f.mergeable} className="mt-2 border-t border-line-faint px-2 py-1.5" />
    </div>
  );
}

function Thumb({ m, hue, fresh, onClick, className, active }: { m: Media; hue: number; fresh?: boolean; onClick?: () => void; className?: string; active?: boolean }) {
  const dark = document.documentElement.dataset.appearance !== 'light';
  return (
    <button type="button" title={m.title} onClick={onClick} className={cn('relative shrink-0 overflow-hidden rounded-md border bg-sunken', active ? 'border-brand-400 ring-1 ring-brand-400' : 'border-line hover:border-line-strong', className)}>
      <img src={screen(m.title, hue, dark)} alt={m.title} className="size-full object-cover" />
      {m.kind === 'recording' && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-px text-[9.5px] font-medium text-white"><Play className="size-2.5 fill-current" />{m.length}</span>
        </span>
      )}
      {m.kind === 'page' && <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] text-white">Page</span>}
      {fresh && <span className="absolute right-0.5 top-0.5 rounded bg-brand-500 px-1 text-[8.5px] font-semibold text-white">NEW</span>}
    </button>
  );
}

function Actions({ ctx, r, mergeable, className }: { ctx: Ctx; r: Review; mergeable: boolean; className?: string }) {
  const { s, set, phone } = ctx;
  const [menu, setMenu] = useState(false);
  return (
    <div className={cn('relative flex min-w-0 flex-wrap items-center gap-1', className)}>
      <ActBtn onClick={ctx.requestChanges} active={ctx.s.phases[ctx.s.open] === 'requested'}><PencilLine className="size-3.5" /> {phone ? 'Changes' : 'Request changes'} {!phone && <Kbd>C</Kbd>}</ActBtn>
      <ActBtn onClick={ctx.reviewed}><Check className="size-3.5" /> {phone ? 'Reviewed' : 'Mark reviewed'} {!phone && <Kbd>R</Kbd>}</ActBtn>
      <span className="ml-auto inline-flex shrink-0 overflow-hidden rounded-md">
        <button
          type="button"
          onClick={() => mergeable && ctx.merge()}
          title={mergeable ? undefined : 'A check is failing'}
          className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium', mergeable ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'cursor-not-allowed bg-surface text-faint')}
        >
          <GitMerge className="size-3.5" /> {phone ? 'Merge' : methods[s.method][0]} {!phone && mergeable && <kbd className="rounded bg-white/15 px-1 font-mono text-[10px]">M</kbd>}
        </button>
        <button type="button" onClick={() => setMenu(!menu)} className={cn('border-l px-1.5', mergeable ? 'border-emerald-800 bg-emerald-600 text-white hover:bg-emerald-500' : 'border-line bg-surface text-faint')}>
          <ChevronDown className="size-3.5" />
        </button>
      </span>
      {menu && (
        <div className="absolute bottom-full right-0 z-30 mb-1 w-72 rounded-xl border border-line bg-modal p-1.5 shadow-2xl">
          {(Object.keys(methods) as Method[]).map((m) => (
            <div key={m} onClick={() => {
                set({ method: m });
                setMenu(false);
              }} className={cn('flex cursor-pointer gap-2 rounded-md px-2 py-1.5 hover:bg-surface', s.method === m && 'bg-surface-strong')}>
              <Check className={cn('mt-0.5 size-3.5 shrink-0', s.method === m ? 'text-brand-300' : 'invisible')} />
              <div>
                <div className="text-[12.5px] text-title">{methods[m][0]}</div>
                <div className="text-[11px] text-subtle">{methods[m][1]}</div>
              </div>
            </div>
          ))}
          <div className="mt-1 border-t border-line-faint px-2 pt-1.5 text-[11px] text-subtle">Deletes {r.pr.number === 88 ? 'agentbox/domains' : `agentbox/${ctx.s.open.split('/')[1]}`} after merging</div>
        </div>
      )}
    </div>
  );
}

function ActBtn({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-tertiary hover:bg-surface-strong hover:text-title', active && 'bg-amber-400/15 text-amber-300')}>
      {children}
    </button>
  );
}

// ——— The review pane: Media, Changes, PR ———

function ReviewPane({ ctx, a, r, phase, takeover, forced }: { ctx: Ctx; a: MockAgent; r: Review; phase: Phase; takeover: boolean; forced: boolean }) {
  const { s, set, phone } = ctx;
  const f = facts(r, phase);
  const tabs: [Tab, string, ReactNode, string][] = [
    ['media', 'Media', <Images key="m" className="size-3.5" />, String(f.media.length)],
    ['changes', 'Changes', <FileDiff key="c" className="size-3.5" />, String(f.files.length)],
    ['pr', 'PR', <GitPullRequest key="p" className="size-3.5" />, f.failing ? '✕' : '✓'],
  ];
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-chat">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line-faint px-2">
        {tabs.map(([id, label, icon, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => set({ pane: id })}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px]', s.pane === id ? 'bg-surface-strong font-medium text-title' : 'text-subtle hover:text-title')}
          >
            {icon} {label}
            <span className={cn('text-[10.5px] tabular-nums', id === 'pr' ? (f.failing ? 'text-rose-300' : 'text-emerald-300') : 'text-faint')}>{n}</span>
          </button>
        ))}
        {phase === 'updated' && <span className="ml-1 rounded bg-brand-500/15 px-1.5 py-px text-[10.5px] font-semibold text-brand-300">Updated</span>}
        <span className="ml-auto flex items-center gap-0.5">
          {ctx.queue.length > 1 && !phone && <span className="mr-1 text-[11px] text-faint">{ctx.at + 1} of {ctx.queue.length}</span>}
          <IconBtn label="Previous to review (K)" onClick={() => ctx.step(-1)}><ArrowUp className="size-3.5" /></IconBtn>
          <IconBtn label="Next to review (J)" onClick={() => ctx.step(1)}><ArrowDown className="size-3.5" /></IconBtn>
          {!forced && (
            <>
              <span className="mx-1 h-4 w-px bg-line" />
              <IconBtn label="Beside the chat" active={!takeover} onClick={() => set({ layout: 'side' })}><Columns2 className="size-3.5" /></IconBtn>
              <IconBtn label="Take over, chat as a drawer" active={takeover} onClick={() => set({ layout: 'takeover' })}><Maximize2 className="size-3.5" /></IconBtn>
            </>
          )}
          <IconBtn label="Close (Esc)" onClick={() => set({ pane: null })}><X className="size-3.5" /></IconBtn>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {s.pane === 'media' && <MediaTab ctx={ctx} a={a} media={f.media} />}
        {s.pane === 'changes' && <ChangesTab ctx={ctx} files={f.files} updated={phase === 'updated'} />}
        {s.pane === 'pr' && <PrTab r={r} f={f} a={a} />}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-line-faint px-3 py-2">
        <Actions ctx={ctx} r={r} mergeable={f.mergeable} className={cn('min-w-0 flex-1 flex-nowrap', !phone && 'ml-auto max-w-[560px]')} />
      </div>
    </section>
  );
}

function MediaTab({ ctx, a, media }: { ctx: Ctx; a: MockAgent; media: (Media & { fresh?: boolean })[] }) {
  const { s, set } = ctx;
  const i = Math.min(s.media, media.length - 1);
  const m = media[i]!;
  const dark = document.documentElement.dataset.appearance !== 'light';
  const hue = project(a.project).hue;
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-3 p-4">
      <div className="relative overflow-hidden rounded-xl border border-line bg-sunken">
        <img src={screen(m.title, hue + i * 24, dark)} alt={m.title} className="aspect-[16/10] w-full object-cover" />
        {m.kind === 'recording' && (
          <>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"><Play className="ml-1 size-6 fill-current" /></span>
            </span>
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] text-white backdrop-blur">
              <Play className="size-3 fill-current" /> 0:00
              <span className="h-1 flex-1 rounded-full bg-white/25"><span className="block h-1 w-[18%] rounded-full bg-white" /></span>
              {m.length}
            </div>
          </>
        )}
        <CarouselArrow side="left" disabled={i === 0} onClick={() => set({ media: i - 1 })} />
        <CarouselArrow side="right" disabled={i === media.length - 1} onClick={() => set({ media: i + 1 })} />
      </div>
      <div className="flex min-w-0 items-start gap-2">
        {m.kind === 'recording' ? <Film className="mt-0.5 size-4 shrink-0 text-subtle" /> : m.kind === 'page' ? <Globe className="mt-0.5 size-4 shrink-0 text-subtle" /> : <Images className="mt-0.5 size-4 shrink-0 text-subtle" />}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-title">
            {m.title}
            {m.fresh && <span className="rounded bg-brand-500/15 px-1 text-[10px] font-semibold text-brand-300">New since your review</span>}
          </div>
          <div className="text-[12px] text-subtle">{m.caption}</div>
        </div>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-faint">{i + 1} / {media.length} · ← →</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {media.map((x, j) => (
          <Thumb key={x.title} m={x} hue={hue + j * 24} fresh={x.fresh} active={j === i} onClick={() => set({ media: j })} className="h-[62px] w-[100px]" />
        ))}
      </div>
    </div>
  );
}

function CarouselArrow({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  if (disabled) return null;
  return (
    <button type="button" onClick={onClick} className={cn('absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70', side === 'left' ? 'left-3' : 'right-3')}>
      {side === 'left' ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}

function ChangesTab({ ctx, files, updated }: { ctx: Ctx; files: FileChange[]; updated: boolean }) {
  const { s, set, phone } = ctx;
  const i = Math.min(s.file, files.length - 1);
  const file = files[i]!;
  const list = (
    <div className={cn('shrink-0 overflow-y-auto p-1.5', phone ? 'max-h-36 border-b border-line-faint' : 'w-[260px] border-r border-line-faint')}>
      <div className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">{files.length} files</div>
      {files.map((x, j) => {
        const parts = x.path.split('/');
        return (
          <div key={x.path} onClick={() => set({ file: j })} className={cn('flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px]', j === i ? 'bg-surface-strong text-title' : 'text-secondary hover:bg-surface')}>
            <span className={cn('w-3 shrink-0 font-mono text-[10.5px] font-semibold', x.status === 'A' ? 'text-emerald-300' : x.status === 'D' ? 'text-rose-300' : 'text-amber-300')}>{x.status}</span>
            <span className="min-w-0 flex-1 truncate" title={x.path}>
              {parts.at(-1)} <span className="text-faint">{parts.slice(-3, -1).join('/')}</span>
            </span>
            {updated && x.later && <span className="size-1.5 shrink-0 rounded-full bg-brand-400" title="New since your review" />}
            <span className="shrink-0 text-[10.5px] tabular-nums text-emerald-300">+{x.add}</span>
            {x.del > 0 && <span className="shrink-0 text-[10.5px] tabular-nums text-rose-300">−{x.del}</span>}
          </div>
        );
      })}
    </div>
  );
  return (
    <div className={cn('flex h-full min-w-0', phone && 'flex-col')}>
      {list}
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line-faint bg-chat px-3 py-1.5 font-mono text-[11.5px] text-secondary">
          <span className="truncate">{file.path}</span>
          {updated && file.later && <span className="rounded bg-brand-500/15 px-1 font-sans text-[10px] font-semibold text-brand-300">New since your review</span>}
          <span className="ml-auto shrink-0 font-sans text-[11px] text-subtle">Viewed <input type="checkbox" className="ml-1 align-middle" /></span>
        </div>
        <Diff file={file} />
      </div>
    </div>
  );
}

// numbered gives each diff line its old and new line numbers, from the
// hunk headers.
function numbered(file: FileChange) {
  let o = 0;
  let n = 0;
  return file.lines.map((l) => {
    if (l.t === '@') {
      const m = /-(\d+)(?:,\d+)? \+(\d+)/.exec(l.s);
      o = Number(m?.[1] ?? 1);
      n = Number(m?.[2] ?? 1);
      return { ...l, old: '', now: '' };
    }
    return { ...l, old: l.t === '+' ? '' : String(o++), now: l.t === '-' ? '' : String(n++) };
  });
}

function Diff({ file }: { file: FileChange }) {
  return (
    <table className="w-full border-collapse font-mono text-[11.5px] leading-[1.6]">
      <tbody>
        {numbered(file).map((l, i) =>
          l.t === '@' ? (
            <tr key={i} className="bg-sky-400/10 text-subtle">
              <td colSpan={3} className="px-3 py-0.5">@{l.s}</td>
            </tr>
          ) : (
            <tr key={i} className={cn(l.t === '+' && 'bg-emerald-400/10', l.t === '-' && 'bg-rose-400/10')}>
              <td className="w-10 select-none px-2 text-right text-faint">{l.old}</td>
              <td className="w-10 select-none px-2 text-right text-faint">{l.now}</td>
              <td className={cn('whitespace-pre pr-4', l.t === '+' ? 'text-emerald-300' : l.t === '-' ? 'text-rose-300' : 'text-secondary')}>
                <span className="select-none pr-2 opacity-60">{l.t === ' ' ? ' ' : l.t}</span>
                {l.s}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function PrTab({ r, f, a }: { r: Review; f: ReturnType<typeof facts>; a: MockAgent }) {
  return (
    <div className="mx-auto grid max-w-[1100px] gap-4 p-4 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11.5px] text-subtle">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300"><GitPullRequest className="size-3" /> Open</span>
          {a.branch} → main · {f.files.length} files <span className="text-emerald-300">+{f.add}</span> <span className="text-rose-300">−{f.del}</span>
        </div>
        <h2 className="mt-2 text-[17px] font-semibold text-title">{r.pr.title} <span className="font-normal text-subtle">#{r.pr.number}</span></h2>
        <div className="mt-3 grid gap-2 text-[13px] leading-relaxed text-secondary">
          {r.pr.body.map((b, i) =>
            b.startsWith('## ') ? (
              <h3 key={i} className="mt-2 text-[13.5px] font-semibold text-title">{b.slice(3)}</h3>
            ) : b.startsWith('- ') ? (
              <div key={i} className="flex gap-2 pl-1"><span className="text-faint">•</span><span>{code(b.slice(2))}</span></div>
            ) : (
              <p key={i}>{code(b)}</p>
            ),
          )}
        </div>
      </div>
      <div className="grid content-start gap-3">
        <div className="rounded-xl border border-line bg-surface-faint">
          <div className="flex items-center gap-2 border-b border-line-faint px-3 py-2 text-[12.5px] font-medium text-title">
            Checks
            <span className={cn('ml-auto text-[11.5px] font-normal', f.failing ? 'text-rose-300' : 'text-emerald-300')}>{f.failing ? `${f.failing} failing` : `${f.passing} of ${f.total} passing`}</span>
          </div>
          {f.checks.map((c) => (
            <div key={c.name} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
              {c.state === 'pass' ? <CircleCheck className="size-3.5 text-emerald-300" /> : c.state === 'fail' ? <CircleX className="size-3.5 text-rose-300" /> : c.state === 'skip' ? <CircleSlash className="size-3.5 text-faint" /> : <CircleDashed className="size-3.5 text-amber-300" />}
              <span className={cn('min-w-0 flex-1 truncate', c.state === 'skip' ? 'text-faint' : 'text-secondary')}>{c.name}</span>
              <span className="text-[11px] tabular-nums text-faint">{c.state === 'skip' ? 'skipped' : c.time}</span>
            </div>
          ))}
          {f.failing > 0 && <div className="border-t border-line-faint px-3 py-2 text-[11.5px] text-subtle">Rerun failed checks · Ask {a.name} to look</div>}
        </div>
        <div className="rounded-xl border border-line bg-surface-faint px-3 py-2.5 text-[12px] text-secondary">
          <div className="flex items-center gap-1.5 font-medium text-title">
            {f.mergeable ? <CircleCheck className="size-3.5 text-emerald-300" /> : <CircleX className="size-3.5 text-rose-300" />}
            {f.mergeable ? 'Ready to merge' : 'Merging is blocked'}
          </div>
          <div className="mt-1 text-[11.5px] text-subtle">{f.mergeable ? 'No conflicts with main. Merge from the bar below, with the method from its menu.' : 'A required check is failing. Request changes, or rerun it.'}</div>
          <label className="mt-2 flex items-center gap-1.5 text-[11.5px]"><input type="checkbox" defaultChecked /> Delete {a.branch} after merging</label>
        </div>
      </div>
    </div>
  );
}

function code(text: string): ReactNode {
  return text.split('`').map((part, i) => (i % 2 ? <code key={i} className="rounded bg-surface-strong px-1 font-mono text-[11.5px] text-primary">{part}</code> : part));
}

// ——— Takeover's chat drawer ———

function Drawer({ ctx, a, narrow, children }: { ctx: Ctx; a: MockAgent; narrow: boolean; children: ReactNode }) {
  const { s, set } = ctx;
  if (!s.drawer)
    return narrow ? (
      <button type="button" onClick={() => set({ drawer: true })} className="absolute inset-x-3 bottom-[60px] z-20 flex items-center gap-2 rounded-full border border-line bg-modal px-3 py-2 text-[12px] text-secondary shadow-xl">
        <MessageSquareText className="size-4 text-subtle" /> Chat with {a.name}
        <span className="min-w-0 flex-1 truncate text-faint">· {a.note}</span>
        <ChevronDown className="size-3.5 rotate-180 text-subtle" />
      </button>
    ) : (
      <button type="button" onClick={() => set({ drawer: true })} className="flex w-12 shrink-0 flex-col items-center gap-3 border-l border-line-faint bg-rail py-3 text-subtle hover:text-title">
        <MessageSquareText className="size-4" />
        <Avatar a={a} className="size-6" />
        <span className="text-[11px] [writing-mode:vertical-rl]">Chat with {a.name}</span>
      </button>
    );
  return (
    <div className={cn('flex shrink-0 flex-col border-l border-line bg-chat', narrow ? 'absolute inset-y-0 right-0 z-20 w-[min(400px,100%)] shadow-2xl' : 'w-[380px]')}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line-faint px-3 text-[12px]">
        <MessageSquareText className="size-3.5 text-subtle" />
        <span className="font-medium text-title">Chat</span>
        <span className="text-subtle">{a.name}</span>
        <span className="ml-auto" />
        <IconBtn label="Fold the chat" onClick={() => set({ drawer: false })}><ChevronRight className="size-3.5" /></IconBtn>
      </div>
      {children}
    </div>
  );
}

// ——— #311's inbox, whose rows deep-link to a thread's card ———

function InboxPanel({ ctx, agents, startAll }: { ctx: Ctx; agents: MockAgent[]; startAll: () => void }) {
  const needs = agents.filter((a) => a.stage === 'needs');
  const ready = ctx.queue.map((k) => agents.find((a) => keyOf(a) === k)!);
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={() => ctx.set({ inbox: false })} />
      <div className="absolute right-2 top-12 z-40 w-[min(440px,calc(100%-1rem))] overflow-hidden rounded-xl border border-line bg-modal shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="text-[14px] font-medium text-title">Inbox</span>
          <span className="ml-auto text-[11.5px] text-subtle">Mark all read</span>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-1.5">
          <InboxHead>Needs you</InboxHead>
          {needs.map((a) => (
            <InboxRow key={keyOf(a)} a={a} onClick={() => ctx.go(keyOf(a))} tone="text-amber-300" text={a.note} />
          ))}
          <InboxHead right={ready.length > 0 && <button type="button" onClick={startAll} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-300 hover:underline"><Play className="size-2.5" /> Review all</button>}>
            Ready to review
          </InboxHead>
          {ready.map((a) => {
            const r = reviewOf(a)!;
            const f = facts(r, ctx.s.phases[keyOf(a)]);
            return (
              <InboxRow
                key={keyOf(a)}
                a={a}
                onClick={() => ctx.go(keyOf(a), true)}
                text={f.summary}
                extra={
                  <span className="flex items-center gap-2 text-[10.5px]">
                    {ctx.s.phases[keyOf(a)] === 'updated' && <span className="rounded bg-brand-500/15 px-1 font-semibold text-brand-300">Updated</span>}
                    <span className={f.failing ? 'text-rose-300' : 'text-emerald-300'}>#{r.pr.number} {f.failing ? 'failing' : 'passing'}</span>
                    <span className="text-faint">{f.media.length} media · {f.files.length} files</span>
                  </span>
                }
              />
            );
          })}
          <InboxHead>Activity</InboxHead>
          <div className="grid gap-0.5 px-2 pb-1 text-[12px] text-subtle">
            <div className="py-1">agent-39 merged <span className="text-secondary">#309 Attach any file</span> · 1h</div>
            <div className="py-1">Hatch lead started agent-7 · 6m</div>
          </div>
        </div>
        <div className="border-t border-line px-4 py-2 text-[11.5px] text-subtle">A ready row opens its thread at the review card</div>
      </div>
    </>
  );
}

function InboxHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center px-2.5 pb-1 pt-2.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">{children}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

function InboxRow({ a, onClick, text, tone, extra }: { a: MockAgent; onClick: () => void; text: string; tone?: string; extra?: ReactNode }) {
  return (
    <div onClick={onClick} className="flex min-w-0 cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface">
      <Avatar a={a} className="size-6" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[12.5px] font-medium text-title">{a.title}</span>
          <ProjectTag name={a.project} />
          <Time mins={a.mins} className="ml-auto" />
        </div>
        <div className={cn('line-clamp-1 text-[11.5px]', tone ?? 'text-subtle')}>{text}</div>
        {extra && <div className="mt-0.5">{extra}</div>}
      </div>
    </div>
  );
}
