// Builds public/timeline.json: every shot of the promo, in the composition's
// seconds, with the takes' pointer paths and clicks mapped onto it, and the
// sound design's cues (clicks, keys, whooshes, hits) for make-audio.py.
import fs from 'node:fs';

const REC = `${process.env.PROMO ?? `${process.env.HOME}/promo`}/rec`;
const FPS = 60;
const take = (name) => {
  const j = JSON.parse(fs.readFileSync(`${REC}/${name}.json`, 'utf8'));
  return j.log.map((l) => ({ ...l, t: l.t - j.start }));
};

// A segment plays [src, src + dur * rate] of a take from comp second `at`.
// cam: [segment second, cx, cy, zoom] in the take's 2560x1440 pixels.
// frame: [segment second, scale, rotateX deg] for the window over the backdrop.
const scenes = [
  { id: 'intro', at: 0, dur: 4 },
  {
    id: 'sidebar', at: 4, dur: 8,
    segs: [{ take: 'spawn', src: 1.6, rate: 1, dur: 8,
      cam: [[0, 1280, 720, 1], [1.1, 1280, 720, 1], [2.0, 430, 540, 1.9], [3.9, 430, 560, 1.9], [4.5, 380, 1120, 1.75], [7.0, 380, 1120, 1.75], [8, 1050, 1000, 1.3]],
      frame: [[0, 0.8, 24], [1.1, 0.92, 0], [2.0, 1, 0]] }],
    captions: [[0.5, 'UI v2 · lead-first', 'Every project has a *lead*'], [3.6, '', 'Its agents fold *under it*'], [5.8, '', 'Quiet projects dock in *Idle*']],
  },
  {
    id: 'ask', at: 12, dur: 14,
    segs: [
      { take: 'spawn', src: 9.6, rate: 1, dur: 1.8, cam: [[0, 1050, 1000, 1.3], [1.6, 1480, 1300, 1.9]] },
      { take: 'spawn', src: 11.4, rate: 2, dur: 4.0, cam: [[0, 1480, 1300, 1.9], [4, 1520, 1290, 2.0]] },
      { take: 'spawn', src: 19.4, rate: 1.75, dur: 8.2, cam: [[0, 1480, 1300, 1.9], [0.7, 380, 560, 1.75], [3.6, 380, 600, 1.75], [4.6, 1400, 560, 1.4], [7.4, 1400, 600, 1.4], [8.2, 1280, 720, 1.05]] },
    ],
    captions: [[0.4, 'Talk to the lead', 'Tell it what you *need*', 'top'], [6.2, '', 'It splits the work…'], [7.4, '', '…and starts an *agent per task*'], [10.6, '', 'Each on its own *machine and branch*']],
  },
  {
    id: 'parallel', at: 26, dur: 8,
    triptych: [['work14', 'agent-14', 'Claude Code'], ['work15', 'agent-15', 'Claude Code'], ['work16', 'agent-16', 'Codex']], src: 2.4,
    captions: [[0.5, 'In parallel', 'Three agents, *working at once*']],
  },
  {
    id: 'panel', at: 34, dur: 12,
    segs: [
      { take: 'panel', src: 2.0, rate: 1, dur: 2.4, cam: [[0, 1280, 720, 1], [2.4, 1350, 720, 1.05]], frame: [[0, 0.9, 10], [0.8, 1, 0]] },
      { take: 'panel', src: 4.4, rate: 1.2, dur: 3.0, cam: [[0, 1450, 760, 1.25], [0.9, 1760, 800, 1.6], [3.0, 1780, 810, 1.65]] },
      { take: 'panel', src: 11.6, rate: 2.4, dur: 3.4, cam: [[0, 1500, 500, 1.4], [1.0, 1420, 420, 1.85], [3.4, 1420, 440, 1.9]] },
      { take: 'panel', src: 26.0, rate: 1.3, dur: 3.2, cam: [[0, 1600, 560, 1.5], [1.4, 1700, 560, 1.75], [3.2, 1720, 600, 1.8]] },
    ],
    captions: [[0.4, 'The right panel', 'Named tabs for *every agent*'], [2.6, '', '*Desktop*: watch it work, live'], [5.4, '', '*Terminal*: its machine’s shell'], [8.8, '', '*Files*: what it changed']],
  },
  {
    id: 'review', at: 46, dur: 12,
    segs: [
      { take: 'review', src: 1.9, rate: 1.2, dur: 3, cam: [[0, 1280, 720, 1], [3, 1180, 700, 1.12]], frame: [[0, 0.9, 10], [0.8, 1, 0]] },
      { take: 'review', src: 5.5, rate: 3, dur: 3, cam: [[0, 1180, 700, 1.12], [3, 1100, 720, 1.25]] },
      { take: 'review', src: 15.8, rate: 1.15, dur: 3, cam: [[0, 1200, 1050, 1.35], [1.0, 1380, 1290, 1.9], [2.2, 1380, 1290, 1.9], [3, 1200, 760, 1.15]] },
      { take: 'review', src: 21.0, rate: 3.4, dur: 3, cam: [[0, 1100, 1100, 1.45], [3, 1150, 1150, 1.55]] },
    ],
    captions: [[0.4, 'Review', 'Every agent, *with its proof*'], [6.3, '', '*Merge* and next', 'top'], [9.2, '', 'Or *request changes*', 'top']],
  },
  {
    id: 'media', at: 58, dur: 8,
    segs: [
      { take: 'media', src: 2.6, rate: 2.7, dur: 2, cam: [[0, 1280, 720, 1], [2, 1650, 820, 1.25]], frame: [[0, 0.9, 10], [0.8, 1, 0]] },
      { take: 'media', src: 12.0, rate: 1.6, dur: 3, cam: [[0, 1300, 700, 1.15], [3, 1280, 690, 1.25]] },
      { take: 'media', src: 25.6, rate: 1.8, dur: 3, cam: [[0, 1280, 640, 1.15], [3, 1280, 560, 1.35]], frame: [[0, 1, 0], [2.2, 1, 0], [3, 0.94, 0]] },
    ],
    captions: [[0.4, 'Media', 'Every screenshot and recording'], [5.0, 'Pages', 'What they *publish*, a click away']],
  },
  { id: 'outro', at: 66, dur: 6 },
];

const cues = [];
for (const sc of scenes) {
  let t = sc.at;
  cues.push({ t: sc.at, kind: sc.id === 'intro' ? 'none' : 'whoosh' });
  for (const seg of sc.segs ?? []) {
    seg.at = t;
    const log = take(seg.take);
    const end = seg.src + seg.dur * seg.rate;
    const inSeg = (l) => l.t >= seg.src - 0.6 && l.t <= end + 0.3;
    seg.ptr = log.filter((l) => (l.k === 'm' || l.k === 'down' || l.k === 'up' || l.k === 'c') && inSeg(l)).map((l) => [+l.t.toFixed(3), l.x, l.y]);
    // The pointer's last place before the segment, so it starts where it was.
    const before = log.filter((l) => l.k === 'm' && l.t < seg.src - 0.6).pop();
    if (before) seg.ptr.unshift([+(seg.src - 0.6).toFixed(3), before.x, before.y]);
    seg.clicks = log.filter((l) => (l.k === 'c' || l.k === 'down') && l.t >= seg.src && l.t <= end).map((l) => [+l.t.toFixed(3), l.x, l.y]);
    for (const [ct] of seg.clicks) cues.push({ t: +(t + (ct - seg.src) / seg.rate).toFixed(3), kind: 'click' });
    for (const l of log.filter((l) => l.k === 'type' && l.t < end)) {
      // One tick per character the segment shows.
      const per = 0.034 * 1.4;
      [...l.text].forEach((_, i) => {
        const st = l.t + i * per;
        if (st >= seg.src && st <= end) cues.push({ t: +(t + (st - seg.src) / seg.rate).toFixed(3), kind: 'key' });
      });
    }
    for (const l of log.filter((l) => l.k === 'key' && l.t >= seg.src && l.t <= end)) cues.push({ t: +(t + (l.t - seg.src) / seg.rate).toFixed(3), kind: 'enter' });
    t += seg.dur;
  }
  for (const [ct] of sc.captions ?? []) cues.push({ t: sc.at + ct, kind: 'pop' });
}
// The three new agents arriving in the sidebar (the spawn take, seconds 21–25).
for (const s of [21.6, 22.9, 24.2]) cues.push({ t: +(12 + 1.8 + 4 + (s - 19.4) / 1.75).toFixed(3), kind: 'chime' });

fs.writeFileSync('public/timeline.json', JSON.stringify({ fps: FPS, duration: 72, scenes }, null, 0));
fs.writeFileSync('cues.json', JSON.stringify(cues.sort((a, b) => a.t - b.t)));
console.log('scenes', scenes.length, 'cues', cues.length);
