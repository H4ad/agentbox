import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { agents } from './data';
import { c, inOut, mono, out, sans, scenes, tween, type Layout } from './theme';
import { Avatar, Logo } from './ui/atoms';
import { Machines, M } from './ui/Machines';
import { P, Phone, PHONE_W } from './ui/Phone';
import { T, targets, tall, wide, World, type Size, type WorldCursor } from './ui/World';

type Rect = [number, number, number, number];
type Key = [number, Rect];

// The camera: for each layout, where on the window it looks at a given time,
// as a rectangle in the window's pixels, eased from one to the next.
const cameras: Record<Layout, { view: Rect; keys: Key[] }> = {
  wide: {
    view: [0, 170, 1920, 910],
    keys: [
      [6.0, [0, 0, 1440, 860]],
      [7.6, [272, 470, 1168, 390]],
      [10.5, [272, 470, 1168, 390]],
      [11.5, [272, 150, 1168, 710]],
      [13.6, [272, 150, 1168, 710]],
      [14.8, [0, 0, 1440, 860]],
      [30.2, [0, 0, 1440, 860]],
      [31.2, [0, 60, 1440, 800]],
      [35.8, [0, 60, 1440, 800]],
      [36.6, [0, 0, 1440, 860]],
      [38.4, [0, 0, 1440, 860]],
      [39.2, [260, 300, 1160, 560]],
      [40.7, [260, 300, 1160, 560]],
      [41.5, [0, 0, 1440, 860]],
      [41.6, [0, 0, 1440, 860]],
      [42.4, [-40, -90, 2060, 1040]],
    ],
  },
  tall: {
    view: [0, 470, 1080, 1430],
    keys: [
      [6.0, [0, 0, 960, 1300]],
      [7.6, [272, 860, 688, 440]],
      [10.5, [272, 860, 688, 440]],
      [11.5, [272, 300, 688, 1000]],
      [13.6, [272, 300, 688, 1000]],
      [14.8, [0, 0, 640, 1300]],
      [25.6, [0, 0, 640, 1300]],
      [26.2, [320, 0, 640, 1300]],
      [30.2, [320, 0, 640, 1300]],
      [31.0, [0, 0, 960, 1300]],
      [41.6, [0, 0, 960, 1300]],
    ],
  },
};

function camera(layout: Layout, t: number, size: Size) {
  const { view, keys } = cameras[layout];
  let r = keys[0][1];
  for (let k = 0; k < keys.length; k++) {
    const [at, rect] = keys[k];
    if (t >= at) r = rect;
    const next = keys[k + 1];
    if (next && t >= at && t < next[0]) {
      const p = interpolate(t, [at, next[0]], [0, 1], { easing: inOut, extrapolateRight: 'clamp' });
      r = rect.map((v, j) => v + (next[1][j] - v) * p) as Rect;
      break;
    }
  }
  const [vx, vy, vw, vh] = view;
  const scale = Math.min((vw * 0.94) / r[2], (vh * 0.94) / r[3]);
  const x = vx + vw / 2 - (r[0] + r[2] / 2) * scale;
  let y = vy + vh / 2 - (r[1] + r[3] / 2) * scale;
  // In portrait, a close-up of the composer would leave the screen's bottom
  // empty under the window: keep the window's bottom edge near the screen's.
  if (layout === 'tall') y = Math.max(y, vy + vh - 40 - size.h * scale);
  return { x, y, scale };
}

function cursorAt(t: number, size: Size): WorldCursor {
  const tg = targets(size);
  const path = (from: { x: number; y: number }, to: { x: number; y: number }, a: number, b: number) => {
    const p = tween(t, a, b, 0, 1, inOut);
    return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p + Math.sin(p * Math.PI) * -40 };
  };
  const press = (at: number) => (t > at && t < at + 0.5 ? (t - at) / 0.5 : 0);
  if (t > 9.2 && t < 11.2) {
    const pos = path({ x: tg.send.x - 380, y: tg.send.y - 160 }, tg.send, 9.4, 10.3);
    return { ...pos, pressed: press(T.send), opacity: tween(t, 9.2, 9.5) * (1 - tween(t, 10.8, 11.1)) };
  }
  if (t > 36.0 && t < 41.4) {
    const a = path({ x: tg.review.x - 420, y: tg.review.y - 260 }, tg.review, 36.2, 37.0);
    const b = path(tg.review, tg.merge, 38.6, 39.9);
    const pos = t < 38.6 ? a : b;
    return { ...pos, pressed: press(T.reviewClick) || press(T.mergeClick), opacity: tween(t, 36.0, 36.3) * (1 - tween(t, 40.9, 41.3)) };
  }
  return null;
}

const steps: { at: number; until: number; n: string; text: string; hi: string }[] = [
  { at: 6.3, until: 13.8, n: '01', text: 'Talk to one lead per project', hi: 'one lead' },
  { at: 14.2, until: 21.8, n: '02', text: 'It spawns agents, each on its own Linux machine and branch', hi: 'its own Linux machine' },
  { at: 22.2, until: 29.8, n: '03', text: 'They work in parallel: Claude Code, Codex, OpenCode', hi: 'in parallel' },
  { at: 30.2, until: 35.8, n: '04', text: 'Each one opens a pull request', hi: 'a pull request' },
  { at: 36.2, until: 41.4, n: '05', text: 'You review and merge from one modal', hi: 'one modal' },
  { at: 41.6, until: 45.8, n: '05', text: '…on the desktop or on your phone', hi: 'your phone' },
];

const gradientText = { background: `linear-gradient(90deg, ${c.brand300}, ${c.sky300})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as const;

function Caption({ t, layout }: { t: number; layout: Layout }) {
  const s = steps.find((x) => t >= x.at - 0.05 && t < x.until + 0.4);
  if (!s) return null;
  const p = tween(t, s.at, s.at + 0.7);
  const q = tween(t, s.until, s.until + 0.35, 0, 1, inOut);
  const [before, after] = s.text.split(s.hi);
  // Punctuation right after the highlight stays on its word, unhighlighted.
  const tail = after.match(/^\S*/)?.[0] ?? '';
  const words = [
    ...before.split(' ').filter(Boolean).map((w) => ({ w, hi: '', tail: '' })),
    { w: '', hi: s.hi, tail },
    ...after.slice(tail.length).split(' ').filter(Boolean).map((w) => ({ w, hi: '', tail: '' })),
  ];
  const wideL = layout === 'wide';
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: wideL ? 62 : 110, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: wideL ? 10 : 22, opacity: 1 - q, transform: `translateY(${q * -20}px)`, padding: '0 60px' }}>
      <div style={{ fontFamily: mono, fontSize: wideL ? 18 : 28, letterSpacing: 4, color: c.brand300, opacity: p }}>
        {s.n} <span style={{ color: c.faint }}>/ 05</span>
      </div>
      <div style={{ fontFamily: sans, fontWeight: 650, fontSize: wideL ? 56 : 64, lineHeight: 1.12, letterSpacing: -1.5, color: c.title, textAlign: 'center', maxWidth: wideL ? 1700 : 960, textWrap: 'balance' }}>
        {words.map(({ w, hi, tail }, k) => {
          const wp = tween(t, s.at + k * 0.06, s.at + 0.6 + k * 0.06);
          return (
            <span key={k} style={{ display: 'inline-block', marginRight: '0.26em', opacity: wp, transform: `translateY(${(1 - wp) * 26}px)`, filter: `blur(${(1 - wp) * 8}px)` }}>
              {w}
              {hi && <span style={gradientText}>{hi}</span>}
              {tail}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Background({ t, layout }: { t: number; layout: Layout }) {
  const a = Math.sin(t * 0.35) * 8;
  const b = Math.cos(t * 0.27) * 10;
  return (
    <AbsoluteFill style={{ background: c.ink, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 55% at ${30 + a}% ${layout === 'wide' ? 20 : 15}%, rgb(139 92 246 / 0.28), transparent 70%), radial-gradient(55% 50% at ${78 + b}% ${80 - a}%, rgb(56 189 248 / 0.16), transparent 70%), radial-gradient(40% 40% at 50% 50%, rgb(99 102 241 / 0.08), transparent 70%)` }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${c.lineFaint} 1px, transparent 1px), linear-gradient(90deg, ${c.lineFaint} 1px, transparent 1px)`, backgroundSize: '64px 64px', backgroundPosition: `${t * 6}px ${t * 6}px`, maskImage: 'radial-gradient(70% 60% at 50% 45%, black, transparent)', WebkitMaskImage: 'radial-gradient(70% 60% at 50% 45%, black, transparent)', opacity: 0.8 }} />
      <AbsoluteFill style={{ background: 'radial-gradient(120% 100% at 50% 40%, transparent 55%, rgb(0 0 0 / 0.7))' }} />
    </AbsoluteFill>
  );
}

function Orbit({ t, r, cx, cy, show, size }: { t: number; r: number; cx: number; cy: number; show: number; size: number }) {
  return (
    <>
      {agents.map((a, i) => {
        const ang = t * 0.9 + (i * Math.PI) / 2;
        const p = tween(t, 2.6 + i * 0.12, 3.3 + i * 0.12);
        const rr = r * (0.6 + 0.4 * p);
        return (
          <div key={i} style={{ position: 'absolute', left: cx + Math.cos(ang) * rr * 1.25 - size / 2, top: cy + Math.sin(ang) * rr * 0.55 - size / 2, opacity: p * show, transform: `scale(${0.5 + 0.5 * p})`, zIndex: Math.sin(ang) > 0 ? 3 : 1 }}>
            <div style={{ width: size, height: size, borderRadius: size * 0.28, background: 'rgb(255 255 255 / 0.07)', border: `1px solid ${c.lineVivid}`, display: 'grid', placeItems: 'center', backdropFilter: 'blur(6px)' }}>
              <Avatar tool={a.tool} size={size * 0.62} t={t} working seed={i} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function Intro({ t, layout }: { t: number; layout: Layout }) {
  if (t > 6.4) return null;
  const { width, height } = { width: layout === 'wide' ? 1920 : 1080, height: layout === 'wide' ? 1080 : 1920 };
  const logo = tween(t, 0.3, 1.3);
  const draw = tween(t, 0.6, 1.9, 0, 1, inOut);
  const leave = tween(t, 5.2, 6.1, 0, 1, inOut);
  const name = 'AgentBox';
  const cx = width / 2;
  const cy = height / 2 - (layout === 'wide' ? 60 : 140);
  const big = layout === 'wide' ? 150 : 190;
  const line1 = 'One chat. A team of AI agents.';
  const line2 = 'Each on its own machine.';
  return (
    <AbsoluteFill style={{ opacity: 1 - leave, transform: `scale(${1 + leave * 0.25})`, filter: `blur(${leave * 10}px)` }}>
      <div style={{ position: 'absolute', left: cx - 260, top: cy - 260, width: 520, height: 520, borderRadius: 999, background: 'radial-gradient(circle, rgb(139 92 246 / 0.45), transparent 65%)', opacity: logo, transform: `scale(${0.7 + 0.3 * logo + Math.sin(t * 2) * 0.03})` }} />
      <Orbit t={t} r={layout === 'wide' ? 230 : 250} cx={cx} cy={cy} show={1} size={layout === 'wide' ? 64 : 80} />
      <div style={{ position: 'absolute', left: cx - big / 2, top: cy - big / 2, opacity: logo, transform: `scale(${0.6 + 0.4 * logo}) rotate(${(1 - logo) * -12}deg)`, zIndex: 2, filter: 'drop-shadow(0 20px 50px rgb(124 58 237 / 0.6))' }}>
        <Logo size={big} draw={draw} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: cy + big / 2 + (layout === 'wide' ? 60 : 110), textAlign: 'center', fontFamily: sans, fontWeight: 700, fontSize: layout === 'wide' ? 96 : 120, letterSpacing: -3, color: c.title }}>
        {name.split('').map((ch, i) => {
          const p = tween(t, 1.3 + i * 0.05, 1.9 + i * 0.05);
          return (
            <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: cy + big / 2 + (layout === 'wide' ? 190 : 270), textAlign: 'center', fontFamily: sans, fontSize: layout === 'wide' ? 40 : 52, fontWeight: 500, color: c.secondary, lineHeight: 1.3 }}>
        <div style={{ opacity: tween(t, 2.5, 3.1), transform: `translateY(${(1 - tween(t, 2.5, 3.1)) * 16}px)` }}>{line1}</div>
        <div style={{ opacity: tween(t, 3.4, 4.0), transform: `translateY(${(1 - tween(t, 3.4, 4.0)) * 16}px)`, ...gradientText, fontWeight: 600 }}>{line2}</div>
      </div>
    </AbsoluteFill>
  );
}

function Outro({ t, layout }: { t: number; layout: Layout }) {
  const [start] = scenes.outro;
  if (t < start - 0.2) return null;
  const width = layout === 'wide' ? 1920 : 1080;
  const height = layout === 'wide' ? 1080 : 1920;
  const p = tween(t, start + 0.2, start + 1.2);
  const cx = width / 2;
  const cy = height / 2 - (layout === 'wide' ? 90 : 160);
  const big = layout === 'wide' ? 130 : 170;
  const url = 'agentbox.linting.dev';
  const urlP = tween(t, start + 2.0, start + 2.8);
  const shimmer = ((t - start - 3) * 0.6) % 1;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: cx - 300, top: cy - 300, width: 600, height: 600, borderRadius: 999, background: 'radial-gradient(circle, rgb(139 92 246 / 0.4), transparent 65%)', opacity: p }} />
      <div style={{ position: 'absolute', left: cx - big / 2, top: cy - big / 2, opacity: p, transform: `scale(${0.7 + 0.3 * p})`, filter: 'drop-shadow(0 20px 50px rgb(124 58 237 / 0.6))' }}>
        <Logo size={big} draw={1} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: cy + big / 2 + 40, textAlign: 'center', fontFamily: sans, fontWeight: 700, fontSize: layout === 'wide' ? 110 : 128, letterSpacing: -3.5, color: c.title, opacity: tween(t, start + 0.6, start + 1.4), transform: `translateY(${(1 - tween(t, start + 0.6, start + 1.4)) * 30}px)` }}>
        AgentBox
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: cy + big / 2 + (layout === 'wide' ? 190 : 220), display: 'flex', justifyContent: 'center', opacity: urlP, transform: `translateY(${(1 - urlP) * 20}px)` }}>
        <div style={{ fontFamily: mono, fontSize: layout === 'wide' ? 38 : 46, padding: '14px 30px', borderRadius: 99, border: `1px solid ${c.lineVivid}`, background: `linear-gradient(100deg, rgb(255 255 255 / 0.04) ${shimmer * 100 - 20}%, rgb(255 255 255 / 0.14) ${shimmer * 100}%, rgb(255 255 255 / 0.04) ${shimmer * 100 + 20}%)`, color: c.title }}>
          {url}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: cy + big / 2 + (layout === 'wide' ? 300 : 360), display: 'flex', justifyContent: 'center', gap: 22, alignItems: 'center', fontFamily: sans, fontSize: layout === 'wide' ? 24 : 30, color: c.muted, opacity: tween(t, start + 2.8, start + 3.6) }}>
        {agents.slice(0, 3).map((a, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar tool={a.tool} size={layout === 'wide' ? 28 : 34} t={t} seed={i} /> {['Claude Code', 'Codex', 'OpenCode'][i]}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// The window slides under the caption, so its top fades out where the caption sits.
const fadeTop = (layout: Layout) => {
  const m = layout === 'wide' ? 'linear-gradient(to bottom, transparent 150px, black 235px)' : 'linear-gradient(to bottom, transparent 390px, black 470px)';
  return { maskImage: m, WebkitMaskImage: m };
};

export function Explainer({ layout = 'wide', music = true }: { layout?: Layout; music?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const size = layout === 'wide' ? wide : tall;
  const cam = camera(layout, t, size);
  const enter = tween(t, 5.6, 6.8, 0, 1, out);
  const leave = tween(t, scenes.outro[0] - 0.4, scenes.outro[0] + 0.6, 0, 1, inOut);
  const back = tween(t, M.enter - 0.2, M.enter + 0.5, 0, 1, inOut) * (1 - tween(t, M.exit, M.exit + 0.6, 0, 1, inOut));
  const phoneP = tween(t, P.enter, P.enter + 0.9);
  const behindPhone = layout === 'tall' ? phoneP : 0;
  const worldOpacity = enter * (1 - leave) * (1 - back * 0.82) * (1 - behindPhone * 0.75);
  const tilt = (1 - enter) * 24 + Math.sin(t * 0.4) * 1.2;
  const showWorld = t > 5.5 && t < scenes.outro[0] + 0.7;
  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      <Background t={t} layout={layout} />
      <Intro t={t} layout={layout} />
      {showWorld && (
        <AbsoluteFill style={{ perspective: 2400, opacity: worldOpacity, ...fadeTop(layout) }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${cam.x}px, ${cam.y + (1 - enter) * 260 + leave * -60}px) scale(${cam.scale * (1 - back * 0.08) * (1 - leave * 0.1)})`, filter: back > 0.01 || behindPhone > 0.01 ? `blur(${Math.max(back, behindPhone) * 6}px)` : undefined }}>
            <div style={{ transform: `rotateX(${tilt}deg)`, transformOrigin: '50% 100%', boxShadow: '0 60px 140px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.04)', borderRadius: 20 }}>
              <World t={t} cursor={cursorAt(t, size)} size={size} />
            </div>
          </div>
        </AbsoluteFill>
      )}
      <Machines t={t} layout={layout} />
      {t > P.enter - 0.1 && t < scenes.outro[0] + 0.7 && (
        <div style={{ position: 'absolute', left: layout === 'wide' ? 1920 - PHONE_W - 150 : 540 - PHONE_W * 0.75, top: layout === 'wide' ? 195 : 520, transformOrigin: '0 0', transform: `translateY(${(1 - phoneP) * 700 + leave * 80}px) scale(${layout === 'wide' ? 1 : 1.5}) rotate(${(1 - phoneP) * 8}deg)`, opacity: phoneP * (1 - leave) }}>
          <Phone t={t} />
        </div>
      )}
      <Caption t={t} layout={layout} />
      <Outro t={t} layout={layout} />
      {music && <Audio src={staticFile('music.wav')} />}
    </AbsoluteFill>
  );
}
