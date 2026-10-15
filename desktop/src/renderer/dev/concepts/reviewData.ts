// What concept D v2 reviews inside a thread: for each agent with finished
// work, the turn's final summary, the media it left, the files it changed
// (with their diffs), its pull request's description and checks, and what
// it says after the user asks for changes. Mock only: nothing here ships.
import { agents, type MockAgent } from './data';

export interface Media {
  kind: 'shot' | 'recording' | 'page';
  title: string;
  caption: string;
  length?: string; // a recording's
}

export interface DiffLine {
  t: ' ' | '+' | '-' | '@';
  s: string;
}

export interface FileChange {
  path: string;
  status: 'M' | 'A' | 'D';
  add: number;
  del: number;
  lines: DiffLine[];
  later?: boolean; // only in the commits after Request changes
}

export interface Check {
  name: string;
  state: 'pass' | 'fail' | 'pending' | 'skip';
  time: string;
}

export interface Review {
  key: string; // project/agent
  summary: string; // the turn's last message, two lines' worth
  media: Media[];
  files: FileChange[];
  pr: { number: number; title: string; body: string[]; checks: Check[]; mergeable: boolean };
  // After Request changes: what the user asks, what the agent says when it's
  // done again, and the media and files it adds.
  ask: string;
  again: { summary: string; media: Media; commits: number };
}

const d = (s: string): DiffLine[] =>
  s
    .trim()
    .split('\n')
    .map((l) => ({ t: (l[0] === '@' ? '@' : l[0]) as DiffLine['t'], s: l.slice(1) }));

const goChecks = (fail?: string): Check[] => [
  { name: 'PR title', state: 'pass', time: '4s' },
  { name: 'Changes', state: 'pass', time: '6s' },
  { name: 'Desktop / lint', state: 'pass', time: '41s' },
  { name: 'Desktop / typecheck', state: 'pass', time: '1m 12s' },
  { name: 'Desktop / test', state: 'pass', time: '2m 03s' },
  { name: 'Desktop / build', state: fail === 'build' ? 'fail' : 'pass', time: '1m 48s' },
  { name: 'Go tests and coverage', state: 'skip', time: '—' },
];

export const reviews: Review[] = [
  {
    key: 'agentbox/agent-12',
    summary:
      'Added a + button to the Projects header that opens Add project, the same as the empty state’s. It has a tooltip, ⌘⇧N, and folds into the rail’s 56 px mode. Before/after shots and a 40 s walkthrough are in Media.',
    media: [
      { kind: 'shot', title: 'New project button', caption: 'After: the + sits beside New section, at the Projects header’s right edge.' },
      { kind: 'recording', title: 'Walkthrough', caption: 'Clicking +, adding ~/code/site, and the project appearing at the top.', length: '0:42' },
      { kind: 'shot', title: 'Sidebar before', caption: 'Before: Add project was only reachable from the empty state or Settings.' },
      { kind: 'shot', title: 'Folded rail', caption: 'At 56 px the button folds to an icon with a tooltip.' },
    ],
    files: [
      {
        path: 'desktop/src/renderer/components/Sidebar.tsx',
        status: 'M',
        add: 38,
        del: 9,
        lines: d(`
@@ -212,14 +212,31 @@ function ProjectsHeader({ onNewSection, folded }: HeaderProps) {
   const t = useT();
-  return (
-    <SectionTitle title={t('sidebar.projects')}>
-      <IconButton icon={FolderPlus} label={t('sidebar.newSection')} onClick={onNewSection} />
-    </SectionTitle>
-  );
+  const addProject = useAddProject();
+  useHotkey('mod+shift+n', addProject.open);
+  return (
+    <SectionTitle title={t('sidebar.projects')} folded={folded}>
+      <IconButton icon={FolderPlus} label={t('sidebar.newSection')} onClick={onNewSection} />
+      <IconButton
+        icon={Plus}
+        label={t('sidebar.newProject')}
+        shortcut="⌘⇧N"
+        onClick={addProject.open}
+        data-new-project
+      />
+    </SectionTitle>
+  );
 }
@@ -301,7 +318,9 @@ export function Sidebar({ projects, folded }: SidebarProps) {
-  if (projects.length === 0) return <EmptyProjects onAdd={() => setAdding(true)} />;
+  // The empty state and the header's + open the same dialog.
+  const addProject = useAddProject();
+  if (projects.length === 0) return <EmptyProjects onAdd={addProject.open} />;
   return (
     <nav className="flex min-w-0 flex-col">
-      <ProjectsHeader onNewSection={newSection} />
+      <ProjectsHeader onNewSection={newSection} folded={folded} />`),
      },
      {
        path: 'desktop/src/renderer/lib/addProject.ts',
        status: 'A',
        add: 29,
        del: 0,
        lines: d(`
@@ -0,0 +1,29 @@
+// useAddProject is the one way to open Add project, shared by the
+// sidebar's + button, its empty state and the ⌘⇧N shortcut.
+import { create } from 'zustand';
+
+interface AddProject {
+  isOpen: boolean;
+  open: () => void;
+  close: () => void;
+}
+
+export const useAddProject = create<AddProject>((set) => ({
+  isOpen: false,
+  open: () => set({ isOpen: true }),
+  close: () => set({ isOpen: false }),
+}));`),
      },
      {
        path: 'desktop/src/renderer/components/AddProjectDialog.tsx',
        status: 'M',
        add: 6,
        del: 5,
        lines: d(`
@@ -18,11 +18,12 @@ export function AddProjectDialog() {
-  const [open, setOpen] = useState(false);
+  const { isOpen, close } = useAddProject();
   const t = useT();
-  return (
-    <Dialog open={open} onOpenChange={setOpen}>
+  return (
+    <Dialog open={isOpen} onOpenChange={(next) => !next && close()}>
       <DialogContent className="w-[min(520px,calc(100vw-2rem))]">`),
      },
      {
        path: 'desktop/src/shared/i18n/en-US.ts',
        status: 'M',
        add: 2,
        del: 0,
        lines: d(`
@@ -611,6 +611,8 @@ export const enUS = {
   'sidebar.projects': 'Projects',
   'sidebar.newSection': 'New section',
+  'sidebar.newProject': 'New project',
+  'sidebar.newProject.hint': 'Add a folder or a git repository as a project',`),
      },
      {
        path: 'desktop/src/shared/i18n/pt-BR.ts',
        status: 'M',
        add: 2,
        del: 0,
        lines: d(`
@@ -609,6 +609,8 @@ export const ptBR: Catalog = {
   'sidebar.projects': 'Projetos',
   'sidebar.newSection': 'Nova seção',
+  'sidebar.newProject': 'Novo projeto',
+  'sidebar.newProject.hint': 'Adicione uma pasta ou um repositório git como projeto',`),
      },
      {
        path: 'desktop/src/renderer/dev/scenarios.json',
        status: 'M',
        add: 7,
        del: 0,
        lines: d(`
@@ -140,4 +140,11 @@
+  {
+    "id": "sidebar-new-project-dark",
+    "description": "The Projects header with its new + button — dark, xl width",
+    "query": "theme=dark",
+    "width": 1440,
+    "height": 900
+  },`),
      },
      {
        path: 'desktop/src/renderer/components/Sidebar.test.tsx',
        status: 'M',
        add: 22,
        del: 0,
        later: true,
        lines: d(`
@@ -88,3 +88,25 @@ describe('Sidebar', () => {
+  it('opens Add project from the header in the folded rail', async () => {
+    render(<Sidebar projects={[project('agentbox')]} folded />);
+    await user.click(screen.getByRole('button', { name: 'New project' }));
+    expect(screen.getByRole('dialog', { name: 'Add project' })).toBeVisible();
+  });
+
+  it('keeps the + button reachable with a long project name', () => {
+    render(<Sidebar projects={[project('a-very-long-project-name-that-wraps')]} />);
+    expect(screen.getByRole('button', { name: 'New project' })).toBeVisible();
+  });`),
      },
    ],
    pr: {
      number: 318,
      title: 'feat: a New project button at the top of the sidebar',
      body: [
        '## What changed',
        'The Projects header gets a + button beside New section. It opens the same Add project dialog as the empty state, through one `useAddProject` store, so the two can’t drift.',
        '- ⌘⇧N / Ctrl+Shift+N opens it from anywhere.',
        '- In the folded 56 px rail the button stays, as an icon with a tooltip.',
        '- New strings are in en-US and pt-BR.',
        '## How it was checked',
        '`npm --prefix desktop run typecheck`, `lint`, `test` (521 pass) and `build`. `npm run preview -- --shots out --against main` shows no overflow down to 480 px. A recording of adding ~/code/site is in Media.',
        '## Can’t do yet',
        'The shortcut isn’t listed in the shortcuts sheet; that’s #321.',
      ],
      checks: goChecks(),
      mergeable: true,
    },
    ask: 'Add a test for the folded rail, and make sure a long project name can’t push the + off the header.',
    again: {
      summary:
        'Added two tests: the + opens Add project from the folded rail, and stays visible beside a 40-character project name (the title truncates now). 523 tests pass; a new shot of the long name is in Media.',
      media: { kind: 'shot', title: 'Long project name', caption: 'The title truncates; the + and New section keep their place.' },
      commits: 2,
    },
  },
  {
    key: 'agentbox/agent-41',
    summary:
      'The release build failed because build-mac uploaded before the signed zip existed. It now waits for notarisation and retries the upload twice. The Desktop / build check still fails on a flaky Electron download.',
    media: [{ kind: 'page', title: 'CI timeline', caption: 'The release run’s jobs, before and after: build-mac now waits on notarise.' }],
    files: [
      {
        path: '.github/workflows/release.yml',
        status: 'M',
        add: 9,
        del: 3,
        lines: d(`
@@ -142,9 +142,15 @@ jobs:
   build-mac:
-    needs: [draft]
+    needs: [draft, notarise]
     runs-on: macos-15
     steps:
-      - run: scripts/release-build.sh mac --upload
+      - name: Upload the signed zip
+        uses: nick-fields/retry@v3
+        with:
+          max_attempts: 3
+          timeout_minutes: 10
+          command: scripts/release-build.sh mac --upload`),
      },
      {
        path: 'scripts/release-build.sh',
        status: 'M',
        add: 3,
        del: 0,
        lines: d(`
@@ -77,6 +77,9 @@ upload() {
   local file="$1"
+  # The zip appears only once notarisation has stapled it.
+  [ -f "$file" ] || { echo "missing $file: was it notarised?" >&2; exit 3; }
+
   gh release upload "$TAG" "$file" --clobber`),
      },
    ],
    pr: {
      number: 312,
      title: 'fix: the release build waits for the signed Mac zip before uploading',
      body: [
        '## What failed',
        'Run 42 failed in build-mac: `gh release upload` ran before notarise had stapled the zip, so the file wasn’t there.',
        '## What changed',
        '- build-mac needs notarise.',
        '- The upload retries up to 3 times.',
        '- release-build.sh says which file is missing instead of gh’s generic error.',
        '## Not fixed here',
        'Desktop / build fails on this PR because Electron’s download timed out on the runner. A rerun should pass.',
      ],
      checks: goChecks('build'),
      mergeable: false,
    },
    ask: 'Rerun the failing check, and if Electron’s download is the problem, cache it.',
    again: {
      summary: 'Cached Electron’s download in the build job (actions/cache on ~/.cache/electron). The rerun passed in 1m 31s; all 7 checks are green.',
      media: { kind: 'shot', title: 'Checks green', caption: 'All checks passing after the cache.' },
      commits: 1,
    },
  },
  {
    key: 'agentbox/agent-95',
    summary:
      'A keyboard shortcuts sheet on ? and in the Help menu, built from the same table the hotkeys register from, so it can’t go stale. Mac and Linux keys both show. Screenshots in dark and light are in Media.',
    media: [
      { kind: 'shot', title: 'Shortcuts sheet', caption: 'The sheet, grouped into Navigation, Chat and Review.' },
      { kind: 'shot', title: 'Shortcuts, light', caption: 'The same sheet in the light appearance.' },
    ],
    files: [
      {
        path: 'desktop/src/renderer/components/ShortcutsSheet.tsx',
        status: 'A',
        add: 96,
        del: 0,
        lines: d(`
@@ -0,0 +1,96 @@
+// ShortcutsSheet lists every hotkey, grouped, from lib/hotkeys' table: the
+// same rows useHotkey registers, so the sheet can't promise a key that
+// does nothing.
+export function ShortcutsSheet({ open, onClose }: Props) {
+  const t = useT();
+  const groups = groupBy(hotkeys, (h) => h.group);
+  return (
+    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>`),
      },
      {
        path: 'desktop/src/renderer/lib/hotkeys.ts',
        status: 'M',
        add: 41,
        del: 4,
        lines: d(`
@@ -1,8 +1,45 @@
-export const hotkeys = ['mod+k', 'mod+p', 'mod+f'];
+export interface Hotkey {
+  keys: string;
+  group: 'navigation' | 'chat' | 'review';
+  label: MessageKey;
+}
+
+export const hotkeys: Hotkey[] = [
+  { keys: 'mod+k', group: 'navigation', label: 'hotkey.search' },
+  { keys: 'mod+p', group: 'chat', label: 'hotkey.files' },`),
      },
    ],
    pr: {
      number: 321,
      title: 'feat: a keyboard shortcuts sheet (press ?)',
      body: ['## What changed', 'Press ? anywhere, or Help → Keyboard shortcuts.', '- Built from `lib/hotkeys`, which `useHotkey` now reads too.', '## How it was checked', 'typecheck, lint, test (519 pass), build; screenshots in Media.'],
      checks: goChecks(),
      mergeable: true,
    },
    ask: 'Add ⌘⇧N from #318 to the sheet.',
    again: { summary: 'Added New project (⌘⇧N) under Navigation.', media: { kind: 'shot', title: 'Sheet with ⌘⇧N', caption: 'New project, under Navigation.' }, commits: 1 },
  },
  {
    key: 'hatch/agent-3',
    summary:
      'Custom domains: a page owner adds a CNAME to pages.hatch.dev, Hatch checks it every minute, and Caddy issues TLS on demand once it resolves. A 1 m 10 s recording walks through docs.example.org.',
    media: [
      { kind: 'recording', title: 'Adding a domain', caption: 'Adding docs.example.org, the DNS check turning green, and the page served over HTTPS.', length: '1:10' },
      { kind: 'shot', title: 'Domain settings', caption: 'The page’s Domain tab, with the record to add.' },
      { kind: 'shot', title: 'Pending check', caption: 'Before DNS resolves: what to add, and the next check in 42 s.' },
    ],
    files: [
      {
        path: 'internal/domains/check.go',
        status: 'A',
        add: 118,
        del: 0,
        lines: d(`
@@ -0,0 +1,118 @@
+// Package domains checks that a page's custom domain points at Hatch, and
+// answers Caddy's on-demand TLS "ask" for the domains that do.
+package domains
+
+func (c *Checker) Check(ctx context.Context, d Domain) (bool, error) {
+	cname, err := c.resolver.LookupCNAME(ctx, d.Name)
+	if err != nil {
+		return false, fmt.Errorf("look up %s: %w", d.Name, err)
+	}
+	return strings.TrimSuffix(cname, ".") == c.target, nil
+}`),
      },
      {
        path: 'deploy/Caddyfile',
        status: 'M',
        add: 6,
        del: 1,
        lines: d(`
@@ -1,4 +1,9 @@
-pages.hatch.dev {
+{
+	on_demand_tls {
+		ask http://localhost:8080/internal/domains/ask
+	}
+}
+pages.hatch.dev, :443 {
+	tls { on_demand }`),
      },
    ],
    pr: {
      number: 88,
      title: 'feat: custom domains for pages',
      body: ['## What changed', 'A page can be served on its owner’s domain.', '- CNAME check every minute (internal/domains).', '- Caddy’s on-demand TLS asks Hatch first.', '## How it was checked', 'go test ./..., and a real domain against the staging box (recording in Media).'],
      checks: [
        { name: 'go test', state: 'pass', time: '1m 02s' },
        { name: 'golangci-lint', state: 'pass', time: '38s' },
        { name: 'web build', state: 'pass', time: '54s' },
      ],
      mergeable: true,
    },
    ask: 'Rate-limit the ask endpoint so nobody can make Caddy try certificates for random domains.',
    again: { summary: 'The ask endpoint now answers only for domains a page has claimed, and allows 10 asks a minute per domain.', media: { kind: 'shot', title: 'Rate limit test', caption: 'The new test hitting the limit.' }, commits: 1 },
  },
];

// The fourth thread to review: not in data.ts, which the other concepts share.
export const extraAgents: MockAgent[] = [
  { project: 'agentbox', name: 'agent-95', title: 'Keyboard shortcuts sheet', ai: 'claude', stage: 'review', mins: 9, note: 'Shortcuts sheet on ?, from the hotkeys table.', branch: 'agentbox/agent-95', pr: { number: 321, checks: 'passing', additions: 137, deletions: 4 }, media: 2, unseen: true },
];

export const allAgents: MockAgent[] = [...agents.filter((a) => a.name !== 'agent-95' || a.project !== 'agentbox'), ...extraAgents];
export const keyOf = (a: MockAgent) => `${a.project}/${a.name}`;
export const reviewOf = (a: MockAgent) => reviews.find((r) => r.key === keyOf(a));
