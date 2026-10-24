// The project's setup command, in its Settings.
//
// The base panel below it is the photograph; this is the recipe. With a
// command set, the daemon makes the photograph itself whenever the project's
// main branch moves (projectsetup.go): a machine of its own runs the command
// and is saved as the base. So what the user needs from here is whether the
// base new agents get is the current one: which commit it was built from,
// when, and how long that took, and when a run failed, why, and that the last
// good base is still the one in use.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Hourglass, LoaderCircle, Play, Save, SquareTerminal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type * as T from '../../shared/api';
import { api } from '../lib/api';
import { formatDuration } from '../lib/chat';
import { formatDateTime, useT } from '../lib/i18n';
import { cn, errorMessage, timeAgo } from '../lib/utils';
import { JobProgress } from './JobProgress';
import { Button } from './ui/button';
import { Card, Code, Notice, Row } from './ui/card';
import { Textarea } from './ui/input';

const short = (commit: string) => commit.slice(0, 7);
const running = (setup?: T.ProjectSetup) => setup?.status === 'waiting' || setup?.status === 'building';

export function ProjectSetupPanel({ project, className }: { project: T.Project; className?: string }) {
  const t = useT();
  const name = project.name;
  const queryClient = useQueryClient();
  // Events say when a run moves on; polling while one goes is the fallback
  // for a stream that dropped.
  const setup = useQuery({
    queryKey: ['setup', name],
    queryFn: () => api.projectSetup(name),
    refetchInterval: (query) => (running(query.state.data) ? 5000 : false),
  });
  const base = useQuery({ queryKey: ['base', name], queryFn: () => api.base(name) });
  const [draft, setDraft] = useState<string | null>(null);
  const saved = setup.data?.command ?? '';
  const command = draft ?? saved;
  const changed = draft !== null && draft.trim() !== saved;

  const save = useMutation({
    mutationFn: () => api.setProjectSetup(name, command),
    onSuccess: (next) => {
      queryClient.setQueryData(['setup', name], next);
      setDraft(null);
      toast(next.command ? t('project.setup.saved') : t('project.setup.turnedOff'));
    },
  });
  const rebuild = useMutation({
    mutationFn: () => api.rebuildProjectSetup(name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['setup', name] }),
  });

  const s = setup.data;
  const b = base.data;
  return (
    <Card className={className} title={t('project.setup.title')} icon={SquareTerminal} description={t('project.setup.description')}>
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Textarea
          aria-label={t('project.setup.commandLabel')}
          className="min-h-16 font-mono text-[12.5px]"
          spellCheck={false}
          placeholder="pnpm install && make deps"
          value={command}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" variant="primary" disabled={!changed || save.isPending}>
            {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
            {t('project.setup.save')}
          </Button>
          {saved && (
            <Button type="button" size="sm" variant="secondary" disabled={running(s) || rebuild.isPending || changed} onClick={() => rebuild.mutate()}>
              <Play />
              {t('project.setup.runNow')}
            </Button>
          )}
          <span className="min-w-0 flex-1 text-xs leading-relaxed text-subtle">
            {t.rich('project.setup.hint', { branch: <Code>{s?.branch || project.branch}</Code> })}
          </span>
        </div>
        {(save.error || rebuild.error) && <Notice>{errorMessage(save.error ?? rebuild.error)}</Notice>}
      </form>

      {s?.status && <Status setup={s} base={b ?? null} />}

      {b?.setupCommit && (
        <div className="mt-3.5">
          <Row label={t('project.setup.builtFrom')} mono>
            <span className="truncate" title={b.setupCommit}>
              {s?.branch ? `${s.branch} @ ` : ''}
              {short(b.setupCommit)}
            </span>
            {s?.head && s.head !== b.setupCommit && <span className="font-sans text-[12.5px] text-amber-300">{t('project.setup.behind', { head: short(s.head) })}</span>}
          </Row>
          <Row label={t('project.setup.built')}>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span>{formatDateTime(new Date(b.savedAt))}</span>
              <span className="text-[12.5px] text-subtle">{timeAgo(b.savedAt)}</span>
            </span>
          </Row>
          <Row label={t('project.setup.took')}>{formatDuration(b.setupSeconds ?? 0)}</Row>
        </div>
      )}
      {saved && b && !b.setupCommit && !running(s) && (
        <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">{t.rich('project.setup.notFromSetup', { from: <Code>{b.savedFrom}</Code> })}</p>
      )}
    </Card>
  );
}

// Status is the last run: going, or how it ended. A failure says the base in
// use is still the last good one, since that is the question it raises.
function Status({ setup, base }: { setup: T.ProjectSetup; base: T.Base | null }) {
  const t = useT();
  const commit = setup.commit ? short(setup.commit) : '';
  const since = setup.startedAt ? timeAgo(setup.startedAt) : '';
  switch (setup.status) {
    case 'waiting':
      return (
        <StatusLine icon={<Hourglass className="size-4 text-amber-300" />} title={t('project.setup.waiting', { commit })}>
          {setup.waiting || t('project.setup.waitingTurn')}
        </StatusLine>
      );
    case 'building':
      return (
        <div className="mt-3.5 grid gap-2">
          <StatusLine className="mt-0" icon={<LoaderCircle className="size-4 animate-spin text-sky-300" />} title={t('project.setup.building', { commit })}>
            {t('project.setup.buildingDetail', { since })}
          </StatusLine>
          {setup.job && <JobProgress jobId={setup.job} header={false} logClassName="max-h-36" />}
        </div>
      );
    case 'failed':
      return (
        <Notice className="mt-3.5">
          <p className="font-medium">{t('project.setup.failed', { commit, when: setup.finishedAt ? timeAgo(setup.finishedAt) : '' })}</p>
          <p className="mt-1 break-words">{setup.error}</p>
          {setup.log && (
            <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2.5 font-mono text-[11.5px] leading-relaxed text-rose-50/90">{setup.log.trimEnd()}</pre>
          )}
          <p className="mt-2 text-[12.5px] opacity-90">
            {base ? t('project.setup.keptBase', { from: base.setupCommit ? short(base.setupCommit) : base.savedFrom }) : t('project.setup.noBase')}
          </p>
        </Notice>
      );
    case 'ready':
      return (
        <StatusLine icon={<CircleCheck className="size-4 text-emerald-300" />} title={t('project.setup.ready')}>
          {t('project.setup.readyDetail', { commit })}
        </StatusLine>
      );
  }
  return null;
}

function StatusLine({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mt-3.5 flex items-start gap-2.5 rounded-xl border border-line bg-surface-faint px-3.5 py-2.5', className)}>
      <span className="mt-px shrink-0">{icon}</span>
      <div className="min-w-0 text-[13px] leading-relaxed">
        <p className="text-secondary">{title}</p>
        <p className="break-words text-[12.5px] text-muted">{children}</p>
      </div>
    </div>
  );
}
