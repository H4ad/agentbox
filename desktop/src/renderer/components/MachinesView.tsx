// Running machines: every agent whose machine is up, across all projects, by
// project, with what each uses and a Stop on each, so a VM that's full can be
// read and emptied from one place. It lists the agents whose chat is done
// too, which the sidebar and the agents' list beside the lead's chat fold
// away: a finished agent nobody stopped still holds its memory. The sidebar's
// foot opens it, with the count, and so does the top bar's machine popover.
// The reading is lib/machines.ts's.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Server, Square } from 'lucide-react';
import { toast } from 'sonner';
import type * as T from '../../shared/api';
import type { View } from '../App';
import { avatarMood } from '../lib/agentStatus';
import { api } from '../lib/api';
import { formatNumber, useT, type MessageKey } from '../lib/i18n';
import { pageItems, useQuestions } from '../lib/inboxPages';
import { agentSt, type AgentSt } from '../lib/leadFirst';
import { machineGroups, usageByRef, type Usage } from '../lib/machines';
import { projectLabel } from '../lib/projectName';
import { cn, errorMessage, humanBytes } from '../lib/utils';
import { ProjectIcon } from './ProjectIcon';
import { AgentAvatar } from './state';
import { Button } from './ui/button';
import { EmptyState } from './ui/card';
import { Tip } from './ui/tooltip';
import { StMark } from './v2/SidebarV2';

const stLabel: Record<AgentSt, MessageKey> = {
  needs: 'v2.st.needs',
  error: 'v2.st.error',
  review: 'v2.st.review',
  working: 'v2.st.working',
  done: 'machines.finished',
};

// The queries every view of the machines reads, shared by their keys.
export function useMachineUsage(refetchInterval = 5_000) {
  const cpu = useQuery({ queryKey: ['cpuUsage'], queryFn: api.cpuUsage, refetchInterval });
  const memory = useQuery({ queryKey: ['memoryUsage'], queryFn: api.memoryUsage, refetchInterval });
  return { usage: usageByRef(cpu.data, memory.data), hostMemory: memory.data?.hostTotal, hostCores: cpu.data?.hostCores };
}

export function MachinesView({ onSelect }: { onSelect: (view: View) => void }) {
  const t = useT();
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents });
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const asking = new Set(pageItems(useQuestions().data).map((n) => n.ref));
  const { usage, hostMemory } = useMachineUsage();
  const groups = machineGroups(agents.data ?? [], usage);
  const count = groups.reduce((n, g) => n + g.agents.length, 0);
  const memory = groups.reduce((n, g) => n + g.memory, 0);
  const cpu = groups.reduce((n, g) => n + g.cpu, 0);
  const st = (a: T.Agent) => agentSt(a, { review: new Set(), asking });
  const finished = groups.flatMap((g) => g.agents.filter((a) => st(a) === 'done' && a.state === 'running'));

  if (agents.data && count === 0)
    return (
      <EmptyState icon={Server} title={t('machines.emptyTitle')}>
        {t('machines.emptyBody')}
      </EmptyState>
    );

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl min-w-0 flex-col gap-4 overflow-y-auto px-4 py-6 md:px-6" data-machines>
      <header className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-semibold text-title">{t('machines.title')}</h1>
          <p className="mt-0.5 text-[12.5px] text-subtle" data-machines-total>
            {t('machines.total', { count, cpu: formatNumber(cpu, { maximumFractionDigits: 0 }), memory: humanBytes(memory), of: hostMemory ? humanBytes(hostMemory) : '–' })}
          </p>
        </div>
        {finished.length > 0 && <StopFinished refs={finished.map((a) => a.ref)} />}
      </header>
      {groups.map((g) => (
        <section key={g.project} className="panel min-w-0 rounded-2xl p-2" data-machines-project={g.project}>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'project', project: g.project })}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface"
          >
            <ProjectIcon project={projects.data?.find((p) => p.name === g.project) ?? { name: g.project, displayName: g.project, iconVersion: 0 }} className="size-5" />
            <span className="min-w-0 truncate text-[13px] font-medium text-title">{projectLabel(g.project, projects.data)}</span>
            <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-faint">
              {t('machines.projectTotal', { count: g.agents.length, memory: humanBytes(g.memory) })}
            </span>
          </button>
          <div className="mt-1 flex flex-col gap-px">
            {g.agents.map((a) => (
              <MachineRow key={a.ref} agent={a} st={st(a)} asking={asking.has(a.ref)} usage={usage.get(a.ref)} hostMemory={hostMemory} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MachineRow({ agent, st, asking, usage, hostMemory, onSelect }: { agent: T.Agent; st: AgentSt; asking: boolean; usage?: Usage; hostMemory?: number; onSelect: (view: View) => void }) {
  const t = useT();
  const stop = useStop();
  const label = agent.title || agent.name;
  // Heavy as the agents' list marks it (lib/terminalTail.ts's heavy): more
  // than a core, or more than a quarter of the VM's memory.
  const heavy = (usage?.cpu ?? 0) > 100 || (!!hostMemory && (usage?.memory ?? 0) > hostMemory / 4);
  return (
    <div className="group flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface" data-machine-row={agent.ref} data-machine-st={st}>
      <AgentAvatar ai={agent.ai} mood={avatarMood(agent, asking)} state={agent.state} seed={agent.ref} className="size-7 shrink-0" />
      <button type="button" onClick={() => onSelect({ kind: 'agent', ref: agent.ref })} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] text-primary group-hover:underline">{label}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-subtle">
          <StMark st={st} />
          <span className="truncate">
            {agent.state === 'paused' ? t('shell.top.paused') : t(stLabel[st])} · <span className="font-mono">{agent.name}</span>
          </span>
        </span>
      </button>
      <span className={cn('shrink-0 whitespace-nowrap font-mono text-[11.5px] tabular-nums', heavy ? 'rounded bg-amber-500/15 px-1.5 py-px text-amber-200' : 'text-tertiary')} data-machine-usage>
        {usage?.cpu !== undefined ? `${formatNumber(usage.cpu, { maximumFractionDigits: 0 })}%` : '–'} · {usage?.memory ? humanBytes(usage.memory) : '–'}
      </span>
      <Tip label={t('shell.top.stop', { name: label })}>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 hover:text-rose-300"
          aria-label={t('shell.top.stop', { name: label })}
          disabled={stop.isPending}
          onClick={() => stop.mutate([agent.ref])}
          data-machine-stop={agent.ref}
        >
          {stop.isPending ? <LoaderCircle className="animate-spin" /> : <Square />}
          {t('machines.stop')}
        </Button>
      </Tip>
    </div>
  );
}

// StopFinished stops every machine whose agent is done in one go, which is
// most of what a full VM holds after a day of agents.
function StopFinished({ refs }: { refs: string[] }) {
  const t = useT();
  const stop = useStop();
  return (
    <Button size="sm" variant="outline" disabled={stop.isPending} onClick={() => stop.mutate(refs)} data-machines-stop-finished={refs.length}>
      {stop.isPending ? <LoaderCircle className="animate-spin" /> : <Square />}
      {t('machines.stopFinished', { count: refs.length })}
    </Button>
  );
}

function useStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (refs: string[]) => {
      for (const ref of refs) await api.agentAction(ref, 'stop');
    },
    onSuccess: async () => {
      for (const key of ['agents', 'usage', 'cpuUsage', 'memoryUsage']) await queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
