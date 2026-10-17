#!/bin/bash
# The "just using it" walkthrough of UI v2: one take, recorded raw.
#
#   take.sh NAME        then   python3 compose.py NAME out.mp4
#
# The real desktop app, built from this checkout (npm --prefix desktop run build),
# runs against mock-daemon.mjs: a scripted stand-in for the daemon with FreshCart,
# a demo shop, as fixtures, so there are no machines, GitHub or secrets. The lead
# starts two agents, agent-05's Desktop tab relays to a second display (:101,
# agentdesk.sh) where Chromium shows the shop, and its Terminal tab to a tmux
# session (term.sh). drive.mjs moves the real pointer and keyboard with xdotool,
# reading only where things are from the DOM, and logs every click and beat;
# compose.py cuts the take, adds the pointer highlight, captions, end card and
# music (music.py, synthesized, so it has no license to worry about).
#
# Needs display :99 at 1920x1080, Xvnc, openbox, tint2, chromium, tmux, xdotool,
# wmctrl, ffmpeg, python3-numpy, python3-pil and fonts-inter. Once per machine:
# serve shop/ on :5173, run agentdesk.sh, and node genmedia.mjs for the agents' media.
set -u
here=$(cd "$(dirname "$0")" && pwd)
name=$1 dir=${PROMO_WORK:-$HOME/promo}/rec; mkdir -p "$dir"
"$here/reset.sh"
export DISPLAY=:99
xdotool mousemove 960 620
(cd "$here" && node d101.mjs); setsid bash "$here/live101.sh" > /dev/null 2>&1 < /dev/null & live=$!
sleep 1
ffmpeg -hide_banner -loglevel info -nostats -f x11grab -framerate 60 -video_size 1920x1080 -draw_mouse 1 -i :99 \
  -c:v libx264 -preset ultrafast -crf 14 -pix_fmt yuv420p -y "$dir/$name.mp4" > "$dir/$name.ff.log" 2>&1 < /dev/null & ff=$!
bash -c 'while :; do echo "$(date +%s.%N) $(xdotool getmouselocation --shell | head -n 2 | tr "\n" " ")"; sleep 0.012; done' > "$dir/$name.ptr" 2>/dev/null & ptr=$!
sleep 1
(cd "$here" && node drive.mjs "$dir/$name.events.jsonl") > "$dir/$name.drive.log" 2>&1
sleep 1
kill -INT $ff; kill $ptr; pkill -f "walkthrough/live10[1]"
wait $ff
tail -1 "$dir/$name.events.jsonl"
