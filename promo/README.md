# The promo video

How the 16:9 and 9:16 demo videos of UI v2 are made: real takes of the app,
filmed against made-up data, cut with motion graphics in Remotion, with
music and sound synthesized from scratch. Nothing here ships, and no real
account, key or user data is in any of it.

## What is filmed

The app is the real renderer from `desktop/`, served by the dev preview
(`npm --prefix desktop run preview`) with `?promo=<scene>&app=project&v2=1`.
`desktop/src/renderer/dev/promo.ts` swaps the preview's overflow fixtures for
FreshCart, a made-up grocery shop, and its neighbours in the sidebar, and
plays each scene:

| Scene    | What it holds |
|----------|---------------|
| `spawn`  | The lead's chat before the ask. Sending a message makes the lead answer and start agent-14, agent-15 and agent-16, which join the sidebar. |
| `work`   | Those agents at work, each chat streaming its steps. Desktop shows a real display, Terminal a scripted shell. |
| `review` | Five agents finished, with pull requests, screenshots and recordings, for the review modal, Media and Pages. |

`dev/promoStreams.ts` carries the app's WebSockets (terminals and desktops)
to `kit/backend.mjs` on :7802, which also serves the demo media and pages.

## Filming

The kit expects to live at `~/promo` (or `$PROMO`), beside the previous
promo's `media-en/` (from `kit/genmedia-en.mjs`, filmed off the demo shop):

```bash
cp -r promo/kit ~/promo && cd ~/promo && npm i playwright-core ws
(cd demoapp && python3 -m http.server 5173 &)   # the demo shop, FreshCart
./restart-backend.sh                            # :7802
node genpages.mjs                               # the Hatch pages and their thumbnails
bash display99.sh                               # the display at 2560x1440
bash agentdesk.sh && bash live101.sh &          # agent-14's desktop on :101, and its hands
npm --prefix <repo>/desktop run preview         # note the port
PREVIEW_PORT=<port> ./app.sh 'promo=spawn&app=project&v2=1'
PREVIEW_PORT=<port> node take.mjs spawn         # and work14 work15 work16 panel review media
```

`take.mjs` drives the real pointer and keyboard with xdotool (Playwright only
looks up where things are), grabs the display at 60 fps without the pointer,
and logs every pointer position and click to `rec/<take>.json` on the same
clock.

## Editing

```bash
cd promo/edit && npm i
mkdir -p public/rec && cp -l ~/promo/rec/*.mp4 public/rec/ && cp ../../desktop/build/icon.svg public/logo.svg
node build-timeline.mjs          # public/timeline.json and cues.json: the cut, pointers, sound cues
python3 make-audio.py            # public/audio.wav (numpy, scipy)
npx remotion render src/index.ts Promo out/promo-16x9.mp4 --crf=17
npx remotion render src/index.ts PromoVertical out/promo-9x16.mp4 --crf=18
npx remotion still src/index.ts Cover out/cover.png
```

The shots, their camera moves and captions are all in `build-timeline.mjs`.
The cursor and click ripples are drawn from the logs, so they stay sharp
when the camera zooms. The music is 120 BPM, so every cut lands on a bar.
Takes are 2560x1440: OffthreadVideo can't hand frames that large to Chrome,
so the edit uses `@remotion/media`'s Video.
