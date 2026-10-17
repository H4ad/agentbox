#!/bin/bash
# agent-01's desktop for the Desktop tab: a second Xvnc like the agent's own,
# with the same openbox, dock and wallpaper, and Chromium on the demo app.
export DISPLAY=:101
pgrep -f "Xvnc :101" >/dev/null || { setsid Xvnc :101 -geometry 1440x900 -depth 24 -desktop agent-01 -rfbport 5901 -localhost -SecurityTypes None -AlwaysShared -AcceptSetDesktopSize=0 >/t/demo/xvnc101.log 2>&1 </dev/null & sleep 1.5; }
xsetroot -solid '#0b0b10'; xwallpaper --zoom /usr/local/share/agentbox/wallpaper.png
pgrep -f "openbox --config-file.*" -a | grep -q ":101" || true
setsid openbox --config-file ~/.config/openbox/rc.xml >/t/demo/ob101.log 2>&1 </dev/null &
setsid tint2 -c ~/.config/tint2/tint2rc >/t/demo/tint101.log 2>&1 </dev/null &
sleep 1
setsid chromium --user-data-dir=/t/demo/chrome101 --no-first-run --no-default-browser-check --disable-dev-shm-usage --password-store=basic --remote-debugging-port=9334 --start-maximized "http://localhost:5173/#orders" >/t/demo/chrome101.log 2>&1 </dev/null &
