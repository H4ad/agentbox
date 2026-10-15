// Concept A, the inbox: one list of threads across every project, the
// leads' chats among them, sorted by what wants the user. A project is a
// filter chip and a tag on the row, not a place. The open thread fills the
// middle; a finished agent's thread opens on its review.
import { ArrowLeft, Crown, Filter, Inbox, Search, Settings, SquarePen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { agentLines, agents, byStage, type MockAgent, projects } from './data';
import { Avatar, Btn, Checks, Composer, ConceptTag, Conversation, Dot, Kbd, ProjectMark, ProjectTag, ReviewPanel, SectionHead, Time } from './kit';

const open = agents.find((a) => a.name === 'agent-12')!;

function Row({ a, active }: { a: MockAgent; active?: boolean }) {
  return (
    <div className={cn('group flex min-w-0 cursor-pointer gap-2.5 rounded-lg px-2.5 py-2', active ? 'bg-surface-strong' : 'hover:bg-surface')}>
      <Avatar a={a} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {a.unseen && <span className="size-1.5 shrink-0 rounded-full bg-brand-400" />}
          <span className={cn('min-w-0 truncate text-[13px]', a.unseen || a.stage === 'needs' ? 'font-semibold text-title' : 'text-primary')}>{a.title}</span>
          <Time mins={a.mins} className="ml-auto" />
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <ProjectTag name={a.project} />
          <span className="min-w-0 truncate text-[12px] text-subtle">{a.note}</span>
        </div>
      </div>
    </div>
  );
}

function LeadRow({ name }: { name: string }) {
  const p = projects.find((x) => x.name === name)!;
  return (
    <div className="flex min-w-0 cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface">
      <ProjectMark name={name} className="size-7 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {p.lead.unread > 0 && <span className="size-1.5 shrink-0 rounded-full bg-brand-400" />}
          <span className={cn('min-w-0 truncate text-[13px]', p.lead.unread ? 'font-semibold text-title' : 'text-primary')}>{p.display}</span>
          <span className="inline-flex items-center gap-0.5 rounded bg-surface-raised px-1 text-[10px] text-subtle">
            <Crown className="size-2.5" /> lead
          </span>
          <Time mins={p.lead.mins} className="ml-auto" />
        </div>
        <p className="mt-0.5 truncate text-[12px] text-subtle">{p.lead.last}</p>
      </div>
    </div>
  );
}

function List({ full }: { full?: boolean }) {
  return (
    <aside className={cn('flex min-h-0 flex-col border-r border-line bg-rail', full ? 'w-full' : 'w-[340px] shrink-0 max-lg:hidden')}>
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Inbox className="size-4 text-brand-300" />
        <span className="text-[14px] font-semibold text-title">Inbox</span>
        <span className="rounded-full bg-brand-500/20 px-1.5 text-[10.5px] font-medium text-brand-200">5</span>
        <span className="ml-auto flex items-center gap-1 text-subtle">
          <Search className="size-4" />
          <SquarePen className="ml-2 size-4" />
          <Settings className="ml-2 size-4" />
        </span>
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto px-3 pb-2">
        <span className="rounded-full bg-inverted px-2.5 py-0.5 text-[11.5px] font-medium text-on-inverted">All</span>
        {projects.map((p) => (
          <span key={p.name} className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-tertiary">
            {p.display}
          </span>
        ))}
        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-subtle">
          <Filter className="size-3.5" />
        </span>
      </div>
      <div className="flex shrink-0 gap-3 border-b border-line-faint px-4 text-[12px]">
        <span className="border-b-2 border-brand-400 pb-1.5 font-medium text-title">For you</span>
        <span className="pb-1.5 text-subtle">Running 6</span>
        <span className="pb-1.5 text-subtle">Everything</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        <SectionHead count={3}>Needs you</SectionHead>
        {byStage('needs').map((a) => <Row key={a.project + a.name} a={a} />)}
        <SectionHead count={3} right={<Btn tone="ghost" className="py-0">Review all <Kbd>⇧R</Kbd></Btn>}>To review</SectionHead>
        {byStage('review').map((a) => <Row key={a.project + a.name} a={a} active={a === open} />)}
        <SectionHead count={2}>Leads with news</SectionHead>
        <LeadRow name="agentbox" />
        <LeadRow name="organic" />
        <SectionHead count={6}>Running</SectionHead>
        {byStage('working').map((a) => <Row key={a.project + a.name} a={a} />)}
      </div>
    </aside>
  );
}

export function InboxConcept({ narrow }: { narrow?: boolean }) {
  return (
    <div className="flex h-screen min-w-0 bg-ink text-primary">
      <List full={narrow} />
      {!narrow && (
        <main className="flex min-w-0 flex-1 flex-col bg-chat">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line-faint px-4">
            <ArrowLeft className="size-4 text-subtle lg:hidden" />
            <Dot stage={open.stage} />
            <span className="min-w-0 truncate text-[13.5px] font-semibold text-title">{open.title}</span>
            <ProjectTag name={open.project} />
            <span className="hidden truncate font-mono text-[11px] text-subtle md:inline">{open.branch}</span>
            {open.pr && <Checks pr={open.pr} />}
            <span className="ml-auto hidden items-center gap-1 text-[11.5px] text-subtle md:flex">
              started by <ProjectMark name={open.project} className="size-4 text-[9px]" /> the lead
            </span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] px-5 pt-5">
              <ReviewPanel a={open} of="1 of 3 to review" />
            </div>
            <Conversation lines={agentLines(open)} />
          </div>
          <Composer placeholder="Reply to agent-12, or @lead…" />
        </main>
      )}
      <ConceptTag letter="A" name="Inbox" />
    </div>
  );
}
