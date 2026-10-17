#!/bin/bash
# app.sh 'query': the preview in a kiosk Chromium on :99, 1920x1080 CSS pixels at 4/3 scale.
p="user-data-dir=/t/demo/app"; pkill -f "${p}chrome"; sleep 1
DISPLAY=:99 setsid chromium --user-data-dir=/t/demo/appchrome --no-first-run --no-default-browser-check --disable-dev-shm-usage --password-store=basic \
  --lang=en-US --disable-features=Translate,TranslateUI --force-device-scale-factor=1.333333 --kiosk --window-position=0,0 --window-size=2560,1440 --remote-debugging-port=9333 \
  --autoplay-policy=no-user-gesture-required "http://localhost:${PREVIEW_PORT}/dev/preview.html?$1" > /t/demo/appchrome.log 2>&1 < /dev/null &
sleep 4
