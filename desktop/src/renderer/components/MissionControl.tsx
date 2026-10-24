// Mission control: every live agent of every project on one screen. A card
// each, with its desktop, what it is doing and for how long, its memory and a
// word for its state; under them, the last day of each as a lane, so what
// happened overnight is one look. Opening a card opens the agent.
//
// Built for twenty agents and more: one /v1/mission poll gives every agent's
// step, lane, last screenshot and pull request (lib/mission.ts says what to
// make of them), the agents and their memory come from the queries the rest
// of the app already polls, and a card's desktop is a still the daemon
// captures, taken again every few seconds only while its agent works and the
// card is on screen, rather than a live stream per card.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Clock, MemoryStick, Monitor, Moon } from 'lucide-react';
import { Fragment, memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as T from '../../shared/api';
import type { View } from '../App';
import { api } from '../lib/api';
import { formatTime, useT, type MessageKey } from '../lib/i18n';
import { mediaUrl } from '../lib/media';
import { elapsed, frameEvery, hourTicks, laneRows, missionCards, missionStates, nights, placeLane, type MissionCard, type MissionState } from '../lib/mission';
import { projectLabel } from '../lib/projectName';
import { stepKinds, type StepKind } from '../lib/timeline';
import { useNow } from '../lib/useNow';
import { cn, humanBytes, timeAgo } from '../lib/utils';
import { PrChip } from './PrChip';
import { standIn } from './pip/standIn';
import { ToolMark } from './state';
import { kindIcon, kindTone } from './timeline/Timeline';
import { Skeleton } from './ui/skeleton';

export const missionKey = ['mission'];

const stateLabel: Record<MissionState, MessageKey> = {
  asking: 'mission.state.asking',
  testing: 'mission.state.testing',
  working: 'mission.state.working',
  frozen: 'mission.state.frozen',
  pr: 'mission.state.pr',
  idle: 'mission.state.idle',
  stopped: 'mission.state.stopped',
};

const stateTone: Record<MissionState, string> = {
  asking: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
  testing: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  working: 'bg-brand-500/15 text-brand-300 ring-brand-400/30',
  frozen: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',
  pr: 'bg-violet-400/15 text-violet-300 ring-violet-400/30',
  idle: 'bg-surface-raised text-muted ring-line',
  stopped: 'bg-surface-raised text-subtle ring-line',
};

const stateDot: Record<MissionState, string> = {
  asking: 'bg-amber-400',
  testing: 'bg-emerald-400 animate-pulse',
  working: 'bg-brand-400 animate-pulse',
  frozen: 'bg-sky-400',
  pr: 'bg-violet-400',
  idle: 'bg-faint',
  stopped: 'bg-faint',
};

const kindLabel = (kind: string): MessageKey => `timeline.kind.${stepKinds.includes(kind as StepKind) ? kind : 'run'}` as MessageKey;
const kindOf = (kind: string): StepKind => (stepKinds.includes(kind as StepKind) ? (kind as StepKind) : 'run');

export function MissionControl({ onSelect }: { onSelect: (view: View) => void }) {
  const t = useT();
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents });
  const mission = useQuery({ queryKey: missionKey, queryFn: api.mission, refetchInterval: 10_000, placeholderData: keepPreviousData });
  const memory = useQuery({ queryKey: ['memoryUsage'], queryFn: api.memoryUsage, refetchInterval: 5_000 });
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const now = useNow(15_000);
  const [filter, setFilter] = useState<MissionState | ''>('');

  const cards = useMemo(() => missionCards(agents.data ?? [], mission.data), [agents.data, mission.data]);
  const counts = useMemo(() => {
    const out: Partial<Record<MissionState, number>> = {};
    for (const c of cards) out[c.state] = (out[c.state] ?? 0) + 1;
    return out;
  }, [cards]);
  const shown = filter ? cards.filter((c) => c.state === filter) : cards;
  const rows = useMemo(() => laneRows(agents.data ?? [], mission.data), [agents.data, mission.data]);
  const memoryOf = useMemo(() => new Map((memory.data?.agents ?? []).map((a) => [a.ref, a.memory])), [memory.data]);
  const label = (project: string) => projectLabel(project, projects.data);
  const open = (ref: string) => onSelect({ kind: 'agent', ref, tab: 'chat' });
  const loading = agents.isPending || mission.isPending;

  return (
    <div className="h-full overflow-y-auto" data-mission>
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-7">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-title">{t('mission.title')}</h1>
            <p className="mt-1 text-sm text-muted">{t('mission.description')}</p>
          </div>
        </div>

        <div role="tablist" aria-label={t('mission.filters')} className="mb-4 flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface-faint p-0.5 text-[12.5px]" data-mission-filters>
          {(['', ...missionStates.filter((s) => s !== 'stopped')] as const).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              role="tab"
              aria-selected={filter === s}
              onClick={() => setFilter(s)}
              className={cn('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 font-medium transition', filter === s ? 'bg-surface-strong text-title' : 'text-subtle hover:text-primary')}
              data-mission-filter={s || 'all'}
            >
              {s && <span className={cn('size-1.5 rounded-full', stateDot[s])} />}
              {s ? t(stateLabel[s]) : t('mission.filter.all')}
              <span className="tabular-nums text-subtle">{s ? (counts[s] ?? 0) : cards.length}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-subtle" data-mission-empty>
            {filter ? t('mission.emptyFilter') : t('mission.empty')}
          </p>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]" data-mission-grid>
            {shown.map((c) => (
              <AgentCard key={c.agent.ref} card={c} project={label(c.agent.project)} memory={memoryOf.get(c.agent.ref)} now={now} onOpen={open} />
            ))}
          </div>
        )}

        <section className="mt-8" data-mission-day>
          <div className="mb-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-title">{t('mission.day')}</h2>
              <p className="text-[12px] text-subtle">{t('mission.dayHint')}</p>
            </div>
            <Legend />
          </div>
          {mission.data && rows.length > 0 ? (
            <Swimlanes mission={mission.data} rows={rows} label={label} onOpen={open} />
          ) : (
            !loading && <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">{t('mission.noLanes')}</p>
          )}
        </section>
      </div>
    </div>
  );
}

// AgentCard is one agent: its desktop, its state, what it is doing and for
// how long, and its memory. Clicking anywhere on it opens the agent.
const AgentCard = memo(function AgentCard({ card, project, memory, now, onOpen }: { card: MissionCard; project: string; memory?: number; now: number; onOpen: (ref: string) => void }) {
  const t = useT();
  const { agent, line, state } = card;
  const step = line?.step;
  const Icon = step ? kindIcon[kindOf(step.kind)] : null;
  const busy = state === 'working' || state === 'testing';
  const name = agent.title || agent.name;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(agent.ref)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(agent.ref);
        }
      }}
      aria-label={t('mission.open', { name })}
      className={cn(
        'group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface-faint text-left transition hover:border-line-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        state === 'asking' ? 'border-amber-400/50' : 'border-line',
      )}
      data-mission-card={agent.ref}
      data-mission-state={state}
    >
      <Thumb card={card} />
      <div className="grid min-w-0 gap-1.5 p-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold leading-4 ring-1 ring-inset', stateTone[state])} data-mission-pill>
            <span className={cn('size-1.5 rounded-full', stateDot[state])} />
            {t(stateLabel[state])}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-title" title={name}>
            {name}
          </span>
          {line?.pr && <PrChip pr={line.pr} dataAttr="data-mission-pr" />}
        </div>
        <div className="flex min-w-0 items-center gap-1 text-[11px] text-subtle">
          <ToolMark ai={agent.ai} className="size-3.5" />
          <span className="truncate">{project}</span>
          <span className="shrink-0 font-mono text-faint">· {agent.name}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-secondary" title={step?.title} data-mission-step>
          {Icon && step ? (
            <>
              <span className={cn('flex size-4 shrink-0 items-center justify-center rounded', kindTone[kindOf(step.kind)])}>
                <Icon className="size-2.5 text-black" />
              </span>
              <span className={cn('min-w-0 flex-1 truncate', step.status === 'failed' && 'text-rose-400')}>{step.title || t(kindLabel(step.kind))}</span>
              <span className="shrink-0 tabular-nums text-subtle">{busy ? t('mission.stepFor', { time: elapsed(step.start, now) }) : timeAgo(step.end, now)}</span>
            </>
          ) : (
            <span className="truncate text-subtle">{t('mission.noStep')}</span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-3 text-[11px] tabular-nums text-subtle">
          {line?.taskAt && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate" title={line.task}>
              <Clock className="size-3 shrink-0" />
              {t('mission.onTask', { time: elapsed(line.taskAt, now) })}
            </span>
          )}
          {memory !== undefined && memory > 0 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1" title={t('mission.memory')} data-mission-memory>
              <MemoryStick className="size-3" />
              {humanBytes(memory)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// useOnScreen is whether el is on screen and the window shown: a card off
// screen takes no stills.
function useOnScreen<E extends Element>(): [React.RefObject<E | null>, boolean] {
  const ref = useRef<E>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const shown = useSyncExternalStore(
    (l) => {
      document.addEventListener('visibilitychange', l);
      return () => document.removeEventListener('visibilitychange', l);
    },
    () => document.visibilityState !== 'hidden',
  );
  return [ref, visible && shown];
}

// Thumb is the card's desktop at 16:10: a still of its display taken again
// every frameEvery while it works; when it has no display up, the last
// screenshot it took; else its tool's mark.
function Thumb({ card }: { card: MissionCard }) {
  const t = useT();
  const { agent, line, state } = card;
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const every = agent.state === 'running' ? frameEvery(state) : null;
  const [bucket, setBucket] = useState(() => Date.now());
  const [noDisplay, setNoDisplay] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!every || !onScreen) return;
    setBucket(Date.now());
    const id = setInterval(() => setBucket(Date.now()), every);
    return () => clearInterval(id);
  }, [every, onScreen]);
  // A display that wasn't up may be by the next poll of a working agent.
  useEffect(() => {
    if (noDisplay && every) {
      const id = setTimeout(() => setNoDisplay(false), Math.max(every, 30_000));
      return () => clearTimeout(id);
    }
  }, [noDisplay, every]);
  const live = !!every && !noDisplay && onScreen;
  const shot = line?.frame;
  return (
    <div ref={ref} className="relative aspect-[16/10] w-full overflow-hidden border-b border-line bg-stage" data-mission-thumb>
      {standIn && every ? (
        <div className="pointer-events-none absolute inset-0">{standIn(agent)}</div>
      ) : (
        <>
          {shot && (!live || !loaded) && <img src={mediaUrl(shot)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover object-top" />}
          {live && (
            <img
              src={api.agentFrameUrl(agent.ref, 480, bucket)}
              alt=""
              className={cn('absolute inset-0 size-full object-cover object-top', !loaded && 'opacity-0')}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setNoDisplay(true);
                setLoaded(false);
              }}
            />
          )}
          {!shot && !(live && loaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11px] text-subtle">
              <ToolMark ai={agent.ai} className="size-7 opacity-70" />
            </div>
          )}
        </>
      )}
      {(standIn ? !!every : live && loaded) ? (
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-rose-500/90 px-1 text-[9px] font-bold tracking-wider text-white">{t('panel.live')}</span>
      ) : (
        shot && (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-px text-[10px] text-white">
            <Monitor className="size-2.5" />
            {t('desk.lastFrame', { ago: timeAgo(shot.createdAt) })}
          </span>
        )
      )}
    </div>
  );
}

function Legend() {
  const t = useT();
  return (
    <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-subtle" data-mission-legend>
      {stepKinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className={cn('size-2 rounded-sm', kindTone[k])} />
          {t(kindLabel(k))}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-sm bg-rose-500" />
        {t('mission.failed')}
      </span>
      <span className="inline-flex items-center gap-1">
        <Moon className="size-2.5" />
        {t('mission.night')}
      </span>
    </div>
  );
}

// Swimlanes is the last day, a lane per agent: hours across, the night
// shaded, and a segment for each stretch of one kind of work.
function Swimlanes({ mission, rows, label, onOpen }: { mission: T.Mission; rows: { agent: T.Agent; line: T.MissionAgent }[]; label: (project: string) => string; onOpen: (ref: string) => void }) {
  const ticks = useMemo(() => hourTicks(mission.since, mission.now, 3), [mission.since, mission.now]);
  const dark = useMemo(() => nights(mission.since, mission.now), [mission.since, mission.now]);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-faint" data-mission-lanes>
      <div className="flex h-6 items-end border-b border-line-faint">
        <div className="w-52 shrink-0" />
        <div className="relative mr-3 h-full flex-1">
          {dark.map((n) => (
            <Moon key={n.left} className="absolute bottom-1.5 size-2.5 text-indigo-300/80" style={{ left: `calc(${(n.left + n.width / 2) * 100}% - 5px)` }} />
          ))}
          {ticks.map((tk) => (
            <span key={tk.at} className={cn('absolute bottom-1 text-[10px] tabular-nums text-subtle', tk.left > 0.96 ? '-translate-x-full' : '-translate-x-1/2')} style={{ left: `${tk.left * 100}%` }}>
              {formatTime(tk.label, { hour: 'numeric' })}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        {/* The night and the hours, under every lane at once. */}
        <div className="pointer-events-none absolute inset-y-0 left-52 right-3">
          {dark.map((n) => (
            <div key={n.left} className="absolute inset-y-0 bg-indigo-400/[0.12]" style={{ left: `${n.left * 100}%`, width: `${n.width * 100}%` }} />
          ))}
          {ticks.map((tk) => (
            <div key={tk.at} className="absolute inset-y-0 w-px bg-line-faint" style={{ left: `${tk.left * 100}%` }} />
          ))}
          <div className="absolute inset-y-0 right-0 w-px bg-brand-400/70" />
        </div>
        {rows.map((r, i) => (
          <Fragment key={r.agent.ref}>
            {r.agent.project !== rows[i - 1]?.agent.project && (
              <div className={cn('flex h-6 items-end px-3 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-subtle', i > 0 && 'border-t border-line-faint')} data-mission-lane-project={r.agent.project}>
                <span className="w-48 truncate">{label(r.agent.project)}</span>
              </div>
            )}
            <Lane agent={r.agent} line={r.line} since={mission.since} now={mission.now} onOpen={onOpen} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

const Lane = memo(function Lane({ agent, line, since, now, onOpen }: { agent: T.Agent; line: T.MissionAgent; since: string; now: string; onOpen: (ref: string) => void }) {
  const t = useT();
  const placed = useMemo(() => placeLane(line.lane, since, now), [line.lane, since, now]);
  const name = agent.title || agent.name;
  const hhmm = (iso: string) => formatTime(iso, { hour: '2-digit', minute: '2-digit' });
  return (
    <button type="button" onClick={() => onOpen(agent.ref)} className="group flex h-7 w-full items-center text-left hover:bg-surface-raised/60" aria-label={t('mission.open', { name })} data-mission-lane={agent.ref}>
      <span className="flex w-52 shrink-0 items-center gap-1.5 px-3 text-[11.5px]">
        <ToolMark ai={agent.ai} className="size-3.5" />
        <span className="min-w-0 truncate text-secondary group-hover:text-title" title={name}>
          {name}
        </span>
      </span>
      <span className="relative mr-3 h-3.5 flex-1">
        {placed.map((p, i) => {
          const kind = kindOf(p.seg.kind);
          return (
            <span
              key={`${i}:${p.seg.start}`}
              className={cn(
                'absolute inset-y-0 min-w-[2px] rounded-[2px]',
                p.seg.status === 'failed' ? 'bg-rose-500' : kindTone[kind],
                kind === 'task' && 'inset-y-[-2px] w-[2px] bg-title',
                p.seg.status === 'running' && 'animate-pulse',
              )}
              style={{ left: `${p.left * 100}%`, width: `${p.width * 100}%` }}
              title={`${t(kindLabel(kind))} · ${hhmm(p.seg.start)}–${hhmm(p.seg.end)} · ${t('mission.steps', { n: p.seg.steps })}`}
            />
          );
        })}
      </span>
    </button>
  );
});
