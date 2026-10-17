#!/bin/bash
b=backend; pkill -f "node $b.mjs"; sleep 0.5
cd ~/promo; setsid node $b.mjs > /t/backend.log 2>&1 < /dev/null &
sleep 1
