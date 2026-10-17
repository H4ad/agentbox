import { Easing, interpolate } from 'remotion';
import timeline from './timeline.json';

// Colours and type are the desktop app's dark appearance
// (desktop/src/renderer/styles.css, :root): the same --ab-* values, by name.
export const c = {
  ink: '#07070b',
  chat: '#09090d',
  composer: '#131318',
  stage: '#0a0a0f',
  brand300: '#c4b5fd',
  brand400: '#a78bfa',
  brand500: '#8b5cf6',
  brand600: '#7c3aed',
  brandMid: '#6366f1',
  brandDeep: '#4f46e5',
  brandFar: '#38bdf8',
  title: '#fafafa',
  primary: '#f4f4f5',
  secondary: '#e4e4e7',
  tertiary: '#d4d4d8',
  muted: '#a1a1aa',
  subtle: '#71717a',
  faint: '#52525b',
  ghost: '#3f3f46',
  surfaceFaint: 'rgb(255 255 255 / 0.03)',
  surface: 'rgb(255 255 255 / 0.05)',
  surfaceRaised: 'rgb(255 255 255 / 0.065)',
  surfaceStrong: 'rgb(255 255 255 / 0.09)',
  surfaceVivid: 'rgb(255 255 255 / 0.14)',
  lineFaint: 'rgb(255 255 255 / 0.05)',
  line: 'rgb(255 255 255 / 0.065)',
  lineStrong: 'rgb(255 255 255 / 0.1)',
  lineVivid: 'rgb(255 255 255 / 0.15)',
  rail: 'rgb(0 0 0 / 0.25)',
  sunken: 'rgb(0 0 0 / 0.3)',
  well: 'rgb(0 0 0 / 0.42)',
  modal: 'rgb(9 9 11 / 0.97)',
  emerald300: '#6ee7b7',
  emerald400: '#34d399',
  amber300: '#fcd34d',
  amber400: '#fbbf24',
  rose300: '#fda4af',
  rose400: '#fb7185',
  sky300: '#7dd3fc',
  sky400: '#38bdf8',
  termBlue: '#818cf8',
  termMagenta: '#c084fc',
  termCyan: '#67e8f9',
  termGreen: '#6ee7b7',
  termYellow: '#fcd34d',
};

export const sans = '"Inter", system-ui, sans-serif';
export const mono = '"JetBrains Mono", ui-monospace, monospace';

export const FPS = timeline.fps;
export const DURATION = Math.round(timeline.duration * FPS);
export const scenes = timeline.scenes as unknown as Record<string, [number, number]>;
export const sec = (s: number) => Math.round(s * FPS);

export const out = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

// tween maps the current time t (seconds) from [a, b] to [from, to], clamped, eased.
export function tween(t: number, a: number, b: number, from = 0, to = 1, easing = out) {
  return interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
}

// typed is the first part of text a typist has reached by time t.
export function typed(text: string, t: number, start: number, cps = 38) {
  const n = Math.max(0, Math.floor((t - start) * cps));
  return text.slice(0, n);
}

export type Layout = 'wide' | 'tall';
