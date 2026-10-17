#!/bin/bash
# Live activity on agent-01's desktop (:101): the agent toggling dark mode and exporting CSV.
export DISPLAY=:101
glide() { # glide x y
  eval $(xdotool getmouselocation --shell); local x0=$X y0=$Y
  for i in $(seq 1 24); do xdotool mousemove $(( x0 + ($1-x0)*i/24 )) $(( y0 + ($2-y0)*i/24 )); sleep 0.015; done
}
s() { awk -v v=$1 'BEGIN{printf "%d", v}'; }
while :; do
  glide $(s 1116) $(s 140); sleep 0.4; xdotool click 1; sleep 2.2
  glide $(s 1215) $(s 140); sleep 0.4; xdotool click 1; sleep 2.5
  glide $(s 116) $(s 268); sleep 0.4; xdotool click 1; sleep 2.0
  glide $(s 116) $(s 190); sleep 0.4; xdotool click 1; sleep 1.5
  glide $(s 1116) $(s 140); sleep 0.4; xdotool click 1; sleep 2.0
  glide 700 500; sleep 1
done
