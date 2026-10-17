#!/bin/bash
# The agent's terminal in the Terminal tab: a shell in its worktree that, once
# woken (tmux -L promo wait-for -S go<agent>), types and runs its tests.
name=$1
G=$'\e[32m' D=$'\e[2m' B=$'\e[1m' C=$'\e[36m' Y=$'\e[33m' R=$'\e[0m' M=$'\e[35m'
prompt() { printf "${G}${B}ana@${name}${R}:${C}${B}~/freshcart${R}\$ "; }
typeit() { local s=$1; for ((i=0;i<${#s};i++)); do printf '%s' "${s:i:1}"; sleep 0.045; done; sleep 0.35; echo; }
clear
printf "${D}Linux ${name} 6.12.48 x86_64 · AgentBox machine · 2 CPUs · 6 GiB${R}\n\n"
prompt; echo "git log --oneline -3"
printf "${Y}3e8c1d2${R} feat: dark palette and theme toggle\n${Y}a91f0b7${R} refactor: orders page colors as theme variables\n${Y}4f2c9a1${R} feat: paginate the orders table (#138)\n"
prompt
tmux -L promo wait-for go$name
typeit "npm test -- --run"
sleep 0.4
printf "\n ${B}${C}RUN${R} ${C}v3.2.4${R} ${D}/home/ana/freshcart${R}\n\n"
sleep 0.9
tests=("src/components/ThemeToggle.test.tsx (6 tests) ${D}38ms${R}" "src/pages/Orders.test.tsx (14 tests) ${D}212ms${R}" "src/api/orders.test.ts (25 tests) ${D}88ms${R}" "src/export/format.test.ts (7 tests) ${D}12ms${R}")
for t in "${tests[@]}"; do printf " ${G}✓${R} %s\n" "$t"; sleep 0.55; done
printf "\n ${D}Test Files${R}  ${G}${B}4 passed${R} (4)\n      ${D}Tests${R}  ${G}${B}52 passed${R} (52)\n   ${D}Start at${R}  $(date +%H:%M:%S)\n   ${D}Duration${R}  2.31s\n\n"
sleep 0.8
prompt
sleep 0.6
typeit "npx playwright test e2e/dark-mode.spec.ts"
sleep 0.6
printf "\nRunning 3 tests using 2 workers\n\n"
for t in "toggle switches the orders page to dark" "choice survives a reload" "follows the system until chosen"; do sleep 0.9; printf "  ${G}✓${R}  ${D}[chromium]${R} › dark-mode.spec.ts › %s ${D}(1.%ds)${R}\n" "$t" $((RANDOM%9)); done
printf "\n  ${G}3 passed${R} ${D}(4.2s)${R}\n\n"
prompt
exec cat > /dev/null
