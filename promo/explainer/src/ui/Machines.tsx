import { Check, Cpu, GitBranch, Sparkles } from 'lucide-react';
import { agents, toolName } from '../data';
import { c, mono, sans, tween, type Layout } from '../theme';
import { AgentBadge } from './atoms';
import { Dashboard } from './Dashboard';
import { agentWorking, statusAt } from './World';

// Machines is the spawn and parallel scenes' stage: the lead in the middle,
// and around it one card per agent, each a Linux machine of its own with its
// branch, booting and then working, all at once.
export const M = { enter: 16.8, exit: 25.6 };

type Box = { x: number; y: number; w: number; h: number };
function geometry(layout: Layout): { cards: Box[]; hub: { x: number; y: number } } {
  if (layout === 'wide') {
    const w = 740, h = 330, gx = 1920 / 2, top = 236, gapY = 70;
    return {
      cards: [
        { x: gx - 90 - w, y: top, w, h },
        { x: gx + 90, y: top, w, h },
        { x: gx - 90 - w, y: top + h + gapY, w, h },
        { x: gx + 90, y: top + h + gapY, w, h },
      ],
      hub: { x: gx, y: top + h + gapY / 2 },
    };
  }
  const w = 960, h = 300;
  return { cards: agents.map((_, i) => ({ x: 60, y: 600 + i * 325, w, h })), hub: { x: 540, y: 520 } };
}

const boot = (branch: string) => ['Linux machine started', `Worktree on ${branch}`, 'AI tool signed in'];

export function Machines({ t, layout }: { t: number; layout: Layout }) {
  if (t < M.enter - 0.1 || t > M.exit + 0.8) return null;
  const { cards, hub } = geometry(layout);
  const gone = tween(t, M.exit, M.exit + 0.6);
  const hubIn = tween(t, M.enter, M.enter + 0.5);
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: sans, opacity: 1 - gone }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="wire" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.brand400} />
            <stop offset="1" stopColor={c.brandFar} />
          </linearGradient>
        </defs>
        {cards.map((b, i) => {
          const p = tween(t, M.enter + 0.2 + i * 0.15, M.enter + 0.9 + i * 0.15);
          const tx = layout === 'wide' ? (b.x < hub.x ? b.x + b.w : b.x) : b.x + 40;
          const ty = layout === 'wide' ? (b.y < hub.y ? b.y + b.h - 40 : b.y + 40) : b.y;
          const d = layout === 'wide' ? `M${hub.x} ${hub.y} C ${hub.x} ${ty}, ${hub.x} ${ty}, ${tx} ${ty}` : `M${hub.x} ${hub.y + 30} L ${hub.x} ${hub.y + 50} L 100 ${hub.y + 50} L ${tx} ${ty}`;
          return (
            <g key={i}>
              <path d={d} stroke="url(#wire)" strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} opacity={0.7} />
              <path d={d} stroke="#fff" strokeWidth={3} fill="none" pathLength={1} strokeDasharray="0.04 0.96" strokeDashoffset={-((t * 0.5 + i * 0.25) % 1)} opacity={p * 0.8} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: hub.x, top: hub.y, transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * hubIn})`, opacity: hubIn, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRadius: 99, background: 'linear-gradient(180deg, #1d1838, #120f24)', border: `1px solid ${c.brand500}`, boxShadow: `0 0 40px rgb(139 92 246 / 0.5)`, color: c.title, fontWeight: 600, fontSize: 20, whiteSpace: 'nowrap' }}>
        <Sparkles size={20} color={c.brand300} /> freshcart · Lead
      </div>
      {cards.map((b, i) => (
        <Card key={i} i={i} b={b} t={t} layout={layout} />
      ))}
    </div>
  );
}

function Card({ i, b, t, layout }: { i: number; b: Box; t: number; layout: Layout }) {
  const a = agents[i];
  const at = M.enter + 0.35 + i * 0.15;
  const p = tween(t, at, at + 0.7);
  const st = statusAt(i, t);
  const work = tween(t, agentWorking(i), 25.4, 0, 1, (x) => x);
  const added = Math.round(a.added * work);
  const removed = Math.round(a.removed * work);
  const bodyH = b.h - 128;
  return (
    <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`, borderRadius: 20, background: 'linear-gradient(180deg, rgb(24 24 32 / 0.96), rgb(12 12 17 / 0.96))', border: `1px solid ${st.working ? 'rgb(52 211 153 / 0.35)' : c.lineVivid}`, boxShadow: `0 30px 80px rgb(0 0 0 / 0.55)${st.working ? ', 0 0 40px rgb(52 211 153 / 0.08)' : ''}`, overflow: 'hidden' }}>
      <div style={{ height: 68, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', borderBottom: `1px solid ${c.line}` }}>
        <AgentBadge tool={a.tool} size={42} t={t} working={st.working} dot={st.dot} seed={i} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: c.title, fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.title}</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 14, color: c.muted, alignItems: 'center' }}>
            <span style={{ fontFamily: mono }}>{a.ref}</span>·<span style={{ color: c.secondary }}>{toolName[a.tool]}</span>·<span style={{ color: st.color }}>{st.label}</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: c.secondary, padding: '3px 10px', borderRadius: 99, background: c.surface, border: `1px solid ${c.lineStrong}` }}>
            <Cpu size={14} color={c.brand300} /> own Linux machine
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: mono, color: c.brand300 }}>
            <GitBranch size={14} color={c.brand300} /> {a.branch}
          </span>
        </div>
      </div>
      <div style={{ height: bodyH, padding: '14px 20px', position: 'relative' }}>
        {t < agentWorking(i) ? <Boot t={t} i={i} branch={a.branch} /> : <Work i={i} t={t} h={bodyH - 28} w={b.w - 40} layout={layout} />}
      </div>
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 9, background: c.surfaceStrong, overflow: 'hidden' }}>
          <div style={{ width: `${(t < agentWorking(i) ? tween(t, at, agentWorking(i)) * 0.12 : 0.12 + 0.88 * work) * 100}%`, height: '100%', borderRadius: 9, background: `linear-gradient(90deg, ${c.brand500}, ${c.emerald400})` }} />
        </div>
        <span style={{ fontFamily: mono, fontSize: 14, minWidth: 96, textAlign: 'right' }}>
          <span style={{ color: c.emerald300 }}>+{added}</span> <span style={{ color: c.rose300 }}>−{removed}</span>
        </span>
      </div>
    </div>
  );
}

function Boot({ t, i, branch }: { t: number; i: number; branch: string }) {
  const start = M.enter + 0.6 + i * 0.15;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: mono, fontSize: 15 }}>
      {boot(branch).map((line, k) => {
        const at = start + k * 0.38;
        if (t < at) return null;
        const done = t > at + 0.3;
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, color: done ? c.secondary : c.muted, opacity: tween(t, at, at + 0.2) }}>
            {done ? <Check size={16} color={c.emerald400} /> : <span style={{ width: 16, color: c.amber300 }}>›</span>}
            {line}
          </div>
        );
      })}
    </div>
  );
}

function Work({ i, t, h, w, layout }: { i: number; t: number; h: number; w: number; layout: Layout }) {
  const from = agentWorking(i);
  const lines = (list: [string, string][], rate = 0.32) =>
    list.map(([col, s], k) => {
      const at = from + 0.1 + k * rate;
      return t > at ? (
        <div key={k} style={{ color: col, opacity: tween(t, at, at + 0.2), whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {s}
        </div>
      ) : null;
    });
  const term = { fontFamily: mono, fontSize: layout === 'wide' ? 15.5 : 16, lineHeight: 1.7 };
  if (i === 0) {
    const dw = Math.round(h * 1.63);
    return (
      <div style={{ display: 'flex', gap: 18, height: h }}>
        <div style={{ ...term, flex: 1, minWidth: 0 }}>
          {lines([
            [c.brand300, '● Reading src/theme.ts'],
            [c.termGreen, '✓ Edit theme.ts  +48 −6'],
            [c.termGreen, '✓ Edit Orders.tsx  +31 −12'],
            [c.brand300, '● Checking it in its browser'],
          ], 0.6)}
        </div>
        <div style={{ width: dw, height: h, borderRadius: 8, overflow: 'hidden', border: `1px solid ${c.lineStrong}`, flexShrink: 0 }}>
          <Dashboard width={dw} height={h} dark={tween(t, 21.6, 22.6)} grow={tween(t, from, from + 1.5)} />
        </div>
      </div>
    );
  }
  if (i === 1) {
    return (
      <div style={{ ...term, height: h, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {lines([
          [c.secondary, '$ codex exec "export orders to CSV"'],
          [c.termCyan, '› apply_patch orders/export.go'],
          [c.termCyan, '› apply_patch web/OrdersToolbar.tsx'],
          [c.secondary, '$ go test ./orders/...'],
          [c.termGreen, 'ok   freshcart/orders  0.41s'],
          [c.termCyan, '› apply_patch orders/export_test.go'],
          [c.secondary, '$ curl -s :8080/orders.csv | head -2'],
          [c.muted, 'order,customer,total,status'],
          [c.muted, '4821,Emma Johnson,81.30,paid'],
          [c.termGreen, '✓ export matches the filtered view'],
        ], 0.62)}
      </div>
    );
  }
  if (i === 2) {
    return (
      <div style={{ ...term, height: h, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {lines([
          [c.muted, 'auth/google.ts'],
          [c.rose300, "-  window.open(url, '_blank')"],
          [c.emerald300, '+  // Safari blocks pop-ups after an await:'],
          [c.emerald300, '+  location.assign(redirectUrl(url))'],
          [c.rose300, '-  sameSite: "none"'],
          [c.emerald300, '+  sameSite: "lax", secure: true'],
          [c.secondary, '$ playwright test --project=webkit signin'],
          [c.termGreen, '  ✓ signs in with Google on WebKit (3.2s)'],
          [c.termGreen, '  ✓ keeps the session after reload (1.1s)'],
        ], 0.68)}
      </div>
    );
  }
  const tests = ['adds to cart', 'applies a discount code', 'pays by card', 'declined card', 'guest checkout', 'saves the address', 'shows the receipt', 'emails the order', 'empty cart', 'stock runs out', 'tax by region', 'free shipping'];
  const cols = layout === 'wide' ? 2 : 3;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '6px 18px', fontSize: 15.5, width: w }}>
      {tests.map((name, k) => {
        const at = from + 0.3 + k * 0.42;
        const done = t > at;
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, color: done ? c.secondary : c.faint, whiteSpace: 'nowrap' }}>
            <span style={{ width: 18, height: 18, borderRadius: 99, display: 'grid', placeItems: 'center', background: done ? 'rgb(52 211 153 / 0.18)' : c.surface, border: `1px solid ${done ? 'rgb(52 211 153 / 0.5)' : c.lineStrong}`, transform: `scale(${done ? 1 + 0.3 * Math.max(0, 1 - (t - at) * 5) : 1})` }}>
              {done && <Check size={12} color={c.emerald300} strokeWidth={3} />}
            </span>
            {name}
          </div>
        );
      }).slice(0, layout === 'wide' ? 10 : 12)}
    </div>
  );
}
