#!/bin/bash
# Starts the fixture daemon and the real app, built from this checkout, against
# it on display :99. The app gets its own HOME, so its local state is
# throwaway, and a stand-in CLI that reports a host-mode install.
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../../.." && pwd)
work=${PROMO_WORK:-$HOME/promo}
mkdir -p "$work/bin" "$work/home" /t/demo
cat > "$work/bin/agentbox" <<'CLI'
#!/bin/sh
if [ "$1 $2" = "vm status" ]; then echo '{"mode":"host","driver":"","state":"running","since":"2026-10-17T00:00:00Z","memory":{"min":0,"cap":0,"granted":0,"used":0,"resident":0},"disk":{"size":0,"allocated":0,"pool":{"size":0,"allocated":0},"root":{"size":0,"allocated":0}}}'; exit 0; fi
[ "$1" = version ] && echo "agentbox version 0.14.0"
exit 0
CLI
chmod +x "$work/bin/agentbox"
export AGENTBOX_SOCKET=/t/demo/agentbox.sock AGENTBOX_NO_AUTOSTART=1
pkill -f "walkthrough/mock-daemo[n]"; sleep 0.3
(MEDIA_DIR=$work/media VM_SOCK=$work/home/.local/share/agentbox/run/vm.sock VNC_PORT=5901 setsid node "$here/mock-daemon.mjs" > /t/demo/mock.log 2>&1 < /dev/null &)
sleep 0.7
cd "$root/desktop"
pkill -f "electro[n] \." ; sleep 0.8
[ "${FRESH:-}" = 1 ] && rm -rf "$work/home/.config/AgentBox"
AGENTBOX_BIN=$work/bin/agentbox HOME=$work/home XDG_CONFIG_HOME=$work/home/.config DISPLAY=:99 setsid npx electron . --force-device-scale-factor=1.25 --remote-debugging-port=9333 > /t/demo/electron.log 2>&1 < /dev/null &
export DISPLAY=:99
timeout 60 bash -c 'until wmctrl -l | grep -q AgentBox; do sleep 0.5; done'; sleep 2
wmctrl -r AgentBox -b add,fullscreen
