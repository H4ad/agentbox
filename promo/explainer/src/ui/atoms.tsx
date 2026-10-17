import type { CSSProperties, ReactNode } from 'react';
import { c, mono, sans } from '../theme';
import type { Tool } from '../data';

// Avatar is the app's AgentCharacter (desktop/src/renderer/components/AgentCharacter.tsx):
// the tools' own marks, Clawd, Codex's cloud and OpenCode's framed "o", drawn
// from the same paths. t drives the blink and, when working, a waving arm.
const CLAWD = '#DE8A6E';
const CLAWD_INK = '#3D2B25';
const CODEX_CLOUD =
  'M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388z';
const OC_FRAME = '#e4dede';
const OC_INNER = '#5a5454';

export function Avatar({ tool, size = 32, t = 0, working = false, seed = 0 }: { tool: Tool; size?: number; t?: number; working?: boolean; seed?: number }) {
  const local = t + seed * 0.37;
  const blink = local % 3.1 < 0.12 ? 0.15 : 1;
  const wave = working ? Math.sin(local * 9) * 18 - 10 : 0;
  const bob = working ? Math.abs(Math.sin(local * 4.5)) * -0.6 : 0;
  const eyes = { transform: `scaleY(${blink})`, transformOrigin: '12px 11px', transformBox: 'view-box' } as CSSProperties;
  const arm = { transform: `rotate(${wave}deg)`, transformOrigin: '18px 12.5px', transformBox: 'view-box' } as CSSProperties;
  const id = `cx${tool}${seed}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={`translate(0 ${bob})`}>
        {tool === 'claude' && (
          <>
            <rect x="18.5" y="10.95" width="5.5" height="3.1" fill={CLAWD} style={arm} />
            <path fill={CLAWD} d="M3 5h18v12.08h-1.49V20H18v-2.92h-1.49V20H15v-2.92H9V20H7.49v-2.92H6V20H4.49v-2.92H3v-3.03H0v-3.1h3z" />
            <g fill={CLAWD_INK} style={eyes}>
              <rect x="6.15" y="8.5" width="1.2" height="2.1" rx="0.3" />
              <rect x="16.66" y="8.5" width="1.2" height="2.1" rx="0.3" />
            </g>
          </>
        )}
        {tool === 'codex' && (
          <>
            <defs>
              <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="12" x2="12" y1="3" y2="21">
                <stop stopColor="#C9C2FF" />
                <stop offset=".5" stopColor="#97B2FF" />
                <stop offset="1" stopColor="#6670FF" />
              </linearGradient>
            </defs>
            <rect x="17" y="11.2" width="6.6" height="2.5" rx="1.25" fill="#97B2FF" style={arm} />
            <path d={CODEX_CLOUD} fill={`url(#${id})`} />
            <g style={eyes} stroke="#fff" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M8.2 10.15l1 1.9-1 1.85" />
            </g>
            <path d="M12.9 14.2h2.9" stroke="#fff" strokeWidth={1} strokeLinecap="round" opacity={working && local % 0.8 < 0.4 ? 0.2 : 1} />
          </>
        )}
        {tool === 'opencode' && (
          <>
            <rect x="8" y="10" width="8" height="8" fill={OC_INNER} />
            <path d="M16 6H8v12h8V6zm4 16H4V2h16v20z" fillRule="evenodd" fill={OC_FRAME} />
            <rect x="17.5" y="12" width="5.8" height="3" fill={OC_FRAME} style={arm} />
            <g fill={OC_FRAME} style={eyes}>
              <rect x="9.8" y="12.4" width="1.2" height="1.9" rx="0.3" />
              <rect x="13" y="12.4" width="1.2" height="1.9" rx="0.3" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}

// AgentBadge is the rail's avatar tile: the character on a dark square with a status dot.
export function AgentBadge({ tool, size = 40, t = 0, working = false, dot = c.emerald400, seed = 0 }: { tool: Tool; size?: number; t?: number; working?: boolean; dot?: string; seed?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: size * 0.28, background: c.surfaceStrong, border: `1px solid ${c.lineStrong}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Avatar tool={tool} size={size * 0.62} t={t} working={working} seed={seed} />
      <div style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.3, height: size * 0.3, borderRadius: 99, background: dot, border: `${Math.max(2, size * 0.06)}px solid #0b0b10` }} />
    </div>
  );
}

// Logo is the app icon (desktop/build/icon.svg): the cube on the brand gradient.
export function Logo({ size = 64, draw = 1 }: { size?: number; draw?: number }) {
  const len = 70;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="lg-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#lg-bg)" />
      <rect x="28" y="28" width="456" height="456" rx="108" fill="url(#lg-shine)" />
      <g transform="translate(106 106) scale(12.5)" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)}>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </g>
    </svg>
  );
}

export function Pill({ children, color = c.muted, bg = c.surface, border = c.lineStrong, style }: { children: ReactNode; color?: string; bg?: string; border?: string; style?: CSSProperties }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, fontSize: 13, fontWeight: 500, color, background: bg, border: `1px solid ${border}`, whiteSpace: 'nowrap', fontFamily: sans, ...style }}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: mono, fontSize: 11, color: c.subtle, border: `1px solid ${c.lineStrong}`, borderRadius: 5, padding: '1px 6px' }}>{children}</span>;
}

// Cursor is a pointer that eases between stops and presses on clicks.
export function Cursor({ x, y, pressed = 0, opacity = 1 }: { x: number; y: number; pressed?: number; opacity?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none', zIndex: 100 }}>
      {pressed > 0 && (
        <div style={{ position: 'absolute', left: -28, top: -28, width: 56, height: 56, borderRadius: 99, border: `2px solid ${c.brand300}`, opacity: 1 - pressed, transform: `scale(${0.4 + pressed * 1.1})` }} />
      )}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: `scale(${1 - Math.sin(Math.min(1, pressed * 2) * Math.PI) * 0.15})`, transformOrigin: '4px 3px', filter: 'drop-shadow(0 4px 10px rgb(0 0 0 / 0.6))' }}>
        <path d="M4 3l15 7.5-6.4 1.9L9.8 19z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
