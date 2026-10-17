#!/bin/bash
# Back to the opening state: a fresh fixture daemon, fresh agent terminals, and
# the app reloaded on Home with its tours done and FreshCart pinned.
here=$(cd "$(dirname "$0")" && pwd)
tmux -L promo kill-server 2>/dev/null; sleep 0.5
for n in agent-05 agent-06; do tmux -L promo new-session -d -s ${n/-/} -x 120 -y 32 "$here/term.sh $n"; done
tmux -L promo set -g status off >/dev/null
"$here/run.sh" > /dev/null 2>&1
cd "$here" && node seed.mjs cards,classic,cross-project,groups,help,hide,home,launcher,lead,mention,panel,places,review,review-button,sidebar,v2,welcome
