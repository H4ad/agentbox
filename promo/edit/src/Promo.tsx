import '@fontsource-variable/inter';
import React from 'react';
import { Video } from '@remotion/media';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import timeline from '../public/timeline.json';

type Cam = [number, number, number, number];
type Frame = [number, number, number];
interface Seg { take: string; src: number; rate: number; dur: number; at: number; cam: Cam[]; frame?: Frame[]; ptr: [number, number, number][]; clicks: [number, number, number][] }
interface Scene { id: string; at: number; dur: number; segs?: Seg[]; captions?: [number, string, string, string?][]; triptych?: [string, string, string][]; src?: number }

const FPS = 60;
const SW = 2560, SH = 1440;
const VIOLET = '#a78bfa', INDIGO = '#6366f1', GREEN = '#34d399';
const font = '"Inter Variable", Inter, system-ui, sans-serif';
const smooth = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.16, 1, 0.3, 1);

// key interpolates keyframes [t, ...values] at time t, eased between each pair.
function key(frames: number[][], t: number): number[] {
  if (t <= frames[0][0]) return frames[0].slice(1);
  const last = frames[frames.length - 1];
  if (t >= last[0]) return last.slice(1);
  const i = frames.findIndex((f) => f[0] > t) - 1;
  const a = frames[i], b = frames[i + 1];
  const p = smooth((t - a[0]) / (b[0] - a[0]));
  return a.slice(1).map((v, j) => v + (b[j + 1] - v) * p);
}

function pointer(ptr: [number, number, number][], t: number): [number, number] | null {
  if (!ptr.length) return null;
  if (t <= ptr[0][0]) return [ptr[0][1], ptr[0][2]];
  for (let i = 1; i < ptr.length; i++) {
    if (ptr[i][0] >= t) {
      const a = ptr[i - 1], b = ptr[i];
      const p = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];
    }
  }
  const l = ptr[ptr.length - 1];
  return [l[1], l[2]];
}

// ---- Backdrop -------------------------------------------------------------

export const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const blob = (x: number, y: number, r: number, c: string, sp: number, ph: number) => (
    <div style={{ position: 'absolute', left: `${x + Math.sin(t * sp + ph) * 8}%`, top: `${y + Math.cos(t * sp * 0.8 + ph) * 8}%`, width: r, height: r, borderRadius: '50%', background: c, filter: 'blur(120px)', opacity: 0.55, transform: 'translate(-50%,-50%)' }} />
  );
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 90% at 50% 0%, #15122b 0%, #0a0a12 55%, #050508 100%)', overflow: 'hidden' }}>
      {blob(20, 25, 900, '#4c1d95', 0.23, 0)}
      {blob(80, 70, 1000, '#312e81', 0.19, 2)}
      {blob(60, 15, 600, '#0f766e', 0.17, 4)}
      <AbsoluteFill style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(70% 60% at 50% 50%, black, transparent)' }} />
    </AbsoluteFill>
  );
};

// ---- Cursor ---------------------------------------------------------------

const Arrow: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.5} viewBox="0 0 24 36" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.55))', display: 'block' }}>
    <path d="M2 2 L2 28 L8.5 22 L13 33 L17.5 31 L13 20.5 L21.5 20.5 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

// ---- Screen: one segment of a take, through the camera --------------------

const Screen: React.FC<{ seg: Seg; vertical: boolean; local: number }> = ({ seg, vertical, local }) => {
  const { width: W, height: H } = useVideoConfig();
  const t = local / FPS;
  const srcT = seg.src + t * seg.rate;
  const [cx, cy, z] = key(seg.cam, t);
  // Landscape fits the take's width at zoom 1; portrait shows half of it.
  const s = vertical ? (W / SW) * 2.05 * (1 + (z - 1) * 0.3) : (W / SW) * z;
  const clamp = (v: number, span: number, view: number) => (span * s <= view ? (view - span * s) / 2 : Math.min(0, Math.max(view - span * s, v)));
  const tx = clamp(W / 2 - cx * s, SW, W);
  // Portrait keeps the screen below the caption band at the top.
  const ty = vertical ? Math.min(400, Math.max(H - SH * s, H * 0.6 - cy * s)) : clamp(H / 2 - cy * s, SH, H);
  const p = pointer(seg.ptr, srcT);
  const cursorScale = 1 / (s / ((W / SW) * 1)) ** 0.35; // stays legible when zoomed
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#09090d' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: SH, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <Video src={staticFile(`rec/${seg.take}.mp4`)} trimBefore={Math.round(seg.src * FPS)} playbackRate={seg.rate} muted style={{ width: SW, height: SH, display: 'block' }} />
        {seg.clicks.map(([ct, x, y], i) => {
          const age = (srcT - ct) / seg.rate;
          if (age < 0 || age > 0.6) return null;
          const k = out(age / 0.6);
          return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 90, height: 90, marginLeft: -45, marginTop: -45, borderRadius: '50%', border: `5px solid ${VIOLET}`, transform: `scale(${0.3 + k * 1.1})`, opacity: 1 - k, boxShadow: `0 0 30px ${VIOLET}` }} />;
        })}
        {p && (
          <div style={{ position: 'absolute', left: p[0] - 3, top: p[1] - 3, transform: `scale(${cursorScale * 1.25})`, transformOrigin: '3px 3px' }}>
            <Arrow size={30} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Window frames the screen as a floating window when its scale is under 1.
const Window: React.FC<{ scale: number; rx: number; children: React.ReactNode }> = ({ scale, rx, children }) => {
  const r = interpolate(scale, [0.85, 1], [22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ perspective: 2000 }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) rotateX(${rx}deg)`, borderRadius: r, overflow: 'hidden', boxShadow: scale < 1 ? '0 40px 120px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.09)' : undefined }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---- Captions ---------------------------------------------------------------

const Caption: React.FC<{ eyebrow: string; text: string; local: number; dur: number; vertical: boolean; top?: boolean }> = ({ eyebrow, text, local, dur, vertical, top }) => {
  const words = text.split(' ');
  const outT = interpolate(local, [dur - 12, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  let accent = false;
  return (
    <div style={{ position: 'absolute', ...(vertical ? { left: 70, right: 70, top: 150 } : top ? { left: 110, top: 80 } : { left: 110, bottom: 96 }), fontFamily: font, color: '#fff', opacity: 1 - outT, transform: `translateY(${-outT * 24}px)`, filter: `blur(${outT * 8}px)` }}>
      {eyebrow && (
        <div style={{ fontSize: vertical ? 30 : 24, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: VIOLET, marginBottom: 14, opacity: interpolate(local, [0, 10], [0, 1], { extrapolateRight: 'clamp' }), transform: `translateX(${interpolate(local, [0, 14], [-20, 0], { extrapolateRight: 'clamp', easing: out })}px)` }}>
          <span style={{ display: 'inline-block', width: 26, height: 3, background: VIOLET, verticalAlign: 'middle', marginRight: 14, borderRadius: 2 }} />
          {eyebrow}
        </div>
      )}
      <div style={{ fontSize: vertical ? 74 : 68, fontWeight: 760, letterSpacing: '-0.035em', lineHeight: 1.06, maxWidth: vertical ? 940 : 1300, textShadow: '0 4px 30px rgba(0,0,0,.65)' }}>
        {words.map((w, i) => {
          const starts = w.startsWith('*');
          if (starts) accent = true;
          const isAccent = accent;
          if (w.endsWith('*') || w.endsWith('*,')) accent = false;
          const d = local - 4 - i * 3;
          const k = interpolate(d, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out });
          return (
            <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: k, transform: `translateY(${(1 - k) * 40}px) scale(${0.92 + k * 0.08})`, filter: `blur(${(1 - k) * 10}px)`, ...(isAccent ? { background: `linear-gradient(90deg, ${VIOLET}, ${GREEN})`, WebkitBackgroundClip: 'text', color: 'transparent' } : {}) }}>
              {w.replace(/\*/g, '')}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const Captions: React.FC<{ scene: Scene; vertical: boolean }> = ({ scene, vertical }) => {
  const f = useCurrentFrame();
  const caps = scene.captions ?? [];
  return (
    <>
      {!vertical && (() => {
        const live = caps.filter(([at], i) => f >= at * FPS && (i + 1 >= caps.length || f < caps[i + 1][0] * FPS));
        const top = live.some((c) => c[3] === 'top');
        return <AbsoluteFill style={{ background: top ? 'linear-gradient(180deg, rgba(5,5,10,.85) 0%, rgba(5,5,10,.45) 22%, transparent 40%)' : 'linear-gradient(0deg, rgba(5,5,10,.82) 0%, rgba(5,5,10,.45) 22%, transparent 42%)' }} />;
      })()}
      {vertical && <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,5,10,.92) 0%, rgba(5,5,10,.6) 22%, transparent 34%)' }} />}
      {caps.map(([at, eyebrow, text, pos], i) => {
        const start = Math.round(at * FPS);
        const end = i + 1 < caps.length ? Math.round(caps[i + 1][0] * FPS) : Math.round(scene.dur * FPS) - 6;
        if (f < start || f >= end) return null;
        return <Caption key={i} eyebrow={eyebrow || (i > 0 ? caps.slice(0, i).reverse().find((c) => c[1])?.[1] ?? '' : '')} text={text} local={f - start} dur={end - start} vertical={vertical} top={pos === 'top'} />;
      })}
    </>
  );
};

// ---- Scenes ---------------------------------------------------------------

// Transition: the scene arrives from a little zoomed out and blurred, and
// leaves zooming past the camera.
const Whip: React.FC<{ dur: number; children: React.ReactNode; first?: boolean }> = ({ dur, children, first }) => {
  const f = useCurrentFrame();
  const total = dur * FPS;
  const inK = first ? 1 : interpolate(f, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out });
  const outK = interpolate(f, [total - 10, total], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ opacity: Math.min(inK * 1.4, 1) * (1 - outK * 0.9), transform: `scale(${(0.94 + inK * 0.06) * (1 + outK * 0.08)})`, filter: `blur(${(1 - inK) * 14 + outK * 16}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

// SegView is one segment, in a Sequence of its own so its take plays from
// the segment's first frame.
const SegView: React.FC<{ seg: Seg; first: boolean; vertical: boolean }> = ({ seg, first, vertical }) => {
  const local = useCurrentFrame();
  const [sc, rx] = seg.frame ? key(seg.frame, local / FPS) : [1, 0];
  const cut = first ? 0 : interpolate(local, [0, 8], [0.35, 0], { extrapolateRight: 'clamp' });
  return (
    <Window scale={vertical ? Math.min(sc, 1) : sc} rx={rx}>
      <Screen seg={seg} vertical={vertical} local={local} />
      <AbsoluteFill style={{ background: '#000', opacity: cut }} />
    </Window>
  );
};

const ScreenScene: React.FC<{ scene: Scene; vertical: boolean }> = ({ scene, vertical }) => (
  <AbsoluteFill>
    <Backdrop />
    {scene.segs!.map((seg, i) => (
      <Sequence key={i} from={Math.round((seg.at - scene.at) * FPS)} durationInFrames={Math.round(seg.dur * FPS)}>
        <SegView seg={seg} first={i === 0} vertical={vertical} />
      </Sequence>
    ))}
    <Captions scene={scene} vertical={vertical} />
  </AbsoluteFill>
);

const Triptych: React.FC<{ scene: Scene; vertical: boolean }> = ({ scene, vertical }) => {
  const f = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const crop = vertical ? { x: 880, y: 70, w: 1100, h: 640 } : { x: 880, y: 70, w: 1000, h: 820 };
  const cardW = vertical ? 940 : 580;
  const s = cardW / crop.w;
  const cardH = crop.h * s;
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ perspective: 2200 }}>
        {scene.triptych!.map(([takeName, name, tool], i) => {
          const d = f - i * 7;
          const k = interpolate(d, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out });
          const drift = interpolate(f, [0, scene.dur * FPS], [0, 1]);
          const x = vertical ? (W - cardW) / 2 : 960 + (i - 1) * (cardW + 50) - cardW / 2;
          const y = vertical ? 470 + i * (cardH + 80) : 170;
          // Landscape pulls focus onto each agent in turn, the others dimmed.
          const t = f / FPS;
          const focusOf = (j: number) => (vertical ? 0 : interpolate(t, [2.0 + j * 1.95, 2.45 + j * 1.95, 3.6 + j * 1.95, 4.05 + j * 1.95], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth }));
          const mine = focusOf(i);
          const other = Math.max(...[0, 1, 2].filter((j) => j !== i).map(focusOf));
          const ry = vertical ? 0 : ((i - 1) * -9 + (i - 1) * 3 * drift) * (1 - mine);
          const dx = (960 - (x + cardW / 2)) * mine + (i - 1) * 140 * other;
          const dy = 30 * mine;
          const sc = (0.9 + k * 0.1 + drift * 0.03) * (1 + 0.5 * mine) * (1 - 0.1 * other);
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: cardW, zIndex: mine > 0 ? 5 : 1, opacity: k * (1 - 0.6 * other), filter: `blur(${other * 6}px)`, transform: `translate(${dx}px, ${(1 - k) * 120 + dy}px) rotateY(${ry}deg) scale(${sc})` }}>
              <div style={{ fontFamily: font, color: '#e7e7ee', fontSize: vertical ? 34 : 26, fontWeight: 650, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: GREEN, boxShadow: `0 0 14px ${GREEN}` }} />
                {name}
                <span style={{ color: '#8b8ba0', fontWeight: 500 }}>· {tool}</span>
              </div>
              <div style={{ width: cardW, height: cardH, borderRadius: 18, overflow: 'hidden', position: 'relative', boxShadow: '0 30px 90px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.1)' }}>
                <div style={{ position: 'absolute', left: -crop.x * s, top: -crop.y * s, width: SW * s, height: SH * s }}>
                  <Video src={staticFile(`rec/${takeName}.mp4`)} trimBefore={Math.round(scene.src! * FPS)} muted style={{ width: SW * s, height: SH * s }} />
                </div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <Captions scene={scene} vertical={vertical} />
    </AbsoluteFill>
  );
};

export const Logo: React.FC<{ size: number }> = ({ size }) => <Img src={staticFile('logo.svg')} style={{ width: size, height: size, filter: 'drop-shadow(0 20px 60px rgba(124,58,237,.55))' }} />;

const Intro: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const f = useCurrentFrame();
  const logoK = interpolate(f, [6, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out });
  const up = interpolate(f, [92, 122], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth });
  const word = (text: string, at: number, accent = false) => {
    const k = interpolate(f - at, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out });
    return <span style={{ display: 'inline-block', marginRight: '0.25em', opacity: k, transform: `translateY(${(1 - k) * 50}px)`, filter: `blur(${(1 - k) * 12}px)`, ...(accent ? { background: `linear-gradient(90deg, ${VIOLET}, ${GREEN})`, WebkitBackgroundClip: 'text', color: 'transparent' } : {}) }}>{text}</span>;
  };
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: font, color: '#fff' }}>
        <div style={{ transform: `translateY(${-up * (vertical ? 260 : 170)}px) scale(${1 - up * 0.35})`, display: 'flex', alignItems: 'center', gap: 34, opacity: logoK }}>
          <div style={{ transform: `scale(${0.6 + logoK * 0.4}) rotate(${(1 - logoK) * -20}deg)` }}><Logo size={vertical ? 150 : 140} /></div>
          <div style={{ fontSize: vertical ? 110 : 120, fontWeight: 800, letterSpacing: '-0.045em', clipPath: `inset(0 ${(1 - logoK) * 100}% 0 0)` }}>AgentBox</div>
        </div>
        <div style={{ position: 'absolute', top: vertical ? 900 : 560, textAlign: 'center', fontSize: vertical ? 88 : 84, fontWeight: 760, letterSpacing: '-0.04em', lineHeight: 1.1, width: vertical ? 900 : 1600 }}>
          {f > 100 && <>{word('One', 104)}{word('lead.', 110)}{vertical && <br />}{word('A', 132)}{word('team', 137, true)}{word('of', 142, true)}{word('agents.', 147, true)}</>}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [4, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out });
  const url = interpolate(f, [34, 64], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out });
  const fade = interpolate(f, [330, 360], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: font, color: '#fff', flexDirection: 'column', gap: vertical ? 60 : 46 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, flexDirection: vertical ? 'column' : 'row', opacity: k, transform: `scale(${(0.85 + k * 0.15) * (1 + f * 0.00015)})`, filter: `blur(${(1 - k) * 14}px)` }}>
          <Logo size={vertical ? 220 : 170} />
          <div style={{ fontSize: vertical ? 150 : 150, fontWeight: 820, letterSpacing: '-0.05em' }}>AgentBox</div>
        </div>
        <div style={{ opacity: url, transform: `translateY(${(1 - url) * 30}px) scale(${1 + f * 0.00012})`, fontSize: vertical ? 52 : 46, fontWeight: 600, padding: '18px 40px', borderRadius: 999, background: 'linear-gradient(90deg, rgba(124,58,237,.35), rgba(52,211,153,.22))', border: '1px solid rgba(255,255,255,.18)', letterSpacing: '-0.01em' }}>
          agentbox.linting.dev
        </div>
        <div style={{ opacity: interpolate(f, [70, 100], [0, 0.75], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), fontSize: vertical ? 34 : 28, color: '#b9b9c9', fontWeight: 500, letterSpacing: '0.02em' }}>
          Claude Code · Codex · OpenCode
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: fade }} />
    </AbsoluteFill>
  );
};

export const Promo: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const scenes = timeline.scenes as unknown as Scene[];
  return (
    <AbsoluteFill style={{ background: '#050508' }}>
      {scenes.map((sc) => (
        <Sequence key={sc.id} from={Math.round(sc.at * FPS)} durationInFrames={Math.round(sc.dur * FPS)}>
          <Whip dur={sc.dur} first={sc.id === 'intro'}>
            {sc.id === 'intro' ? <Intro vertical={vertical} /> : sc.id === 'outro' ? <Outro vertical={vertical} /> : sc.triptych ? <Triptych scene={sc} vertical={vertical} /> : <ScreenScene scene={sc} vertical={vertical} />}
          </Whip>
        </Sequence>
      ))}
      <Audio src={staticFile('audio.wav')} />
    </AbsoluteFill>
  );
};
