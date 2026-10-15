// Concept C, the command centre: no project list. A slim rail of places
// (Home, Review, Media, Settings) and project marks; Home is every project
// as a card with its lead's last word, a reply box and its agents' faces,
// what needs the user across all of them on top, and live activity beside.
// A card opens the project as today (its lead's chat with its agents).
import { Activity, ArrowRight, CheckCheck, Home, Image, KeyRound, MessageCircleQuestion, Play, Plus, Settings, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { agents, byStage, type MockAgent, ofProject, project, projects } from './data';
import { Avatar, Btn, Checks, ConceptTag, Dot, Kbd, ProjectMark, ProjectTag, ReviewPanel, SectionHead, Time } from './kit';

function Rail() {
  const place = (Icon: typeof Home, label: string, active?: boolean, badge?: number) => (
    <span title={label} className={cn('relative flex size-10 items-center justify-center rounded-xl', active ? 'bg-surface-strong text-title' : 'text-subtle hover:bg-surface')}>
      <Icon className="size-[18px]" />
      {badge !== undefined && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-500 px-1 text-[9.5px] font-semibold text-white">{badge}</span>}
    </span>
  );
  return (
    <nav className="flex w-[60px] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-rail py-3 max-md:hidden">
      {place(Home, 'Home', true)}
      {place(CheckCheck, 'Review', false, 3)}
      {place(Image, 'Media')}
      <span className="my-1.5 h-px w-7 bg-line" />
      {projects.map((p) => (
        <span key={p.name} className="relative">
          <ProjectMark name={p.name} className="size-9 rounded-xl text-[13px]" />
          {ofProject(p.name).some((a) => a.stage === 'working') && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-rail bg-emerald-400" />}
        </span>
      ))}
      <span className="flex size-9 items-center justify-center rounded-xl border border-dashed border-line text-subtle">
        <Plus className="size-4" />
      </span>
      <span className="mt-auto">{place(Settings, 'Settings')}</span>
    </nav>
  );
}

function Needs({ a }: { a: MockAgent }) {
  const secret = a.note.includes('secret') || a.note.includes('account');
  return (
    <div className="flex w-[300px] shrink-0 flex-col gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar a={a} className="size-6" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-title">{a.title}</span>
        <ProjectTag name={a.project} />
      </div>
      <p className="line-clamp-2 flex min-w-0 gap-1.5 text-[12px] text-secondary">
        {secret ? <KeyRound className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> : <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0 text-amber-300" />}
        {a.note}
      </p>
      <div className="mt-auto flex gap-1.5">
        {secret ? <Btn tone="brand">Provide</Btn> : <><Btn tone="solid">Paginate</Btn><Btn tone="solid">Load all</Btn></>}
        <Btn tone="ghost" className="ml-auto">Open</Btn>
      </div>
    </div>
  );
}

function ProjectCard({ name }: { name: string }) {
  const p = project(name);
  const mine = ofProject(name);
  const count = (s: MockAgent['stage']) => mine.filter((a) => a.stage === s).length;
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface-faint p-4 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <ProjectMark name={name} className="size-8 rounded-lg text-[13px]" />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-title">{p.display}</div>
          <div className="text-[11px] text-subtle">{p.env} · main</div>
        </div>
        <span className="ml-auto flex shrink-0 gap-2 text-[11px]">
          {count('needs') > 0 && <span className="text-amber-300">{count('needs')} need you</span>}
          {count('review') > 0 && <span className="text-sky-300">{count('review')} to review</span>}
          {count('working') > 0 && <span className="text-emerald-300">{count('working')} working</span>}
        </span>
      </div>
      <div className="flex min-w-0 gap-2 rounded-xl bg-chat p-2.5">
        <Sparkles className={cn('mt-0.5 size-3.5 shrink-0', p.lead.working ? 'animate-pulse text-brand-300' : 'text-subtle')} />
        <p className="line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-snug text-secondary">{p.lead.last}</p>
        <Time mins={p.lead.mins} />
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-faint">
        Tell the {p.display} lead…
        <Kbd>↵</Kbd>
      </div>
      <div className="flex min-w-0 items-center gap-1">
        {mine.map((a) => (
          <span key={a.name} className="relative" title={a.title}>
            <Avatar a={a} className="size-6" />
            <span className="absolute -bottom-0.5 -right-0.5"><Dot stage={a.stage} /></span>
          </span>
        ))}
        {mine.length === 0 && <span className="text-[12px] text-faint">No agents</span>}
        <Btn tone="ghost" className="ml-auto">Open <ArrowRight className="size-3" /></Btn>
      </div>
    </div>
  );
}

const feed: [string, string, number][] = [
  ['hatch', 'agent-5 edited src/editor/Toolbar.tsx', 0],
  ['organic', 'agent-15 ran the e2e checkout test: 2 of 5 passed', 0],
  ['agentbox', 'agent-96 took 14 screenshots', 1],
  ['hatch', 'The lead started agent-7 (Codex)', 1],
  ['agentbox', 'agent-98 asked: paginate or load all?', 4],
  ['agentbox', 'agent-12 opened #318', 3],
  ['organic', 'agent-14 asked for STRIPE_SECRET_KEY', 12],
  ['hatch', 'agent-3 finished: Custom domains (#88)', 18],
  ['agentbox', 'agent-88 stalled for 22 min', 22],
  ['agentbox', '#309 merged', 95],
];

export function CommandConcept() {
  const review = byStage('review');
  const working = agents.filter((a) => a.stage === 'working').length;
  return (
    <div className="flex h-screen min-w-0 bg-ink text-primary">
      <Rail />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-5 px-6 py-6 max-md:px-4 max-md:pb-16">
          <header className="flex flex-wrap items-end gap-3">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-title">Good morning</h1>
              <p className="text-[13px] text-subtle">
                <span className="text-amber-300">3 need you</span> · <span className="text-sky-300">{review.length} to review</span> · <span className="text-emerald-300">{working} working</span> across {projects.length} projects
              </p>
            </div>
            <Btn tone="brand" className="ml-auto px-3 py-1.5">+ New agent</Btn>
          </header>
          <section>
            <SectionHead className="px-0 pt-0">Needs you</SectionHead>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {byStage('needs').map((a) => <Needs key={a.project + a.name} a={a} />)}
            </div>
          </section>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_320px]">
            <section className="min-w-0">
              <SectionHead className="px-0 pt-0">Projects</SectionHead>
              <div className="grid gap-3 lg:grid-cols-2">
                {projects.map((p) => <ProjectCard key={p.name} name={p.name} />)}
              </div>
            </section>
            <aside className="grid min-w-0 content-start gap-4">
              <section>
                <SectionHead className="px-0 pt-0" right={<Btn tone="solid" className="py-0.5"><Play className="size-3" /> Review all</Btn>}>
                  Ready to review
                </SectionHead>
                <ReviewPanel a={review[0]!} of={`1 of ${review.length}`} compact />
              </section>
              <section>
                <SectionHead className="px-0 pt-0"><span className="inline-flex items-center gap-1"><Activity className="size-3" /> Live</span></SectionHead>
                <div className="grid gap-0.5">
                  {feed.map(([p, text, mins], i) => (
                    <div key={i} className="flex min-w-0 items-center gap-2 py-1 text-[12px]">
                      <ProjectMark name={p} className="size-4 rounded text-[9px]" />
                      <span className="min-w-0 flex-1 truncate text-secondary">{text}</span>
                      <Time mins={mins} />
                    </div>
                  ))}
                </div>
              </section>
              <section className="flex flex-wrap gap-2">
                {review.slice(1).map((a) => (
                  <span key={a.name} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11.5px] text-tertiary">
                    <Avatar a={a} className="size-4" /> {a.title.slice(0, 22)}… {a.pr && <Checks pr={a.pr} />}
                  </span>
                ))}
              </section>
            </aside>
          </div>
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-line bg-rail py-2 md:hidden">
        {[Home, CheckCheck, Image, Settings].map((I, i) => <I key={i} className={cn('size-5', i === 0 ? 'text-title' : 'text-subtle')} />)}
      </nav>
      <ConceptTag letter="C" name="Command centre" />
    </div>
  );
}
