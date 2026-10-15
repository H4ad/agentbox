// What the navigation concepts share: avatars, status, a project's tag, a
// conversation and its composer, and the review panel (#295/#301) each
// concept puts somewhere different.
import { ArrowRight, Check, CircleDot, GitMerge, GitPullRequest, Paperclip, Send, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Mood } from '../../lib/agentStatus';
import { AgentCharacter, hasCharacter } from '../../components/AgentCharacter';
import { cn } from '../../lib/utils';
import { screen } from '../notifications';
import { ago, type Line, type MockAgent, project, type Stage } from './data';

const mood: Record<Stage, Mood> = { needs: 'asking', review: 'idle', working: 'working', done: 'idle', stopped: 'sleeping' };

export const stageTone: Record<Stage, string> = {
  needs: 'bg-amber-400',
  review: 'bg-sky-400',
  working: 'bg-emerald-400',
  done: 'bg-ghost',
  stopped: 'bg-ghost',
};

export const stageText: Record<Stage, string> = {
  needs: 'text-amber-300',
  review: 'text-sky-300',
  working: 'text-emerald-300',
  done: 'text-subtle',
  stopped: 'text-subtle',
};

export function Avatar({ a, className }: { a: MockAgent; className?: string }) {
  if (hasCharacter(a.ai)) return <AgentCharacter ai={a.ai} mood={mood[a.stage]} seed={a.name} className={cn('size-7 shrink-0', className)} />;
  return <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[11px] text-secondary', className)}>{a.ai[0]}</span>;
}

export function Dot({ stage, pulse }: { stage: Stage; pulse?: boolean }) {
  return <span className={cn('size-2 shrink-0 rounded-full', stageTone[stage], pulse && stage === 'working' && 'animate-pulse')} />;
}

export function ProjectTag({ name, className }: { name: string; className?: string }) {
  const p = project(name);
  return (
    <span
      className={cn('inline-flex max-w-[9rem] shrink-0 items-center gap-1 truncate rounded-md px-1.5 py-px text-[10.5px] font-medium', className)}
      style={{ background: `hsl(${p.hue} 70% 55% / 0.14)`, color: `hsl(${p.hue} 75% var(--concept-tag-l, 72%))` }}
    >
      {p.display}
    </span>
  );
}

export function ProjectMark({ name, className }: { name: string; className?: string }) {
  const p = project(name);
  return (
    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white', className)} style={{ background: `linear-gradient(135deg, hsl(${p.hue} 70% 58%), hsl(${p.hue + 30} 65% 45%))` }}>
      {p.display[0]!.toUpperCase()}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface px-1 font-mono text-[10px] text-subtle">{children}</kbd>;
}

export function Time({ mins, className }: { mins: number; className?: string }) {
  return <span className={cn('shrink-0 text-[11px] tabular-nums text-faint', className)}>{ago(mins)}</span>;
}

export function Checks({ pr }: { pr: NonNullable<MockAgent['pr']> }) {
  const tone = pr.checks === 'passing' ? 'text-emerald-300' : pr.checks === 'failing' ? 'text-rose-300' : 'text-amber-300';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', tone)}>
      <GitPullRequest className="size-3" />#{pr.number}
    </span>
  );
}

// Conversation draws a chat's lines; tool lines are one quiet row.
export function Conversation({ lines, ai = 'claude' }: { lines: Line[]; ai?: string }) {
  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-3 px-5 py-5">
      {lines.map((l, i) =>
        l.who === 'user' ? (
          <div key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-surface-strong px-3.5 py-2 text-[13px] text-primary">
            {l.text}
          </div>
        ) : l.who === 'tool' ? (
          <div key={i} className="flex items-center gap-2 text-[11.5px] text-subtle">
            <CircleDot className="size-3" /> <span className="truncate font-mono">{l.text}</span>
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

export function Composer({ placeholder = 'Message the lead…', className }: { placeholder?: string; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[720px] px-4 pb-4', className)}>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-composer px-3 py-2.5 shadow-sm">
        <Paperclip className="size-4 text-subtle" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-faint">{placeholder}</span>
        <span className="hidden text-[11px] text-faint sm:inline">Opus 5.5</span>
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-500 text-white">
          <Send className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

// ReviewPanel is the review walk (#295/#301) for one agent: its slide, the
// filmstrip, the pull request's actions and the keys. compact drops the
// slide to a strip, for concepts that review inline.
export function ReviewPanel({ a, of, compact, className }: { a: MockAgent; of?: string; compact?: boolean; className?: string }) {
  const dark = document.documentElement.dataset.appearance !== 'light';
  const p = project(a.project);
  const shots = ['sidebar-after', 'sidebar-before', 'walkthrough', 'pr'];
  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-faint', className)}>
      <div className="flex min-w-0 items-center gap-2 border-b border-line-faint px-3 py-2">
        <Avatar a={a} className="size-5" />
        <span className="min-w-0 truncate text-[12.5px] font-medium text-title">{a.title}</span>
        <ProjectTag name={a.project} />
        {of && <span className="ml-auto shrink-0 text-[11px] text-subtle">{of}</span>}
      </div>
      {!compact && <img src={screen(a.title, p.hue, dark)} alt="" className="aspect-[16/9] w-full bg-sunken object-cover" />}
      <div className="flex min-w-0 items-center gap-1.5 px-3 py-2">
        {shots.slice(0, compact ? 4 : 4).map((s, i) => (
          <img key={s} src={screen(s, p.hue + i * 20, dark)} alt="" className={cn('h-7 w-11 shrink-0 rounded border object-cover', i === 0 ? 'border-brand-400' : 'border-line opacity-70')} />
        ))}
        <span className="ml-1 text-[11px] text-subtle">1 of {a.media ?? 1}</span>
      </div>
      <p className="line-clamp-2 px-3 text-[12px] leading-relaxed text-tertiary">{a.note}</p>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-line-faint px-3 py-2">
        {a.pr && <Checks pr={a.pr} />}
        {a.pr && (
          <span className="text-[11px] tabular-nums">
            <span className="text-emerald-300">+{a.pr.additions}</span> <span className="text-rose-300">−{a.pr.deletions}</span>
          </span>
        )}
        <span className="ml-auto" />
        <Btn tone="ghost"><X className="size-3" /> Dismiss <Kbd>D</Kbd></Btn>
        <Btn tone="ghost"><Check className="size-3" /> Reviewed <Kbd>R</Kbd></Btn>
        {a.pr && <Btn tone={a.pr.checks === 'failing' ? 'off' : 'brand'}><GitMerge className="size-3" /> Merge <Kbd>M</Kbd></Btn>}
        <Btn tone="ghost">Next <ArrowRight className="size-3" /> <Kbd>N</Kbd></Btn>
      </div>
    </div>
  );
}

export function Btn({ children, tone = 'ghost', className }: { children: ReactNode; tone?: 'ghost' | 'brand' | 'off' | 'solid'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium',
        tone === 'ghost' && 'text-tertiary hover:bg-surface-strong hover:text-title',
        tone === 'solid' && 'bg-surface-strong text-primary hover:bg-surface-vivid',
        tone === 'brand' && 'bg-brand-500 text-white hover:bg-brand-400',
        tone === 'off' && 'cursor-not-allowed bg-surface text-faint',
        className,
      )}
    >
      {children}
    </span>
  );
}

// SectionHead is a sidebar section's title with its count.
export function SectionHead({ children, count, className, right }: { children: ReactNode; count?: number; className?: string; right?: ReactNode }) {
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 pb-1 pt-3', className)}>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">{children}</span>
      {count !== undefined && <span className="rounded-full bg-surface-raised px-1.5 text-[10px] tabular-nums text-subtle">{count}</span>}
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

// Tag says which concept a screenshot is, in its corner.
export function ConceptTag({ letter, name }: { letter: string; name: string }) {
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-50 max-md:bottom-auto max-md:top-2 rounded-full border border-line bg-modal/90 px-3 py-1 text-[11px] font-medium text-secondary shadow-lg backdrop-blur">
      Concept {letter} · {name}
    </div>
  );
}
