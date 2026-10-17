#!/usr/bin/env python3
# Cuts the walkthrough from one raw take and finishes it: segments (some sped
# up a little), short dissolves where time is skipped, a soft highlight on the
# pointer with a ripple on each click, lower-third captions, an end card and
# quiet music (music.py writes $PROMO_WORK/music.wav first).
# Usage: compose.py <take> <out.mp4> [--preview]
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

take, OUT = sys.argv[1], sys.argv[2]
PREVIEW = '--preview' in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('PROMO_WORK', os.path.expanduser('~/promo'))
REC = f'{WORK}/rec/{take}'
W, H, FPS = 1920, 1080, 60
FONT = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
FONT_M = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
FONT_B = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'

start = float(open(f'{REC}.ff.log').read().split('start: ')[1].split(',')[0].split()[0])
beats, clicks = {}, []
for line in open(f'{REC}.events.jsonl'):
    e = json.loads(line)
    if 'beat' in e:
        beats[e['beat']] = e['t'] - start
    if 'click' in e:
        clicks.append((e['t'] - start, *e['click']))
ptr = []
for line in open(f'{REC}.ptr'):
    p = line.split()
    try:
        ptr.append((float(p[0]) - start, int(p[1].split('=')[1]), int(p[2].split('=')[1])))
    except (IndexError, ValueError):
        pass
ptr = np.array(ptr)
B = beats

# Segments of the raw take: (from, to, speed, dissolve into it in seconds).
SEG = [
    (B['start'] - 0.2, B['ask'] + 0.9, 1.0, 0),
    (B['ask'] + 0.9, B['sent'], 1.4, 0),
    (B['sent'], B['agents'], 1.3, 0),
    (B['agents'], B['agent'] + 2.0, 1.0, 0),
    (B['panel'] - 0.4, B['desktop'] + 5.6, 1.0, 0.25),
    (B['terminal'] - 0.3, B['terminal'] + 11.0, 1.3, 0.25),
    (B['cut'] + 0.8, B['review'], 1.0, 0.5),
    (B['review'], B['pr'] + 1.8, 1.15, 0),
    (B['pr'] + 1.8, B['merged'] + 3.2, 1.0, 0),
    (B['close'] - 0.2, B['past'] + 3.4, 1.0, 0),
]
CARD = 4.2  # end card, dissolving in over 0.7s

CAPTIONS = [  # raw-time windows
    (B['start'] + 0.4, B['ask'] + 0.4, 'Open a project: its lead is a chat'),
    (B['ask'] + 1.0, B['sent'] + 0.3, 'Ask the lead for two features'),
    (B['sent'] + 3.0, B['agents'] + 1.6, 'It starts two agents, each on its own machine and branch'),
    (B['agent'] + 0.2, B['agent'] + 2.0, 'agent-05 at work on the dark mode'),
    (B['desktop'] + 0.2, B['desktop'] + 5.6, 'Glance at its desktop, live'),
    (B['terminal'] + 0.8, B['terminal'] + 11.0, 'or at its terminal'),
    (B['cut'] + 0.9, B['review'] - 0.3, 'Later: both agents finish'),
    (B['review'] + 0.5, B['pr'] + 0.6, 'Review what it recorded'),
    (B['pr'] + 1.9, B['merged'] - 0.9, 'and its diff'),
    (B['merged'] + 0.2, B['merged'] + 3.2, 'Merge. The next one moves up'),
    (B['past'] + 0.1, B['past'] + 3.4, 'The merged agent is now in Past agents'),
]

# Output timeline: where each raw instant lands.
spans, t_out = [], 0.0
for a, b, s, d in SEG:
    spans.append((a, b, s, d, t_out))
    t_out += (b - a) / s
TOTAL = t_out + CARD
NF = int(round(TOTAL * FPS))
print(f'output {TOTAL:.1f}s, {NF} frames', file=sys.stderr)

def raw_to_out(r):
    for a, b, s, d, o in spans:
        if a - 0.01 <= r <= b + 0.01:
            return o + (r - a) / s
    return None

cap_out = []
for a, b, text in CAPTIONS:
    oa, ob = raw_to_out(a), raw_to_out(b)
    if oa is None or ob is None:
        print('caption outside the cut:', text, file=sys.stderr)
        continue
    cap_out.append((oa, ob, text))

# ---------- sprites ----------
def caption_sprite(text):
    f = ImageFont.truetype(FONT, 27)
    tw = f.getbbox(text)[2]
    pw, ph = tw + 64, 62
    pad = 30
    im = Image.new('RGBA', (pw + 2 * pad, ph + 2 * pad), (0, 0, 0, 0))
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad + 6, pad + pw, pad + ph + 6), 18, fill=(0, 0, 0, 120))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((pad, pad, pad + pw, pad + ph), 18, fill=(18, 17, 27, 236), outline=(255, 255, 255, 30), width=1)
    d.rounded_rectangle((pad + 20, pad + 20, pad + 24, pad + ph - 20), 2, fill=(129, 120, 255, 255))
    d.text((pad + 40, pad + ph / 2), text, font=f, fill=(240, 240, 247, 255), anchor='lm')
    a = np.asarray(im).astype(np.float32) / 255
    return a

sprites = {text: caption_sprite(text) for _, _, text in cap_out}
CAP_X, CAP_BOTTOM = 26 - 30, 1048 + 30  # pill's left edge 26px, bottom 1048px

def glow_sprite(r=30):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    d = np.sqrt(x * x + y * y) / r
    a = np.clip(1 - d, 0, 1) ** 1.6 * 0.22
    rgb = np.zeros((2 * r + 1, 2 * r + 1, 3), np.float32) + np.array([1.0, 0.95, 0.75])
    return rgb, a[..., None]
GLOW = glow_sprite()

def ring(radius, alpha, r=48):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    d = np.sqrt(x * x + y * y)
    a = np.clip(1 - np.abs(d - radius) / 2.2, 0, 1) * alpha
    rgb = np.zeros((2 * r + 1, 2 * r + 1, 3), np.float32) + np.array([1.0, 0.9, 0.55])
    return rgb, a[..., None]

def blend(frame, rgb, a, cx, cy):
    h, w = a.shape[:2]
    x0, y0 = int(cx - w // 2), int(cy - h // 2)
    fx0, fy0, fx1, fy1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if fx0 >= fx1 or fy0 >= fy1:
        return
    sub = frame[fy0:fy1, fx0:fx1].astype(np.float32) / 255
    sa = a[fy0 - y0:fy1 - y0, fx0 - x0:fx1 - x0]
    sr = rgb[fy0 - y0:fy1 - y0, fx0 - x0:fx1 - x0]
    frame[fy0:fy1, fx0:fx1] = ((sub * (1 - sa) + sr * sa) * 255).astype(np.uint8)

def draw_caption(frame, sprite, alpha, rise):
    h, w = sprite.shape[:2]
    y0 = CAP_BOTTOM - h + int(rise)
    x0 = CAP_X
    fx0, fy0 = max(0, x0), max(0, y0)
    fx1, fy1 = min(W, x0 + w), min(H, y0 + h)
    sub = frame[fy0:fy1, fx0:fx1].astype(np.float32) / 255
    sp = sprite[fy0 - y0:fy1 - y0, fx0 - x0:fx1 - x0]
    a = sp[..., 3:4] * alpha
    frame[fy0:fy1, fx0:fx1] = ((sub * (1 - a) + sp[..., :3] * a) * 255).astype(np.uint8)

def end_card():
    im = Image.new('RGB', (W, H), (9, 9, 14))
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W / 2 - 700, H / 2 - 420, W / 2 + 700, H / 2 + 420), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    color = Image.new('RGB', (W, H), (88, 70, 200))
    im = Image.composite(color, im, glow)
    logo = Image.open(os.path.join(HERE, '../../../desktop/build/icon.png')).convert('RGBA').resize((150, 150), Image.LANCZOS)
    im.paste(logo, (W // 2 - 75, 330), logo)
    d = ImageDraw.Draw(im)
    d.text((W / 2, 580), 'AgentBox', font=ImageFont.truetype(FONT_B, 96), fill=(244, 244, 250), anchor='mm')
    d.text((W / 2, 672), 'agentbox.linting.dev', font=ImageFont.truetype(FONT_M, 40), fill=(170, 168, 200), anchor='mm')
    return np.asarray(im)
CARD_IMG = end_card()

def pointer_at(r):
    i = np.searchsorted(ptr[:, 0], r)
    if i <= 0:
        return ptr[0, 1:]
    if i >= len(ptr):
        return ptr[-1, 1:]
    a, b = ptr[i - 1], ptr[i]
    k = (r - a[0]) / max(1e-6, b[0] - a[0])
    return a[1:] + (b[1:] - a[1:]) * k

def smooth(x):
    x = min(1, max(0, x))
    return x * x * (3 - 2 * x)

# ---------- render ----------
enc = subprocess.Popen(
    ['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
     '-i', f'{WORK}/music.wav', '-map', '0:v', '-map', '1:a',
     '-c:v', 'libx264', '-preset', 'veryfast' if PREVIEW else 'slow', '-crf', '24' if PREVIEW else '17', '-pix_fmt', 'yuv420p',
     '-profile:v', 'high', '-r', str(FPS), '-af', f'afade=t=out:st={TOTAL - 3.5:.2f}:d=3.5', '-t', f'{TOTAL:.3f}', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', OUT],
    stdin=subprocess.PIPE)

FB = W * H * 3
prev_last = None
frame_no = 0
for a, b, s, d, o in spans:
    dec = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-ss', f'{a:.3f}', '-i', f'{REC}.mp4', '-t', f'{b - a + 0.2:.3f}',
                            '-vf', 'fps=60', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    src_i, cur = -1, None
    n_out = int(round((b - a) / s * FPS))
    first = None
    for k in range(n_out):
        want = int(round(k * s))
        while src_i < want:
            buf = dec.stdout.read(FB)
            if len(buf) < FB:
                break
            cur = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            src_i += 1
        frame = cur.copy()
        t_out = (frame_no) / FPS
        raw = a + k * s / FPS
        # pointer glow and click ripples
        px, py = pointer_at(raw)
        blend(frame, *GLOW, px + 4, py + 6)
        for ct, cx, cy in clicks:
            age = (raw - ct) / 0.45
            if 0 <= age <= 1:
                blend(frame, *ring(10 + 30 * smooth(age), 0.75 * (1 - age)), cx, cy)
        # dissolve from the previous segment's last frame
        if d and prev_last is not None and t_out - o < d:
            x = smooth((t_out - o) / d)
            frame = (prev_last.astype(np.float32) * (1 - x) + frame.astype(np.float32) * x).astype(np.uint8)
        # captions
        for ca, cb, text in cap_out:
            if ca - 0.01 <= t_out <= cb:
                fin, fout = smooth((t_out - ca) / 0.35), smooth((cb - t_out) / 0.35)
                al = min(fin, fout)
                draw_caption(frame, sprites[text], al, (1 - fin) * 14)
        # fade in from black at the very start
        if frame_no < 18:
            frame = (frame.astype(np.float32) * (frame_no / 18)).astype(np.uint8)
        enc.stdin.write(frame.tobytes())
        frame_no += 1
    prev_last = frame
    dec.stdout.close()
    dec.wait()
    print(f'segment {a:.1f}-{b:.1f} -> {o:.1f}s', file=sys.stderr)

# end card
n_card = NF - frame_no
for k in range(n_card):
    x = smooth(k / (0.7 * FPS))
    frame = (prev_last.astype(np.float32) * (1 - x) + CARD_IMG.astype(np.float32) * x).astype(np.uint8)
    enc.stdin.write(frame.tobytes())
enc.stdin.close()
enc.wait()
print('done', OUT, f'{TOTAL:.1f}s', file=sys.stderr)
