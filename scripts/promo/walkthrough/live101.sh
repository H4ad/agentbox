#!/bin/bash
# Live activity on agent-05's desktop (:101): the agent trying its dark mode toggle.
export DISPLAY=:101
glide() { # glide x y
  eval $(xdotool getmouselocation --shell); local x0=$X y0=$Y
  for i in $(seq 1 30); do xdotool mousemove $(( x0 + ($1-x0)*i/30 )) $(( y0 + ($2-y0)*i/30 )); sleep 0.016; done
}
xdotool mousemove 700 500
while :; do
  glide 1164 132; sleep 0.5; xdotool click 1; sleep 1.6
  glide 640 420; sleep 1.0
  glide 1164 132; sleep 0.5; xdotool click 1; sleep 1.4
  glide 820 560; sleep 0.9
done
