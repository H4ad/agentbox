// The ?setup= scenarios: a project's setup command in Settings' Repository
// (components/ProjectSetupPanel), with ?page=settings. none has no command;
// waiting, building, ready and failed are its last run, beside the base the
// run before made.
import type * as T from '../../shared/api';
import { PROJECT, setDevSetup } from './fixtures';

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const command = 'pnpm install --frozen-lockfile && make deps';
const head = '9f3c2a7d41e0b6c58a1f2e3d4c5b6a7980f1e2d3';
const built = '4be81c09d2a7f3e6b5c4d3e2f1a0b9c8d7e6f5a4';

const base = (): T.Base => ({
  snapshot: `ab-${PROJECT}-base/ready`,
  savedFrom: `${PROJECT}/base-setup`,
  savedAt: ago(26 * 60),
  image: '2026.10.20.1',
  setupCommit: built,
  setupSeconds: 312,
});

const buildLog = `Making a machine for the setup at main 9f3c2a7d41e0
==> Creating worktree /home/user/.local/share/agentbox/worktrees/${PROJECT}/base-setup on branch agentbox/base-setup (from main)
==> Creating instance ab-${PROJECT}-base-setup from agentbox-base/ready
==> Waiting for the machine to be ready
$ ${command}
Lockfile is up to date, resolution step is skipped
Progress: resolved 1342, reused 1290, downloaded 52, added 1342
Packages: +1342
node_modules/.pnpm/electron@39.0.0/node_modules/electron: Running postinstall script...
`;

export function seedProjectSetup(scenario: string): void {
  const branch = 'main';
  switch (scenario) {
    case 'none':
      setDevSetup({ command: '', branch, head }, null);
      return;
    case 'waiting':
      setDevSetup(
        { command, branch, head, status: 'waiting', commit: head, startedAt: ago(1), waiting: 'the VM is nearly out of memory (1.2 GiB of 16 GiB available, swap full)' },
        base(),
      );
      return;
    case 'building': {
      const job: T.Job = { id: 'setup-job', kind: 'base-setup', target: `${PROJECT}/base-setup`, status: 'running', createdAt: ago(3) };
      setDevSetup({ command, branch, head, status: 'building', commit: head, startedAt: ago(3), job: job.id }, base(), job, buildLog);
      return;
    }
    case 'ready':
      setDevSetup({ command, branch, head: built, status: 'ready', commit: built, startedAt: ago(31 * 60), finishedAt: ago(26 * 60) }, base());
      return;
    case 'failed':
      setDevSetup(
        {
          command,
          branch,
          head,
          status: 'failed',
          commit: head,
          startedAt: ago(14),
          finishedAt: ago(12),
          error: 'the setup command failed: exit status 1',
          log: `$ ${command}
 ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with desktop/package.json

Note that in CI environments this setting is true by default. If you still need to run install in such cases, use "pnpm install --no-frozen-lockfile"
`,
        },
        base(),
      );
      return;
  }
}
