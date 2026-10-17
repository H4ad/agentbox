import { AbsoluteFill } from 'remotion';
import { c, mono, sans } from './theme';
import { Logo } from './ui/atoms';
import { Machines } from './ui/Machines';

// Cover is the video's thumbnail: the four machines at work behind the name.
export function Cover() {
  const hi = { background: `linear-gradient(90deg, ${c.brand300}, ${c.sky300})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as const;
  return (
    <AbsoluteFill style={{ background: c.ink, fontFamily: sans }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 55% at 30% 20%, rgb(139 92 246 / 0.3), transparent 70%), radial-gradient(55% 50% at 78% 80%, rgb(56 189 248 / 0.18), transparent 70%)' }} />
      <AbsoluteFill style={{ opacity: 0.55, filter: 'blur(3px)', transform: 'scale(1.06) translateY(30px)' }}>
        <Machines t={24.8} layout="wide" />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(50% 45% at 50% 50%, rgb(7 7 11 / 0.92), rgb(7 7 11 / 0.55) 70%, rgb(7 7 11 / 0.2))' }} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <div style={{ filter: 'drop-shadow(0 20px 50px rgb(124 58 237 / 0.7))' }}>
          <Logo size={150} />
        </div>
        <div style={{ fontSize: 128, fontWeight: 700, letterSpacing: -4, color: c.title, lineHeight: 1 }}>AgentBox</div>
        <div style={{ fontSize: 46, fontWeight: 600, color: c.secondary, letterSpacing: -0.5 }}>
          One lead. <span style={hi}>A team of AI agents</span>, each on its own machine.
        </div>
        <div style={{ marginTop: 8, fontFamily: mono, fontSize: 30, color: c.muted }}>agentbox.linting.dev</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
