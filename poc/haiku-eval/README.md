# Can Haiku 5.5 take small agent work from Sonnet 5.5 / Opus 5.5?

Replays of three real tasks with `claude -p --model <m> --effort high --output-format json`, one detached
git worktree per run (`run.sh`), scored by `score.sh`. Prompts are in `prompts/`, raw JSON and scores in `results/`.
Run: `./run.sh <rebase269|pr266|pr262> <haiku|sonnet|opus> <n> [effort]` (default effort `high`, like real agents).

Tasks:
- **rebase269**: rebase #269's single commit 377f6272 onto bb8988e5. Reference 83d7676a. Score: rebase finished, parent is bb8988e5, tree identical to the reference (`diff_vs_reference_lines`), typecheck and desktop tests pass.
- **pr266**: feature from #266 (X on label chips; 7 files, i18n, a `labelToggle` helper). Score: the PR's own `pulls.test.ts` copied in, plus typecheck, oxlint, i18n keys in both languages.
- **pr262**: bug fix from #262 (RemoveProject in one transaction, FK error; Go). Score: the PR's `removeproject_test.go` copied in, plus `go vet` and `go test ./internal/state`.

Effort: `--effort high` on every run except the two marked low. The CLI accepted `high` for Haiku with no warning (a bogus value does warn), but I cannot see from the output whether Haiku 5.5 acts on it.

## Results (n = 2 per arm, 1 for Opus and for low effort)

`ok` is the strict score. Costs are `total_cost_usd`; tokens are from `usage` (cache read dominates, as in real agents).

| task | model | effort | ok | turns | in | out | cache read | cache write | cost $ | wall s |
|---|---|---|---|---|---|---|---|---|---|---|
| rebase269 | haiku #1 | high | yes | 11 | 90 | 1624 | 462527 | 23743 | 0.103 | 27 |
| rebase269 | haiku #2 | high | yes | 9 | 66 | 1668 | 308580 | 22638 | 0.086 | 33 |
| rebase269 | haiku #3 | low | yes | 14 | 114 | 2562 | 633999 | 37437 | 0.152 | 52 |
| rebase269 | sonnet #1 | high | yes | 15 | 30 | 6028 | 730203 | 17849 | 0.279 | 99 |
| rebase269 | sonnet #2 | high | yes | 17 | 34 | 4923 | 982199 | 36918 | 0.395 | 91 |
| rebase269 | opus #1 | high | yes | 7 | 14 | 1946 | 216466 | 11347 | 0.174 | 34 |
| pr266 | haiku #1 | high | NO | 62 | 498 | 16362 | 4824993 | 69801 | 0.706 | 196 |
| pr266 | haiku #2 | high | yes | 74 | 578 | 23624 | 6399005 | 87604 | 0.935 | 328 |
| pr266 | sonnet #1 | high | yes | 36 | 70 | 18918 | 2971762 | 62334 | 1.034 | 218 |
| pr266 | sonnet #2 | high | yes | 41 | 82 | 18450 | 3509487 | 64595 | 1.146 | 234 |
| pr262 | haiku #1 | high | NO* | 48 | 386 | 15800 | 2808283 | 53427 | 0.468 | 267 |
| pr262 | haiku #2 | high | NO* | 60 | 482 | 21233 | 4036485 | 64102 | 0.640 | 241 |
| pr262 | haiku #3 | low | NO | 81 | 650 | 28618 | 4746294 | 69819 | 0.759 | 305 |
| pr262 | sonnet #1 | high | yes | 51 | 102 | 26978 | 4470461 | 80045 | 1.486 | 365 |
| pr262 | sonnet #2 | high | yes | 62 | 86 | 34571 | 4146111 | 104761 | 1.596 | 418 |

\* Strict score failed only on a name (see below); after renaming, the PR's tests pass.

Per task, mean cost at high effort: rebase269 Haiku $0.09 vs Sonnet $0.34 (Opus $0.17, one run); pr266 Haiku $0.82 vs Sonnet $1.09;
pr262 Haiku $0.55 vs Sonnet $1.54. Total spend of the 15 runs: about $10 (plus a few aborted runs, below).

## What Haiku got wrong

- **pr266 #1**: `labelToggle(id, number, …)` built the edit with `id` and `number` swapped (`{id: 9, number: 4}`), so the reference test failed. The other run got it right. It also took 62-74 turns against Sonnet's 36-41, and its output tokens were not lower.
- **pr262 #1 and #2**: the prompt named the package vars `projectOwned` and `projectKept`; Haiku exported `ProjectOwned` and `ProjectKept` instead, which doesn't compile against the reference test. Behaviour was right: with the names lowercased and Haiku's own external-package test removed, the PR's tests pass. This is an instruction-following slip, not a logic bug, but a reviewer would have to catch it.
- **pr262 #3 (low effort)**: put tables that don't exist (`agent_memory_peaks`, `task_dependencies`) in `projectOwned`, so every removal errors. It invented them instead of reading the migrations. Low effort cut nothing: more turns and cost than high on both tasks where it ran.
- Rebase: nothing wrong. All 6 rebase runs (any model, any effort) produced a tree byte-identical to the reference 83d7676a.

## Recommendation

- **Default to Haiku: rebase and conflict resolution, and other mechanical edits** where the answer is mostly "keep main's side, call the PR's function". 6/6 correct, Haiku at about a quarter of Sonnet's cost and a third of its wall time, and cheaper than Opus. Keep effort at high: low was worse.
- **Mechanical edits with a clear target** (rename, add an i18n key, wire an existing helper): probably fine on Haiku, but I did not test them in isolation. Check that it finished the whole spec.
- **Don't default small features or bug fixes to Haiku.** On the multi-file feature and the Go fix it was 25-65% cheaper per run but got one of two strictly right on pr266 and none on pr262 (two near-misses and one hallucination), took about 1.5x the turns, and needs a reviewer. A failed run costs more than it saves: pr266 Haiku spent $1.64 for one pass against Sonnet's $1.03 per pass. Use Sonnet for these, with a test the task must pass.
- Opus on the rebase was fast (7 turns) and cheaper than Sonnet, so for a one-off conflict Opus is not wasteful, but Haiku is simply cheaper.

## Caveats

n is tiny; costs include the project's large CLAUDE.md and tool prompt, so absolute numbers are higher than a bare `claude -p`. The reference tests are the PR's own, so they check only what the PR tested. I did not review the UI of pr266 visually. Five runs initially failed to start because a stale worktree path existed (my script's fault) and were rerun; earlier runs made before `--effort` was pinned were discarded and are not in the table (about a dozen partial runs, a few dollars).
