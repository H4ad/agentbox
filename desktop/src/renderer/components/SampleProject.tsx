// The sample project, for a new user with no project in mind (internal/sample):
// SampleOffer on the empty Home makes it, and SampleBanner, atop the sample's
// chat, offers its three starter tasks, says where to watch the agents, and
// deletes it again in one click.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FlaskConical, LoaderCircle, MessagesSquare, Monitor, Play, Trash, X } from 'lucide-react';
import { useState } from 'react';
import type * as T from '../../shared/api';
import type { MessageKey } from '../../shared/i18n';
import type { View } from '../App';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { cn, errorMessage } from '../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './ui/button';
import { Notice, Panel } from './ui/card';

// The starter tasks' titles and what each asks, in the app's language, by
// their branch; a task the app doesn't know shows the daemon's English title.
const taskText: Record<string, { title: MessageKey; body: MessageKey }> = {
  'add-dark-mode': { title: 'sample.task.darkMode', body: 'sample.task.darkModeBody' },
  'add-tests': { title: 'sample.task.tests', body: 'sample.task.testsBody' },
  'fix-items-left': { title: 'sample.task.bug', body: 'sample.task.bugBody' },
};

// SampleOffer is Home's offer when there are no projects: one click makes the
// sample and opens it, where SampleBanner offers its tasks. Agents can't start
// before Setup is done, so neither can the sample.
export function SampleOffer({ onSelect, setupReady }: { onSelect: (view: View) => void; setupReady?: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: api.createSample,
    onSuccess: async (made) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSelect({ kind: 'project', project: made.project });
    },
  });
  return (
    <Panel className="mt-8 flex flex-col gap-4 border-brand-400/25 bg-brand-500/[0.06] p-5 sm:flex-row sm:items-center" data-sample-offer>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/30 to-sky-500/10 text-brand-200 ring-1 ring-inset ring-line-strong">
        <FlaskConical className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-primary">{t('sample.offer.title')}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('sample.offer.body')}</p>
        {create.error && <Notice className="mt-3">{errorMessage(create.error)}</Notice>}
        {setupReady === false && <p className="mt-2 text-[12px] text-amber-200">{t('sample.offer.setupFirst')}</p>}
      </div>
      <Button variant="primary" className="shrink-0" disabled={create.isPending || setupReady === false} onClick={() => create.mutate()}>
        {create.isPending ? <LoaderCircle className="animate-spin" /> : <FlaskConical />}
        {create.isPending ? t('sample.offer.creating') : t('sample.offer.action')}
      </Button>
    </Panel>
  );
}

// SampleBanner sits atop the sample project's chat. Before any agent, it
// lists the starter tasks to launch at once; after, it points at the lead
// (this chat) and the agents' desktops. Delete takes the whole sample away.
export function SampleBanner({ project, agents, onSelect }: { project: T.Project; agents: T.Agent[]; onSelect: (view: View) => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const sample = useQuery({ queryKey: ['sample'], queryFn: api.sample, staleTime: Infinity });
  const tasks = sample.data?.tasks ?? [];
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem(hideKey(project.name)) === '1');
  const chosen = tasks.filter((task) => !skipped.has(task.branch));

  const launch = useMutation({
    // One after another: each brings the VM up if it's down, and the daemon
    // queues what doesn't fit anyway.
    mutationFn: async (list: T.SampleTask[]) => {
      for (const task of list) {
        await api.createAgent({ project: project.name, ai: 'claude', title: task.title, branch: task.branch, task: task.task });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const toggle = (branch: string) =>
    setSkipped((s) => {
      const next = new Set(s);
      if (!next.delete(branch)) next.add(branch);
      return next;
    });

  const remove = async () => {
    await api.deleteSample(project.name);
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['projects'] }), queryClient.invalidateQueries({ queryKey: ['agents'] })]);
    onSelect({ kind: 'home' });
  };

  const started = agents.length > 0 || launch.isSuccess;
  if (started && hidden) return null;

  return (
    <div className="shrink-0 px-2 pb-2 md:px-6" data-sample-banner>
      <Panel className="border-brand-400/25 bg-brand-500/[0.05] p-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-brand-200" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-primary">{t('sample.banner.title')}</div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{started ? t('sample.banner.started') : t('sample.banner.intro')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDeleting(true)} data-sample-delete>
              <Trash />
              {t('sample.banner.delete')}
            </Button>
            {started && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={t('sample.banner.hide')}
                onClick={() => {
                  localStorage.setItem(hideKey(project.name), '1');
                  setHidden(true);
                }}
              >
                <X />
              </Button>
            )}
          </div>
        </div>

        {started ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Hint icon={MessagesSquare} title={t('sample.banner.leadTitle')}>
              {t('sample.banner.leadBody')}
            </Hint>
            <Hint icon={Monitor} title={t('sample.banner.desktopTitle')}>
              {t('sample.banner.desktopBody')}
            </Hint>
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {tasks.map((task) => {
                const on = !skipped.has(task.branch);
                const text = taskText[task.branch];
                return (
                  <button
                    key={task.branch}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(task.branch)}
                    className={cn(
                      'flex min-w-0 items-start gap-2.5 rounded-xl border p-3 text-left transition',
                      on ? 'border-brand-400/40 bg-brand-500/[0.08]' : 'border-line bg-surface opacity-70 hover:opacity-100',
                    )}
                  >
                    <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand-400 bg-brand-500 text-white' : 'border-line-strong')}>
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-primary">{text ? t(text.title) : task.title}</span>
                      {text && <span className="mt-0.5 block text-[12px] leading-snug text-subtle">{t(text.body)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {launch.error && <Notice className="mt-3">{errorMessage(launch.error)}</Notice>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={chosen.length === 0 || launch.isPending} onClick={() => launch.mutate(chosen)} data-sample-launch>
                {launch.isPending ? <LoaderCircle className="animate-spin" /> : <Play />}
                {t('sample.banner.launch', { count: chosen.length })}
              </Button>
              <span className="text-[12px] text-subtle">{t('sample.banner.launchHint')}</span>
            </div>
          </>
        )}
      </Panel>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('sample.delete.title')}
        description={t('sample.delete.description', { count: agents.length, root: project.root })}
        confirmLabel={t('sample.delete.confirm')}
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

function hideKey(project: string) {
  return `agentbox.sampleBanner.hidden.${project}`;
}

function Hint({ icon: Icon, title, children }: { icon: typeof Monitor; title: string; children: string }) {
  return (
    <div className="flex min-w-0 gap-2.5 rounded-xl border border-line bg-surface p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-tertiary" />
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-primary">{title}</div>
        <p className="mt-0.5 text-[12px] leading-snug text-subtle">{children}</p>
      </div>
    </div>
  );
}
