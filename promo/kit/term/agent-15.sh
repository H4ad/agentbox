#!/bin/bash
# agent-15's terminal in the promo: the CSV export's tests, then the commit.
G=$'\e[32m' D=$'\e[2m' B=$'\e[1m' C=$'\e[36m' Y=$'\e[33m' M=$'\e[35m' R=$'\e[0m'
P="${G}${B}lint@agent-15${R}:${C}${B}~/freshcart${R}\$ "
type() { for ((i=0;i<${#1};i++)); do printf '%s' "${1:i:1}"; sleep 0.035; done; sleep 0.25; echo; }
sleep 0.6
printf '%s' "$P"; type "npm test -- src/export"
sleep 0.4
echo
echo " ${B}${C}RUN${R}  ${C}v3.2.4${R} ${D}/home/lint/freshcart${R}"
echo
sleep 0.8
for t in "header row matches the table's columns" "quotes fields with commas and quotes" "dates are ISO 8601 in the store's time zone" "totals keep two decimals" "filters apply to the export" "10,000 orders stream without blocking"; do
  sleep 0.32; echo "   ${G}✓${R} src/export/csv.test.ts ${D}>${R} $t ${D}$((RANDOM%30+3))ms${R}"
done
sleep 0.3; echo " ${G}✓${R} src/export/csv.test.ts ${D}(9 tests)${R} ${Y}41ms${R}"
sleep 0.5; echo " ${G}✓${R} src/pages/Orders.test.tsx ${D}(14 tests)${R} ${Y}212ms${R}"
sleep 0.4; echo " ${G}✓${R} src/api/orders.test.ts ${D}(25 tests)${R} ${Y}88ms${R}"
echo
echo " ${D}Test Files${R}  ${B}${G}3 passed${R} ${D}(3)${R}"
echo "      ${D}Tests${R}  ${B}${G}48 passed${R} ${D}(48)${R}"
echo "   ${D}Duration${R}  1.94s"
echo
sleep 1.2
printf '%s' "$P"; type "git commit -qam \"feat: export orders to CSV\" && git push -q"
sleep 0.9
echo "${D}remote:${R} Create a pull request for 'agentbox/export-orders-csv' on GitHub"
printf '%s' "$P"; type "agentbox media record stop"
echo "Saved ${M}export-csv.mp4${R} to Media ${D}(0:14, 1.8 MB)${R}"
printf '%s' "$P"
sleep 600
