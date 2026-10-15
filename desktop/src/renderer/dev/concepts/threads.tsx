// Concept D, T3Code's threads: one project at a time, picked from a
// switcher at the top (grouped by where it runs, or All projects), and its
// threads in Pinned, Active, Snoozed and Settled. The lead's chat is a
// thread, pinned by default; each agent is a thread. Reviewing is settling:
// a finished thread shows its review above the composer, and Reviewed or
// Merge settles it. Snooze hides a thread until a time, or until it asks.
import { AlarmClock, Archive, Check, ChevronDown, ChevronRight, Crown, Menu, Monitor, Pin, Server, SquarePen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { agentLines, agents, type MockAgent, ofProject, project, projects } from './data';
import { Avatar, Btn, Checks, Composer, ConceptTag, Conversation, Dot, Kbd, ProjectMark, ReviewPanel, SectionHead, Time } from './kit';

const here = 'agentbox';
const openThread = agents.find((a) => a.name === 'agent-12')!;
const status: Record<MockAgent['stage'], [string, string]> = {
  needs: ['Needs input', 'bg-amber-400/15 text-amber-300'],
  review: ['Ready', 'bg-sky-400/15 text-sky-300'],
  working: ['Working', 'bg-emerald-400/15 text-emerald-300'],
  done: ['Settled', 'bg-surface-raised text-subtle'],
  stopped: ['Snoozed', 'bg-surface-raised text-subtle'],
};

function Thread({ a, active }: { a: MockAgent; active?: boolean }) {
  const [label, tone] = status[a.stage];
  return (
    <div className={cn('group flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5', active ? 'bg-surface-strong' : 'hover:bg-surface')}>
      <Dot stage={a.stage} pulse />
      <span className={cn('min-w-0 flex-1 truncate text-[12.5px]', a.stage === 'done' || a.stage === 'stopped' ? 'text-subtle' : a.unseen ? 'font-semibold text-title' : 'text-primary')}>{a.title}</span>
      {a.stage !== 'done' && a.stage !== 'stopped' && <span className={cn('shrink-0 rounded px-1 text-[10px] font-medium', tone)}>{label}</span>}
      {a.pr && a.stage === 'review' && <Checks pr={a.pr} />}
      <Time mins={a.mins} className="group-hover:hidden" />
      <span className="hidden gap-1 text-subtle group-hover:flex">
        <AlarmClock className="size-3.5" />
        <Archive className="size-3.5" />
      </span>
    </div>
  );
}

function LeadThread() {
  const p = project(here);
  return (
    <div className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
      <Crown className="size-3.5 shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-title">Lead</span>
      <span className="shrink-0 rounded-full bg-brand-500 px-1.5 text-[10px] text-white">{p.lead.unread}</span>
      <Time mins={p.lead.mins} />
    </div>
  );
}

function Switcher({ openMenu }: { openMenu?: boolean }) {
  const p = project(here);
  return (
    <div className="relative px-2 pb-2">
      <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-faint px-2 py-1.5">
        <ProjectMark name={here} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-title">{p.display}</div>
          <div className="flex items-center gap-1 text-[10.5px] text-subtle"><Monitor className="size-3" /> {p.env}</div>
        </div>
        <Kbd>⌘P</Kbd>
        <ChevronDown className="size-3.5 text-subtle" />
      </div>
      {openMenu && (
        <div className="absolute inset-x-2 top-full z-20 mt-1 grid gap-0.5 rounded-xl border border-line bg-modal p-1.5 shadow-2xl">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-primary hover:bg-surface">All projects <span className="ml-auto text-[11px] text-subtle">5 need you</span></div>
          {['Local VM', 'Hetzner box'].map((env) => (
            <div key={env}>
              <div className="flex items-center gap-1 px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {env === 'Local VM' ? <Monitor className="size-3" /> : <Server className="size-3" />} {env}
              </div>
              {projects.filter((x) => x.env === env).map((x) => {
                const asks = ofProject(x.name).filter((a) => a.stage === 'needs' || a.stage === 'review').length;
                return (
                  <div key={x.name} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]', x.name === here ? 'bg-surface-strong text-title' : 'text-primary hover:bg-surface')}>
                    <ProjectMark name={x.name} className="size-4 rounded text-[9px]" /> {x.display}
                    {asks > 0 && <span className="ml-auto rounded-full bg-surface-raised px-1.5 text-[10px] text-secondary">{asks}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ openMenu }: { openMenu?: boolean }) {
  const mine = ofProject(here);
  const pinned = mine.filter((a) => a.pinned);
  const active = mine.filter((a) => !a.pinned && (a.stage === 'needs' || a.stage === 'review' || a.stage === 'working')).sort((a, b) => a.mins - b.mins);
  const snoozed = mine.filter((a) => a.snoozed);
  const settled = mine.filter((a) => a.stage === 'done');
  return (
    <aside className="flex w-[290px] shrink-0 flex-col border-r border-line bg-rail max-lg:hidden">
      <div className="flex h-11 shrink-0 items-center gap-2 px-3">
        <span className="text-[13px] font-semibold tracking-tight text-title">AgentBox</span>
        <SquarePen className="ml-auto size-4 text-subtle" />
      </div>
      <Switcher openMenu={openMenu} />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        <SectionHead count={pinned.length + 1}><span className="inline-flex items-center gap-1"><Pin className="size-3" /> Pinned</span></SectionHead>
        <LeadThread />
        {pinned.map((a) => <Thread key={a.name} a={a} active={a === openThread} />)}
        <SectionHead count={active.length}>Active</SectionHead>
        {active.map((a) => <Thread key={a.name} a={a} />)}
        <SectionHead count={snoozed.length} right={<ChevronRight className="size-3 text-subtle" />}>
          <span className="inline-flex items-center gap-1"><AlarmClock className="size-3" /> Snoozed</span>
        </SectionHead>
        <div className="px-2.5 text-[11px] text-faint">agent-93 until {snoozed[0]?.snoozed} · wakes early if it asks</div>
        <SectionHead count={settled.length} right={<ChevronDown className="size-3 text-subtle" />}>
          <span className="inline-flex items-center gap-1"><Check className="size-3" /> Settled</span>
        </SectionHead>
        {settled.map((a) => <Thread key={a.name} a={a} />)}
      </div>
    </aside>
  );
}

export function ThreadsConcept({ openMenu }: { openMenu?: boolean }) {
  const a = openThread;
  return (
    <div className="flex h-screen min-w-0 bg-ink text-primary">
      <Sidebar openMenu={openMenu} />
      <main className="flex min-w-0 flex-1 flex-col bg-chat">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line-faint px-4">
          <Menu className="size-4 text-subtle lg:hidden" />
          <ProjectMark name={here} className="size-4 rounded text-[9px] lg:hidden" />
          <Avatar a={a} className="size-5" />
          <span className="min-w-0 truncate text-[13px] font-semibold text-title">{a.title}</span>
          <span className="hidden truncate font-mono text-[11px] text-subtle md:inline">{a.branch}</span>
          <span className="ml-auto flex items-center gap-1">
            <Btn tone="ghost"><AlarmClock className="size-3" /> Snooze</Btn>
            <Btn tone="ghost"><Pin className="size-3" /> Pinned</Btn>
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Conversation lines={agentLines(a)} />
        </div>
        <div className="mx-auto w-full max-w-[720px] px-4 pb-2">
          <ReviewPanel a={a} of="Turn finished · 3 ready in AgentBox" compact />
          <div className="mt-1.5 flex items-center gap-2 px-1 text-[11px] text-faint">
            Reviewed or Merge settles the thread <Kbd>E</Kbd> · Space opens the slides full size
          </div>
        </div>
        <Composer placeholder="Reply to agent-12…" />
      </main>
      <ConceptTag letter="D" name="Threads (T3Code)" />
    </div>
  );
}
