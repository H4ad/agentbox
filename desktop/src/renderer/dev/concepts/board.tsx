// Concept B, by state: agents sorted by where they stand (needs you, ready
// to review, working, done) across every project, as the sidebar and as the
// board in the middle. The leads sit in a dock on the right, one tab per
// project, always a glance away from the agents they run.
import { ChevronDown, Crown, LayoutGrid, Menu, MessageSquare, Play, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { byStage, leadLines, type MockAgent, projects, type Stage, stageLabel } from './data';
import { Avatar, Btn, Checks, Composer, ConceptTag, Conversation, Dot, Kbd, ProjectMark, ProjectTag, SectionHead, stageText, Time } from './kit';

const columns: Stage[] = ['needs', 'review', 'working', 'done'];

function SideRow({ a }: { a: MockAgent }) {
  return (
    <div className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-surface">
      <Dot stage={a.stage} pulse />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-primary">{a.title}</span>
      <ProjectTag name={a.project} className="max-w-[4.5rem]" />
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-rail max-lg:hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <LayoutGrid className="size-4 text-brand-300" />
        <span className="text-[14px] font-semibold text-title">Agents</span>
        <Search className="ml-auto size-4 text-subtle" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {(['needs', 'review', 'working', 'stopped', 'done'] as Stage[]).map((s) => (
          <div key={s}>
            <SectionHead count={byStage(s).length} className={stageText[s]}>
              {stageLabel[s]}
            </SectionHead>
            {byStage(s).map((a) => <SideRow key={a.project + a.name} a={a} />)}
          </div>
        ))}
        <SectionHead>Leads</SectionHead>
        {projects.map((p) => (
          <div key={p.name} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-surface">
            <ProjectMark name={p.name} className="size-4 rounded text-[9px]" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-primary">{p.display}</span>
            {p.lead.unread > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[10px] text-white">{p.lead.unread}</span>}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Card({ a }: { a: MockAgent }) {
  return (
    <div className="grid min-w-0 cursor-pointer gap-1.5 rounded-xl border border-line bg-surface-faint p-3 shadow-sm hover:border-line-strong">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar a={a} className="size-6" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-title">{a.title}</span>
        <Time mins={a.mins} />
      </div>
      <p className="line-clamp-2 text-[12px] leading-snug text-tertiary">{a.note}</p>
      <div className="flex min-w-0 items-center gap-2">
        <ProjectTag name={a.project} />
        {a.pr && <Checks pr={a.pr} />}
        {a.stage === 'needs' && <Btn tone="solid" className="ml-auto py-0.5">Answer</Btn>}
        {a.stage === 'review' && <Btn tone="solid" className="ml-auto py-0.5">Review</Btn>}
        {a.stage === 'working' && a.cpu !== undefined && <span className="ml-auto text-[10.5px] tabular-nums text-faint">CPU {a.cpu}%</span>}
      </div>
    </div>
  );
}

function Board() {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-ink">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line-faint px-4">
        <Menu className="size-4 text-subtle lg:hidden" />
        <span className="text-[13.5px] font-semibold text-title">All projects</span>
        <ChevronDown className="size-3.5 text-subtle" />
        <span className="ml-3 hidden gap-1 md:flex">
          {projects.map((p) => (
            <span key={p.name} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-tertiary">
              {p.display}
            </span>
          ))}
        </span>
        <Btn tone="brand" className="ml-auto">+ New agent</Btn>
      </header>
      <div className="grid min-h-0 flex-1 auto-cols-[minmax(190px,1fr)] grid-flow-col gap-3 overflow-x-auto p-4">
        {columns.map((s) => (
          <section key={s} className="flex min-h-0 min-w-0 flex-col rounded-2xl bg-sunken/60 p-2">
            <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
              <Dot stage={s} />
              <span className={cn('whitespace-nowrap text-[12px] font-semibold', stageText[s])}>{stageLabel[s]}</span>
              <span className="text-[11px] text-faint">{byStage(s).length}</span>
              {s === 'review' && (
                <Btn tone="ghost" className="ml-auto py-0">
                  <Play className="size-3" /> Review all <Kbd>⇧R</Kbd>
                </Btn>
              )}
            </div>
            <div className="grid min-h-0 content-start gap-2 overflow-y-auto">
              {byStage(s).map((a) => <Card key={a.project + a.name} a={a} />)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function LeadDock() {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-line bg-chat max-xl:hidden">
      <div className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-line-faint px-2">
        <Crown className="mx-1 size-3.5 shrink-0 text-amber-300" />
        {projects.map((p, i) => (
          <span key={p.name} className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px]', i === 0 ? 'bg-surface-strong text-title' : 'text-subtle')}>
            <ProjectMark name={p.name} className="size-4 rounded text-[9px]" />
            {p.display}
            {p.lead.unread > 0 && <span className="size-1.5 rounded-full bg-brand-400" />}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Conversation lines={leadLines('agentbox')} />
      </div>
      <Composer placeholder="Ask the AgentBox lead…" className="px-3" />
    </aside>
  );
}

// NarrowDock is the dock folded to a bar at the foot, where the lead stays
// reachable on a small window.
function NarrowDock() {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-line bg-chat px-3 py-2 xl:hidden">
      <MessageSquare className="size-4 text-brand-300" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-secondary">AgentBox lead: agent-12 opened #318. Merge once CI is green?</span>
      <span className="rounded-full bg-brand-500 px-1.5 text-[10px] text-white">2</span>
    </div>
  );
}

export function BoardConcept() {
  return (
    <div className="flex h-screen min-w-0 bg-ink text-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <Board />
          <LeadDock />
        </div>
        <NarrowDock />
      </div>
      <ConceptTag letter="B" name="By state" />
    </div>
  );
}
