// MOCK (lib/headerMock.ts): the pieces of the three project-header
// alternatives. Nothing here is drawn unless dev/preview.tsx turns one on.
import { ArrowLeftRight, Check, ChevronRight, Copy, Ellipsis, FolderOpen, Paperclip, Plus, Smile } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as T from '../../../shared/api';
import { useT } from '../../lib/i18n';
import { requestNewAgent, topSlotId } from '../../lib/headerMock';
import { projectLabel } from '../../lib/projectName';
import { ProjectIcon } from '../ProjectIcon';
import { Button } from '../ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '../ui/menu';
import { Tip } from '../ui/tooltip';
import { TalkToProject } from './TalkToProject';

// TopSlot is where a view puts its own controls in the top bar.
export function TopSlot() {
  return <div id={topSlotId} className="flex min-w-0 items-center gap-1" />;
}

export function InTopBar({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.getElementById(topSlotId)), []);
  return el ? createPortal(children, el) : null;
}

// ProjectCrumb is the project's identity in the top bar: A the icon, name
// and, on hover, the muted root; C "Project › Lead", the root in a tooltip
// and copied on click. B draws none.
export function ProjectCrumb({ project, variant }: { project: T.Project; variant: 'a' | 'c' }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(project.root);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const name = <span className="max-w-[16rem] shrink-0 truncate font-medium text-primary">{projectLabel(project)}</span>;
  if (variant === 'a') {
    return (
      <span className="group flex min-w-0 items-center gap-2" data-mock-crumb="a">
        <ProjectIcon project={project} className="size-6 rounded-md" />
        {name}
        <span className="hidden min-w-0 truncate font-mono text-[11px] text-subtle opacity-0 transition-opacity group-hover:opacity-100 md:inline" data-mock-path>
          {project.root}
        </span>
      </span>
    );
  }
  return (
    <span className="group flex min-w-0 items-center gap-1.5" data-mock-crumb="c">
      <Tip label={project.root}>
        <button type="button" onClick={copy} className="-mx-1 flex min-w-0 items-center gap-1.5 truncate rounded-md px-1 text-primary hover:bg-surface-raised">
          {name}
        </button>
      </Tip>
      <button type="button" aria-label={t('headerMock.copyPath')} onClick={copy} className="shrink-0 rounded p-0.5 text-faint opacity-0 transition hover:text-primary focus-visible:opacity-100 group-hover:opacity-100" data-mock-copy>
        {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
      </button>
      <ChevronRight className="size-3.5 shrink-0 text-faint" />
      <span className="truncate text-muted">{t('headerMock.lead')}</span>
    </span>
  );
}

// ProjectMenu is variant A's ⋯, the project's items the header block held.
export function ProjectMenu({ project, leadRef, onChangeIcon }: { project: T.Project; leadRef: string; onChangeIcon: () => void }) {
  const t = useT();
  const [talk, setTalk] = useState(false);
  return (
    <TalkToProject
      project={project.name}
      leadRef={leadRef}
      open={talk}
      onOpenChange={setTalk}
      anchor={
        <span className="inline-flex">
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={t('project.view.actions')} data-project-menu>
                <Ellipsis />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>{projectLabel(project)}</MenuLabel>
              <MenuItem icon={Plus} onSelect={() => requestNewAgent(project.name)}>
                {t('project.view.newAgent')}
              </MenuItem>
              <MenuItem icon={ArrowLeftRight} onSelect={() => setTimeout(() => setTalk(true), 0)}>
                {t('v2.talk.button')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={Smile} onSelect={onChangeIcon}>
                {t('projectIcon.change')}
              </MenuItem>
              <MenuItem icon={FolderOpen} onSelect={() => void window.agentbox.openPath(project.root)}>
                {t('project.view.openFolder')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </span>
      }
    />
  );
}

// ComposerPlus is variant B's +, the composer's attach button grown into a
// menu with the two actions beside "Attach files".
export function ComposerPlus({ project, leadRef, onAttach, noAttach }: { project: string; leadRef: string; onAttach: () => void; noAttach?: string }) {
  const t = useT();
  const [talk, setTalk] = useState(false);
  return (
    <TalkToProject
      project={project}
      leadRef={leadRef}
      open={talk}
      onOpenChange={setTalk}
      anchor={
        <span className="shrink-0">
          <Menu>
            <MenuTrigger asChild>
              <button type="button" aria-label={t('headerMock.plus')} className="flex size-8 items-center justify-center rounded-full text-subtle transition hover:bg-surface-raised hover:text-primary" data-composer-plus>
                <Plus className="size-4" />
              </button>
            </MenuTrigger>
            <MenuContent align="start" side="top" className="w-64">
              <MenuItem icon={Paperclip} disabled={!!noAttach} onSelect={onAttach}>
                {t('chat.composer.attach')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={Plus} onSelect={() => requestNewAgent(project)}>
                {t('project.view.newAgent')}
              </MenuItem>
              <MenuItem icon={ArrowLeftRight} onSelect={() => setTimeout(() => setTalk(true), 0)}>
                {t('v2.talk.button')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </span>
      }
    />
  );
}
