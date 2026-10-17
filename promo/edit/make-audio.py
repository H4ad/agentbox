"""Original music and sound design for the promo, synthesized from scratch.

120 BPM (a bar is 2 s, so every scene cut lands on a bar), A minor,
Am9 - Fmaj7 - Cmaj7 - G6. The arrangement follows the scenes in
public/timeline.json; cues.json (build-timeline.mjs) places the effects:
pointer clicks, keystrokes, whooshes on cuts, caption pops, chimes as agents
arrive. Writes public/audio.wav (48 kHz stereo).
"""
import json
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 72.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def lp(x, f, order=2):
    b, a = butter(order, min(f / (SR / 2), 0.99))
    return lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = butter(order, f / (SR / 2), btype='high')
    return lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], btype='band')
    return lfilter(b, a, x)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f, t, phase=0.0):
    return 2 * ((f * t + phase) % 1) - 1


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def env(n, a, r, sus=None):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    nr = max(1, int(r * SR))
    if sus is None:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def reverb(x, secs=2.4, mix=0.3, tone=5000):
    ir_t = t_(secs)
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 6.5 / secs)
    ir = lp(ir, tone)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix


# Scene energy: (start, end, level 0..3)
sections = [(0, 4, 0), (4, 12, 1), (12, 26, 2), (26, 34, 3), (34, 46, 3), (46, 58, 3), (58, 66, 2), (66, 72, 0)]


def level(t):
    for a, b, l in sections:
        if a <= t < b:
            return l
    return 0


# A minor: Am9, Fmaj7, Cmaj7, G6 — one bar each.
chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 64, 67], [55, 59, 62, 64, 67]]
roots = [45, 41, 48, 43]
BAR = 4 * BEAT

L = np.zeros(N)
R = np.zeros(N)
pad = np.zeros(N)
bass = np.zeros(N)
drums = np.zeros(N)
arp = np.zeros(N)
sfx = np.zeros(N)

# ---- Pad: detuned saws, filtered, a bar per chord --------------------------
for bar in range(int(DUR / BAR) + 1):
    at = bar * BAR
    if at >= 66:
        break
    ch = chords[bar % 4]
    tt = t_(BAR + 0.6)
    sig = np.zeros(len(tt))
    for n in ch:
        for d in (-0.11, -0.04, 0.0, 0.05, 0.12):
            sig += saw(midi(n) * 2 ** (d / 12), tt, rng.random())
    sig /= len(ch) * 5
    cutoff = 900 + 1700 * min(1, level(at + 0.1) / 3)
    sig = lp(sig, cutoff) * env(len(tt), 0.35, 0.6)
    place(pad, sig, at, 0.5 if at >= 4 else 0.35)

# Intro swell and the closing chord.
tt = t_(6.0)
sig = sum(saw(midi(n) * 2 ** (d / 12), tt, rng.random()) for n in [45, 57, 60, 64, 71, 76] for d in (-0.08, 0, 0.09))
sig = lp(sig / 18, 2600) * np.exp(-tt * 0.55) * env(len(tt), 0.01, 1.5)
place(pad, sig, 66.0, 0.9)
tt = t_(4.0)
sig = sum(saw(midi(n) * 2 ** (d / 12), tt, rng.random()) for n in [45, 57, 64, 71] for d in (-0.08, 0, 0.09))
ramp = (tt / 4) ** 2
sig = (lp(sig / 12, 300) * (1 - ramp) + lp(sig / 12, 2500) * ramp) * (tt / 4) ** 1.5
place(pad, sig, 0.0, 0.6)

# ---- Drums -------------------------------------------------------------------
def kick():
    tt = t_(0.45)
    f = 45 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    k = np.sin(ph) * np.exp(-tt * 7.5)
    k[:200] += rng.standard_normal(200) * 0.25 * np.linspace(1, 0, 200)
    return np.tanh(k * 1.6)


def clap():
    tt = t_(0.3)
    nz = bp(rng.standard_normal(len(tt)), 900, 5000)
    e = np.exp(-tt * 22)
    for d in (0.0, 0.011, 0.022):
        e += np.where(tt > d, np.exp(-(tt - d) * 90), 0) * 0.6
    return nz * e * 0.5


def hat(open_=False):
    tt = t_(0.25 if open_ else 0.06)
    return hp(rng.standard_normal(len(tt)), 7500) * np.exp(-tt * (14 if open_ else 70)) * 0.35


K, C, H, HO = kick(), clap(), hat(), hat(True)
duck = np.ones(N)
beats = int(DUR / BEAT)
for b in range(beats):
    at = b * BEAT
    lv = level(at + 0.01)
    if at >= 66:
        break
    if lv >= 2 or (lv == 1 and b % 2 == 0):
        place(drums, K, at, 0.95)
        i = int(at * SR)
        d = 1 - 0.65 * np.exp(-t_(BEAT) * 9)
        duck[i:i + len(d)] = np.minimum(duck[i:i + len(d)], d[: len(duck) - i])
    if lv >= 3 and b % 2 == 1:
        place(drums, C, at, 0.8)
    if lv >= 2:
        place(drums, H, at + BEAT / 2, 0.5)
        if lv >= 3:
            place(drums, H, at + BEAT / 4, 0.2)
            place(drums, H, at + 3 * BEAT / 4, 0.2)
        if b % 4 == 3:
            place(drums, HO, at + BEAT / 2, 0.5)

# ---- Bass: eighths on the root ------------------------------------------------
for e8 in range(int(DUR / (BEAT / 2))):
    at = e8 * BEAT / 2
    lv = level(at + 0.01)
    if lv < 2 or at >= 66:
        continue
    r = roots[int(at / BAR) % 4]
    tt = t_(BEAT / 2)
    f = midi(r - 12 if e8 % 2 == 0 else r)
    sig = np.sin(2 * np.pi * f * tt) * 0.8 + lp(saw(f, tt), 600) * 0.35
    place(bass, sig * env(len(tt), 0.004, 0.06), at, 0.55)

# ---- Arp: sixteenths over the chord, plucked ----------------------------------
pattern = [0, 2, 1, 3, 4, 3, 1, 2]
for s16 in range(int(DUR / (BEAT / 4))):
    at = s16 * BEAT / 4
    lv = level(at + 0.01)
    if lv < 1 or at >= 66 or (lv == 1 and s16 % 2):
        continue
    ch = chords[int(at / BAR) % 4]
    n = ch[pattern[s16 % 8]] + 12
    tt = t_(0.3)
    sig = (saw(midi(n), tt) * 0.5 + np.sin(2 * np.pi * midi(n) * tt)) * np.exp(-tt * 16)
    sig = lp(sig, 2400 + 2000 * (lv / 3))
    place(arp, sig, at, 0.16 if lv < 3 else 0.2)
# A dotted-eighth echo on the arp.
dl = int(BEAT * 0.75 * SR)
echo = np.zeros(N)
echo[dl:] = arp[:-dl] * 0.4
echo[2 * dl:] += arp[:-2 * dl] * 0.16
arp = arp + lp(echo, 3000)

# ---- Risers into the big moments ----------------------------------------------
for at, d in ((24.0, 2.0), (64.0, 2.0)):
    tt = t_(d)
    nz = rng.standard_normal(len(tt))
    out = np.zeros(len(tt))
    for k in range(8):
        a, b = int(k * len(tt) / 8), int((k + 1) * len(tt) / 8)
        f = 400 * 2 ** (k * 0.55)
        out[a:b] = bp(nz, f, f * 2.5)[a:b]
    place(sfx, out * (tt / d) ** 2 * 0.5, at)

# ---- Effects from the cues --------------------------------------------------
def click():
    tt = t_(0.05)
    return (bp(rng.standard_normal(len(tt)), 2000, 9000) * np.exp(-tt * 260) + np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 300) * 0.6) * 0.55


def key_tick():
    tt = t_(0.035)
    f = 2600 + rng.random() * 1200
    return bp(rng.standard_normal(len(tt)), f, f * 2.2) * np.exp(-tt * 320) * 0.32


def whoosh():
    tt = t_(0.55)
    nz = rng.standard_normal(len(tt))
    hi = lp(nz, 7000) - lp(nz, 600)
    shape = np.sin(np.pi * np.clip(tt / 0.55, 0, 1)) ** 2
    return lp(hi, 5000) * shape * 0.45


def pop():
    tt = t_(0.12)
    f = 700 + 500 * tt / 0.12
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 38) * 0.18


def chime(n=76):
    tt = t_(1.4)
    m = np.sin(2 * np.pi * midi(n) * 3.5 * tt) * np.exp(-tt * 6) * 2
    return np.sin(2 * np.pi * midi(n) * tt + m) * np.exp(-tt * 3.2) * 0.2


def hit():
    tt = t_(2.5)
    k = kick()
    boom = np.sin(2 * np.pi * 42 * tt) * np.exp(-tt * 2.2) * 0.8
    nz = lp(rng.standard_normal(len(tt)), 3000) * np.exp(-tt * 5) * 0.25
    s = boom + nz
    s[: len(k)] += k
    return s


cues = json.load(open('cues.json'))
notes = [76, 79, 83]
c = 0
for q in cues:
    k = q['kind']
    if k == 'click':
        place(sfx, click(), q['t'], 0.9)
    elif k == 'key':
        place(sfx, key_tick(), q['t'], 0.7)
    elif k == 'enter':
        place(sfx, click(), q['t'], 1.1)
        place(sfx, pop(), q['t'] + 0.03, 1.2)
    elif k == 'whoosh':
        place(sfx, whoosh(), q['t'] - 0.3, 0.9)
    elif k == 'pop':
        place(sfx, pop(), q['t'] + 0.07, 0.8)
    elif k == 'chime':
        place(sfx, chime(notes[c % 3]), q['t'], 1.0)
        c += 1
place(sfx, hit(), 0.1, 0.8)
place(sfx, chime(81), 0.12, 0.8)
place(sfx, hit(), 66.0, 0.9)
place(sfx, chime(88), 66.05, 0.6)

# ---- Mix -------------------------------------------------------------------------
music = pad * duck * 0.9 + bass * duck + arp + drums * 0.85
music = reverb(music, 1.8, 0.18)
sfx = reverb(sfx, 1.2, 0.15)
# Width: the pad and arp a little apart between the ears.
side = lp(np.roll(pad + arp, int(0.012 * SR)), 6000) * 0.25
L = lp(music + sfx + side, 13000)
R = lp(music + sfx - side, 13000)
# Fade the tail.
fade = np.ones(N)
fi = int(70.4 * SR)
fade[fi:] = np.linspace(1, 0, N - fi) ** 1.5
L *= fade
R *= fade
mix = np.stack([L, R], axis=1)
rms = np.sqrt(np.mean(mix ** 2))
mix *= 0.12 / rms
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.93 / np.max(np.abs(mix))
import sys
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else 'public/audio.wav', SR, (mix * 32767).astype(np.int16))
print('audio: rms', round(float(np.sqrt(np.mean(mix ** 2))), 3), 'peak', round(float(np.max(np.abs(mix))), 3))
