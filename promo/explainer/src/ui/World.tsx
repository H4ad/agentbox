import type { ReactNode } from 'react';
import {
  Archive, ArrowRight, ArrowUp, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, FileText, GitBranch, GitMerge,
  GitPullRequest, House, Images, Lock, Monitor, PanelRight, Paperclip, Play, Plus, Search, Settings, SlidersHorizontal, Sparkles,
  SquarePen, Terminal, X,
} from 'lucide-react';
import { agents, leadReply, toolName, userAsk } from '../data';
import { c, mono, sans, tween, typed } from '../theme';
import { AgentBadge, Avatar, Cursor, Kbd, Logo, Pill } from './atoms';
import { Dashboard } from './Dashboard';

// World is the stylised UI v2 window, everything in it a function of the
// video's time t (seconds): the sidebar with the project and its agents, the
// lead's chat, the right panel's tabs and the review modal.
// The window is 1440×860 for the 16:9 cut and a portrait 960×1300 for 9:16,
// where, as in the app below xl, the right panel is a drawer over the chat.
export type Size = { w: number; h: number; compact: boolean };
export const wide: Size = { w: 1440, h: 860, compact: false };
export const tall: Size = { w: 960, h: 1300, compact: true };
const SIDEBAR = 272;
const PANEL = 540;
const DRAWER = 640;

export const T = {
  typeStart: 7.0,
  send: 10.4,
  userBubble: 10.5,
  thinking: 10.7,
  reply: 11.15,
  tasks: 12.4,
  spawn: 15.2,
  working: 18.6,
  panelOpen: 26.0,
  tabDesktop: 27.3,
  tabMedia: 28.6,
  panelClose: 30.0,
  pr: 31.0,
  reviewBar: 32.8,
  reviewClick: 37.2,
  modal: 37.3,
  mergeClick: 40.2,
  nextAgent: 40.95,
};

export const agentSpawn = (i: number) => T.spawn + i * 0.3;
export const agentWorking = (i: number) => T.working + i * 0.35;
export const agentPr = (i: number) => T.pr + i * 0.5;

type Status = { label: string; color: string; dot: string; working: boolean };
export function statusAt(i: number, t: number): Status {
  if (t >= agentPr(i)) return { label: 'To review', color: c.sky300, dot: c.sky400, working: false };
  if (t >= agentWorking(i)) return { label: 'Working', color: c.emerald300, dot: c.emerald400, working: true };
  return { label: 'Starting', color: c.amber300, dot: c.amber400, working: false };
}

const ico = (I: typeof Plus, size = 16, color: string = c.muted) => <I size={size} color={color} strokeWidth={1.8} />;

function Appear({ t, at, children, dy = 14, h }: { t: number; at: number; children: ReactNode; dy?: number; h?: number }) {
  const p = tween(t, at, at + 0.5);
  if (p <= 0) return null;
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, maxHeight: h === undefined ? undefined : h * tween(t, at, at + 0.35), overflow: h === undefined ? undefined : 'hidden', flexShrink: 0 }}>
      {children}
    </div>
  );
}

function ProjectTile({ letter, from, to, size = 30 }: { letter: string; from: string; to: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: `linear-gradient(135deg, ${from}, ${to})`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.5, flexShrink: 0 }}>
      {letter}
    </div>
  );
}

function Sidebar({ t }: { t: number }) {
  const toReview = agents.filter((_, i) => t >= agentPr(i)).length;
  const spawned = agents.filter((_, i) => t >= agentSpawn(i)).length;
  const lastLine =
    toReview > 0 ? `${toReview} agent${toReview > 1 ? 's' : ''} finished, ready to review` : spawned > 0 ? `Spinning up ${spawned} agent${spawned > 1 ? 's' : ''}…` : t > T.userBubble ? 'Dark mode for the orders dashboard…' : 'What should we build?';
  return (
    <div style={{ width: SIDEBAR, flexShrink: 0, height: '100%', background: c.rail, borderRight: `1px solid ${c.line}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px' }}>
        <Logo size={28} />
        <span style={{ fontWeight: 600, fontSize: 17, color: c.title }}>AgentBox</span>
      </div>
      <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Row icon={ico(SquarePen)} label="New task" right={<Kbd>Ctrl N</Kbd>} />
        <Row icon={ico(House)} label="Home" right={<span style={{ fontSize: 12, color: c.subtle }}>2m ago</span>} />
        <div style={{ margin: '8px 4px', height: 36, borderRadius: 9, border: `1px solid ${c.lineStrong}`, background: c.surfaceFaint, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', color: c.subtle, fontSize: 14 }}>
          {ico(Search, 15, c.subtle)} Search chats and agents
          <div style={{ marginLeft: 'auto' }}>{ico(SlidersHorizontal, 15, c.subtle)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 4px', fontSize: 11.5, letterSpacing: 1.2, color: c.subtle, fontWeight: 600 }}>
          PROJECTS
          {toReview > 0 && (
            <span style={{ letterSpacing: 0, fontSize: 12, color: '#bae6fd', background: 'rgb(56 189 248 / 0.14)', border: '1px solid rgb(56 189 248 / 0.3)', borderRadius: 99, padding: '1px 8px', transform: `scale(${1 + 0.25 * Math.max(0, 1 - (t - agentPr(toReview - 1)) * 3)})` }}>
              Review {toReview}
            </span>
          )}
        </div>
      </div>
      <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ borderRadius: 12, background: c.surfaceRaised, border: `1px solid ${c.lineStrong}`, padding: '10px 10px', display: 'flex', gap: 10, alignItems: 'center' }}>
          {ico(ChevronDown, 14, c.subtle)}
          <ProjectTile letter="F" from="#34d399" to="#059669" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: c.title, fontWeight: 600, fontSize: 15 }}>
              freshcart <span style={{ fontSize: 12, color: c.subtle, fontWeight: 400 }}>now</span>
            </div>
            <div style={{ fontSize: 13, color: c.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastLine}</div>
          </div>
        </div>
        {agents.map((a, i) => {
          const at = agentSpawn(i);
          if (t < at) return null;
          const p = tween(t, at, at + 0.45);
          const st = statusAt(i, t);
          return (
            <div key={a.ref} style={{ opacity: p, transform: `translateX(${(1 - p) * -24}px)`, maxHeight: 58 * tween(t, at, at + 0.3), overflow: 'hidden', display: 'flex', gap: 11, alignItems: 'center', padding: '8px 8px 8px 22px' }}>
              <AgentBadge tool={a.tool} size={34} t={t} working={st.working} dot={st.dot} seed={i} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: c.primary, fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: c.subtle, fontFamily: mono }}>
                  {a.ref} · <span style={{ color: st.color, fontFamily: sans }}>{st.label}</span>
                </div>
              </div>
            </div>
          );
        })}
        {[
          ['agentbox', 'A', '#a78bfa', '#4f46e5', 'Polish UI v2 and the phone app'],
          ['hatch', 'H', '#fb923c', '#ea580c', 'Pages for the weekly demo'],
        ].map(([n, l, f, to, line]) => (
          <div key={n} style={{ padding: '10px 10px', display: 'flex', gap: 10, alignItems: 'center', opacity: 0.75 }}>
            {ico(ChevronRight, 14, c.faint)}
            <ProjectTile letter={l} from={f} to={to} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: c.secondary, fontWeight: 500, fontSize: 15 }}>{n}</div>
              <div style={{ fontSize: 13, color: c.subtle, whiteSpace: 'nowrap' }}>{line}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', height: 52, borderTop: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 18, padding: '0 20px' }}>
        {ico(Settings, 17, c.subtle)}
        {ico(Archive, 17, c.subtle)}
        {ico(Images, 17, c.subtle)}
      </div>
    </div>
  );
}

function Row({ icon, label, right }: { icon: ReactNode; label: string; right?: ReactNode }) {
  return (
    <div style={{ height: 38, display: 'flex', alignItems: 'center', gap: 11, padding: '0 10px', color: c.secondary, fontSize: 15 }}>
      {icon}
      {label}
      <div style={{ marginLeft: 'auto' }}>{right}</div>
    </div>
  );
}

function TaskRow({ i, t }: { i: number; t: number }) {
  const a = agents[i];
  const spawned = t >= agentSpawn(i);
  const st = statusAt(i, t);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10, background: c.surfaceFaint, border: `1px solid ${c.line}` }}>
      <Avatar tool={a.tool} size={20} t={t} working={st.working && spawned} seed={i} />
      <span style={{ color: c.primary, fontSize: 15, flex: 1 }}>{a.title}</span>
      <span style={{ fontFamily: mono, fontSize: 12.5, color: c.subtle, display: 'flex', alignItems: 'center', gap: 5 }}>
        {ico(GitBranch, 13, c.subtle)} {a.branch}
      </span>
      <span style={{ fontSize: 12.5, color: spawned ? st.color : c.subtle, width: 76, textAlign: 'right' }}>{spawned ? st.label : 'Queued'}</span>
    </div>
  );
}

function PrCard({ i, t }: { i: number; t: number }) {
  const a = agents[i];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: c.surface, border: `1px solid ${c.lineStrong}` }}>
      <AgentBadge tool={a.tool} size={28} t={t} dot={c.sky400} seed={i} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: c.primary, fontSize: 14.5 }}>
          <span style={{ fontFamily: mono, color: c.muted, fontSize: 13 }}>{a.ref}</span> opened <span style={{ color: c.title, fontWeight: 600 }}>#{a.pr}</span> {a.prTitle}
        </div>
      </div>
      <span style={{ fontSize: 12.5, color: c.emerald300, display: 'flex', alignItems: 'center', gap: 4 }}>
        {ico(Check, 13, c.emerald300)} checks passing
      </span>
      <span style={{ fontFamily: mono, fontSize: 12.5 }}>
        <span style={{ color: c.emerald300 }}>+{a.added}</span> <span style={{ color: c.rose300 }}>−{a.removed}</span>
      </span>
    </div>
  );
}

function Chat({ t, width }: { t: number; width: number }) {
  const draft = t < T.send + 0.05 ? typed(userAsk, t, T.typeStart, 40) : '';
  const reply = typed(leadReply, t, T.reply, 78);
  const empty = 1 - tween(t, T.userBubble - 0.2, T.userBubble + 0.2);
  const toReview = agents.filter((_, i) => t >= agentPr(i)).length;
  const sendHot = draft.length > 0;
  const pressed = t > T.send && t < T.send + 0.18;
  return (
    <div style={{ width, flexShrink: 0, height: '100%', position: 'relative', background: c.chat, overflow: 'hidden' }}>
      <div style={{ height: 52, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', color: c.secondary, fontSize: 15 }}>
        <ProjectTile letter="F" from="#34d399" to="#059669" size={24} />
        <span style={{ fontWeight: 600, color: c.title }}>freshcart</span>
        {ico(ChevronRight, 14, c.faint)}
        <span>Lead</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Pill color={c.secondary}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: c.emerald400 }} /> AgentBox running · {agents.filter((_, i) => t >= agentSpawn(i)).length} agents
          </Pill>
          {ico(PanelRight, 18, c.muted)}
        </div>
      </div>
      {empty > 0 && (
        <div style={{ position: 'absolute', inset: '52px 0 160px 0', display: 'grid', placeItems: 'center', opacity: empty }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-grid', placeItems: 'center', width: 52, height: 52, borderRadius: 14, background: c.surface, border: `1px solid ${c.lineStrong}`, marginBottom: 18 }}>{ico(Sparkles, 22, c.brand300)}</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: c.title }}>What should we build in freshcart?</div>
            <div style={{ fontSize: 15, color: c.subtle, marginTop: 8 }}>The lead plans the work and hands each task to an agent on its own machine.</div>
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 52, bottom: 196, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 16, padding: '0 40px', overflow: 'hidden' }}>
        <Appear t={t} at={T.userBubble} h={120}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: '72%', background: c.surfaceStrong, border: `1px solid ${c.lineStrong}`, borderRadius: '18px 18px 4px 18px', padding: '12px 16px', color: c.primary, fontSize: 16, lineHeight: 1.5 }}>{userAsk}</div>
          </div>
        </Appear>
        <Appear t={t} at={T.thinking} h={480}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: c.surface, border: `1px solid ${c.lineStrong}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{ico(Sparkles, 16, c.brand300)}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, color: c.subtle }}>Lead · Claude Code · Opus</div>
              {t < T.reply ? (
                <div style={{ display: 'flex', gap: 5, height: 22, alignItems: 'center' }}>
                  {[0, 1, 2].map((d) => (
                    <div key={d} style={{ width: 7, height: 7, borderRadius: 9, background: c.muted, opacity: 0.3 + 0.7 * Math.abs(Math.sin(t * 6 - d * 0.7)) }} />
                  ))}
                </div>
              ) : (
                <div style={{ color: c.secondary, fontSize: 16, lineHeight: 1.6, minHeight: 50 }}>{reply}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agents.map((_, i) => (
                  <Appear key={i} t={t} at={T.tasks + i * 0.18} h={50} dy={8}>
                    <TaskRow i={i} t={t} />
                  </Appear>
                ))}
              </div>
            </div>
          </div>
        </Appear>
        {agents.map((_, i) => (
          <Appear key={i} t={t} at={agentPr(i)} h={60}>
            <PrCard i={i} t={t} />
          </Appear>
        ))}
      </div>
      {t >= T.reviewBar && (
        <div style={{ position: 'absolute', left: 52, right: 52, bottom: 132, height: 46, borderRadius: '12px 12px 0 0', border: `1px solid ${c.lineStrong}`, borderBottom: 'none', background: c.surface, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, opacity: tween(t, T.reviewBar, T.reviewBar + 0.4), transform: `translateY(${(1 - tween(t, T.reviewBar, T.reviewBar + 0.5)) * 20}px)` }}>
          <span style={{ width: 8, height: 8, borderRadius: 9, background: c.sky400, boxShadow: `0 0 12px ${c.sky400}` }} />
          <span style={{ color: c.secondary, fontSize: 15 }}>{toReview} agents ready to review</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: c.title, fontWeight: 600, fontSize: 15, padding: '6px 12px', borderRadius: 8, background: t > T.reviewClick - 0.6 ? c.surfaceVivid : 'transparent' }}>
            Review {ico(ArrowRight, 15, c.title)}
          </span>
        </div>
      )}
      <div style={{ position: 'absolute', left: 28, right: 28, bottom: 20, height: 112, borderRadius: 18, background: c.composer, border: `1px solid ${sendHot ? c.lineVivid : c.lineStrong}`, boxShadow: sendHot ? `0 0 0 4px rgb(139 92 246 / 0.12)` : 'none', padding: '14px 18px' }}>
        <div style={{ fontSize: 16, color: draft ? c.primary : c.subtle, lineHeight: 1.5, height: 48, overflow: 'hidden' }}>
          {draft || 'Ask the lead for anything in freshcart'}
          {draft && draft.length < userAsk.length && <span style={{ display: 'inline-block', width: 2, height: 19, background: c.brand300, verticalAlign: 'middle', marginLeft: 1 }} />}
        </div>
        <div style={{ position: 'absolute', left: 16, bottom: 12, display: 'flex', gap: 18, alignItems: 'center', fontSize: 14, color: c.muted }}>
          {ico(Paperclip, 16)}
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Avatar tool="claude" size={17} /> Claude Code · Opus · 1M {ico(ChevronDown, 13, c.subtle)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{ico(Brain, 15)} Medium</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{ico(Lock, 15)} Ask before edits</span>
        </div>
        <div style={{ position: 'absolute', right: 14, bottom: 12, width: 38, height: 38, borderRadius: 99, display: 'grid', placeItems: 'center', background: sendHot ? c.brand500 : c.surfaceStrong, transform: `scale(${pressed ? 0.88 : 1})`, boxShadow: sendHot ? `0 0 24px rgb(139 92 246 / 0.6)` : 'none' }}>
          {ico(ArrowUp, 19, '#fff')}
        </div>
      </div>
    </div>
  );
}

// Where the cursor's targets are, in world pixels.
export const targets = ({ w, h, compact }: Size) => ({
  send: { x: w - 28 - 14 - 19, y: h - 20 - 12 - 19 },
  review: { x: w - 52 - 16 - 44, y: h - 132 - 23 },
  merge: { x: w - MODAL_INSET - (compact ? 0 : SIDE) - 24 - 96 - 14 - 164 - 14 - 118, y: h - MODAL_INSET - FOOT / 2 },
});

function RightPanel({ t, open, compact }: { t: number; open: number; compact: boolean }) {
  const tab = t >= T.tabMedia ? 2 : t >= T.tabDesktop ? 1 : 0;
  const tabs: [typeof Terminal, string][] = [
    [Terminal, 'Terminal · agent-41'],
    [Monitor, 'Desktop · agent-41'],
    [Images, 'Media'],
  ];
  return (
    <div style={compact ? { position: 'absolute', right: 0, top: 0, bottom: 0, width: DRAWER, transform: `translateX(${(1 - open) * 105}%)`, boxShadow: '-30px 0 80px rgb(0 0 0 / 0.7)', borderLeft: `1px solid ${c.lineStrong}`, background: c.stage, zIndex: 5 } : { width: PANEL * open, flexShrink: 0, height: '100%', overflow: 'hidden', borderLeft: `1px solid ${c.lineStrong}`, background: c.stage }}>
      <div style={{ width: compact ? DRAWER : PANEL, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 52, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'flex-end', gap: 2, padding: '0 10px' }}>
          {tabs.map(([I, label], i) => (
            <div key={label} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: '9px 9px 0 0', background: i === tab ? c.surfaceRaised : 'transparent', borderBottom: i === tab ? `2px solid ${c.brand400}` : '2px solid transparent', color: i === tab ? c.title : c.muted, fontSize: 13.5, whiteSpace: 'nowrap' }}>
              {ico(I, 15, i === tab ? c.brand300 : c.subtle)} {label} {i === tab && ico(X, 13, c.subtle)}
            </div>
          ))}
          <div style={{ height: 40, display: 'grid', placeItems: 'center', padding: '0 8px' }}>{ico(Plus, 16, c.subtle)}</div>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {tab === 0 && <TerminalView t={t} from={T.panelOpen} />}
          {tab === 1 && (
            <div style={{ padding: 18, opacity: tween(t, T.tabDesktop, T.tabDesktop + 0.3) }}>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${c.lineStrong}` }}>
                <div style={{ height: 28, background: '#1c1c22', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
                  {['#fb7185', '#fbbf24', '#34d399'].map((col) => (
                    <span key={col} style={{ width: 9, height: 9, borderRadius: 9, background: col }} />
                  ))}
                  <span style={{ marginLeft: 10, fontFamily: mono, fontSize: 11, color: c.muted }}>localhost:5173/orders</span>
                </div>
                <Dashboard width={compact ? 602 : 502} height={compact ? 440 : 330} dark={tween(t, T.tabDesktop + 0.4, T.tabDesktop + 1.0)} />
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5, color: c.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 9, background: c.rose400 }} /> agent-41 is recording its desktop
              </div>
            </div>
          )}
          {tab === 2 && (
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {agents.concat(agents.slice(0, 2)).map((a, i) => {
                const p = tween(t, T.tabMedia + i * 0.08, T.tabMedia + 0.4 + i * 0.08);
                return (
                  <div key={i} style={{ opacity: p, transform: `scale(${0.92 + 0.08 * p})`, borderRadius: 10, overflow: 'hidden', border: `1px solid ${c.lineStrong}`, background: c.surface }}>
                    <div style={{ position: 'relative' }}>
                      <Dashboard width={240} height={136} dark={i % 2 === 0 ? 1 : 0} />
                      {i % 3 === 0 && (
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 99, background: 'rgb(0 0 0 / 0.6)', display: 'grid', placeItems: 'center' }}>{ico(Play, 15, '#fff')}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '7px 10px', fontSize: 12, color: c.secondary, fontFamily: mono }}>{i % 3 === 0 ? 'recording' : 'screenshot'} · {a.ref}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const termLines: [string, string][] = [
  [c.subtle, '~/freshcart (agentbox/dark-mode)'],
  [c.brand300, '● Reading src/theme.ts and the dashboard components'],
  [c.secondary, '  Adding a dark palette behind a [data-theme] switch'],
  [c.termGreen, '✓ Edit src/theme.ts  +48 −6'],
  [c.termGreen, '✓ Edit src/pages/Orders.tsx  +31 −12'],
  [c.secondary, '$ npm test -- orders'],
  [c.termGreen, '  ✓ 24 passed (1.8s)'],
  [c.brand300, '● Opening the dashboard in its own browser to check'],
];

function TerminalView({ t, from }: { t: number; from: number }) {
  return (
    <div style={{ padding: 20, fontFamily: mono, fontSize: 13.5, lineHeight: 1.9 }}>
      {termLines.map(([col, s], i) => {
        const at = from + 0.15 + i * 0.14;
        return t > at ? (
          <div key={i} style={{ color: col, opacity: tween(t, at, at + 0.2), whiteSpace: 'nowrap' }}>
            {s}
          </div>
        ) : null;
      })}
    </div>
  );
}

// The review modal, as ReviewV2 draws it: header with the PR's chips, the
// agent's slides, what it said beside them and the footer's Merge.
const MODAL_INSET = 26;
const SIDE = 330;
const FOOT = 66;

function Modal({ t, compact }: { t: number; compact: boolean }) {
  const p = tween(t, T.modal, T.modal + 0.5);
  if (p <= 0) return null;
  const which = t >= T.nextAgent ? 1 : 0;
  const a = agents[which];
  const merged = t >= T.mergeClick && t < T.nextAgent + 0.1;
  const slide = tween(t, T.nextAgent - 0.15, T.nextAgent + 0.35);
  const pressed = t > T.mergeClick && t < T.mergeClick + 0.16;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `rgb(0 0 0 / ${0.62 * p})` }}>
      <div style={{ position: 'absolute', inset: MODAL_INSET, borderRadius: 18, background: '#0b0b0f', border: `1px solid ${c.lineStrong}`, boxShadow: '0 40px 120px rgb(0 0 0 / 0.8)', overflow: 'hidden', opacity: p, transform: `scale(${0.94 + 0.06 * p}) translateY(${(1 - p) * 30}px)`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 76, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', flexShrink: 0 }}>
          {ico(Sparkles, 22, c.secondary)}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: c.title }}>{a.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: c.muted, marginTop: 4 }}>
              freshcart
              <span style={{ fontFamily: mono, display: 'flex', alignItems: 'center', gap: 4 }}>
                {ico(GitBranch, 13, c.subtle)}
                {a.branch}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.secondary }}>
                {ico(GitPullRequest, 13, c.subtle)}#{a.pr} {compact ? '' : a.prTitle}
              </span>
              <Pill color={c.sky300} bg="rgb(56 189 248 / 0.1)" border="rgb(56 189 248 / 0.35)" style={{ fontSize: 12, padding: '1px 9px' }}>
                open
              </Pill>
              <Pill color={c.emerald300} bg="rgb(52 211 153 / 0.1)" border="rgb(52 211 153 / 0.35)" style={{ fontSize: 12, padding: '1px 9px' }}>
                checks passing
              </Pill>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: 13.5, color: c.muted }}>
            Agent {which + 1} of 4
            <div style={{ display: compact ? 'none' : 'flex', borderRadius: 9, border: `1px solid ${c.lineStrong}`, padding: 3 }}>
              <span style={{ padding: '4px 10px', borderRadius: 6, background: c.surfaceStrong, color: c.title }}>To review {4 - which}</span>
              <span style={{ padding: '4px 10px' }}>Reviewed {which}</span>
            </div>
            {ico(X, 18, c.muted)}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', fontSize: 14, color: c.secondary, borderBottom: `1px solid ${c.line}` }}>
              {ico(which ? FileText : Monitor, 15, c.muted)} {which ? 'orders.csv, exported from the Orders page' : 'Orders, in dark mode'}
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: c.muted }}>{ico(ExternalLink, 14)} Open in browser</span>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#060609', display: 'grid', placeItems: 'center' }}>
              <div style={{ opacity: which ? slide : 1, transform: `translateX(${which ? (1 - slide) * 80 : 0}px)` }}>
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${c.lineStrong}`, boxShadow: '0 20px 60px rgb(0 0 0 / 0.6)' }}>
                  {which ? <CsvSlide /> : <Dashboard width={640} height={392} dark={1} />}
                </div>
                {compact && (
                  <div style={{ width: 640, marginTop: 28, display: 'flex', gap: 14, fontSize: 18, lineHeight: 1.5, color: c.secondary }}>
                    <AgentBadge tool={a.tool} size={36} t={t} dot={c.sky400} seed={which} />
                    <div>
                      {which ? 'Added Export CSV to the Orders page, with the totals.' : 'The orders dashboard follows the system theme, with a Dark mode switch.'}
                      <div style={{ fontSize: 15, color: c.subtle, marginTop: 6 }}>
                        PR #{a.pr} is green · <span style={{ color: c.emerald300 }}>+{a.added}</span> <span style={{ color: c.rose300 }}>−{a.removed}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ position: 'absolute', right: 18, top: '50%', marginTop: -20, width: 40, height: 40, borderRadius: 99, background: c.surfaceStrong, display: 'grid', placeItems: 'center' }}>{ico(ChevronRight, 20, c.secondary)}</div>
            </div>
            <div style={{ height: 70, borderTop: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px' }}>
              {[0, 1, 2, 3, 4].map((k) => (
                <div key={k} style={{ width: 82, height: 48, borderRadius: 7, border: `1px solid ${k === 0 ? c.brand400 : c.lineStrong}`, overflow: 'hidden', opacity: k === 0 ? 1 : 0.7, display: 'grid', placeItems: 'center', background: c.surface }}>
                  {k === 4 ? (
                    <span style={{ fontSize: 11.5, color: c.secondary, display: 'flex', gap: 4, alignItems: 'center' }}>{ico(GitPullRequest, 12)}#{a.pr}</span>
                  ) : k === 2 ? (
                    ico(Play, 15, c.secondary)
                  ) : (
                    <Dashboard width={82} height={48} dark={k === 0 ? 1 : 0} />
                  )}
                </div>
              ))}
              <span style={{ fontSize: 13, color: c.subtle, marginLeft: 6 }}>1 of 5</span>
            </div>
            <div style={{ height: FOOT, borderTop: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', flexShrink: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: c.subtle }}>{ico(ChevronLeft, 15, c.subtle)} Back</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: c.secondary, border: `1px solid ${c.lineStrong}`, borderRadius: 9, padding: '7px 12px' }}>Request changes <Kbd>C</Kbd></span>
              <div style={{ marginLeft: 'auto', width: 236, height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14.5, fontWeight: 600, color: '#fff', background: merged ? '#059669' : `linear-gradient(180deg, ${c.brandMid}, ${c.brandDeep})`, boxShadow: merged ? '0 0 30px rgb(16 185 129 / 0.55)' : '0 0 24px rgb(99 102 241 / 0.45)', transform: `scale(${pressed ? 0.94 : 1})` }}>
                {merged ? (
                  <>
                    {ico(Check, 17, '#fff')} Merged #{agents[0].pr}
                  </>
                ) : (
                  <>
                    {ico(GitMerge, 16, '#fff')} Merge #{a.pr} and next {ico(ChevronDown, 14, '#fff')}
                  </>
                )}
              </div>
              <span style={{ width: 164, height: 40, borderRadius: 9, background: c.primary, color: '#18181b', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {ico(Check, 15, '#18181b')} Reviewed, next
              </span>
              <span style={{ width: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, color: c.secondary }}>Finish {ico(ArrowRight, 14, c.secondary)}</span>
            </div>
          </div>
          <div style={{ display: compact ? 'none' : 'flex', width: SIDE, borderLeft: `1px solid ${c.line}`, padding: 22, flexDirection: 'column', gap: 14, fontSize: 14.5, lineHeight: 1.55, color: c.secondary }}>
            <div style={{ fontSize: 11.5, letterSpacing: 1.2, fontWeight: 600, color: c.subtle }}>WHAT THE AGENT SAID</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AgentBadge tool={a.tool} size={30} t={t} dot={c.sky400} seed={which} />
              <span style={{ fontFamily: mono, fontSize: 13, color: c.muted }}>
                {a.ref} · {toolName[a.tool]}
              </span>
            </div>
            {which ? (
              <div>
                Added <b style={{ color: c.title }}>Export CSV</b> to the Orders page. It exports what the filters show, with the totals.
              </div>
            ) : (
              <div>
                The orders dashboard follows the system theme, with a <b style={{ color: c.title }}>Dark mode</b> switch in its header.
              </div>
            )}
            <div style={{ color: c.muted }}>• Tested in its own browser, recording in Media{'\n'}</div>
            <div style={{ color: c.muted }}>• PR #{a.pr} is green</div>
            <div style={{ fontSize: 13.5, color: c.subtle }}>
              {which ? 3 : 6} files changed <span style={{ color: c.emerald300 }}>+{a.added}</span> <span style={{ color: c.rose300 }}>−{a.removed}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CsvSlide() {
  const rows = [
    ['order', 'customer', 'total', 'status'],
    ['4821', 'Emma Johnson', '81.30', 'paid'],
    ['4820', 'Liam Smith', '120.00', 'shipped'],
    ['4819', 'Olivia Brown', '128.70', 'awaiting'],
    ['4818', 'Noah Davis', '152.40', 'paid'],
    ['4817', 'Ava Miller', '176.10', 'shipped'],
    ['4816', 'Lucas Wilson', '96.20', 'paid'],
  ];
  return (
    <div style={{ width: 640, height: 392, background: '#0e1116', padding: 26, fontFamily: mono, fontSize: 16, color: '#e6edf3' }}>
      <div style={{ color: c.muted, fontSize: 13, marginBottom: 14 }}>orders-2026-10-17.csv</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 22, lineHeight: 2, color: i === 0 ? c.brand300 : undefined }}>
          {r.map((cell, j) => (
            <span key={j} style={{ width: [70, 190, 90, 110][j] }}>
              {cell}
              {j < 3 ? <span style={{ color: c.faint }}>,</span> : null}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export type WorldCursor = { x: number; y: number; pressed: number; opacity: number } | null;

export function World({ t, cursor, size }: { t: number; cursor: WorldCursor; size: Size }) {
  const open = tween(t, T.panelOpen, T.panelOpen + 0.6) * (1 - tween(t, T.panelClose, T.panelClose + 0.6));
  const chatW = size.w - SIDEBAR - (size.compact ? 0 : PANEL * open);
  return (
    <div style={{ width: size.w, height: size.h, position: 'relative', borderRadius: 20, overflow: 'hidden', background: c.ink, border: `1px solid ${c.lineVivid}`, display: 'flex', fontFamily: sans, color: c.primary }}>
      <Sidebar t={t} />
      <Chat t={t} width={chatW} />
      <RightPanel t={t} open={open} compact={size.compact} />
      <Modal t={t} compact={size.compact} />
      {cursor && <Cursor {...cursor} />}
    </div>
  );
}
