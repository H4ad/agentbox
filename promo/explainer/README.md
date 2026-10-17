# AgentBox explainer video

A 54-second motion-designed explainer, made from code with [Remotion](https://www.remotion.dev):
stylised versions of UI v2 (the sidebar, the lead's chat, the right panel's tabs, the review modal)
and the phone app's review screen, in the desktop app's colours and type (`desktop/src/renderer/styles.css`,
Inter and JetBrains Mono, both under the SIL Open Font License, copied into `public/`). Nothing here is part of the app.

```bash
npm ci
npm run music             # public/music.wav, the original soundtrack, synthesised by music/compose.mjs
npm run studio            # preview and scrub in the browser
npm run render            # out/agentbox-explainer.mp4, 1920×1080 at 60 fps
npm run render:vertical   # out/agentbox-explainer-9x16.mp4, 1080×1920
npm run cover             # out/cover.png
```

Pass `--browser-executable=/usr/bin/chromium` to the render commands to use the system's Chromium
instead of downloading one.

- `src/timeline.json` is the one clock: the scenes' times, and the clicks, pops, whooshes and chimes
  that both the picture and `music/compose.mjs` hit.
- `src/Explainer.tsx` is the composition: captions, camera, intro and outro. Both cuts are the same
  scenes; the 9:16 one lays the window out in portrait (`tall` in `src/ui/World.tsx`) rather than cropping.
- `src/ui/` holds the stylised UI: `World.tsx` (the window), `Machines.tsx` (the agents' machines),
  `Phone.tsx`, `Dashboard.tsx` (the demo app the agents work on) and `atoms.tsx` (the tools'
  characters, the logo, the cursor).

Remotion is free for individuals and companies of up to three people; larger companies need its
company license to render with it.
