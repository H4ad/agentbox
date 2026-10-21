// The agents that hold a machine, across every project, for the Running
// machines page (components/MachinesView.tsx), the sidebar's count of them and
// its Idle list. An agent's chat can be done while its machine still runs: it
// finished, nobody stopped it, and it keeps its memory and whatever it left
// running. Those were read as done, so neither the sidebar nor the agents'
// list beside the lead's chat showed them, and a VM full of them looked empty.
import type * as T from '../../shared/api';

// holdsMachine is whether an agent's machine is up: running, or paused, which
// still holds its memory (stopping is what frees it).
export const holdsMachine = (a: Pick<T.Agent, 'state'>) => a.state === 'running' || a.state === 'paused';

export type Usage = { cpu?: number; memory?: number };

// usageByRef is each agent's CPU and memory from the daemon's two readings.
export function usageByRef(cpu: T.CPUUsage | undefined, memory: T.MemoryUsage | undefined): Map<string, Usage> {
  const out = new Map<string, Usage>();
  for (const a of cpu?.agents ?? []) out.set(a.ref, { cpu: a.cpu });
  for (const a of memory?.agents ?? []) out.set(a.ref, { ...out.get(a.ref), memory: a.memory });
  return out;
}

export type MachineGroup = { project: string; agents: T.Agent[]; memory: number; cpu: number };

// machineGroups is the agents holding a machine by project, the project whose
// machines use the most memory first, and in each the heaviest first: what to
// stop to free the VM is at the top.
export function machineGroups(agents: readonly T.Agent[], usage: ReadonlyMap<string, Usage>): MachineGroup[] {
  const mem = (a: T.Agent) => usage.get(a.ref)?.memory ?? 0;
  const groups = new Map<string, MachineGroup>();
  for (const a of agents) {
    if (!holdsMachine(a)) continue;
    const g = groups.get(a.project) ?? { project: a.project, agents: [], memory: 0, cpu: 0 };
    g.agents.push(a);
    g.memory += mem(a);
    g.cpu += usage.get(a.ref)?.cpu ?? 0;
    groups.set(a.project, g);
  }
  const out = [...groups.values()];
  for (const g of out) g.agents.sort((a, b) => mem(b) - mem(a) || a.name.localeCompare(b.name));
  return out.sort((a, b) => b.memory - a.memory || a.project.localeCompare(b.project));
}

// projectsWithMachines is the projects with a machine up, which never fold
// into the sidebar's Idle list.
export const projectsWithMachines = (agents: readonly T.Agent[]) => new Set(agents.filter(holdsMachine).map((a) => a.project));
