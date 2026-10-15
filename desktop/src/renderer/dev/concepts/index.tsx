// ?concept=a|b|c|d: four mock layouts of the app's navigation, to choose
// one from (agent-364's comparison page). Mock only: nothing here ships or
// is translated. &menu=1 opens D's project switcher; d2 is D with review in the
// agent's thread (threadsReview.tsx); e is lead-first, with review in a modal
// (leadFirst.tsx).
import { BoardConcept } from './board';
import { CommandConcept } from './command';
import { InboxConcept } from './inbox';
import { LeadFirstConcept } from './leadFirst';
import { ThreadsConcept } from './threads';
import { ThreadsReviewConcept } from './threadsReview';

export function Concepts({ which, menu }: { which: string; menu: boolean }) {
  const light = document.documentElement.dataset.appearance === 'light';
  return (
    <div style={{ font: '13px var(--font-sans)', ['--concept-tag-l' as string]: light ? '36%' : '72%' }}>
      {which === 'a' && <InboxConcept narrow={innerWidth < 1024} />}
      {which === 'b' && <BoardConcept />}
      {which === 'c' && <CommandConcept />}
      {which === 'd' && <ThreadsConcept openMenu={menu} />}
      {which === 'd2' && <ThreadsReviewConcept />}
      {which === 'e' && <LeadFirstConcept />}
    </div>
  );
}
