// compose.mjs writes the explainer's soundtrack, an original piece synthesised
// here from oscillators and noise (no samples), as a 48 kHz stereo WAV:
//   node music/compose.mjs public/music.wav
// It follows src/timeline.json: 120 BPM, so a bar is 2 s and every scene
// starts on a bar, and the UI's clicks, pops, whooshes and chimes land on the
// times listed there.
import { readFileSync, writeFileSync } from 'node:fs';

const tl = JSON.parse(readFileSync(new URL('../src/timeline.json', import.meta.url)));
const SR = 48000;
const LEN = Math.ceil(tl.duration * SR);
const BEAT = 60 / tl.bpm;
const BAR = BEAT * 4;
const S = tl.scenes;

const bus = () => ({ l: new Float32Array(LEN), r: new Float32Array(LEN) });
const dry = bus(); // drums, bass
const wet = bus(); // pads, plucks, bells: also sent to the reverb
const duck = new Float32Array(LEN).fill(1); // the kick's sidechain

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function add(b, i, v, pan = 0) {
  if (i < 0 || i >= LEN) return;
  b.l[i] += v * Math.cos(((pan + 1) * Math.PI) / 4);
  b.r[i] += v * Math.sin(((pan + 1) * Math.PI) / 4);
}

// A two-pole state-variable lowpass, one per voice.
function svf() {
  let lp = 0, bp = 0;
  return (x, cutoff, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SR / 6)) / SR);
    lp += f * bp;
    const hp = x - lp - bp / q;
    bp += f * hp;
    return lp;
  };
}

const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

// Chords, one per bar: Am7, Fmaj7, Cadd9, G6.
const prog = [
  { root: 45, notes: [57, 60, 64, 67] },
  { root: 41, notes: [53, 57, 60, 64] },
  { root: 48, notes: [60, 62, 64, 67] },
  { root: 43, notes: [55, 59, 62, 64] },
];
const chordAt = (t) => prog[Math.floor(t / BAR) % 4];
const inScene = (t, ...names) => names.some((n) => t >= S[n][0] && t < S[n][1]);

function pad(start, dur, notes, gain, bright) {
  const a = Math.floor(start * SR), n = Math.floor(dur * SR);
  for (const note of notes) {
    const f = midi(note);
    const voices = [-0.09, 0, 0.11].map((d, k) => ({ ph: rnd() * 0.5 + 0.5, inc: (f * 2 ** (d / 12)) / SR, pan: (k - 1) * 0.6 }));
    const lp = svf(), lp2 = svf();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.6) * Math.min(1, (dur - t) / 0.8);
      let l = 0, r = 0;
      for (const v of voices) {
        v.ph += v.inc;
        const s = saw(v.ph % 1);
        l += s * (1 - v.pan) * 0.5;
        r += s * (1 + v.pan) * 0.5;
      }
      const cut = bright * (1 + 0.15 * Math.sin(t * 1.3));
      const ii = a + i;
      if (ii >= LEN) break;
      const d = duck[ii];
      wet.l[ii] += lp(l, cut) * env * gain * d;
      wet.r[ii] += lp2(r, cut) * env * gain * d;
    }
  }
}

function pluck(start, note, gain, bright, pan) {
  const a = Math.floor(start * SR), n = Math.floor(0.5 * SR);
  const f = midi(note), lp = svf();
  let ph = 0, ph2 = 0.3;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += f / SR;
    ph2 += (f * 1.004) / SR;
    const env = Math.exp(-t * 9) * Math.min(1, t / 0.002);
    const s = (saw(ph % 1) + saw(ph2 % 1)) * 0.5;
    const v = lp(s, 300 + bright * Math.exp(-t * 14), 1.4) * env * gain;
    add(wet, a + i, v, pan);
    // a dotted-eighth echo, panned the other way
    add(wet, a + i + Math.floor(BEAT * 0.75 * SR), v * 0.35, -pan);
    add(wet, a + i + Math.floor(BEAT * 1.5 * SR), v * 0.15, pan);
  }
}

function bell(start, note, gain, pan = 0) {
  const a = Math.floor(start * SR), n = Math.floor(2.5 * SR), f = midi(note);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const mod = Math.sin(2 * Math.PI * f * 3.5 * t) * 2.2 * Math.exp(-t * 3);
    const v = Math.sin(2 * Math.PI * f * t + mod) * Math.exp(-t * 2.2) * Math.min(1, t / 0.003) * gain;
    add(wet, a + i, v, pan);
  }
}

function bass(start, dur, note, gain) {
  const a = Math.floor(start * SR), n = Math.floor(dur * SR), f = midi(note), lp = svf();
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += f / SR;
    const env = Math.min(1, t / 0.005) * Math.min(1, (dur - t) / 0.03);
    const s = Math.sin(2 * Math.PI * ph) * 0.8 + lp(saw(ph % 1), 420) * 0.5;
    const ii = a + i;
    if (ii >= LEN) break;
    add(dry, ii, s * env * gain * duck[ii]);
  }
}

function kick(start, gain) {
  const a = Math.floor(start * SR), n = Math.floor(0.45 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (45 + 120 * Math.exp(-t * 28)) / SR;
    add(dry, a + i, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * gain);
    const ii = a + i;
    if (ii < LEN) duck[ii] = Math.min(duck[ii], 1 - 0.55 * Math.exp(-t * 7));
  }
}

function noiseHit(start, dur, gain, cutoff, hp, pan = 0) {
  const a = Math.floor(start * SR), n = Math.floor(dur * SR), lp = svf();
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let x = rnd();
    if (hp) {
      const y = x - prev;
      prev = x;
      x = y;
    }
    add(dry, a + i, lp(x, cutoff, 0.9) * Math.exp((-t * 4) / dur) * gain, pan);
  }
}

const clap = (t, g) => {
  for (const d of [0, 0.011, 0.022]) noiseHit(t + d, 0.18, g * 0.8, 2400, false);
};
const hat = (t, g, pan) => noiseHit(t, 0.05, g, 11000, true, pan);

function whoosh(end, gain) {
  const dur = 0.9, a = Math.floor((end - dur) * SR), n = Math.floor(dur * SR + 0.4 * SR), lp = svf();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const p = Math.min(1, t / dur);
    const env = t < dur ? p * p : Math.exp(-(t - dur) * 10);
    const v = lp(rnd(), 400 + 6000 * p * p, 2) * env * gain;
    add(wet, a + i, v, Math.sin(t * 5) * 0.5);
  }
}

function blip(start, f0, f1, dur, gain) {
  const a = Math.floor(start * SR), n = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (f0 + (f1 - f0) * (t / dur)) / SR;
    add(wet, a + i, Math.sin(2 * Math.PI * ph) * Math.exp(-t * (6 / dur)) * gain);
  }
}

// --- the arrangement ---
// Kicks first: the pads and the bass duck under them.
for (let i = 0; i * BEAT * 0.25 < S.outro[0]; i++) {
  const t = i * BEAT * 0.25;
  const full = inScene(t, 'spawn', 'parallel', 'review');
  if (inScene(t, 'lead') && i % 8 === 0) kick(t, 0.5);
  if (full && i % 4 === 0) kick(t, 0.7);
  if (inScene(t, 'prs') && i % 8 === 0) kick(t, 0.45);
}
kick(S.outro[0], 0.8);

const bars = Math.ceil(tl.duration / BAR);
for (let b = 0; b < bars; b++) {
  const t0 = b * BAR;
  const ch = chordAt(t0);
  const outro = t0 >= S.outro[0];
  const intro = t0 < S.intro[1];
  const breakdown = inScene(t0, 'prs');
  if (outro) continue;
  pad(t0, BAR + 0.6, ch.notes, intro ? 0.05 : 0.04, intro ? 700 + b * 350 : breakdown ? 1500 : 2200);
}
// the outro: one long Am(add9) that rings out
pad(S.outro[0], tl.duration - S.outro[0], [45, 57, 60, 64, 71], 0.045, 1600);
bass(S.outro[0], 4, 33, 0.22);

for (let i = 0; i * BEAT * 0.25 < S.outro[0]; i++) {
  const t = i * BEAT * 0.25;
  const ch = chordAt(t);
  const step = i % 16;
  // plucked arpeggio from the lead's scene on, quieter while the PRs come in
  if (t >= S.lead[0]) {
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    const note = ch.notes[pattern[step % 8]] + 12 + (step >= 8 && t >= S.spawn[0] ? 12 * (step % 3 === 0) : 0);
    const bright = inScene(t, 'lead') ? 1800 : inScene(t, 'prs') ? 2200 : 4200;
    pluck(t, note, inScene(t, 'prs') ? 0.06 : 0.08, bright, step % 2 ? 0.4 : -0.4);
  }
  // drums
  const full = inScene(t, 'spawn', 'parallel', 'review');
  if (full && i % 8 === 4) clap(t, 0.32);
  if ((full || inScene(t, 'prs')) && i % 2 === 1) hat(t, i % 4 === 3 ? 0.075 : 0.04, i % 4 === 3 ? 0.3 : -0.3);
  if (inScene(t, 'lead') && i % 4 === 2) hat(t, 0.05, 0.2);
  // bass in eighths under the full sections, held notes under the lead
  if (t >= S.lead[0]) {
    if (full && i % 2 === 0) bass(t, BEAT * 0.45, ch.root - 12 + (i % 8 === 6 ? 12 : 0), 0.24);
    else if (!full && i % 16 === 0) bass(t, BAR * 0.95, ch.root - 12, 0.2);
  }
}

// A short motif over the parallel scene and the review, an octave up.
const motif = [[0, 76], [0.75, 74], [1.5, 72], [2.5, 69], [3, 72], [3.5, 74], [4, 76], [5.5, 79], [6, 76], [7, 74]];
for (const start of [S.parallel[0], S.parallel[0] + 4 * BAR, S.review[0] + BAR, S.review[0] + 3 * BAR]) {
  for (const [beat, note] of motif) bell(start + beat * BEAT, note, 0.05, 0.2);
}

// The intro's logo, and the outro's name and address.
bell(0.6, 81, 0.09, -0.2);
bell(0.9, 88, 0.06, 0.3);
bell(1.3, 84, 0.06, 0);
for (const [d, n] of [[0, 69], [0.25, 76], [0.5, 81], [0.75, 84], [1.0, 88]]) bell(S.outro[0] + 0.3 + d, n, 0.07, (n - 78) / 20);
bell(S.outro[0] + 2.1, 93, 0.05, 0);

// UI sound effects on the timeline's moments.
for (const t of tl.whooshes) whoosh(t + 0.3, 0.09);
for (const t of tl.clicks) {
  blip(t, 2200, 1600, 0.03, 0.12);
  noiseHit(t, 0.02, 0.08, 6000, true);
}
for (const t of tl.pops) blip(t, 520, 1100, 0.09, 0.09);
for (const t of tl.chimes) {
  bell(t, 84, 0.08, -0.1);
  bell(t + 0.09, 91, 0.06, 0.1);
}

// --- mix: a small Schroeder reverb on the wet bus, then a soft clip ---
function reverb(inp, out, mix) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: Math.floor(d * (SR / 44100) * 1.6), buf: null, i: 0, fb: 0.84, lp: 0 }));
  for (const c of combs) c.buf = new Float32Array(c.d);
  const aps = [225, 556].map((d) => ({ d: Math.floor(d * (SR / 44100)), buf: null, i: 0 }));
  for (const a of aps) a.buf = new Float32Array(a.d);
  for (let n = 0; n < LEN; n++) {
    const x = inp[n] * 0.3;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * 0.6 + c.lp * 0.4;
      c.buf[c.i] = x + c.lp * c.fb;
      c.i = (c.i + 1) % c.d;
      y += o;
    }
    for (const a of aps) {
      const o = a.buf[a.i];
      const v = y + o * 0.5;
      a.buf[a.i] = v;
      a.i = (a.i + 1) % a.d;
      y = o - v * 0.5;
    }
    out[n] += y * mix;
  }
}
const mix = { l: new Float32Array(LEN), r: new Float32Array(LEN) };
for (let n = 0; n < LEN; n++) {
  mix.l[n] = dry.l[n] + wet.l[n];
  mix.r[n] = dry.r[n] + wet.r[n];
}
reverb(wet.l, mix.l, 0.55);
reverb(wet.r.map((v, i) => wet.r[Math.max(0, i - 23)]), mix.r, 0.55);

let peak = 0;
const fadeIn = 0.05 * SR, fadeOut = 1.8 * SR;
for (let n = 0; n < LEN; n++) {
  const g = Math.min(1, n / fadeIn) * Math.min(1, (LEN - n) / fadeOut);
  mix.l[n] = Math.tanh(mix.l[n] * 1.2) * g;
  mix.r[n] = Math.tanh(mix.r[n] * 1.2) * g;
  peak = Math.max(peak, Math.abs(mix.l[n]), Math.abs(mix.r[n]));
}
const norm = 0.89 / peak;

const data = Buffer.alloc(44 + LEN * 4);
data.write('RIFF', 0);
data.writeUInt32LE(36 + LEN * 4, 4);
data.write('WAVEfmt ', 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28);
data.writeUInt16LE(4, 32);
data.writeUInt16LE(16, 34);
data.write('data', 36);
data.writeUInt32LE(LEN * 4, 40);
for (let n = 0; n < LEN; n++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix.l[n] * norm)) * 32767), 44 + n * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix.r[n] * norm)) * 32767), 46 + n * 4);
}
writeFileSync(process.argv[2] ?? 'music.wav', data);
console.log(`wrote ${process.argv[2] ?? 'music.wav'}: ${tl.duration}s, peak ${peak.toFixed(2)} before normalising`);
