# Light lane: an agent without an Incus machine (evaluation and PoC)

Research PoC. It isn't part of any build: no Go package, no npm workspace, nothing CI runs.
`lane.mjs` starts one agent "lane" the way AgentBox could: a git worktree on its own branch, a
private HOME, the **unmodified Claude Code binary** through the same ACP adapter the chats use
(`claude-agent-acp`), inside a **bubblewrap** jail and a **memory cgroup of its own**, with no
Incus machine. Then it drives one ACP turn and measures it.

The question was whether AgentBox can start light work in **workerd isolates** instead of Incus
machines, after SAI App 4's PoC (`docs/plans/2026-10-10-isolate-agent-lane-poc.md` and
`poc/isolate-lane/` in that project). The short answer is no for the isolate itself. The idea
does carry over to a jailed Claude Code process, which this PoC builds.

## Recommendation

1. **Build a light lane, but as a jailed Claude Code process, not a workerd isolate.** On this VM
   it is ready in 0.8 s instead of 12–28 s (17 s p50), and makes its first useful tool call in
   about 2 s instead of 13 s. It peaks at about 260 MiB against 2.0 GB for an agent's machine.
   It keeps the user's Claude subscription, ACP, the chat UI, worktrees, branches, diffs and PRs
   exactly as they are.
2. **Don't move app hosting or previews to workerd.** Agents' apps are whatever stack the project
   uses (Vite, Next, Go, Rails, Docker Compose). workerd runs only Workers-shaped JavaScript, and
   the machine has to exist anyway while the agent works on the app.
3. **What comes first**, in this order:
   1. A lane kind of agent in `internal/agent`, with no Instance: `LaneChatCommand`, built from
      `LeadChatCommand` (which already runs `claude-agent-acp` on the host with a private HOME
      and AgentBox's login), plus this jail and cgroup.
   2. Network isolation before anything ships: a network namespace with the
      `@anthropic-ai/sandbox-runtime` (srt) proxy or pasta, so a lane can't reach the VM's
      localhost ports. Today's PoC shares the VM's network.
   3. The in-agent API (memory MCP, `agentbox ask`, `report`, media) reached through a per-lane
      socket bound into the jail.
   4. A lane brief: no desktop, no Docker, no package installs. A **"move to a machine"**
      action for when the task turns out heavy: the worktree is already on the host, so a
      machine can mount it and resume the session.
   5. The lead picks the lane for reviews, questions, docs and small edits.

The case is weaker than it was when the lane was first proposed. Since #252, agents no longer
wait for memory admission: every agent starts at once and only heavy commands wait on PSI. The
~2 GB light reservation the proposal assumed is gone. So what the lane buys is **start time (≈20× to ready, ≈6× to the first tool call)
and memory (≈8×) per light agent**, not shorter admission queues.

## Measurements on this VM

p50 (max) for each column. Lanes: Opus 5.5, 5 runs each alone and 2 runs of 5 at once, 20/20
succeeded. Incus: ten creates on this VM, with one first-tool-call sample (agent-310).

| | ready (request → usable agent) | first useful action (first tool call) | turn done | memory peak | memory steady (current / anon) |
| --- | --- | --- | --- | --- | --- |
| **Incus agent today** | **17.1 s (28.3 s)**; 11.6 s for agent-310, 16.8 s alone, 27–28 s with four created at once | **13.0 s** (agent-310) | n/a (a different task) | **2.01 GB** machine `memory.peak` at 2 min | **1.65 GB** `memory.current`, 1.54 GiB (Incus); Claude Code 305 MiB RSS, Chromium ≈750 MiB |
| **Light lane** (bwrap, this PoC), 1 at a time | **0.79 s (0.83 s)**, of which `git worktree add` 0.06 s | **2.15 s (2.28 s)** | 9.4 s (10.2 s) | **256 MiB (314)** | 192 / 181 MiB |
| Same adapter with no jail, 1 at a time | 0.79 s (0.86 s) | 1.72 s (2.52 s) | 7.6 s (11.1 s) | 260 MiB (309) | 191 / 166 MiB |
| Light lane, 5 at once | 0.87 s (1.08 s) | 1.80 s (4.56 s) | 7.7 s (21.6 s) | 261 MiB (288) per lane; **1.17–1.21 GiB for all 5** | 185 / 174 MiB per lane; 0.87 GiB anon for all 5 |
| workerd isolate (SAI App 4, their VM, custom harness: reference only) | 0.14 s alone; 1.65 s p50 at 10 at once | n/a | n/a | ≈60 MiB per turn, plus a 0.3–0.7 GiB lane process | n/a |

Read it this way:
- **A lane is ready ≈20× sooner** than a machine (0.8 s against 17 s), and makes its first tool
  call ≈6× sooner (2 s against 13 s).
- **A lane uses about an eighth of a machine's memory** (256 MiB against 2.0 GB peak). Five lanes
  at once fit in what one idle machine uses.
- **The jail costs nothing measurable.** Ready time is the same with and without bubblewrap, and
  the first-tool difference (0.4 s) is within the model's own jitter (1.6–4.6 s across runs).
- **Nearly all of a lane's time and memory is Claude Code and the model**: about 0.3 s to
  initialize the adapter, 0.4 s for `session/new`, then model latency. That is the floor for any
  design that keeps the CLI. workerd's 0.14 s isn't reachable while Claude Code runs the turn,
  and the subscription requires that it does.

How each number was taken, the same way for every row:

- **Ready**: from the request to a usable agent. For a lane, that is `git worktree add` through
  the jail and adapter starting, to ACP `session/new` answered (`lane.mjs`). For an Incus agent,
  it is the create job's `created_at` to `finished_at` in `state.db` (ten creates on this VM,
  read by the lead; the daemon log has no step timings). That job also takes the `initial`
  snapshot and starts the browser.
- **First useful action**: from the request to the first ACP `tool_call`. For agent-310
  (this agent) that was 13.0 s: the job was created at 06:57:29, the first Bash tool call came
  at 06:57:42.5 (`chat_items`). The lanes ran a question about this repository on Opus 5.5
  ("what is `pressureInterval` set to, and what reads it?"). agent-310's first turn was a longer
  task on the same model, but the first tool call comes before the task's length matters.
- **Memory**: the cgroup's `memory.peak`, and `memory.current` and `anon` 5 s after the turn
  with the session still open (steady). For the Incus agent, `memory.current`/`memory.peak` of
  its machine at about 2 minutes old, idle (the lead's reading): 1.65 GB current, 2.01 GB peak,
  of which Claude Code is 305 MiB RSS, Chromium about 750 MiB and dockerd 83 MiB. Cgroup
  `current` includes page cache, so `anon` is the fairer floor.
- **The lanes ran inside agent-310's own machine**, which is the only place an agent can run
  them. It is the same VM, kernel and Claude Code version (2.1.280, adapter 0.88.0), but nested
  one level deeper than production would be. In production a lane runs in the VM directly, as
  the lead does.
- **workerd numbers are SAI App 4's**, on their 3 vCPU / 15 GiB VM with a custom harness (see
  below why they can't be reproduced here on the subscription). They are a reference, not the
  same method.

## Candidate 1: a light lane for light tasks

### In a workerd isolate (SAI's design)

| | Fits? | Why |
| --- | --- | --- |
| Claude Code, Codex, OpenCode over ACP | **no** | An isolate runs JavaScript with no processes, no real filesystem and no child processes. All three tools are native programs (Claude Code is a binary, Codex is Rust, OpenCode is Bun), so a lane needs a custom harness: an AI SDK or LangGraph loop, as SAI built. That means a second agent implementation beside ACP, with its own tools, prompts, permissions and transcript format, which the chat UI, checkpoints, rollback, the token ledger and memory capture would all have to learn. |
| The subscription | **no** | See "Can a lane use the subscription?" below: a custom harness may not use `CLAUDE_CODE_OAUTH_TOKEN`. It needs an API key, which moves the user from their plan to per-token billing. SAI's 25–33% saving is a token saving from dropping Claude Code's harness, and it was priced on API billing. |
| Desktop, recording subagent, browser, Playwright | no | No display, no Chromium. |
| Docker | no | |
| git, push, PRs | partly | isomorphic-git over an in-memory FS works (SAI pushes branches). But AgentBox's worktrees are real directories on the host, which diffs, the Fleet view, rollback and checkpoints read. An in-memory tree would need syncing back. No `gh`. |
| Tests, type checks, installs | mostly no | SAI type-checks with a ts-rust WASM build and runs one test convention in a second isolate. There is no `npm install`, build, Go or Python, and AgentBox projects are any language. |
| Secrets and accounts | yes | Bindings and env work. Egress is open unless routed through a proxy. |
| Memory | ≈60 MiB per turn | SAI's density run, with one compiled wasm module shared. But OSS workerd has no per-isolate memory limit, so one runaway turn kills every turn in the process. |
| Complexity and maintenance | high | A second harness and toolset to keep at parity with three ACP tools; a workerd supervisor, one process per core, CPU and wall limits, re-queueing; the `LOADER.get(name)` leak SAI hit. |

### As a jailed Claude Code process (this PoC)

| | Fits? | Why |
| --- | --- | --- |
| Claude Code over ACP | **yes, tested** | The same `claude-agent-acp` the chats use, unmodified, signed in with the user's `CLAUDE_CODE_OAUTH_TOKEN`. A question turn and an edit-and-commit turn ran in the jail on Opus 5.5. |
| Codex, OpenCode | likely, untested | Both are native programs that run under bubblewrap the same way. Codex runs its own bubblewrap/landlock sandbox for commands, which needs checking when nested. |
| Desktop, recording subagent, browser, Playwright | no | A lane has no display. A light task that needs a screenshot moves to a machine. Lanes could share one headless Chromium later, but nothing here needs it. |
| Docker | no | Giving a lane the Docker socket would be giving it root on the VM. Docker tasks aren't light anyway. |
| git, push, PRs | **yes** | The worktree is a real directory on the host, on `agentbox/<slug>` from the project's repository, exactly where an agent's worktree lives today. Diffs, Fleet, rollback and PR features work unchanged. The commit test landed on the lane's branch with the configured author. Push and `gh` get `GH_TOKEN` the way the lead does (`leadGitHubToken`); this PoC didn't push. The jail has to bind the repository's `.git` writable, so a lane could write other refs. That is the same as an agent's machine today. |
| Secrets and accounts | yes | Secrets go in the environment. The PoC passes the token through sudo's `--preserve-env`, never through a command line. The jail sees the system read-only, its tools, its worktree, `.git` and its own HOME: no `state.db`, other worktrees, `~/.ssh` or `gh` config (checked with `--probe`). |
| Isolation compared with a machine | weaker | It shares the VM's kernel, and in this PoC its network: it can reach ports on the VM's localhost. It needs a network namespace and the srt proxy before it ships. A machine's isolation stays the default for real work. |
| Memory | ≈260 MiB peak, ≈180 MiB anon steady | It has a hard `memory.max` per lane (1.5 GiB here), which workerd lacks. Most of it is Claude Code itself; no Chromium, dockerd, systemd or snapshot. |
| Complexity and maintenance | low to medium | bubblewrap is a Debian package in the VM image, and the VM is Linux on every platform (CHV, Lima, WSL), so there's one implementation. The new code is a lane agent kind, its chat command, a jail builder, a per-lane in-agent API socket, a brief variant and a "move to a machine" action. No second harness: the AI tools stay the ones AgentBox already pins. |

## Candidate 2: hosting and previews on one shared workerd host

| | Fits? | Why |
| --- | --- | --- |
| The apps agents start | **mostly no** | Agents run whatever the project is: Vite or Next dev servers, Go or Python servers, Rails, Docker Compose databases. workerd hosts only Workers-shaped JavaScript (SAI rewrote their app as Hono + Drizzle to fit). Postgres over workerd sockets needs a connection per request. |
| Previews while an agent works | no gain | The agent's machine exists while it works, and its dev server's hot reload already previews edits. The preview proxy (`<port>.<agent>.agentbox.localhost:7777`) already reaches it. |
| Previews after an agent is retired | the one real use | Keeping a finished app viewable without its machine would save that machine's memory. But only for Workers-shaped apps; a static build served by the daemon would cover more of them for less. |
| Desktop, Playwright, recordings | unaffected | Recordings are of the app in the agent's browser. |
| Docker, git, secrets | n/a | |
| Memory | ≈4.8 MiB per idle app (SAI) | Against a dev server's 100–300 MiB, but only for apps that fit. |
| Complexity and maintenance | high | A multi-tenant host, a build step per app, a template that agents must write to, and a second runtime to keep current. |

## Can a lane use the subscription? (sources)

Agents run on the user's Claude subscription through Claude Code with `CLAUDE_CODE_OAUTH_TOKEN`.
Anthropic's terms allow that token only in the unmodified Claude Code binary, so **a light lane
has to keep the Claude Code CLI**:

- Claude Code, Legal and compliance (https://code.claude.com/docs/en/legal-and-compliance):
  - "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team,
    and Enterprise subscription plans and is designed to support ordinary use of Claude Code and
    other native Anthropic applications."
  - "Developers building products or services that interact with Claude's capabilities,
    including those using the Agent SDK, should use API key authentication… Anthropic does not
    permit third-party developers to offer Claude.ai login into their own applications, or to
    route requests through Free, Pro, or Max plan credentials on behalf of their users.
    Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session
    tokens — sign-in to a Claude account must complete through Anthropic's own flow."
  - What is allowed: it doesn't "prevent an end user from signing in to the unmodified Claude
    Code binary with their own Claude subscription, including where a platform hosts Claude
    Code". "The Claude Code binary must not be modified."
- Agent SDK overview (https://code.claude.com/docs/en/agent-sdk/overview): "Unless previously
  approved, Anthropic does not allow third party developers to offer claude.ai login or rate
  limits for their products, including agents built on the Claude Agent SDK. Use the API key
  authentication methods described in the Quickstart instead."
- Consumer Terms §3(7), effective 8 Oct 2025 (https://www.anthropic.com/legal/consumer-terms):
  users may not, "Except when you are accessing our Services via an Anthropic API Key or where we
  otherwise explicitly permit it… access the Services through automated or non-human means".
- In 2026, Anthropic reportedly enforced this against third-party harnesses (secondary reports
  of the February docs change and the April OpenClaw cut-off:
  https://alternativeto.net/news/2026/2/anthropic-officially-bans-using-subscription-authentication-for-third-party-claude-use,
  https://pasqualepillitteri.it/en/news/642/anthropic-blocks-openclaw-third-party-tools-claude-subscriptions).
  I found no first-party announcement.

So SAI's custom AI SDK / LangGraph harness is out on the subscription: it would need an API key.

Can Claude Code itself run in something lighter than a machine? Yes:

- Claude Code's own sandbox (https://code.claude.com/docs/en/sandboxing) uses bubblewrap on
  Linux, but "The sandbox covers shell commands only. Claude's file tools, MCP servers, and hooks
  run outside it." For a lane, the docs' own advice applies: "To put the tools, processes, and
  commands in this section behind one boundary, run the Claude Code process itself in a
  container, virtual machine, or the sandbox runtime."
- The sandbox runtime, srt (https://github.com/anthropic-experimental/sandbox-runtime): "A
  lightweight sandboxing tool for enforcing filesystem and network restrictions on arbitrary
  processes at the OS level, without requiring a container." It uses bubblewrap on Linux, and a
  proxy for network: "By default, all network access is denied." It is a "Beta Research
  Preview".

This PoC uses bubblewrap directly, with the whole Claude Code process inside, which is the
boundary the docs describe. Production should add srt's network proxy, or follow its approach.

A nuance for AgentBox as it is today: `claude-agent-acp` is built on the Agent SDK, which "runs
the Claude Code binary" unmodified, and each user signs it in with their own subscription token.
That is the "platform hosts Claude Code" case, and a lane changes nothing about it.

## Running it

```bash
sudo apt-get install -y bubblewrap
git clone --no-hardlinks <repo> ~/.cache/light-lane/repo      # any git checkout
export CLAUDE_CODE_OAUTH_TOKEN=…                              # the agent's own login
node lane.mjs --repo ~/.cache/light-lane/repo --arm bwrap --reps 5 --out results/bwrap-n1.json
node lane.mjs --repo ~/.cache/light-lane/repo --arm direct --reps 5 --out results/direct-n1.json
node lane.mjs --repo ~/.cache/light-lane/repo --arm bwrap --n 5 --reps 2 --out results/bwrap-n5.json
node lane.mjs --repo ~/.cache/light-lane/repo --probe 'ls ~/.ssh; env'   # what the jail sees
node summarize.mjs results/*-n*.json
```

`--arm direct` is the same adapter and cgroup without the jail, which separates bubblewrap's cost
from Claude Code's. `--task` sets the prompt, `--model` the model (`claude-opus-5-5`), `--mem-max`
the lane's `memory.max`, and `--keep` keeps the lane's branch. It needs `sudo` for the cgroups.
Results are in `results/`.

## What it can't do yet

- No network isolation: the lane shares the VM's network namespace.
- No in-agent API: no memory MCP, `agentbox ask`, `report` or media inside a lane.
- It didn't push, or run `gh`, Codex or OpenCode.
- The `.git` it binds is the whole repository's, writable.
- Concurrency was measured to 5 lanes at once, inside one agent's machine.
