#!/usr/bin/env python3
# Quiet background music, synthesized here so it carries no license: a slow
# pad on four chords, a soft bass and a sparse bell arpeggio, with a little
# echo. Usage: music.py <seconds> <out.wav>
import sys, wave
import numpy as np

SR = 48000
dur = float(sys.argv[1])
out = sys.argv[2]
n = int(SR * dur)
t = np.arange(n) / SR
rng = np.random.default_rng(7)

def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

# Fmaj9 - Am7 - Dm9 - Bbmaj7(#11), 4 bars of 4s each, looped. Gentle and unresolved.
chords = [
    [53, 60, 64, 67, 69],
    [57, 60, 64, 67, 71],
    [50, 57, 60, 64, 65],
    [46, 57, 62, 65, 69],
]
bar = 4.0
mix = np.zeros(n)

def env(length, a, r):
    e = np.ones(length)
    ai, ri = int(a * SR), int(r * SR)
    e[:ai] = np.linspace(0, 1, ai) ** 2
    e[-ri:] *= np.linspace(1, 0, ri) ** 1.5
    return e

# Pad: detuned soft saws (few harmonics), crossfading chord to chord.
k = 0
start = 0.0
while start < dur:
    ch = chords[k % 4]
    s0 = int(start * SR)
    length = min(int((bar + 1.5) * SR), n - s0)
    if length <= 0:
        break
    tt = np.arange(length) / SR
    seg = np.zeros(length)
    for m in ch[1:]:
        for det in (-0.07, 0.0, 0.06):
            f = hz(m) * 2 ** (det / 12)
            ph = rng.uniform(0, 2 * np.pi)
            for h, amp in ((1, 1.0), (2, 0.28), (3, 0.09)):
                seg += amp * np.sin(2 * np.pi * f * h * tt + ph * h)
    seg *= env(length, 1.4, 1.6) * 0.018
    # bass
    seg += 0.11 * np.sin(2 * np.pi * hz(ch[0] - 12) * tt) * env(length, 0.6, 1.8)
    mix[s0:s0 + length] += seg
    start += bar
    k += 1

# Bells: a sparse arpeggio, one note every half bar or so.
step = 0.5
times = np.arange(2.0, dur - 2, step)
for i, st in enumerate(times):
    if rng.random() < 0.45:
        continue
    ch = chords[int(st // bar) % 4]
    m = ch[1 + rng.integers(0, 4)] + 12
    s0 = int(st * SR)
    length = min(int(2.2 * SR), n - s0)
    tt = np.arange(length) / SR
    f = hz(m)
    note = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 6)) * np.exp(-tt * 2.4)
    note *= np.minimum(1, tt / 0.01)
    mix[s0:s0 + length] += 0.03 * note

# Echo and a touch of smoothing.
for d, g in ((0.37, 0.28), (0.74, 0.14), (1.11, 0.07)):
    k = int(d * SR)
    mix[k:] += g * mix[:-k]
kern = np.ones(6) / 6
mix = np.convolve(mix, kern, mode='same')

# Fade in and out, then level it quietly.
fi, fo = int(2.5 * SR), int(4.0 * SR)
mix[:fi] *= np.linspace(0, 1, fi)
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.3
mix = mix / np.max(np.abs(mix)) * 0.32
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)
data = (stereo * 32767).astype(np.int16)
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print('wrote', out, dur, 's')
