#!/bin/bash
# Restarts the agent's display at a fixed 1920x1200 that viewers can't resize.
x="Xvn"; pkill -f "${x}c :99 "; sleep 2
rm -f /tmp/.X11-unix/X99 /tmp/.X99-lock
setsid Xvnc :99 -geometry 2560x1440 -depth 24 -desktop agentbox -rfbport 5900 -localhost -SecurityTypes None -AlwaysShared -AcceptSetDesktopSize=0 >/t/demo/xvnc99.log 2>&1 </dev/null &
sleep 2
agentbox browser start
export DISPLAY=:99
xsetroot -solid '#0b0b10'; xwallpaper --zoom /usr/local/share/agentbox/wallpaper.png
o="openbo"; pgrep -f "${o}x --config" >/dev/null || (setsid openbox --config-file ~/.config/openbox/rc.xml >/t/demo/ob99.log 2>&1 </dev/null &)
t="tint"; pgrep -f "${t}2 -c" >/dev/null || (setsid tint2 -c ~/.config/tint2/tint2rc >/t/demo/tint99.log 2>&1 </dev/null &)
