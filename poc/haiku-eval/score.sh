#!/usr/bin/env bash
# usage: score.sh <task> <worktree>; prints key=value lines, ok=1 when the result passes
task=$1; cd "$2" || exit 1
repo=$(git rev-parse --show-toplevel); nm=$HOME/.cache/haiku-eval/node_modules
ok=1
case $task in
rebase269)
  [ -d "$(git rev-parse --git-path rebase-merge)" ] && { echo in_rebase=1; ok=0; }
  if [ "$(git rev-parse HEAD~1 2>/dev/null)" = "$(git rev-parse bb8988e5)" ]; then echo parent_ok=1; else echo parent_ok=0; ok=0; fi
  echo dirty=$(git status --porcelain | wc -l)
  echo markers=$(git grep -lE '^(<<<<<<<|>>>>>>>) ' | wc -l)
  echo diff_vs_reference_lines=$(git diff 83d7676a HEAD | grep -cE '^[+-][^+-]')
  git diff --stat 83d7676a HEAD | tail -3
  (cd desktop && npm run -s typecheck >/tmp/tc.$$ 2>&1) && echo typecheck=pass || { echo typecheck=fail; ok=0; }
  (cd desktop && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test "src/**/*.test.ts" >/tmp/t.$$ 2>&1) && echo tests=pass || { echo tests=fail; ok=0; }
  ;;
pr266)
  git checkout -q fb7740af -- desktop/src/renderer/lib/pulls.test.ts  # reference test (labelToggle)
  grep -q 'memory.pulls.labels.remove' desktop/src/shared/i18n/en-US.ts && grep -q 'memory.pulls.labels.remove' desktop/src/shared/i18n/pt-BR.ts && echo i18n=pass || { echo i18n=fail; ok=0; }
  git diff --stat HEAD | tail -1
  (cd desktop && npm run -s typecheck >/tmp/tc.$$ 2>&1) && echo typecheck=pass || { echo typecheck=fail; ok=0; }
  (cd desktop && npm run -s lint >/tmp/l.$$ 2>&1) && echo lint=pass || { echo lint=fail; ok=0; }
  (cd desktop && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test "src/**/*.test.ts" >/tmp/t.$$ 2>&1) && echo tests=pass || { echo tests=fail; ok=0; }
  ;;
pr262)
  git checkout -q fe65d6e4 -- internal/state/removeproject_test.go  # reference tests
  git diff --stat HEAD | tail -1
  go vet ./internal/state >/tmp/v.$$ 2>&1 && echo vet=pass || { echo vet=fail; ok=0; }
  go test ./internal/state >/tmp/t.$$ 2>&1 && echo tests=pass || { echo tests=fail; ok=0; }
  ;;
esac
echo ok=$ok
