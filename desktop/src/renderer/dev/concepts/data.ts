// The one world every navigation concept (dev/concepts) draws: four
// projects, their leads and agents in every state the app knows, so the
// concepts differ only in how they lay it out. agentbox's agents are the
// preview's own fixtures (buildFixtures), placed in a state; the others are
// made up here. Mock only: nothing here ships.
import { buildFixtures, PROJECT } from '../fixtures';

// Where an agent stands, from the user's side: it asks for them, has
// finished work to review, is working, is done with (reviewed or merged), or
// is asleep.
export type Stage = 'needs' | 'review' | 'working' | 'done' | 'stopped';

export interface MockPR {
  number: number;
  checks: 'passing' | 'failing' | 'pending';
  additions: number;
  deletions: number;
}

export interface MockAgent {
  project: string;
  name: string;
  title: string;
  ai: string;
  stage: Stage;
  mins: number; // minutes since it last did something
  note: string; // its last line, or what it asks
  branch?: string;
  pr?: MockPR;
  pinned?: boolean;
  snoozed?: string; // until when, in words
  unseen?: boolean; // finished since the user last looked
  media?: number; // screenshots, recordings and pages it left
  cpu?: number;
}

export interface MockProject {
  name: string;
  display: string;
  hue: number;
  env: string; // where it runs: this machine's VM, or a remote one
  lead: { last: string; mins: number; unread: number; working: boolean };
}

export const projects: MockProject[] = [
  { name: PROJECT, display: 'AgentBox', hue: 262, env: 'Local VM', lead: { last: 'agent-12 opened #318 with a recording. Want me to merge it once CI is green?', mins: 2, unread: 2, working: false } },
  { name: 'hatch', display: 'Hatch', hue: 150, env: 'Local VM', lead: { last: 'Starting agent-7 on the page analytics; agent-5 is still on the editor.', mins: 6, unread: 0, working: true } },
  { name: 'organic', display: 'Organic', hue: 28, env: 'Hetzner box', lead: { last: 'The import finished: 18,402 products, 12 skipped (no SKU). Report attached.', mins: 47, unread: 1, working: false } },
  { name: 'site', display: 'leciric.dev', hue: 200, env: 'Local VM', lead: { last: 'Nothing running. The blog post draft is in Pages.', mins: 26 * 60, unread: 0, working: false } },
];

export const project = (name: string) => projects.find((p) => p.name === name)!;

// agentbox's agents come from the fixtures; each gets a stage and a last line.
const placed: Record<string, Omit<MockAgent, 'project' | 'name' | 'title' | 'ai' | 'branch'> & { title?: string }> = {
  'agent-12': { stage: 'review', mins: 3, note: 'Added a New project button at the top of the sidebar. Screenshots and a recording are in Media.', pr: { number: 318, checks: 'passing', additions: 142, deletions: 17 }, unseen: true, media: 4, pinned: true },
  'agent-94': { stage: 'needs', mins: 1, note: 'Needs a GitHub account to push agentbox/agent-94.', title: 'Push the docs fixes' },
  'agent-98': { stage: 'needs', mins: 4, note: 'Should the reminders page paginate, or load everything at once?', title: 'Reminders page: pagination' },
  'agent-96': { stage: 'working', mins: 0, note: 'Running npm run preview -- --shots out', cpu: 64 },
  'agent-99': { stage: 'working', mins: 0, note: 'Waiting on CI for #320 (3 of 7 checks done)', pr: { number: 320, checks: 'pending', additions: 58, deletions: 9 }, cpu: 12 },
  'agent-88': { stage: 'working', mins: 22, note: 'No progress for 22 min: stalled on go test ./internal/daemon', cpu: 2 },
  'agent-41': { stage: 'review', mins: 40, note: 'The release build now waits for the signed Mac zip.', pr: { number: 312, checks: 'failing', additions: 12, deletions: 3 }, media: 1, title: 'Release CI: find what failed' },
  'agent-39': { stage: 'done', mins: 95, note: 'Merged #309.', pr: { number: 309, checks: 'passing', additions: 210, deletions: 44 } },
  'agent-93': { stage: 'stopped', mins: 8 * 60, note: 'Stopped for the night.', snoozed: 'tomorrow 9:00' },
  'agent-91': { stage: 'done', mins: 5 * 60, note: 'Merged #305.' },
};

function fromFixtures(): MockAgent[] {
  return buildFixtures()
    .agents.filter((a) => placed[a.ref.split('/')[1]!])
    .map((a) => {
      const name = a.ref.split('/')[1]!;
      const { title, ...rest } = placed[name]!;
      return { project: PROJECT, name, title: title ?? a.title, ai: a.ai === 'cursor' ? 'claude' : a.ai, branch: `agentbox/${name}`, ...rest };
    });
}

export const agents: MockAgent[] = [
  ...fromFixtures(),
  { project: 'hatch', name: 'agent-5', title: 'Rich text editor for pages', ai: 'claude', stage: 'working', mins: 0, note: 'Editing src/editor/Toolbar.tsx', branch: 'agentbox/editor', cpu: 41 },
  { project: 'hatch', name: 'agent-7', title: 'Page analytics: views per day', ai: 'codex', stage: 'working', mins: 1, note: 'Reading the events table schema', branch: 'agentbox/analytics', cpu: 18 },
  { project: 'hatch', name: 'agent-3', title: 'Custom domains for pages', ai: 'claude', stage: 'review', mins: 18, note: 'CNAME check and TLS via Caddy on-demand. Recording in Media.', pr: { number: 88, checks: 'passing', additions: 391, deletions: 20 }, unseen: true, media: 3 },
  { project: 'hatch', name: 'agent-2', title: 'Expire pages after N hours', ai: 'claude', stage: 'done', mins: 3 * 60, note: 'Merged #85.' },
  { project: 'organic', name: 'agent-14', title: 'Import the product catalogue', ai: 'opencode', stage: 'needs', mins: 12, note: 'Needs the STRIPE_SECRET_KEY secret to sync prices.', pinned: true },
  { project: 'organic', name: 'agent-15', title: 'Checkout: Pix payments', ai: 'claude', stage: 'working', mins: 0, note: 'Running the e2e checkout test (2 of 5)', cpu: 77 },
  { project: 'organic', name: 'agent-11', title: 'Product page photos gallery', ai: 'codex', stage: 'stopped', mins: 2 * 24 * 60, note: 'Paused: waiting on the photographer’s files.', snoozed: 'Monday' },
  { project: 'site', name: 'agent-2', title: 'Blog post: running agents in VMs', ai: 'claude', stage: 'done', mins: 26 * 60, note: 'Draft published as a page.', media: 1 },
];

export const stageLabel: Record<Stage, string> = { needs: 'Needs you', review: 'Ready to review', working: 'Working', done: 'Done', stopped: 'Asleep' };

export function ago(mins: number): string {
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (24 * 60))}d`;
}

export const byStage = (stage: Stage) => agents.filter((a) => a.stage === stage).sort((a, b) => a.mins - b.mins);
export const ofProject = (name: string) => agents.filter((a) => a.project === name);

// A conversation, either a lead's or an agent's, short enough for a mock.
export interface Line {
  who: 'user' | 'ai' | 'tool';
  text: string;
}

export function leadLines(name: string): Line[] {
  if (name !== PROJECT) return [
    { who: 'user', text: 'What’s going on?' },
    { who: 'ai', text: project(name).lead.last },
  ];
  return [
    { who: 'user', text: 'Add a New project button to the top of the sidebar, and fix the rail overflowing on long text.' },
    { who: 'tool', text: 'create_agent agent-12 · create_agent agent-96' },
    { who: 'ai', text: 'Started agent-12 on the button and agent-96 on the overflow. agent-98 is asking whether the reminders page should paginate; I said I’d check with you.' },
    { who: 'ai', text: 'agent-12 opened #318 with a recording. Want me to merge it once CI is green?' },
  ];
}

export function agentLines(a: MockAgent): Line[] {
  return [
    { who: 'user', text: a.title },
    { who: 'tool', text: 'Read desktop/src/renderer/components/Sidebar.tsx · Edit 3 files · npm run typecheck ✓' },
    { who: 'ai', text: a.note },
  ];
}
