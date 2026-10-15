// Concept E: lead-first. Most people never open an agent: they talk to each
// project's lead. So the sidebar lists the main chats (Home and each
// project's lead), each project with its agents folded under it: count
// badges when folded, a row per agent with a state dot when open. Filters
// like T3Code's (a filter button beside search, a popover, removable chips)
// narrow it by state, project, mine or recent. Review is #301's modal, with
// Merge as the one primary action, Mark reviewed secondary, and Request
// changes as a box inside the modal that messages the agent without leaving
// it. An agent's own view keeps a small card above its composer that opens
// the same modal. #311's header and its one inbox stay.
//
// ?concept=e and, for screenshots:
//   &view=home|lead:<project>|<project>/<agent>   what the middle shows
//   &expand=all|agentbox,hatch                   projects open in the sidebar
//   &filters=1 (the popover open) &st=review,working,needs,error,done
//   &proj=agentbox &show=mine|recent &q=text     filters on
//   &inbox=1  &nav=1 (the sidebar over the chat, below 1024 px)
//   &modal=<project>/<agent> &slide=pr|<n> &compose=1 (Request changes' box)
//   &phase=requested|updated|reviewed|merged     where that agent's review is
// Mock only: nothing here ships or is translated.
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  Crown,
  Ellipsis,
  ExternalLink,
  Film,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Globe,
  House,
  Images,
  Inbox as InboxIcon,
  ListFilter,
  LoaderCircle,
  Menu,
  PencilLine,
  Play,
  Plus,
  Search,
  Send,
  SquarePen,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { screen } from '../notifications';
import { agentLines, leadLines, type MockAgent, project, projects } from './data';
import { Avatar, Composer, Conversation, Kbd, ProjectMark, Time } from './kit';
import { allAgents, keyOf, type Media, type Review, reviewOf } from './reviewData';
import { PanelButton, panelBox, panelOn, RightPanel, usePanel } from './rightPanel';

// ——— The world, as this concept sees it ———

// Where an agent stands in the filters: working, needs review, needs you (a
// question or a credential), stopped on an error, or done (settled, merged,
// asleep).
type St = 'working' | 'review' | 'needs' | 'error' | 'done';
// Where one review stands: waiting, changes asked for (the agent is on
// them), back with the changes, or settled.
type Phase = 'review' | 'requested' | 'updated' | 'reviewed' | 'merged';
type Show = 'all' | 'mine' | 'recent';

const stLabel: Record<St, string> = { needs: 'Needs you', review: 'Needs review', working: 'Working', error: 'Errors', done: 'Done' };
const stDot: Record<St, string> = { needs: 'bg-amber-400', review: 'bg-sky-400', working: 'bg-emerald-400', error: 'bg-rose-400', done: 'bg-ghost' };
const stText: Record<St, string> = { needs: 'text-amber-300', review: 'text-sky-300', working: 'text-emerald-300', error: 'text-rose-300', done: 'text-subtle' };
const stOrder: St[] = ['needs', 'review', 'working', 'error', 'done'];

// The agents the user started themselves; the leads started the rest.
const mine = new Set(['agentbox/agent-12', 'agentbox/agent-88', 'agentbox/agent-95', 'hatch/agent-3', 'organic/agent-15']);

// agent-88 is stopped on an error here, and Hatch has one more; two of the
// preview's fixture titles read better renamed.
const retitled: Record<string, Partial<MockAgent>> = {
  'agentbox/agent-88': { title: 'Daemon tests: job queue flake', note: 'Stopped on an error: go test ./internal/daemon timed out after 20m', cpu: 0 },
  'agentbox/agent-99': { title: 'Token ledger per model' },
};
const world: MockAgent[] = [
  ...allAgents.map((a) => ({ ...a, ...retitled[keyOf(a)] })),
  { project: 'hatch', name: 'agent-6', title: 'Image uploads to R2', ai: 'codex', stage: 'stopped', mins: 35, note: 'Stopped on an error: R2 answered 403 (the token can’t write to pages-media)', branch: 'agentbox/uploads' },
];
const errored = new Set(['agentbox/agent-88', 'hatch/agent-6']);

function stOf(a: MockAgent, phase?: Phase): St {
  if (phase === 'requested') return 'working';
  if (phase === 'reviewed' || phase === 'merged') return 'done';
  if (phase === 'updated') return 'review';
  if (errored.has(keyOf(a))) return 'error';
  if (a.stage === 'stopped') return 'done';
  return a.stage === 'needs' ? 'needs' : a.stage === 'review' ? 'review' : a.stage === 'working' ? 'working' : 'done';
}

const byKey = (key: string) => world.find((a) => keyOf(a) === key);

// The review's own numbers, which change once the agent has worked again.
function facts(r: Review, phase?: Phase) {
  const updated = phase === 'updated';
  const media: (Media & { fresh?: boolean })[] = updated ? [{ ...r.again.media, fresh: true }, ...r.media] : r.media;
  const checks = updated ? r.pr.checks.map((c) => (c.state === 'fail' ? { ...c, state: 'pass' as const, time: '1m 31s' } : c)) : r.pr.checks;
  const counted = checks.filter((c) => c.state !== 'skip');
  const failing = counted.filter((c) => c.state === 'fail');
  const files = r.files.filter((f) => updated || !f.later);
  return {
    media,
    checks,
    files,
    passing: counted.length - failing.length,
    failing,
    total: counted.length,
    add: files.reduce((n, f) => n + f.add, 0),
    del: files.reduce((n, f) => n + f.del, 0),
    mergeable: updated || r.pr.mergeable,
    summary: updated ? r.again.summary : r.summary,
    shots: media.filter((m) => m.kind === 'shot').length,
    recordings: media.filter((m) => m.kind === 'recording').length,
    pages: media.filter((m) => m.kind === 'page').length,
  };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

// ——— State, from the URL first ———

interface S {
  view: string; // 'home', 'lead:<project>' or project/agent
  expanded: string[];
  doneOpen: string[]; // projects whose done agents are unfolded
  filtersOpen: boolean;
  st: St[];
  proj: string[];
  show: Show;
  q: string;
  inbox: boolean;
  nav: boolean;
  modal: string | null;
  walk: string[] | null; // Review all's order
  slide: number;
  compose: boolean;
  draft: string;
  phases: Record<string, Phase>;
  asked: Record<string, string>;
}

const params = new URLSearchParams(location.search);
const list = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean);

function initial(): S {
  const modal = params.get('modal');
  const phase = params.get('phase') as Phase | null;
  const target = modal ?? params.get('view') ?? '';
  const r = modal ? reviewOf(byKey(modal)!) : undefined;
  const expand = params.get('expand');
  const s: S = {
    view: params.get('view') ?? 'lead:agentbox',
    expanded: expand === 'all' ? projects.map((p) => p.name) : list('expand'),
    doneOpen: [],
    filtersOpen: params.get('filters') === '1',
    st: list('st') as St[],
    proj: list('proj'),
    show: (params.get('show') as Show) ?? 'all',
    q: params.get('q') ?? '',
    inbox: params.get('inbox') === '1',
    nav: params.get('nav') === '1',
    modal,
    walk: null,
    slide: 0,
    compose: params.get('compose') === '1',
    draft: params.get('compose') === '1' ? (r?.ask ?? '') : '',
    phases: phase && target ? { [target]: phase } : {},
    asked: phase === 'requested' || phase === 'updated' ? { [target]: (target && reviewOf(byKey(target)!)?.ask) ?? '' } : {},
  };
  const slide = params.get('slide');
  if (modal && r) s.slide = slide === 'pr' ? facts(r, phase ?? undefined).media.length : Number(slide ?? 0);
  return s;
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

interface Ctx {
  s: S;
  set: (patch: Partial<S> | ((s: S) => Partial<S>)) => void;
  st: (a: MockAgent) => St;
  phase: (key: string) => Phase | undefined;
  queue: string[]; // every agent that needs review, newest first
  openReview: (key: string, walk?: boolean) => void;
  go: (view: string) => void;
  narrow: boolean;
  phone: boolean;
  panel: ReturnType<typeof usePanel>;
}

export function LeadFirstConcept() {
  const [s, setS] = useState(initial);
  const panel = usePanel();
  const set = (patch: Partial<S> | ((s: S) => Partial<S>)) => setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  const width = useWidth();
  const narrow = width < 1024;
  // With the right-hand panel open beside it, the chat can be as narrow as a
  // phone's, and its header and review card then fold the same way.
  const box = panelBox(panel.p.variant, width);
  const chatWidth = width - (narrow ? 0 : 288) - (panelOn && panel.p.open && !box.drawer ? box.width : 0);
  const phone = width < 640 || chatWidth < 480;
  const phase = (key: string) => s.phases[key];
  const st = (a: MockAgent) => stOf(a, phase(keyOf(a)));
  const queue = useMemo(
    () => world.filter((a) => stOf(a, s.phases[keyOf(a)]) === 'review' && reviewOf(a)).sort((a, b) => a.mins - b.mins).map(keyOf),
    [s.phases],
  );
  const ctx: Ctx = {
    s,
    set,
    st,
    phase,
    queue,
    narrow,
    phone,
    panel,
    openReview: (key, walk) => set({ modal: key, slide: 0, compose: false, draft: '', inbox: false, walk: walk ? queue : null }),
    go: (view) => set({ view, nav: false, inbox: false }),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      set((p) => (p.compose ? { compose: false } : p.modal ? { modal: null } : { inbox: false, filtersOpen: false, nav: false }));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const current = s.view.includes('/') ? byKey(s.view) : undefined;
  return (
    <div className="flex h-screen min-w-0 bg-ink text-primary">
      {(!narrow || s.nav) && (
        <>
          {narrow && <div className="fixed inset-0 z-30 bg-black/40" onClick={() => set({ nav: false })} />}
          <Sidebar ctx={ctx} overlay={narrow} />
        </>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col bg-chat">
        <Header ctx={ctx} a={current} />
        {current ? <AgentView ctx={ctx} a={current} /> : <LeadView ctx={ctx} />}
        {s.inbox && <InboxPanel ctx={ctx} />}
      </main>
      {panelOn && (
        <RightPanel
          {...panel}
          {...box}
          proj={current?.project ?? (s.view.startsWith('lead:') ? s.view.slice(5) : 'agentbox')}
          agents={world.filter((x) => x.project === (current?.project ?? (s.view.startsWith('lead:') ? s.view.slice(5) : 'agentbox'))).sort((x, y) => x.mins - y.mins)}
          follow={current?.name ?? null}
        />
      )}
      {s.modal && <ReviewModal key={s.modal} ctx={ctx} k={s.modal} />}
      <div className="pointer-events-none fixed bottom-3 left-3 z-[40] rounded-full border border-line bg-modal/90 px-3 py-1 text-[11px] font-medium text-secondary shadow-lg backdrop-blur max-lg:hidden">
        Concept E · lead-first{panelOn && ` · panel ${panel.p.variant}`}
      </div>
    </div>
  );
}

// ——— The sidebar: Home and the leads, their agents folded under them ———

function matches(ctx: Ctx, a: MockAgent) {
  const { s } = ctx;
  if (s.st.length && !s.st.includes(ctx.st(a))) return false;
  if (s.proj.length && !s.proj.includes(a.project)) return false;
  if (s.show === 'mine' && !mine.has(keyOf(a))) return false;
  if (s.show === 'recent' && a.mins > 120) return false;
  if (s.q) {
    const q = s.q.toLowerCase();
    if (![a.title, a.name, project(a.project).display, a.note].some((x) => x.toLowerCase().includes(q))) return false;
  }
  return true;
}

function Sidebar({ ctx, overlay }: { ctx: Ctx; overlay: boolean }) {
  const { s, set } = ctx;
  // Narrowing to agents (state, mine, recent, a search) opens the projects
  // with a match and hides the rest; a project filter alone just hides the others.
  const narrowing = s.st.length > 0 || s.show !== 'all' || s.q !== '';
  const shown = projects.filter((p) => !s.proj.length || s.proj.includes(p.name));
  const rows = shown
    .map((p) => ({ p, agents: world.filter((a) => a.project === p.name && matches(ctx, a)) }))
    .filter(({ p, agents }) => !narrowing || agents.length > 0 || (s.q && p.display.toLowerCase().includes(s.q.toLowerCase())));
  const hidden = projects.length - rows.length;
  const clear = () => set({ st: [], proj: [], show: 'all', q: '' });
  return (
    <aside
      className={cn('flex w-[288px] shrink-0 flex-col border-r border-line bg-rail', overlay && 'fixed inset-y-0 left-0 z-40 w-[min(320px,88vw)] shadow-2xl')}
      // The rail's colour is see-through (the window's vibrancy); over the chat it needs a floor.
      style={overlay ? { background: 'linear-gradient(var(--color-rail), var(--color-rail)), var(--color-ink)' } : undefined}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 px-3">
        <span className="text-[13px] font-semibold tracking-tight text-title">AgentBox</span>
        <span title="New project" className="ml-auto flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-strong hover:text-title">
          <SquarePen className="size-4" />
        </span>
      </div>
      <FilterBar ctx={ctx} onClear={clear} />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3 pt-1">
        <Row active={s.view === 'home'} onClick={() => ctx.go('home')} className="py-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-strong text-secondary"><House className="size-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-title">Home</span>
            <span className="block truncate text-[11.5px] text-subtle">Across every project</span>
          </span>
          <Time mins={14} />
        </Row>
        <div className="flex items-center px-2.5 pb-1 pt-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">Projects</span>
          <Plus className="ml-auto size-3.5 text-faint" />
        </div>
        {rows.map(({ p, agents }) => (
          <ProjectRow key={p.name} ctx={ctx} name={p.name} agents={agents} open={narrowing || s.expanded.includes(p.name)} filtered={narrowing} />
        ))}
        {(hidden > 0 || (narrowing && rows.length === 0)) && (
          <div className="mx-2 mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-[11.5px] text-subtle">
            {rows.length === 0 ? 'Nothing matches' : `${plural(hidden, 'project')} hidden by filters`}
            <button type="button" onClick={clear} className="ml-auto font-medium text-brand-300 hover:underline">Clear</button>
          </div>
        )}
      </div>
    </aside>
  );
}

// FilterBar is search and the filter button beside it (T3Code's), and under
// them a chip per filter that's on, each removable, with Reset.
function FilterBar({ ctx, onClear }: { ctx: Ctx; onClear: () => void }) {
  const { s, set } = ctx;
  const on = s.st.length + s.proj.length + (s.show !== 'all' ? 1 : 0);
  const chips: { label: string; tone?: string; remove: () => void }[] = [
    ...s.st.map((x) => ({ label: stLabel[x], tone: stDot[x], remove: () => set({ st: s.st.filter((y) => y !== x) }) })),
    ...s.proj.map((x) => ({ label: project(x).display, remove: () => set({ proj: s.proj.filter((y) => y !== x) }) })),
    ...(s.show !== 'all' ? [{ label: s.show === 'mine' ? 'Only mine' : 'Last 2 hours', remove: () => set({ show: 'all' }) }] : []),
  ];
  return (
    <div className="relative shrink-0 px-2 pb-1.5">
      <div className="flex items-center gap-1.5">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-surface-faint px-2 focus-within:border-brand-400">
          <Search className="size-3.5 shrink-0 text-faint" />
          <input
            value={s.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search chats and agents"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-primary outline-none placeholder:text-faint"
          />
          {s.q ? (
            <button type="button" onClick={() => set({ q: '' })} className="text-faint hover:text-title"><X className="size-3.5" /></button>
          ) : (
            <Kbd>⌘K</Kbd>
          )}
        </label>
        <button
          type="button"
          aria-label="Filter agents"
          onClick={() => set({ filtersOpen: !s.filtersOpen })}
          className={cn(
            'relative flex size-8 shrink-0 items-center justify-center rounded-lg border',
            on ? 'border-brand-400/60 bg-brand-500/15 text-brand-300' : 'border-line bg-surface-faint text-subtle hover:text-title',
            s.filtersOpen && 'ring-2 ring-brand-400/40',
          )}
        >
          <ListFilter className="size-4" />
          {on > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9.5px] font-semibold text-white">{on}</span>}
        </button>
      </div>
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {chips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-secondary">
              {c.tone && <span className={cn('size-1.5 rounded-full', c.tone)} />}
              {c.label}
              <button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove} className="-mr-0.5 text-faint hover:text-title"><X className="size-3" /></button>
            </span>
          ))}
          <button type="button" onClick={onClear} className="px-1 text-[11px] text-subtle hover:text-title">Reset</button>
        </div>
      )}
      {s.filtersOpen && <FilterPopover ctx={ctx} />}
    </div>
  );
}

function FilterPopover({ ctx }: { ctx: Ctx }) {
  const { s, set } = ctx;
  const count = (x: St) => world.filter((a) => ctx.st(a) === x).length;
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={() => set({ filtersOpen: false })} />
      <div className="absolute left-2 top-10 z-30 grid w-[310px] gap-3 rounded-xl border border-line bg-modal p-3 shadow-2xl backdrop-blur-xl">
        <FilterGroup title="State">
          {stOrder.map((x) => (
            <Chip key={x} on={s.st.includes(x)} onClick={() => set({ st: toggle(s.st, x) })}>
              <span className={cn('size-1.5 rounded-full', stDot[x])} /> {stLabel[x]} <span className="tabular-nums text-faint">{count(x)}</span>
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Project">
          {projects.map((p) => (
            <Chip key={p.name} on={s.proj.includes(p.name)} onClick={() => set({ proj: toggle(s.proj, p.name) })}>
              <ProjectMark name={p.name} className="size-3.5 rounded text-[8px]" /> {p.display}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Show">
          <div className="flex w-full rounded-lg border border-line bg-surface-faint p-0.5">
            {(['all', 'mine', 'recent'] as Show[]).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => set({ show: x })}
                className={cn('flex-1 rounded-md px-2 py-1 text-[11.5px]', s.show === x ? 'bg-surface-strong font-medium text-title shadow-sm' : 'text-subtle hover:text-title')}
              >
                {x === 'all' ? 'Everything' : x === 'mine' ? 'Only mine' : 'Recent'}
              </button>
            ))}
          </div>
        </FilterGroup>
        <div className="flex items-center border-t border-line-faint pt-2 text-[11px] text-subtle">
          Only mine: agents you started, not a lead
          <button type="button" onClick={() => set({ filtersOpen: false })} className="ml-auto rounded-md bg-surface-strong px-2 py-0.5 font-medium text-title">Done</button>
        </div>
      </div>
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">{title}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px]', on ? 'border-brand-400/70 bg-brand-500/15 text-title' : 'border-line text-secondary hover:bg-surface')}
    >
      {on && <Check className="size-3 text-brand-300" />}
      {children}
    </button>
  );
}

function Row({ children, active, onClick, className }: { children: ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <div onClick={onClick} className={cn('group flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5', active ? 'bg-surface-strong' : 'hover:bg-surface', className)}>
      {children}
    </div>
  );
}

// ProjectRow is a project's lead, the main chat: its last line, and its
// agents' counts; the chevron opens the agents under it.
function ProjectRow({ ctx, name, agents, open, filtered }: { ctx: Ctx; name: string; agents: MockAgent[]; open: boolean; filtered: boolean }) {
  const { s, set } = ctx;
  const p = project(name);
  const all = world.filter((a) => a.project === name);
  const n = (x: St) => all.filter((a) => ctx.st(a) === x).length;
  const toggle = () => set({ expanded: s.expanded.includes(name) ? s.expanded.filter((x) => x !== name) : [...s.expanded, name] });
  const sorted = [...agents].sort((a, b) => stOrder.indexOf(ctx.st(a)) - stOrder.indexOf(ctx.st(b)) || a.mins - b.mins);
  // Done agents fold into one line, unless a filter asks for them.
  const done = sorted.filter((a) => ctx.st(a) === 'done');
  const foldDone = !filtered && !s.doneOpen.includes(name) && done.length > 0;
  const rows = foldDone ? sorted.filter((a) => ctx.st(a) !== 'done') : sorted;
  return (
    <div className="mb-0.5">
      <Row active={s.view === `lead:${name}`} onClick={() => ctx.go(`lead:${name}`)} className="items-start py-2 pl-1">
        <button
          type="button"
          aria-label={open ? 'Hide its agents' : 'Show its agents'}
          onClick={(e) => {
            e.stopPropagation();
            if (!filtered) toggle();
          }}
          className="mt-1 flex size-4 shrink-0 items-center justify-center rounded text-faint hover:bg-surface-strong hover:text-title"
        >
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <ProjectMark name={name} className="mt-px size-6" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn('truncate text-[13px] text-title', p.lead.unread ? 'font-semibold' : 'font-medium')}>{p.display}</span>
            {p.lead.working && <LoaderCircle className="size-3 shrink-0 animate-spin text-emerald-300" />}
            <Time mins={p.lead.mins} className="ml-auto" />
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn('min-w-0 flex-1 truncate text-[11.5px]', p.lead.unread ? 'text-secondary' : 'text-subtle')}>{p.lead.last}</span>
            {p.lead.unread > 0 && <span className="shrink-0 rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">{p.lead.unread}</span>}
          </span>
          {!open && all.length > 0 && (
            <span className="mt-1 flex flex-wrap items-center gap-1">
              <Count n={n('working')} st="working" />
              <Count n={n('review')} st="review" />
              <Count n={n('needs')} st="needs" />
              <Count n={n('error')} st="error" />
              {n('working') + n('review') + n('needs') + n('error') === 0 && <span className="text-[10.5px] text-faint">{plural(all.length, 'agent')}, all done</span>}
            </span>
          )}
        </span>
      </Row>
      {open && (
        <div className="relative ml-[22px] border-l border-line-faint pl-1.5">
          {rows.map((a) => <AgentRow key={keyOf(a)} ctx={ctx} a={a} />)}
          {foldDone && (
            <Row onClick={() => set({ doneOpen: [...s.doneOpen, name] })} className="py-1">
              <Check className="size-3 shrink-0 text-faint" />
              <span className="text-[11.5px] text-subtle">{done.length} done</span>
            </Row>
          )}
          {sorted.length === 0 && <div className="px-2 py-1 text-[11.5px] text-faint">No agents</div>}
        </div>
      )}
    </div>
  );
}

const countWord: Record<St, string> = { working: 'working', review: 'to review', needs: 'ask', error: 'failed', done: 'done' };

function Count({ n, st }: { n: number; st: St }) {
  if (!n) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-surface px-1.5 py-px text-[10.5px] font-medium tabular-nums', stText[st])} title={`${n} ${stLabel[st].toLowerCase()}`}>
      <span className={cn('size-1.5 rounded-full', stDot[st], st === 'working' && 'animate-pulse')} />
      {n} {countWord[st]}
    </span>
  );
}

function AgentRow({ ctx, a }: { ctx: Ctx; a: MockAgent }) {
  const key = keyOf(a);
  const st = ctx.st(a);
  const phase = ctx.phase(key);
  return (
    <Row active={ctx.s.view === key} onClick={() => ctx.go(key)} className="py-1">
      <span className={cn('size-2 shrink-0 rounded-full', stDot[st], st === 'working' && 'animate-pulse')} />
      <span className={cn('min-w-0 flex-1 truncate text-[12px]', st === 'done' ? 'text-subtle' : a.unseen && st === 'review' ? 'font-medium text-title' : 'text-secondary')}>{a.title}</span>
      {phase === 'requested' && <Tag tone="bg-amber-400/15 text-amber-300">Changes</Tag>}
      {phase === 'updated' && <Tag tone="bg-brand-500/15 text-brand-300">Updated</Tag>}
      {!phase && st === 'needs' && <Tag tone="bg-amber-400/15 text-amber-300">Asks</Tag>}
      {!phase && st === 'error' && <Tag tone="bg-rose-400/15 text-rose-300">Error</Tag>}
      {!phase && st === 'review' && a.unseen && <Tag tone="bg-sky-400/15 text-sky-300">New</Tag>}
      {phase === 'merged' && <GitMerge className="size-3 shrink-0 text-violet-300" />}
      <Time mins={phase ? 0 : a.mins} />
    </Row>
  );
}

function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn('shrink-0 rounded px-1 text-[10px] font-medium', tone)}>{children}</span>;
}

// ——— #311's header: the chat's one primary action and ⋯, then search,
// the machine's dot and the one inbox ———

function Header({ ctx, a }: { ctx: Ctx; a?: MockAgent }) {
  const { s, set, narrow, phone } = ctx;
  const leadOf = s.view.startsWith('lead:') ? s.view.slice(5) : undefined;
  const needs = world.filter((x) => ['needs', 'error'].includes(ctx.st(x))).length;
  const count = ctx.queue.length + needs;
  const st = a && ctx.st(a);
  const phase = a && ctx.phase(keyOf(a));
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line-faint px-3">
      {narrow && (
        <button type="button" aria-label="Chats" onClick={() => set({ nav: true })} className="flex items-center rounded-md p-1 text-subtle hover:bg-surface">
          <Menu className="size-4" />
        </button>
      )}
      {a && st ? (
        <>
          <button type="button" onClick={() => ctx.go(`lead:${a.project}`)} className="hidden shrink-0 items-center gap-1 text-[12px] text-subtle hover:text-title sm:flex">
            <ProjectMark name={a.project} className="size-4 rounded text-[9px]" /> {project(a.project).display} <ChevronRight className="size-3 text-faint" />
          </button>
          <span className="min-w-0 truncate text-[13px] font-semibold text-title">{a.title}</span>
          {!phone && <span className={cn('shrink-0 rounded px-1.5 py-px text-[10.5px] font-medium', 'bg-surface', stText[st])}>{phase === 'requested' ? 'Changes requested' : stLabel[st]}</span>}
          {a.pr && !phone && (
            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-1.5 py-px text-[11px]', phase === 'merged' ? 'text-violet-300' : 'text-secondary')}>
              {phase === 'merged' ? <GitMerge className="size-3" /> : <GitPullRequest className="size-3" />}#{a.pr.number} {phase === 'merged' ? 'merged' : 'open'}
            </span>
          )}
        </>
      ) : leadOf ? (
        <>
          <ProjectMark name={leadOf} className="size-5 rounded text-[10px]" />
          <span className="truncate text-[13px] font-semibold text-title">{project(leadOf).display}</span>
          {!phone && <span className="inline-flex items-center gap-1 text-[11.5px] text-subtle"><Crown className="size-3 text-amber-300" /> Lead</span>}
        </>
      ) : (
        <>
          <House className="size-4 text-subtle" />
          <span className="text-[13px] font-semibold text-title">Home</span>
        </>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {leadOf && (
          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-500 px-2.5 text-[12px] font-medium text-white">
            <Plus className="size-3.5" /> {!phone && 'New agent'}
          </span>
        )}
        {panelOn ? <PanelButton {...ctx.panel} fresh={3} /> : <IconBtn label="More"><Ellipsis className="size-4" /></IconBtn>}
        <span className="mx-1 h-5 w-px bg-line" />
        {!phone && <IconBtn label="Search ⌘K"><Search className="size-4" /></IconBtn>}
        {!phone && <span title="Machine: all well" className="flex size-7 items-center justify-center"><span className="size-2 rounded-full bg-emerald-400" /></span>}
        <button
          type="button"
          onClick={() => set({ inbox: !s.inbox })}
          aria-label={`Inbox, ${count} need you`}
          className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-faint text-muted hover:bg-surface-raised hover:text-primary', s.inbox && 'bg-surface-raised text-primary')}
        >
          <InboxIcon className="size-4" />
          {count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-[var(--color-chat)]">{count}</span>}
        </button>
      </span>
    </header>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-strong hover:text-title">
      {children}
    </button>
  );
}

// ——— The middle: a lead's chat (or Home's), or an agent's ———

function LeadView({ ctx }: { ctx: Ctx }) {
  const name = ctx.s.view.startsWith('lead:') ? ctx.s.view.slice(5) : undefined;
  const lines = name
    ? leadLines(name)
    : [
        { who: 'user' as const, text: 'What needs me today?' },
        { who: 'ai' as const, text: `${plural(ctx.queue.length, 'agent')} across your projects are ready to review, and two are stopped on an error. Organic’s import needs a Stripe key.` },
      ];
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Conversation lines={lines} />
      </div>
      <Composer placeholder={name ? `Message ${project(name).display}’s lead…` : 'Message Home…'} />
    </>
  );
}

function AgentView({ ctx, a }: { ctx: Ctx; a: MockAgent }) {
  const key = keyOf(a);
  const r = reviewOf(a);
  const phase = ctx.phase(key);
  const f = r && facts(r, phase);
  const lines = agentLines(a);
  if (f) lines[lines.length - 1] = { who: 'ai', text: f.summary };
  if (r && ctx.s.asked[key]) lines.push({ who: 'user', text: ctx.s.asked[key]! }, ...(phase === 'updated' ? [{ who: 'ai' as const, text: r.again.summary }] : [{ who: 'tool' as const, text: 'Working on your changes…' }]));
  const showCard = r && f && phase !== 'reviewed' && phase !== 'merged' && ctx.st(a) !== 'done';
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Conversation lines={lines} ai={a.ai} />
      </div>
      {showCard && <ReviewCard ctx={ctx} a={a} r={r} f={f} phase={phase} />}
      <Composer placeholder={`Message ${a.name}…`} className={showCard ? 'pt-0' : undefined} />
    </>
  );
}

// ReviewCard sits above a finished agent's composer: what it made, its pull
// request, and Review changes, which opens the modal on it. Gone once it's
// reviewed or merged.
function ReviewCard({ ctx, a, r, f, phase }: { ctx: Ctx; a: MockAgent; r: Review; f: ReturnType<typeof facts>; phase?: Phase }) {
  const asked = phase === 'requested';
  const made = [f.shots && plural(f.shots, 'screenshot'), f.recordings && plural(f.recordings, 'recording'), f.pages && plural(f.pages, 'page')].filter(Boolean) as string[];
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-2" data-review-card={keyOf(a)}>
      <div className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2', asked ? 'border-amber-400/30 bg-amber-400/5' : 'border-sky-400/30 bg-sky-400/5')}>
        <span className="flex min-w-0 items-center gap-2">
          {asked ? <LoaderCircle className="size-4 shrink-0 animate-spin text-amber-300" /> : <CircleCheck className="size-4 shrink-0 text-sky-300" />}
          <span className="shrink-0 text-[12.5px] font-medium text-title">{asked ? 'Changes requested' : phase === 'updated' ? 'Updated, ready to review' : 'Ready to review'}</span>
        </span>
        <span className="flex min-w-[200px] flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-subtle">
          {made.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Images className="size-3.5 text-faint" /> {made.join(' · ')}
            </span>
          )}
          <span className={cn('inline-flex items-center gap-1', f.failing.length ? 'text-rose-300' : 'text-emerald-300')}>
            <GitPullRequest className="size-3.5" />#{r.pr.number} open · {f.failing.length ? `${f.failing.length} check failing` : 'checks pass'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => ctx.openReview(keyOf(a))}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-brand-500 px-2.5 text-[12px] font-medium text-white hover:bg-brand-400"
          data-review-open
        >
          Review changes <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ——— #311's inbox: Needs you, Ready to review (the modal opens from here),
// and what's asked to change ———

function InboxPanel({ ctx }: { ctx: Ctx }) {
  const needs = world.filter((a) => ['needs', 'error'].includes(ctx.st(a)));
  const ready = ctx.queue.map((k) => byKey(k)!);
  const changing = world.filter((a) => ctx.phase(keyOf(a)) === 'requested');
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={() => ctx.set({ inbox: false })} />
      <div className="absolute right-2 top-12 z-40 w-[min(440px,calc(100%-1rem))] overflow-hidden rounded-xl border border-line bg-modal shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="text-[14px] font-medium text-title">Inbox</span>
          <span className="ml-auto text-[11.5px] text-subtle">Mark all read</span>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-1.5">
          <InboxHead>Needs you</InboxHead>
          {needs.map((a) => (
            <InboxRow key={keyOf(a)} a={a} onClick={() => ctx.go(keyOf(a))} tone={stText[ctx.st(a)]} text={a.note} />
          ))}
          <InboxHead
            right={ready.length > 0 && (
              <button type="button" onClick={() => ctx.openReview(ready[0]!.project + '/' + ready[0]!.name, true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-300 hover:underline">
                <Play className="size-2.5" /> Review all {ready.length}
              </button>
            )}
          >
            Ready to review
          </InboxHead>
          {ready.map((a) => {
            const r = reviewOf(a)!;
            const f = facts(r, ctx.phase(keyOf(a)));
            return (
              <InboxRow
                key={keyOf(a)}
                a={a}
                onClick={() => ctx.openReview(keyOf(a))}
                text={f.summary}
                extra={
                  <span className="flex items-center gap-2 text-[10.5px]">
                    {ctx.phase(keyOf(a)) === 'updated' && <span className="rounded bg-brand-500/15 px-1 font-semibold text-brand-300">Updated</span>}
                    <span className={f.failing.length ? 'text-rose-300' : 'text-emerald-300'}>#{r.pr.number} {f.failing.length ? 'failing' : 'passing'}</span>
                    <span className="text-faint">{plural(f.media.length, 'item')}</span>
                  </span>
                }
              />
            );
          })}
          {changing.length > 0 && <InboxHead>Changes requested</InboxHead>}
          {changing.map((a) => (
            <InboxRow key={keyOf(a)} a={a} onClick={() => ctx.go(keyOf(a))} tone="text-amber-300" text={`Working on: ${ctx.s.asked[keyOf(a)] ?? ''}`} />
          ))}
        </div>
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
          <span className="shrink-0 text-[11px] text-subtle">{project(a.project).display}</span>
          <Time mins={a.mins} className="ml-auto" />
        </div>
        <div className={cn('line-clamp-1 text-[11.5px]', tone ?? 'text-subtle')}>{text}</div>
        {extra && <div className="mt-0.5">{extra}</div>}
      </div>
    </div>
  );
}

// ——— The review modal: #301's carousel and PR slide, with Merge as the
// primary action, Mark reviewed secondary, and Request changes inline ———

function ReviewModal({ ctx, k }: { ctx: Ctx; k: string }) {
  const { s, set, phone } = ctx;
  const a = byKey(k)!;
  const r = reviewOf(a)!;
  const phase = ctx.phase(k) ?? 'review';
  const f = facts(r, phase);
  const slides = f.media.length + 1; // the media, then the pull request
  const at = Math.min(s.slide, slides - 1);
  const onPr = at === slides - 1;
  const order = s.walk ?? ctx.queue;
  const pos = order.indexOf(k);
  const next = order.slice(pos + 1).find((x) => ctx.queue.includes(x)) ?? order.find((x) => x !== k && ctx.queue.includes(x));
  const settled = phase === 'reviewed' || phase === 'merged';
  const asked = phase === 'requested';
  const box = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (s.compose) box.current?.focus();
  }, [s.compose]);

  const setPhase = (p: Phase) => set((prev) => ({ phases: { ...prev.phases, [k]: p } }));
  const goNext = () => (next ? set({ modal: next, slide: 0, compose: false, draft: '' }) : set({ modal: null }));
  const send = () => {
    const text = s.draft.trim() || r.ask;
    set((prev) => ({ compose: false, draft: '', phases: { ...prev.phases, [k]: 'requested' }, asked: { ...prev.asked, [k]: text } }));
    // The mock agent finishes in a few seconds, and the review comes back.
    timer.current = setTimeout(() => set((prev) => ({ phases: { ...prev.phases, [k]: 'updated' } })), 6000);
  };
  const reviewed = () => {
    setPhase('reviewed');
    setTimeout(goNext, 700);
  };
  const blocked = asked ? `Waiting for ${a.name}’s changes` : f.failing.length ? `${plural(f.failing.length, 'check')} failing: ${f.failing.map((c) => c.name).join(', ')}` : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('textarea,input') || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (key === 'arrowright' && !onPr) set({ slide: at + 1 });
      else if (key === 'arrowleft' && at > 0) set({ slide: at - 1 });
      else if (key === 'n' && next) goNext();
      else if (settled) return;
      else if (key === 'c' && !asked) {
        e.preventDefault();
        set({ compose: true });
      } else if (key === 'r') reviewed();
      else if (key === 'm' && !blocked) setPhase('merged');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const actions = (stack: boolean) => (
    <ModalActions
      stack={stack}
      phone={phone}
      phase={phase}
      blocked={blocked}
      composing={s.compose}
      onRequest={() => set({ compose: !s.compose, draft: s.compose ? '' : s.draft })}
      onReviewed={reviewed}
      onMerge={() => setPhase('merged')}
      prNumber={r.pr.number}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]" onClick={() => set({ modal: null })}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn('flex flex-col overflow-hidden border border-line bg-modal shadow-2xl', phone ? 'size-full' : 'h-[min(94vh,1000px)] w-[calc(100vw-2rem)] max-w-[1440px] rounded-2xl')}
        data-review-modal={k}
      >
        {/* The header: who, where, then the decision. */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-2.5 max-sm:px-3">
          <div className="flex min-w-0 flex-1 basis-[360px] items-start gap-3">
            <Avatar a={a} className="mt-0.5 size-6" />
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-[16px] font-semibold leading-snug text-title">{a.title}</h2>
                {phase === 'updated' && <Tag tone="bg-brand-500/15 text-brand-300">Updated</Tag>}
                {phase === 'reviewed' && <Tag tone="bg-emerald-500/15 text-emerald-300">Reviewed just now</Tag>}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                <span className="font-medium text-secondary">{project(a.project).display}</span>
                <span className="flex min-w-0 items-center gap-1"><GitBranch className="size-3 shrink-0 text-faint" /><span className="truncate font-mono text-[11.5px]">{a.branch}</span></span>
                <span className="flex items-center gap-1.5">
                  <GitPullRequest className="size-3 text-faint" />
                  <span className="font-mono text-[11.5px] text-secondary">#{r.pr.number}</span>
                  <span className={cn('rounded-full px-1.5 text-[10.5px] font-medium', phase === 'merged' ? 'bg-violet-500/15 text-violet-300' : 'bg-emerald-500/15 text-emerald-300')}>{phase === 'merged' ? 'Merged' : 'Open'}</span>
                </span>
                <span className="text-faint">· finished {a.mins}m ago</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {order.length > 1 && pos >= 0 && <span className="mr-1 text-[12px] tabular-nums text-subtle">{pos + 1} of {order.length}</span>}
            <button type="button" onClick={() => set({ modal: null, view: k })} className="rounded-md px-2 py-1 text-[12px] text-tertiary hover:bg-surface-strong hover:text-title">Open agent</button>
            <IconBtn label="Dismiss, more"><Ellipsis className="size-4" /></IconBtn>
            <IconBtn label="Close (Esc)" onClick={() => set({ modal: null })}><X className="size-4" /></IconBtn>
          </div>
          {!phone && <div className="flex w-full min-w-0 justify-end lg:hidden">{actions(false)}</div>}
        </header>

        {s.compose && <RequestBox a={a} box={box} draft={s.draft} onDraft={(draft) => set({ draft })} onSend={send} onCancel={() => set({ compose: false, draft: '' })} />}
        {(asked || phase === 'updated' || phase === 'merged') && <StatusBanner a={a} r={r} phase={phase} text={s.asked[k]} next={next ? byKey(next) : undefined} onNext={goNext} />}

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-surface-faint">
              {onPr ? <PrSlide a={a} r={r} f={f} /> : <MediaSlide a={a} m={f.media[at]!} i={at} />}
              {at > 0 && !onPr && <Arrow side="left" onClick={() => set({ slide: at - 1 })} />}
              {!onPr && <Arrow side="right" onClick={() => set({ slide: at + 1 })} />}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-2 max-sm:px-3">
              <Filmstrip a={a} media={f.media} at={at} onPick={(i) => set({ slide: i })} prFailing={f.failing.length > 0} />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {onPr && !phone && (
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-tertiary">
                    <ExternalLink className="size-3.5" /> Open on GitHub
                  </span>
                )}
                {next ? (
                  <button type="button" onClick={goNext} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-medium', settled ? 'border-transparent bg-brand-500 text-white hover:bg-brand-400' : 'border-line text-secondary hover:bg-surface-strong')}>
                    Next agent <ArrowRight className="size-3.5" /> {!phone && <Kbd>N</Kbd>}
                  </button>
                ) : (
                  <button type="button" onClick={() => set({ modal: null })} className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[12.5px] font-medium text-secondary hover:bg-surface-strong">Done</button>
                )}
              </div>
            </div>
            {phone && <div className="border-t border-line px-3 py-2">{actions(false)}</div>}
          </section>

          <aside className="hidden w-[340px] shrink-0 flex-col border-l border-line lg:flex">
            {!phone && <div className="border-b border-line-faint px-4 py-3 max-lg:hidden">{actions(true)}</div>}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">Summary</h3>
              <p className="text-[13px] leading-relaxed text-secondary">{f.summary}</p>
              <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
                {plural(f.files.length, 'file')} changed <span className="font-mono text-emerald-300">+{f.add}</span> <span className="font-mono text-rose-300">−{f.del}</span>
              </p>
            </div>
            <div className="grid gap-1 border-t border-line-faint px-5 py-3 text-[11.5px] text-subtle">
              <Shortcut k="← →">Slides</Shortcut>
              <Shortcut k="C">Request changes</Shortcut>
              <Shortcut k="R">Mark reviewed</Shortcut>
              <Shortcut k="M">Merge</Shortcut>
              <Shortcut k="N">Next agent</Shortcut>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ModalActions is the decision, in order of weight: Merge (green, or
// disabled with why), Mark reviewed (outlined), Request changes (quiet).
function ModalActions({ stack, phone, phase, blocked, composing, onRequest, onReviewed, onMerge, prNumber }: {
  stack: boolean; // the summary column's: Merge on its own line, the rest under it
  phone: boolean;
  phase: Phase;
  blocked?: string;
  composing: boolean;
  onRequest: () => void;
  onReviewed: () => void;
  onMerge: () => void;
  prNumber: number;
}) {
  if (phase === 'merged')
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-violet-300">
        <GitMerge className="size-4" /> Merged #{prNumber} · squash · branch deleted
      </div>
    );
  const merge = (
    <button
      type="button"
      onClick={() => !blocked && onMerge()}
      aria-disabled={!!blocked}
      title={blocked}
      className={cn(
        'inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold',
        stack ? 'w-full' : 'order-last ml-auto',
        blocked ? 'cursor-not-allowed border border-dashed border-line-strong bg-surface text-faint' : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500',
      )}
      data-review-merge={blocked ? 'blocked' : 'ready'}
    >
      <GitMerge className="size-4" /> {stack && !blocked ? `Squash and merge #${prNumber}` : 'Merge'}
      {!blocked && !phone && <kbd className="rounded bg-white/15 px-1 font-mono text-[10px] font-normal">M</kbd>}
    </button>
  );
  const reason = blocked && (
    <div className={cn('flex items-start gap-1.5 text-[11.5px]', phase === 'requested' ? 'text-amber-300' : 'text-rose-300', !stack && 'order-last w-full justify-end')} data-merge-blocked>
      {phase === 'requested' ? <LoaderCircle className="mt-px size-3.5 shrink-0 animate-spin" /> : <CircleX className="mt-px size-3.5 shrink-0" />}
      <span className="min-w-0">Can’t merge: {blocked}</span>
    </div>
  );
  const reviewedBtn = (
    <button
      type="button"
      onClick={onReviewed}
      disabled={phase === 'reviewed'}
      className={cn('inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[12.5px] font-medium text-primary hover:bg-surface-strong disabled:opacity-50', stack && 'flex-1')}
      data-review-done
    >
      <Check className="size-3.5 shrink-0" /> <span className="truncate">{phone ? 'Reviewed' : 'Mark reviewed'}</span>
    </button>
  );
  const requestBtn = (
    <button
      type="button"
      onClick={onRequest}
      disabled={phase === 'requested'}
      className={cn(
        'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50',
        composing ? 'bg-amber-400/15 text-amber-300' : 'text-tertiary hover:bg-surface-strong hover:text-title',
        stack && 'flex-1 border border-line',
      )}
      data-review-request
    >
      <PencilLine className="size-3.5 shrink-0" /> <span className="truncate">{phone ? 'Changes' : 'Request changes'}</span>
    </button>
  );
  if (stack)
    return (
      <div className="grid gap-2" data-review-actions>
        {merge}
        {reason}
        <div className="flex gap-1.5">
          {reviewedBtn}
          {requestBtn}
        </div>
      </div>
    );
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5" data-review-actions>
      {requestBtn}
      {reviewedBtn}
      {merge}
      {reason}
    </div>
  );
}

function RequestBox({ a, box, draft, onDraft, onSend, onCancel }: {
  a: MockAgent;
  box: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  onDraft: (s: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-b border-amber-400/25 bg-amber-400/5 px-5 py-3 max-sm:px-3" data-request-box>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-title">
        <PencilLine className="size-3.5 text-amber-300" /> Request changes from {a.name}
        <span className="font-normal text-subtle max-sm:hidden">· sent straight to the agent; you stay here</span>
      </div>
      <div className="flex items-end gap-2 max-sm:flex-col max-sm:items-stretch">
        <textarea
          ref={box}
          value={draft}
          rows={2}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSend();
          }}
          placeholder={`What should ${a.name} change?`}
          className="min-h-[56px] min-w-0 flex-1 resize-none rounded-lg border border-line bg-composer px-3 py-2 text-[13px] text-primary outline-none placeholder:text-faint focus:border-amber-400/60"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onCancel} className="h-8 rounded-md px-2.5 text-[12.5px] text-tertiary hover:bg-surface-strong">Cancel</button>
          <button type="button" onClick={onSend} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-[12.5px] font-medium text-white hover:bg-brand-400" data-request-send>
            <Send className="size-3.5" /> Send to {a.name} <kbd className="rounded bg-white/15 px-1 font-mono text-[10px]">⌘↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

// StatusBanner says where this review went: changes asked for and the agent
// on them, back with them, or merged; with the next agent one click away.
function StatusBanner({ a, r, phase, text, next, onNext }: { a: MockAgent; r: Review; phase: Phase; text?: string; next?: MockAgent; onNext: () => void }) {
  const asked = phase === 'requested';
  const merged = phase === 'merged';
  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-2 text-[12.5px] max-sm:px-3', asked ? 'border-amber-400/25 bg-amber-400/10' : merged ? 'border-violet-400/25 bg-violet-500/10' : 'border-brand-400/25 bg-brand-500/10')}
      data-review-status={phase}
    >
      {asked ? <LoaderCircle className="size-4 shrink-0 animate-spin text-amber-300" /> : merged ? <GitMerge className="size-4 shrink-0 text-violet-300" /> : <CircleCheck className="size-4 shrink-0 text-brand-300" />}
      <span className="font-medium text-title">
        {asked ? `Changes requested — ${a.name} working` : merged ? `Merged #${r.pr.number}` : `${a.name} made your changes`}
      </span>
      <span className="min-w-0 flex-1 truncate text-subtle">
        {asked ? `“${text ?? r.ask}” · back in Needs review when it finishes` : merged ? 'Squash, branch deleted; the agent is settled.' : `${r.again.commits} new commits, 1 new screenshot · ${r.again.summary}`}
      </span>
      {(asked || merged) && next && (
        <button type="button" onClick={onNext} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-brand-300 hover:underline">
          Review {next.title} meanwhile <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Shortcut({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      {children} <Kbd>{k}</Kbd>
    </div>
  );
}

function MediaSlide({ a, m, i }: { a: MockAgent; m: Media & { fresh?: boolean }; i: number }) {
  const dark = document.documentElement.dataset.appearance !== 'light';
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-6 max-sm:p-3">
      <div className="relative w-full max-w-[1100px] overflow-hidden rounded-xl border border-line bg-sunken shadow-lg">
        <img src={screen(m.title, project(a.project).hue + i * 24, dark)} alt={m.title} className="aspect-[16/10] max-h-[62vh] w-full object-cover" />
        {m.kind === 'recording' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"><Play className="ml-1 size-6 fill-current" /></span>
          </span>
        )}
        {m.fresh && <span className="absolute right-2 top-2 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">NEW since your request</span>}
      </div>
      <div className="flex max-w-[1100px] items-center gap-2 self-stretch text-[12.5px] sm:self-center">
        {m.kind === 'recording' ? <Film className="size-4 shrink-0 text-subtle" /> : m.kind === 'page' ? <Globe className="size-4 shrink-0 text-subtle" /> : <Images className="size-4 shrink-0 text-subtle" />}
        <span className="shrink-0 whitespace-nowrap font-medium text-title">{m.title}</span>
        <span className="min-w-0 truncate text-subtle">{m.caption}</span>
      </div>
    </div>
  );
}

function PrSlide({ a, r, f }: { a: MockAgent; r: Review; f: ReturnType<typeof facts> }) {
  return (
    <div className="size-full overflow-y-auto bg-modal">
      <div className="mx-auto grid max-w-[1100px] gap-4 p-5 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-subtle">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300"><GitPullRequest className="size-3" /> Open</span>
            {a.branch} → main · {plural(f.files.length, 'file')} <span className="text-emerald-300">+{f.add}</span> <span className="text-rose-300">−{f.del}</span>
          </div>
          <h2 className="mt-2 text-[17px] font-semibold text-title">{r.pr.title} <span className="font-normal text-subtle">#{r.pr.number}</span></h2>
          <div className="mt-3 grid gap-2 text-[13px] leading-relaxed text-secondary">
            {r.pr.body.map((b, i) =>
              b.startsWith('## ') ? <h3 key={i} className="mt-2 text-[13.5px] font-semibold text-title">{b.slice(3)}</h3> : <p key={i}>{b.replace(/^- /, '• ')}</p>,
            )}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface-faint">
          <div className="flex items-center gap-2 border-b border-line-faint px-3 py-2 text-[12.5px] font-medium text-title">
            Checks
            <span className={cn('ml-auto text-[11.5px] font-normal', f.failing.length ? 'text-rose-300' : 'text-emerald-300')}>{f.failing.length ? `${f.failing.length} failing` : `${f.passing} of ${f.total} passing`}</span>
          </div>
          {f.checks.map((c) => (
            <div key={c.name} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
              {c.state === 'pass' ? <CircleCheck className="size-3.5 text-emerald-300" /> : c.state === 'fail' ? <CircleX className="size-3.5 text-rose-300" /> : c.state === 'skip' ? <CircleSlash className="size-3.5 text-faint" /> : <CircleDashed className="size-3.5 text-amber-300" />}
              <span className={cn('min-w-0 flex-1 truncate', c.state === 'skip' ? 'text-faint' : 'text-secondary')}>{c.name}</span>
              <span className="text-[11px] tabular-nums text-faint">{c.state === 'skip' ? 'skipped' : c.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Filmstrip({ a, media, at, onPick, prFailing }: { a: MockAgent; media: (Media & { fresh?: boolean })[]; at: number; onPick: (i: number) => void; prFailing: boolean }) {
  const dark = document.documentElement.dataset.appearance !== 'light';
  const hue = project(a.project).hue;
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
      {media.map((m, i) => (
        <button key={m.title} type="button" title={m.title} onClick={() => onPick(i)} className={cn('relative h-9 w-14 shrink-0 overflow-hidden rounded border', i === at ? 'border-brand-400 ring-1 ring-brand-400' : 'border-line opacity-75 hover:opacity-100')}>
          <img src={screen(m.title, hue + i * 24, dark)} alt="" className="size-full object-cover" />
          {m.kind === 'recording' && <Play className="absolute inset-0 m-auto size-3.5 fill-white text-white" />}
          {m.fresh && <span className="absolute right-0 top-0 size-2 rounded-full bg-brand-400 ring-1 ring-black/40" />}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPick(media.length)}
        className={cn('flex h-9 shrink-0 items-center gap-1 rounded border px-2 text-[11.5px]', at === media.length ? 'border-brand-400 text-title ring-1 ring-brand-400' : 'border-line text-secondary hover:bg-surface')}
      >
        <GitPullRequest className={cn('size-3.5', prFailing ? 'text-rose-300' : 'text-emerald-300')} /> PR
      </button>
      <span className="ml-1 shrink-0 text-[11.5px] tabular-nums text-subtle">{at + 1} of {media.length + 1}</span>
    </div>
  );
}

function Arrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70', side === 'left' ? 'left-3' : 'right-3')}>
      {side === 'left' ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}
