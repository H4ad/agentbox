import { Check, ChevronLeft, GitPullRequest, Play } from 'lucide-react';
import { agents, toolName } from '../data';
import { c, mono, sans, tween } from '../theme';
import { AgentBadge } from './atoms';
import { Dashboard } from './Dashboard';

// Phone is the phone app's Review screen (mobile/src/features/review/ReviewScreen.tsx):
// the agent's card, its pull request with Merge, and the review buttons.
export const P = { enter: 41.6, tap: 44.0 };
export const PHONE_W = 410;
export const PHONE_H = 860;

export function Phone({ t }: { t: number }) {
  const a = agents[1];
  const merged = t >= P.tap + 0.1;
  const pressed = t > P.tap - 0.05 && t < P.tap + 0.15;
  const toast = tween(t, P.tap + 0.25, P.tap + 0.6) * (1 - tween(t, P.tap + 1.6, P.tap + 1.9));
  const tap = tween(t, P.tap - 0.05, P.tap + 0.5);
  return (
    <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 62, padding: 12, background: 'linear-gradient(160deg, #3a3a44, #121216 40%, #26262e)', boxShadow: '0 50px 120px rgb(0 0 0 / 0.75), inset 0 0 0 1.5px rgb(255 255 255 / 0.12)', fontFamily: sans }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 50, overflow: 'hidden', background: '#09090d' }}>
        <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', fontSize: 15, fontWeight: 600, color: c.title }}>
          9:41
          <div style={{ position: 'absolute', left: '50%', top: 12, width: 110, height: 30, marginLeft: -55, borderRadius: 99, background: '#000' }} />
          <span style={{ fontSize: 12, letterSpacing: 1 }}>●●● ▮</span>
        </div>
        <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ChevronLeft size={22} color={c.brand300} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.title }}>Review</div>
            <div style={{ fontSize: 13, color: c.muted }}>freshcart</div>
          </div>
        </div>
        <div style={{ margin: '14px 16px 0', padding: 16, borderRadius: 18, background: c.surface, border: `1px solid ${c.lineStrong}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: c.subtle }}>Agent 2 of 4</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <AgentBadge tool={a.tool} size={34} t={t} dot={c.sky400} seed={1} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: c.title }}>{a.title}</div>
              <div style={{ fontSize: 12.5, color: c.muted, fontFamily: mono }}>
                {a.ref} · {toolName[a.tool]}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.5, color: c.secondary }}>
            Added <b style={{ color: c.title }}>Export CSV</b> to the Orders page. It exports what the filters show, with the totals.
          </div>
          <div style={{ fontSize: 13, color: c.subtle }}>
            3 files changed <span style={{ color: c.emerald300 }}>+{a.added}</span> <span style={{ color: c.rose300 }}>−{a.removed}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{ position: 'relative', width: 108, height: 66, borderRadius: 9, overflow: 'hidden', border: `1px solid ${c.lineStrong}` }}>
                <Dashboard width={108} height={66} dark={k === 1 ? 1 : 0} />
                {k === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgb(0 0 0 / 0.3)' }}>
                    <Play size={18} color="#fff" fill="#fff" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{ margin: '12px 16px 0', padding: 16, borderRadius: 18, background: c.surface, border: `1px solid ${c.lineStrong}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <GitPullRequest size={16} color={c.emerald300} />
            <span style={{ fontFamily: mono, color: c.muted, fontSize: 14 }}>#{a.pr}</span>
            <span style={{ color: c.title, fontSize: 15.5, fontWeight: 600 }}>{a.prTitle}</span>
          </div>
          <div style={{ fontSize: 13, color: c.muted }}>
            open · <span style={{ color: c.emerald300 }}>checks passing</span> · +{a.added} −{a.removed}
          </div>
          <div style={{ position: 'relative', height: 50, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', fontWeight: 600, fontSize: 16, background: merged ? '#059669' : `linear-gradient(180deg, ${c.brandMid}, ${c.brandDeep})`, transform: `scale(${pressed ? 0.95 : 1})`, boxShadow: merged ? '0 0 30px rgb(16 185 129 / 0.5)' : '0 0 24px rgb(99 102 241 / 0.4)' }}>
            {merged ? (
              <>
                <Check size={18} color="#fff" strokeWidth={3} /> Merged #{a.pr}
              </>
            ) : (
              <>Merge · Squash ▾</>
            )}
            {tap > 0 && tap < 1 && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 90, height: 90, marginLeft: -45, marginTop: -45, borderRadius: 99, background: 'rgb(255 255 255 / 0.35)', transform: `scale(${0.2 + tap})`, opacity: 1 - tap }} />}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {['Back', 'Next', 'Request changes', 'Done reviewing'].map((l, k) => (
            <div key={l} style={{ height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 14.5, fontWeight: 600, color: k === 3 ? '#18181b' : c.secondary, background: k === 3 ? c.primary : c.surfaceStrong, border: `1px solid ${c.lineStrong}` }}>
              {l}
            </div>
          ))}
        </div>
        {toast > 0 && (
          <div style={{ position: 'absolute', left: 24, right: 24, top: 64, padding: '14px 16px', borderRadius: 16, background: 'rgb(30 30 38 / 0.97)', border: `1px solid ${c.lineVivid}`, display: 'flex', gap: 12, alignItems: 'center', opacity: toast, transform: `translateY(${(1 - toast) * -30}px)`, boxShadow: '0 20px 40px rgb(0 0 0 / 0.5)' }}>
            <div style={{ width: 30, height: 30, borderRadius: 99, background: 'rgb(16 185 129 / 0.2)', display: 'grid', placeItems: 'center' }}>
              <Check size={17} color={c.emerald300} strokeWidth={3} />
            </div>
            <div>
              <div style={{ color: c.title, fontWeight: 600, fontSize: 14.5 }}>Merged #{a.pr} into main</div>
              <div style={{ color: c.muted, fontSize: 12.5 }}>agent-42 is freed</div>
            </div>
          </div>
        )}
        {t > P.tap - 0.6 && t < P.tap + 0.5 && (
          <div style={{ position: 'absolute', left: PHONE_W / 2 - 12 - 28, top: 491 - 28 - 12 + (1 - tween(t, P.tap - 0.6, P.tap - 0.05)) * 60, width: 56, height: 56, borderRadius: 99, background: 'rgb(255 255 255 / 0.22)', border: '2px solid rgb(255 255 255 / 0.5)', opacity: tween(t, P.tap - 0.6, P.tap - 0.3) * (1 - tween(t, P.tap + 0.15, P.tap + 0.5)) }} />
        )}
      </div>
    </div>
  );
}
