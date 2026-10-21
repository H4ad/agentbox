import assert from 'node:assert/strict';
import { test } from 'node:test';
import type * as T from '../../shared/api';
import { holdsMachine, machineGroups, projectsWithMachines, usageByRef } from './machines.ts';

const agent = (ref: string, state: string, chat = 'ready') => ({ ref, project: ref.split('/')[0], name: ref.split('/')[1], state, chat }) as T.Agent;

test('a running or paused machine is held; stopped and gone ones are not', () => {
  assert.deepEqual(['running', 'paused', 'stopped', 'incomplete', 'initializing'].map((state) => holdsMachine({ state })), [true, true, false, false, false]);
});

test('machines group by project, the heaviest project and agent first, stopped ones left out', () => {
  const GiB = 1024 ** 3;
  const agents = [agent('a/agent-1', 'running'), agent('a/agent-2', 'running', 'running'), agent('b/agent-3', 'paused'), agent('b/agent-4', 'stopped'), agent('c/agent-5', 'running')];
  const usage = usageByRef(
    { hostCPU: 0, hostCores: 8, otherCPU: 0, agents: [{ ref: 'a/agent-1', state: 'running', cpu: 3 }, { ref: 'a/agent-2', state: 'running', cpu: 90 }] },
    { hostTotal: 16 * GiB, agentsUsed: 0, otherUsed: 0, swapTotal: 0, swapUsed: 0, agentsSwap: 0, agents: [{ ref: 'a/agent-1', state: 'running', memory: GiB, swap: 0 }, { ref: 'a/agent-2', state: 'running', memory: 2 * GiB, swap: 0 }, { ref: 'b/agent-3', state: 'paused', memory: 4 * GiB, swap: 0 }] },
  );
  const groups = machineGroups(agents, usage);
  assert.deepEqual(groups.map((g) => [g.project, g.agents.map((a) => a.name), g.memory / GiB, g.cpu]), [
    ['b', ['agent-3'], 4, 0],
    ['a', ['agent-2', 'agent-1'], 3, 93],
    ['c', ['agent-5'], 0, 0],
  ]);
});

test('a project with only finished agents still holding machines has machines', () => {
  assert.deepEqual([...projectsWithMachines([agent('courier/agent-19', 'running'), agent('quill/agent-2', 'stopped')])], ['courier']);
});
