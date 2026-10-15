// MOCK, not shipped behaviour: three alternatives to v2's project header
// (the top bar saying the project's name, then a block under it saying it
// again with the path, "Talk to another project" and "New agent"). dev/preview.tsx
// turns one on with &header=a|b|c; with none on (always, in the app) every
// check below is false and nothing changes.
//   a  one compact top bar: icon, name, muted path on hover; actions in a ⋯ menu
//   b  no header: identity is the sidebar row and the window title; actions in the composer's +
//   c  a slim breadcrumb Project › Lead, path in a copyable tooltip; actions in the panel's launcher
import { useSyncExternalStore } from 'react';

export type HeaderVariant = 'a' | 'b' | 'c';

let current: HeaderVariant | null = null;
const listeners = new Set<() => void>();

export function setHeaderMock(variant: HeaderVariant | null) {
  current = variant;
  for (const listener of listeners) listener();
}

export function useHeaderMock(): HeaderVariant | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

// The App opens its New agent dialog for whoever asks, so a menu deep in the
// chat doesn't need the prop ProjectView gets.
export const newAgentEvent = 'agentbox:new-agent';
export function requestNewAgent(project: string) {
  window.dispatchEvent(new CustomEvent(newAgentEvent, { detail: project }));
}

export const topSlotId = 'top-bar-slot';
