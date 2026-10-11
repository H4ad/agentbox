#!/usr/bin/env bash
# usage: run.sh <task> <model> <n> [effort=high]   (task: rebase269 | pr266 | pr262)
# One detached git worktree per run; claude -p JSON goes to results/<task>-<model>-<n>.json
set -u
# the machine's own Claude login (never printed or written out)
[ -f ~/.config/agentbox/env ] && . ~/.config/agentbox/env
task=$1 model=$2 n=$3 effort=${4:-high}
here=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
work=${EVAL_DIR:-$HOME/.cache/haiku-eval}
wt=$work/wt/$task-$model-$n
out=$here/results; mkdir -p "$out" "$work/wt"
case $task in
  rebase269) start=377f6272 ;;
  pr266) start=$(git -C "$repo" rev-parse fb7740af~1) ;;
  pr262) start=$(git -C "$repo" rev-parse fe65d6e4~1) ;;
esac
git -C "$repo" worktree add -q --detach "$wt" "$start" || exit 1
# share one npm install; the worktrees' desktop/ has the same lockfile
[ -d "$wt/desktop" ] && ln -s "$work/node_modules" "$wt/desktop/node_modules"
cd "$wt"
t0=$(date +%s)
claude -p "$(cat "$here/prompts/$task.txt")" --model "$model" --effort "$effort" --output-format json \
  --permission-mode bypassPermissions --no-session-persistence --max-budget-usd 2 \
  > "$out/$task-$model-$n.json" 2> "$out/$task-$model-$n.err"
echo $(( $(date +%s) - t0 )) > "$out/$task-$model-$n.wall"
"$here/score.sh" "$task" "$wt" > "$out/$task-$model-$n.score" 2>&1
