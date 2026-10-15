// Concept E's right-hand panel: one header button opens it, closed by
// default, like T3Code's (pingdotgg/t3code: the "Toggle right panel" button in
// apps/web/src/components/chat/PanelLayoutControls.tsx, mod+d in
// packages/shared/src/keybindings.ts; RightPanelTabs.tsx's tab strip; 540px
// wide by default and never leaving the chat under 360px,
// hooks/usePreviewPanelInlineSize.ts; a sheet from the right at 980px and
// below, rightPanelLayout.ts and RightPanelSheet.tsx). It gathers what sits
// in the chat header today: the lead's ⋯ items, Files (#306), Desktop,
// Terminal, Browser, Media, and the Pages tab back (#248). An agent picker at
// its top chooses whose they are: the project's repository (the lead's) or
// any agent, and a filter keeps only those that still hold a machine.
//
// Three layouts of the same panel, picked with &rp=:
//   1  tabs along the top, the agent picker above them
//   2  a vertical icon rail on the panel's outer edge, the picker in its header
//   3  the agents as a list down the panel's left, the tabs on its right
// and, for screenshots:
//   &tab=files|desktop|terminal|browser|pages|media   the panel open on a tab
//   &on=lead|agent-12          whose (default: the chat in the middle)
//   &machines=1                only agents with a machine
//   &picker=1                  the picker's popover open (1 and 2)
//   &more=1                    the panel's ⋯ menu open
// Inline from 1024px, never leaving the chat under 360px; below 1024 (where
// E's sidebar is already a drawer) it's a drawer over the chat.
// Mock only: nothing here ships or is translated.
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Crown,
  Ellipsis,
  ExternalLink,
  File,
  FileCode,
  Film,
  Folder,
  FolderOpen,
  FolderTree,
  GitBranch,
  GitPullRequest,
  Globe,
  HardDrive,
  History,
  Images,
  Lock,
  Maximize2,
  Monitor,
  Moon,
  MousePointer2,
  Newspaper,
  PanelRight,
  Play,
  RotateCw,
  Search,
  Settings,
  SquareTerminal,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { ago, type MockAgent, project } from './data';
import { Avatar, ProjectMark } from './kit';

// ——— Whose: the repository, or an agent and its machine ———

export type Tab = 'files' | 'desktop' | 'terminal' | 'browser' | 'pages' | 'media';
export type Variant = 1 | 2 | 3;
// What an agent's machine is: running, stopped but kept (asleep), or freed
// (the agent finished and its machine was given back; its branch and what it
// published stay).
type Machine = 'running' | 'asleep' | 'freed';

const tabs: { id: Tab; label: string; icon: typeof Folder }[] = [
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'pages', label: 'Pages', icon: Newspaper },
  { id: 'media', label: 'Media', icon: Images },
];

// agent-39 and agent-91 merged but still hold their machines (nobody freed
// them yet); the retired ones below gave theirs back.
const kept = new Set(['agentbox/agent-39', 'agentbox/agent-91']);
export function machineOf(a: MockAgent): Machine {
  if (a.stage === 'stopped') return 'asleep';
  if (a.stage === 'done') return kept.has(`${a.project}/${a.name}`) ? 'running' : 'freed';
  return 'running';
}

// Which tabs a target has. The lead runs on the host with no machine: its
// repository has files, a terminal, pages and media, but no desktop or
// browser of its own. A freed agent keeps its branch, pages and media.
function hasTab(who: MockAgent | 'lead', tab: Tab, freedOk = false): boolean {
  if (who === 'lead') return tab !== 'desktop' && tab !== 'browser';
  if (machineOf(who) === 'freed' && !freedOk) return tab === 'files' || tab === 'pages' || tab === 'media';
  return true;
}

// ——— State, from the URL first ———

export interface PanelState {
  variant: Variant;
  open: boolean;
  tab: Tab;
  on: string | null; // 'lead', an agent's name, or null: follow the chat
  machines: boolean;
  picker: boolean;
  more: boolean;
}

const params = new URLSearchParams(location.search);

export function usePanel() {
  const [p, setP] = useState<PanelState>(() => ({
    variant: (Number(params.get('rp')) || 1) as Variant,
    open: params.has('tab'),
    tab: (params.get('tab') as Tab) ?? 'files',
    on: params.get('on'),
    machines: params.get('machines') === '1',
    picker: params.get('picker') === '1',
    more: params.get('more') === '1',
  }));
  const set = (patch: Partial<PanelState>) => setP((prev) => ({ ...prev, ...patch }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setP((prev) => ({ ...prev, open: !prev.open, picker: false, more: false }));
      }
      if (e.key === 'Escape') setP((prev) => (prev.picker || prev.more ? { ...prev, picker: false, more: false } : { ...prev, open: false }));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  return { p, set };
}

export const panelOn = params.has('rp');

// How wide it is, and whether it sits beside the chat or over it.
export function panelBox(variant: Variant, vw: number): { width: number; drawer: boolean } {
  if (vw < 1024) return { width: Math.min(Math.round(vw * 0.92), variant === 3 ? 520 : 440), drawer: true };
  const room = vw - 288 - 360; // the sidebar, and the least the chat keeps
  return { width: Math.min(variant === 3 ? 620 : 500, room), drawer: false };
}

// ——— The header's one button ———

export function PanelButton({ p, set, fresh }: { p: PanelState; set: (patch: Partial<PanelState>) => void; fresh: number }) {
  return (
    <button
      type="button"
      title="Panel: files, desktop, terminal, pages (⌘D)"
      aria-label="Toggle the panel"
      onClick={() => set({ open: !p.open, picker: false, more: false })}
      className={cn('relative flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-strong hover:text-title', p.open && 'bg-surface-strong text-title')}
    >
      <PanelRight className="size-4" />
      {!p.open && fresh > 0 && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-brand-500 ring-2 ring-[var(--color-chat)]" />}
    </button>
  );
}

// ——— The panel ———

interface Props {
  p: PanelState;
  set: (patch: Partial<PanelState>) => void;
  proj: string;
  agents: MockAgent[]; // the project's, newest first
  follow: string | null; // the agent whose chat is in the middle, if any
  width: number;
  drawer: boolean;
}

export function RightPanel(props: Props) {
  const { p, set, drawer, width } = props;
  if (!p.open) return null;
  const body = p.variant === 1 ? <TopTabs {...props} /> : p.variant === 2 ? <IconRail {...props} /> : <ListAndTabs {...props} />;
  return (
    <>
      {drawer && <div className="fixed inset-0 z-30 bg-black/40" onClick={() => set({ open: false })} />}
      <aside
        style={{ width }}
        className={cn('relative flex shrink-0 flex-col border-l border-line', drawer ? 'fixed inset-y-0 right-0 z-40 bg-chat shadow-2xl' : 'bg-rail')}
      >
        {body}
      </aside>
    </>
  );
}

// The project's agents that finished and were retired: no machine, but
// their branch, pages and media stay, so the picker still lists them unless
// the filter is on.
const retired: MockAgent[] = [
  { project: 'agentbox', name: 'agent-80', title: 'Hatch page stack race', ai: 'claude', stage: 'done', mins: 20 * 60, note: 'Merged #260.', branch: 'agentbox/agent-80' },
  { project: 'agentbox', name: 'agent-77', title: 'PR labels and a Mine filter', ai: 'codex', stage: 'done', mins: 22 * 60, note: 'Merged #264.', branch: 'agentbox/agent-77' },
];

function everyone(proj: string, agents: MockAgent[]) {
  return proj === 'agentbox' ? [...agents, ...retired] : agents;
}

function useWho({ p, proj, agents: own, follow }: Props) {
  const agents = everyone(proj, own);
  const name = p.on ?? follow ?? 'lead';
  const who: MockAgent | 'lead' = name === 'lead' ? 'lead' : (agents.find((a) => a.name === name) ?? 'lead');
  const shown = p.machines ? agents.filter((a) => machineOf(a) !== 'freed') : agents;
  return { who, shown };
}

// (1) The picker above a strip of tabs.
function TopTabs(props: Props) {
  const { p, set, width } = props;
  const { who } = useWho(props);
  const compact = width < 440;
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line-faint px-2">
        <PickerButton {...props} who={who} wide />
        <MoreButton {...props} who={who} />
        <CloseButton set={set} />
      </div>
      <nav className="flex shrink-0 items-end gap-0.5 border-b border-line px-2">
        {tabs.map((t) => {
          const ok = hasTab(who, t.id);
          const on = p.tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={ok ? t.label : `${t.label}: ${unavailable(who, t.id)}`}
              onClick={() => set({ tab: t.id })}
              className={cn(
                '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2 text-[12px]',
                on ? 'border-brand-500 font-medium text-title' : 'border-transparent text-subtle hover:text-title',
                !ok && 'opacity-40',
              )}
            >
              <t.icon className="size-3.5 shrink-0" />
              {(!compact || on) && t.label}
              {t.id === 'pages' && <NewCount who={who} />}
            </button>
          );
        })}
      </nav>
      <Body {...props} who={who} />
      {p.picker && <PickerPopover {...props} who={who} />}
    </>
  );
}

// (2) A rail of icons down the panel's outer edge; the picker in the header.
function IconRail(props: Props) {
  const { p, set } = props;
  const { who } = useWho(props);
  const tab = tabs.find((t) => t.id === p.tab)!;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line-faint px-3">
          <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-title">
            <tab.icon className="size-4 text-subtle" /> {tab.label}
          </span>
          <span className="text-faint">·</span>
          <PickerButton {...props} who={who} />
          <span className="ml-auto" />
          <MoreButton {...props} who={who} />
        </div>
        <Body {...props} who={who} />
      </div>
      <nav className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-line bg-ink/40 py-1.5">
        <CloseButton set={set} />
        <span className="my-1 h-px w-6 bg-line" />
        {tabs.map((t) => {
          const ok = hasTab(who, t.id);
          const on = p.tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={ok ? t.label : `${t.label}: ${unavailable(who, t.id)}`}
              aria-label={t.label}
              onClick={() => set({ tab: t.id })}
              className={cn(
                'relative flex size-8 items-center justify-center rounded-md',
                on ? 'bg-surface-strong text-title' : 'text-subtle hover:bg-surface hover:text-title',
                !ok && 'opacity-35',
              )}
            >
              {on && <span className="absolute -right-1.5 top-1.5 h-5 w-0.5 rounded-full bg-brand-500" />}
              <t.icon className="size-4" />
              {t.id === 'pages' && <NewCount who={who} dot />}
            </button>
          );
        })}
      </nav>
      {p.picker && <PickerPopover {...props} who={who} />}
    </div>
  );
}

// (3) The agents down the left, always in view; the tabs on the right.
function ListAndTabs(props: Props) {
  const { p, set, proj, width } = props;
  const { who, shown } = useWho(props);
  const slim = width < 520;
  const pick = (on: string) => set({ on });
  return (
    <div className="flex min-h-0 flex-1">
      <div className={cn('flex shrink-0 flex-col border-r border-line bg-ink/30', slim ? 'w-12 items-center' : 'w-[188px]')}>
        <div className={cn('flex h-11 shrink-0 items-center border-b border-line-faint', slim ? 'justify-center' : 'gap-1.5 px-2.5')}>
          <MachineToggle on={p.machines} onClick={() => set({ machines: !p.machines })} small={slim} />
          {!slim && <span className="ml-auto text-[11px] text-faint">{shown.length + 1}</span>}
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto py-1.5', slim ? 'space-y-1' : 'space-y-px px-1.5')}>
          <ListRow slim={slim} active={who === 'lead'} onClick={() => pick('lead')} title="Repository" sub={`${project(proj).display} · main`} icon={<ProjectMark name={proj} className="size-6 rounded-md text-[10px]" />} badge={<Crown className="size-3 text-amber-300" />} />
          {!slim && <div className="px-2 pb-0.5 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-faint">Agents</div>}
          {slim && <span className="mx-auto my-1 block h-px w-6 bg-line" />}
          {shown.map((a) => (
            <ListRow key={a.name} slim={slim} active={who !== 'lead' && who.name === a.name} onClick={() => pick(a.name)} title={a.name} sub={a.title} icon={<Avatar a={a} className="size-6" />} badge={<MachineMark m={machineOf(a)} />} dim={machineOf(a) === 'freed'} />
          ))}
          {p.machines && !slim && <div className="px-2 pt-2 text-[11px] text-faint">{everyone(proj, props.agents).length - shown.length} without a machine hidden</div>}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-line-faint pl-1.5 pr-1">
          {tabs.map((t) => {
            const ok = hasTab(who, t.id);
            const on = p.tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={ok ? t.label : `${t.label}: ${unavailable(who, t.id)}`}
                onClick={() => set({ tab: t.id })}
                className={cn('relative flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px]', on ? 'bg-surface-strong font-medium text-title' : 'text-subtle hover:bg-surface hover:text-title', !ok && 'opacity-35')}
              >
                <t.icon className="size-3.5 shrink-0" />
                {on && t.label}
                {t.id === 'pages' && <NewCount who={who} dot />}
              </button>
            );
          })}
          <span className="ml-auto" />
          <MoreButton {...props} who={who} />
          <CloseButton set={set} />
        </div>
        <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-line-faint px-3 text-[11.5px] text-subtle">
          <WhoLine who={who} proj={proj} />
        </div>
        <Body {...props} who={who} />
      </div>
    </div>
  );
}

function ListRow({ slim, active, onClick, title, sub, icon, badge, dim }: { slim: boolean; active: boolean; onClick: () => void; title: string; sub: string; icon: ReactNode; badge: ReactNode; dim?: boolean }) {
  if (slim)
    return (
      <button type="button" title={`${title}: ${sub}`} onClick={onClick} className={cn('relative mx-auto flex size-9 items-center justify-center rounded-lg', active ? 'bg-surface-strong ring-1 ring-brand-500/60' : 'hover:bg-surface', dim && 'opacity-45')}>
        {icon}
        <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-rail">{badge}</span>
      </button>
    );
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left', active ? 'bg-surface-strong' : 'hover:bg-surface', dim && 'opacity-50')}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[12px] font-medium text-title">{title}</span>
        <span className="block truncate text-[11px] text-subtle">{sub}</span>
      </span>
      <span className="shrink-0">{badge}</span>
    </button>
  );
}

// ——— The picker ———

function PickerButton({ p, set, proj, who, wide }: Props & { who: MockAgent | 'lead'; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => set({ picker: !p.picker, more: false })}
      className={cn('flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface', wide && 'flex-1', p.picker && 'bg-surface')}
    >
      {who === 'lead' ? <ProjectMark name={proj} className="size-6 rounded-md text-[10px]" /> : <Avatar a={who} className={wide ? 'size-6' : 'size-5'} />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-title">
          {who === 'lead' ? 'Repository' : who.name}
          {who === 'lead' ? <Crown className="size-3 text-amber-300" /> : <MachineMark m={machineOf(who)} />}
        </span>
        {wide && <span className="block truncate text-[11px] text-subtle">{who === 'lead' ? `${project(proj).display} · main, on this computer` : who.title}</span>}
      </span>
      <ChevronDown className="size-3.5 shrink-0 text-subtle" />
    </button>
  );
}

function PickerPopover({ p, set, proj, agents: own, who }: Props & { who: MockAgent | 'lead' }) {
  const agents = everyone(proj, own);
  const shown = p.machines ? agents.filter((a) => machineOf(a) !== 'freed') : agents;
  const pick = (on: string) => set({ on, picker: false });
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => set({ picker: false })} />
      <div className={cn('absolute left-2 z-50 overflow-hidden rounded-xl border border-line bg-modal shadow-2xl', p.variant === 1 ? 'top-11 w-[min(360px,calc(100%-16px))]' : 'top-10 w-[min(360px,calc(100%-60px))]')}>
        <div className="flex items-center gap-2 border-b border-line-faint px-3 py-2">
          <Search className="size-3.5 text-faint" />
          <span className="flex-1 text-[12.5px] text-faint">Find an agent…</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-line-faint px-3 py-2">
          <span className="text-[11.5px] text-subtle">{p.machines ? `${shown.length} of ${agents.length} agents` : `${agents.length} agents`}</span>
          <MachineToggle on={p.machines} onClick={() => set({ machines: !p.machines })} />
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1">
          <PickRow active={who === 'lead'} onClick={() => pick('lead')} icon={<ProjectMark name={proj} className="size-7 rounded-md text-[11px]" />} title={<>Repository <Crown className="size-3 text-amber-300" /></>} sub={`${project(proj).display} · main, the lead’s checkout`} right={<span className="text-[10.5px] text-faint">Host</span>} />
          <div className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-faint">Agents</div>
          {shown.map((a) => {
            const m = machineOf(a);
            return (
              <PickRow
                key={a.name}
                active={who !== 'lead' && who.name === a.name}
                onClick={() => pick(a.name)}
                icon={<Avatar a={a} />}
                title={a.name}
                sub={a.title}
                dim={m === 'freed'}
                right={<span className="flex items-center gap-1 text-[10.5px] text-subtle"><MachineMark m={m} /> {m === 'running' ? 'Running' : m === 'asleep' ? 'Asleep' : 'Freed'}</span>}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

function PickRow({ active, onClick, icon, title, sub, right, dim }: { active: boolean; onClick: () => void; icon: ReactNode; title: ReactNode; sub: string; right: ReactNode; dim?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface', active && 'bg-surface-strong', dim && 'opacity-50')}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[12.5px] font-medium text-title">{title}</span>
        <span className="block truncate text-[11px] text-subtle">{sub}</span>
      </span>
      {right}
      <Check className={cn('size-3.5 shrink-0 text-brand-400', !active && 'invisible')} />
    </button>
  );
}

function MachineToggle({ on, onClick, small }: { on: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      title="Only agents that still hold a machine"
      onClick={onClick}
      className={cn('flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]', on ? 'border-brand-500/60 bg-brand-500/15 text-title' : 'border-line text-subtle hover:text-title', small && 'px-1.5')}
    >
      <HardDrive className="size-3" />
      {!small && 'With a machine'}
      {!small && on && <X className="size-3" />}
    </button>
  );
}

function MachineMark({ m }: { m: Machine }) {
  if (m === 'running') return <span title="Machine running" className="block size-1.5 rounded-full bg-emerald-400" />;
  if (m === 'asleep') return <Moon className="size-3 text-subtle" aria-label="Machine asleep" />;
  return <Unplug className="size-3 text-faint" aria-label="Machine freed" />;
}

function WhoLine({ who, proj }: { who: MockAgent | 'lead'; proj: string }) {
  if (who === 'lead') return <><GitBranch className="size-3" /> main <span className="text-faint">·</span> the lead’s checkout of {project(proj).display}, on this computer</>;
  const m = machineOf(who);
  return (
    <>
      <GitBranch className="size-3 shrink-0" /> <span className="truncate">{who.branch}</span>
      <span className="text-faint">·</span>
      <span className="flex shrink-0 items-center gap-1"><MachineMark m={m} /> {m === 'running' ? 'machine running' : m === 'asleep' ? 'machine asleep' : 'machine freed'}</span>
    </>
  );
}

function CloseButton({ set }: { set: (patch: Partial<PanelState>) => void }) {
  return (
    <button type="button" title="Close (⌘D)" aria-label="Close the panel" onClick={() => set({ open: false })} className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-strong hover:text-title">
      <X className="size-4" />
    </button>
  );
}

// The ⋯ menu: what the lead's ⋯ held, for the repository; an agent's own
// for an agent.
function MoreButton({ p, set, proj, who }: Props & { who: MockAgent | 'lead' }) {
  const items: { icon: typeof Folder; label: string; danger?: boolean }[] =
    who === 'lead'
      ? [
          { icon: FolderOpen, label: 'Open the repository folder' },
          { icon: GitPullRequest, label: 'Pull requests' },
          { icon: History, label: 'Past agents' },
          { icon: Trash2, label: 'Free finished agents’ machines' },
          { icon: Settings, label: `${project(proj).display} settings` },
          { icon: X, label: 'Remove project', danger: true },
        ]
      : [
          { icon: FolderOpen, label: 'Open its worktree folder' },
          { icon: History, label: 'Snapshots' },
          { icon: Moon, label: machineOf(who) === 'asleep' ? 'Wake the machine' : 'Put the machine to sleep' },
          { icon: Settings, label: 'Agent settings' },
          { icon: Trash2, label: 'Retire and free the machine', danger: true },
        ];
  return (
    <span className="relative">
      <button type="button" title="More" aria-label="More" onClick={() => set({ more: !p.more, picker: false })} className={cn('flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-strong hover:text-title', p.more && 'bg-surface-strong text-title')}>
        <Ellipsis className="size-4" />
      </button>
      {p.more && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => set({ more: false })} />
          <div className="absolute right-0 top-8 z-50 w-64 rounded-xl border border-line bg-modal p-1 shadow-2xl">
            {items.map((i) => (
              <div key={i.label} className={cn('flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-surface', i.danger ? 'text-rose-300' : 'text-primary')}>
                <i.icon className="size-3.5 shrink-0 opacity-80" /> {i.label}
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

// ——— The tabs' contents ———

function unavailable(who: MockAgent | 'lead', tab: Tab) {
  if (who === 'lead') return tab === 'desktop' ? 'the lead runs on this computer, with no desktop of its own' : 'the lead has no machine to browse from';
  return 'its machine was freed';
}

function Body(props: Props & { who: MockAgent | 'lead' }) {
  const { p, who } = props;
  if (!hasTab(who, p.tab)) return <Unavailable {...props} />;
  if (who !== 'lead' && machineOf(who) === 'asleep' && ['desktop', 'terminal', 'browser'].includes(p.tab)) return <Asleep a={who} tab={p.tab} />;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {p.tab === 'files' && <Files who={who} />}
      {p.tab === 'desktop' && <Desktop a={who as MockAgent} />}
      {p.tab === 'terminal' && <Terminal who={who} />}
      {p.tab === 'browser' && <Browser a={who as MockAgent} />}
      {p.tab === 'pages' && <Pages {...props} />}
      {p.tab === 'media' && <MediaGrid who={who} />}
    </div>
  );
}

function Unavailable({ p, set, agents, who }: Props & { who: MockAgent | 'lead' }) {
  const withDesktop = agents.filter((a) => machineOf(a) === 'running').slice(0, 4);
  const tab = tabs.find((t) => t.id === p.tab)!;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <tab.icon className="size-8 text-faint" />
      <p className="max-w-[300px] text-[12.5px] text-subtle">No {tab.label.toLowerCase()} here: {unavailable(who, p.tab)}.</p>
      {withDesktop.length > 0 && (
        <div className="w-full max-w-[280px] space-y-1">
          <div className="text-[11px] text-faint">Show an agent’s instead</div>
          {withDesktop.map((a) => (
            <button key={a.name} type="button" onClick={() => set({ on: a.name })} className="flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left hover:bg-surface">
              <Avatar a={a} className="size-5" />
              <span className="text-[12px] font-medium text-title">{a.name}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-subtle">{a.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Asleep({ a, tab }: { a: MockAgent; tab: Tab }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Moon className="size-8 text-faint" />
      <p className="max-w-[280px] text-[12.5px] text-subtle">{a.name}’s machine is asleep{a.snoozed ? ` until ${a.snoozed}` : ''}. Wake it to see its {tab}.</p>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-[12px] font-medium text-white"><Play className="size-3.5" /> Wake {a.name}</span>
    </div>
  );
}

// Files (#306): the tree, what changed marked, one file open below it.
function Files({ who }: { who: MockAgent | 'lead' }) {
  const lead = who === 'lead';
  const freed = !lead && machineOf(who) === 'freed';
  type Node = [depth: number, name: string, kind: 'dir' | 'open' | 'file', mark?: 'M' | 'A'];
  const tree: Node[] = [
    [0, 'desktop', 'open'],
    [1, 'src', 'open'],
    [2, 'renderer', 'open'],
    [3, 'components', 'open'],
    [4, 'AddProjectDialog.tsx', 'file', lead ? undefined : 'M'],
    [4, 'Sidebar.tsx', 'file', lead ? undefined : 'M'],
    [4, 'TopBar.tsx', 'file'],
    [3, 'lib', 'dir'],
    [2, 'shared', 'dir'],
    [1, 'package.json', 'file'],
    [0, 'internal', 'dir'],
    [0, 'cmd', 'dir'],
    [0, 'AGENTS.md', 'file'],
    [0, 'go.mod', 'file'],
  ];
  const openFile = 'Sidebar.tsx';
  const code = [
    ['318', '  return (', ''],
    ['319', '    <aside className="flex w-[288px] flex-col">', ''],
    ['320', '      <NewProjectButton onClick={openAddProject} />', 'add'],
    ['321', '      <ProjectList projects={projects} folded={folded} />', ''],
    ['322', '    </aside>', ''],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <span className="flex h-7 flex-1 items-center gap-1.5 rounded-md border border-line bg-surface-faint px-2 text-[12px] text-faint"><Search className="size-3.5" /> Go to file…</span>
        {!lead && <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-secondary">2 changed</span>}
      </div>
      {freed && <div className="mx-3 mb-2 rounded-md bg-surface px-2.5 py-1.5 text-[11.5px] text-subtle">From the branch {who.branch} on GitHub: its machine was freed, so this is read-only.</div>}
      <div className="px-1.5 pb-2">
        {tree.map(([d, name, kind, mark]) => (
          <div key={`${d}${name}`} style={{ paddingLeft: 6 + d * 14 }} className={cn('flex h-[26px] items-center gap-1.5 rounded-md pr-2 text-[12.5px]', name === openFile ? 'bg-surface-strong text-title' : 'text-secondary hover:bg-surface')}>
            {kind === 'file' ? <span className="w-3" /> : kind === 'open' ? <ChevronDown className="size-3 text-faint" /> : <ChevronRight className="size-3 text-faint" />}
            {kind === 'file' ? (name.endsWith('.tsx') || name.endsWith('.mod') ? <FileCode className="size-3.5 text-sky-300/80" /> : <File className="size-3.5 text-subtle" />) : kind === 'open' ? <FolderOpen className="size-3.5 text-amber-300/80" /> : <Folder className="size-3.5 text-amber-300/80" />}
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {mark && <span className={cn('text-[10.5px] font-semibold', mark === 'M' ? 'text-amber-300' : 'text-emerald-300')}>{mark}</span>}
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-line">
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] text-subtle">
          <FileCode className="size-3.5 text-sky-300/80" /> <span className="truncate">components/Sidebar.tsx</span>
          {!lead && <span className="ml-auto shrink-0 text-emerald-300">+1</span>}
        </div>
        <pre className="overflow-x-auto bg-ink px-0 py-2 font-mono text-[11.5px] leading-[1.6]">
          {code.map(([n, line, kind]) => (
            <div key={n} className={cn('flex', kind === 'add' && !lead && 'bg-emerald-500/10')}>
              <span className="w-10 shrink-0 select-none pr-3 text-right text-faint">{n}</span>
              <span className={cn('whitespace-pre', kind === 'add' && !lead ? 'text-emerald-200' : 'text-secondary')}>{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// The agent's desktop: its display, live, as the Desktop tab shows it.
function Desktop({ a }: { a: MockAgent }) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-1.5 text-[11.5px] text-subtle">
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live</span>
        <span>View only</span>
        <span className="ml-auto flex items-center gap-1">
          <span className="inline-flex h-6 items-center gap-1 rounded-md border border-line px-2 text-[11px] text-secondary"><MousePointer2 className="size-3" /> Take control</span>
          <span className="inline-flex h-6 items-center gap-1 rounded-md border border-line px-2 text-[11px] text-secondary"><CircleDot className="size-3 text-rose-400" /> Record</span>
          <span className="flex size-6 items-center justify-center rounded-md border border-line text-secondary"><Maximize2 className="size-3" /></span>
        </span>
      </div>
      {/* The agent's screen, drawn: a desktop bar, Chromium on the preview. */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-line bg-[#1d2330] shadow-inner">
        <div className="flex h-[6%] items-center gap-2 bg-black/50 px-2 text-[8px] text-white/60">
          <span>Activities</span>
          <span className="ml-auto">14:07</span>
        </div>
        <div className="absolute left-[5%] top-[11%] h-[82%] w-[90%] overflow-hidden rounded-md bg-[#f6f6f8] shadow-xl">
          <div className="flex h-[9%] items-center gap-1 bg-[#dfe1e6] px-2">
            <span className="size-1.5 rounded-full bg-rose-400" /><span className="size-1.5 rounded-full bg-amber-400" /><span className="size-1.5 rounded-full bg-emerald-400" />
            <span className="ml-2 h-[60%] flex-1 rounded bg-white px-1.5 text-[7px] leading-[1.9] text-zinc-500">localhost:5173/preview.html?open=agent-99</span>
          </div>
          <div className="flex h-[91%]">
            <div className="w-[28%] space-y-1 bg-[#14161c] p-1.5">
              <div className="h-3 rounded bg-indigo-500/80 text-center text-[6px] leading-3 text-white">+ New project</div>
              {[70, 55, 80, 62, 48, 74].map((w, i) => <div key={i} className="h-2 rounded bg-white/15" style={{ width: `${w}%` }} />)}
            </div>
            <div className="flex-1 space-y-1.5 p-2">
              {[90, 65, 80, 40].map((w, i) => <div key={i} className="h-2 rounded bg-zinc-300" style={{ width: `${w}%` }} />)}
            </div>
          </div>
        </div>
        <MousePointer2 className="absolute left-[18%] top-[24%] size-3.5 fill-white text-black" />
      </div>
      <div className="flex items-center gap-1.5 text-[11.5px] text-subtle">
        <Monitor className="size-3.5 shrink-0" /> <span className="truncate">{a.name}’s display · 1280×800</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-secondary">Open in a window <ExternalLink className="size-3" /></span>
      </div>
    </div>
  );
}

function Terminal({ who }: { who: MockAgent | 'lead' }) {
  const lead = who === 'lead';
  const lines = lead
    ? ['~/src/agentbox (main) $ git log --oneline -3', '2deb36ce chore: mock concept E, a lead-first sidebar', 'c5e6ead4 chore: mock concept D v2', 'aad703bd chore: mock four navigation concepts', '~/src/agentbox (main) $ ▍']
    : ['$ npm --prefix desktop run typecheck', '> tsgo --noEmit', '✓ no errors (3.1s)', '$ npm --prefix desktop test -- Sidebar', '▶ Sidebar', '  ✔ shows New project at the top (12ms)', '  ✔ opens the dialog on click (8ms)', 'ℹ tests 2  pass 2  fail 0', '$ ▍'];
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line-faint px-2 py-1 text-[11.5px]">
        {(lead ? ['shell'] : ['claude', 'shell']).map((t, i) => (
          <span key={t} className={cn('rounded px-2 py-0.5', i === (lead ? 0 : 1) ? 'bg-surface-strong text-title' : 'text-subtle')}>{t}</span>
        ))}
        <span className="ml-auto text-faint">{lead ? 'on this computer' : 'tmux on its machine'}</span>
      </div>
      <pre className="flex-1 overflow-auto bg-[#0b0d12] p-3 font-mono text-[11.5px] leading-[1.6] text-zinc-300">
        {lines.map((l, i) => <div key={i} className={cn(l.startsWith('✓') || l.includes('✔') ? 'text-emerald-400' : l.startsWith('$') || l.startsWith('~') ? 'text-zinc-100' : '')}>{l}</div>)}
      </pre>
    </div>
  );
}

function Browser({ a }: { a: MockAgent }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line-faint px-2 py-1.5">
        <RotateCw className="size-3.5 text-subtle" />
        <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-surface-faint px-2 text-[12px] text-secondary">
          <Lock className="size-3 shrink-0 text-faint" /> <span className="truncate">5173.{a.name}.agentbox.localhost:7777/preview.html</span>
        </span>
        <ExternalLink className="size-3.5 text-subtle" />
      </div>
      <div className="m-3 flex-1 overflow-hidden rounded-lg border border-line bg-[#f6f6f8]">
        <div className="flex h-full">
          <div className="w-[34%] space-y-1.5 bg-[#14161c] p-2">
            <div className="h-5 rounded bg-indigo-500/90 text-center text-[10px] leading-5 text-white">+ New project</div>
            {[70, 55, 80, 62, 48, 74, 66].map((w, i) => <div key={i} className="h-2.5 rounded bg-white/15" style={{ width: `${w}%` }} />)}
          </div>
          <div className="flex-1 space-y-2 p-3">
            {[90, 65, 80, 40, 70].map((w, i) => <div key={i} className="h-2.5 rounded bg-zinc-300" style={{ width: `${w}%` }} />)}
          </div>
        </div>
      </div>
      <div className="px-3 pb-2 text-[11px] text-faint">Its dev server on port 5173, through the preview proxy.</div>
    </div>
  );
}

// ——— Pages (#248 back): what the agent, or the whole project, published ———

type Look = 'compare' | 'report' | 'flame' | 'notes' | 'board' | 'none';
interface Page { title: string; by: string; mins: number; look: Look; fresh?: boolean; version?: number; shared?: boolean; expires?: string }
const pages: Page[] = [
  { title: 'Sidebar: before and after', by: 'agent-12', mins: 2, look: 'compare', fresh: true, expires: '23h' },
  { title: 'Q3 usage report', by: 'lead', mins: 6, look: 'report', fresh: true, version: 3, expires: '23h' },
  { title: 'Daemon startup flame graph', by: 'agent-98', mins: 14, look: 'flame', fresh: true, version: 2, expires: '23h' },
  { title: 'Onboarding flow — design notes', by: 'agent-97', mins: 180, look: 'notes', shared: true },
  { title: 'Release CI: what failed and why', by: 'agent-41', mins: 300, look: 'board', expires: '19h' },
  { title: 'Sidebar spacing options', by: 'agent-12', mins: 420, look: 'none', expires: '17h' },
];

function NewCount({ who, dot }: { who: MockAgent | 'lead'; dot?: boolean }) {
  const n = pages.filter((x) => x.fresh && (who === 'lead' || x.by === who.name)).length;
  if (!n) return null;
  if (dot) return <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-brand-500" />;
  return <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold leading-4 text-white">{n}</span>;
}

function Pages({ who, proj }: Props & { who: MockAgent | 'lead' }) {
  const [scope, setScope] = useState<'agent' | 'project'>(who === 'lead' ? 'project' : 'agent');
  useEffect(() => setScope(who === 'lead' ? 'project' : 'agent'), [who]);
  const list = scope === 'project' || who === 'lead' ? pages : pages.filter((x) => x.by === who.name);
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        {who !== 'lead' ? (
          <span className="flex rounded-md border border-line p-0.5 text-[11.5px]">
            {(['agent', 'project'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setScope(k)} className={cn('rounded px-2 py-0.5', scope === k ? 'bg-surface-strong text-title' : 'text-subtle')}>
                {k === 'agent' ? who.name : `All of ${project(proj).display}`}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-[12px] text-subtle">Published by the lead and every agent</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-faint"><span className="size-1.5 rounded-full bg-emerald-400" /> Hatch</span>
      </div>
      {list.map((x) => (
        <div key={x.title} className="group flex gap-3 rounded-lg border border-line bg-surface-faint p-2 hover:bg-surface">
          <Thumb look={x.look} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {x.fresh && <span className="size-1.5 shrink-0 rounded-full bg-brand-500" title="New" />}
              <span className="truncate text-[12.5px] font-medium text-title">{x.title}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-subtle">
              <span>{x.by === 'lead' ? 'the lead' : x.by}</span>
              <span className="text-faint">·</span>
              <span>{ago(x.mins)} ago</span>
              {x.version && x.version > 1 && <><span className="text-faint">·</span><span>v{x.version}</span></>}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px]">
              {x.shared ? (
                <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-px text-sky-300"><Globe className="size-2.5" /> Public, kept</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-surface-strong px-1.5 py-px text-subtle"><Lock className="size-2.5" /> Private · {x.expires} left</span>
              )}
              <span className="ml-auto hidden items-center gap-1 text-secondary group-hover:inline-flex">Open <ExternalLink className="size-3" /></span>
            </div>
          </div>
        </div>
      ))}
      {list.length === 0 && <div className="py-8 text-center text-[12px] text-subtle">{who !== 'lead' && who.name} hasn’t published a page.</div>}
    </div>
  );
}

// A page's thumbnail, drawn in the shape of what it is.
function Thumb({ look }: { look: Look }) {
  return (
    <div className="flex h-[52px] w-[76px] shrink-0 overflow-hidden rounded-md border border-line bg-white p-1">
      {look === 'compare' && <div className="flex flex-1 gap-0.5"><div className="flex-1 rounded-sm bg-zinc-800" /><div className="flex-1 rounded-sm bg-indigo-500/70" /></div>}
      {look === 'report' && <div className="flex flex-1 items-end gap-0.5 px-0.5">{[40, 65, 50, 85, 70, 95].map((h, i) => <div key={i} className="flex-1 rounded-t-sm bg-sky-500" style={{ height: `${h}%` }} />)}</div>}
      {look === 'flame' && <div className="flex flex-1 flex-col justify-end gap-px">{[30, 55, 75, 100].map((w, i) => <div key={i} className="h-1.5 rounded-sm bg-orange-400" style={{ width: `${w}%`, opacity: 0.55 + i * 0.15 }} />)}</div>}
      {look === 'notes' && <div className="flex-1 space-y-1 p-0.5">{[85, 60, 75, 50].map((w, i) => <div key={i} className="h-1 rounded bg-zinc-300" style={{ width: `${w}%` }} />)}</div>}
      {look === 'board' && <div className="flex flex-1 gap-0.5">{['bg-rose-300', 'bg-amber-200', 'bg-emerald-300'].map((c) => <div key={c} className={cn('flex-1 rounded-sm', c)} />)}</div>}
      {look === 'none' && <div className="flex flex-1 items-center justify-center text-zinc-400"><Newspaper className="size-4" /></div>}
    </div>
  );
}

function MediaGrid({ who }: { who: MockAgent | 'lead' }) {
  const items = [
    { kind: 'recording', label: 'New project button', by: 'agent-12' },
    { kind: 'shot', label: 'Sidebar, dark', by: 'agent-12' },
    { kind: 'shot', label: 'Sidebar, light', by: 'agent-12' },
    { kind: 'shot', label: 'Rail overflow fixed', by: 'agent-96' },
    { kind: 'recording', label: 'Release CI rerun', by: 'agent-41' },
    { kind: 'shot', label: 'Flame graph', by: 'agent-98' },
  ].filter((m) => who === 'lead' || m.by === who.name);
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {items.map((m) => (
        <div key={m.label} className="overflow-hidden rounded-lg border border-line bg-surface-faint">
          <div className="relative flex aspect-video items-center justify-center bg-[#1d2330]">
            {m.kind === 'recording' ? <Film className="size-5 text-white/60" /> : <Images className="size-5 text-white/50" />}
          </div>
          <div className="truncate px-2 py-1 text-[11px] text-secondary">{m.label}{who === 'lead' && <span className="text-faint"> · {m.by}</span>}</div>
        </div>
      ))}
      {items.length === 0 && <div className="col-span-2 py-8 text-center text-[12px] text-subtle">Nothing in Media yet.</div>}
    </div>
  );
}
