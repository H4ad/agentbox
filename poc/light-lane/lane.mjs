#!/usr/bin/env node
// Light lane PoC: one agent turn without an Incus machine.
//
// A lane is a git worktree on its own branch, a private HOME, and the
// unmodified Claude Code binary (through the same ACP adapter AgentBox's chats
// use, claude-agent-acp) inside a bubblewrap jail and a memory cgroup of its
// own. This script creates lanes, drives one ACP turn in each, and measures:
//
//   ready   request -> session/new answered (the lane is a usable agent)
//   first   request -> first tool_call (time to the first useful action)
//   done    request -> session/prompt answered
//   memory  the lane's cgroup: memory.peak, and memory.current/anon sampled
//           every 100 ms during the turn and 5 s after it (steady)
//
// Usage (needs sudo for the cgroups, bwrap, and CLAUDE_CODE_OAUTH_TOKEN):
//   node lane.mjs --repo <git dir> [--arm bwrap|direct] [--n 1] [--reps 3]
//                 [--mem-max 1G] [--task "..."] [--out results/x.json]
//
// --arm direct runs the adapter without the jail (still in a cgroup), which is
// what an agent's machine does today once it is up.

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { homedir } from "node:os";

const args = parseArgs(process.argv.slice(2));
const ARM = args.arm ?? "bwrap";
const N = Number(args.n ?? 1);
const REPS = Number(args.reps ?? 1);
const MEM_MAX = args["mem-max"] ?? "1536M";
const REPO = resolve(args.repo ?? "");
const TASK =
  args.task ??
  "In internal/daemon/pressure.go, what is pressureInterval set to, and what reads it? Answer in two sentences; don't change any file.";
const MODEL = args.model ?? "claude-opus-5-5";
// --probe runs a shell command in the jail instead of the adapter, to show what the lane can see.
const PROBE = args.probe;
// --keep leaves the lane's branch (and what it committed) after the run.
const KEEP = !!args.keep;
const ROOT = join(homedir(), ".cache/light-lane");
const CG = "/sys/fs/cgroup/lightlane";
const UID = process.getuid(), GID = process.getgid();
// What sudo leaves in the environment besides the token, which the lane doesn't get.
const unset = ["SUDO_USER", "SUDO_UID", "SUDO_GID", "SUDO_COMMAND", "SUDO_HOME", "MAIL", "SHELL", "LOGNAME", "USER", "TERM"];

const ADAPTER = execFileSync("mise", ["where", "npm:@agentclientprotocol/claude-agent-acp"]).toString().trim();
const NODE = execFileSync("mise", ["where", "node"]).toString().trim();
const ADAPTER_BIN = join(ADAPTER, "node_modules/.bin/claude-agent-acp");

if (!existsSync(join(REPO, ".git"))) die("--repo must be a git checkout");
if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) die("CLAUDE_CODE_OAUTH_TOKEN is not set");

sh("sudo", ["mkdir", "-p", CG]);
sh("sudo", ["sh", "-c", `echo +memory +pids > ${CG}/cgroup.subtree_control`]);

const results = [];
for (let rep = 0; rep < REPS; rep++) {
  const t0 = Date.now();
  const total = sampler(CG);
  const runs = await Promise.all(Array.from({ length: N }, (_, i) => lane(`${ARM}-${t0}-${i}`)));
  total.stop();
  if (PROBE) break;
  const r = { arm: ARM, n: N, rep, runs, totalPeakMiB: mib(total.peak), wallMs: Date.now() - t0 };
  results.push(r);
  console.log(
    `${ARM} n=${N} rep=${rep}: ` +
      runs.map((x) => `ready ${x.readyMs} first ${x.firstToolMs} done ${x.doneMs} peak ${x.peakMiB}MiB steady ${x.steadyMiB}/${x.steadyAnonMiB}MiB ${x.ok ? "ok" : "FAIL " + x.error}`).join(" | ") +
      ` | all lanes peak ${r.totalPeakMiB} MiB`,
  );
}
if (args.out) {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify({ arm: ARM, n: N, model: MODEL, task: TASK, memMax: MEM_MAX, results }, null, 2));
}

async function lane(id) {
  const t0 = Date.now();
  const dir = join(ROOT, id);
  const work = join(dir, "work"), home = join(dir, "home");
  mkdirSync(home, { recursive: true });
  // The commit identity, as AgentBox writes it into an agent's HOME today.
  const who = (k) => sh("git", ["-C", REPO, "config", "--get", k], true)?.trim() || "AgentBox lane";
  writeFileSync(join(home, ".gitconfig"), `[user]\n\tname = ${who("user.name")}\n\temail = ${who("user.email")}\n`);
  // The worktree shares the repo's object store: no clone, no copy.
  sh("git", ["-C", REPO, "worktree", "add", "-q", "-b", `lane/${id}`, work, "HEAD"]);
  const worktreeMs = Date.now() - t0;
  const cg = join(CG, id);
  sh("sudo", ["mkdir", cg]);
  sh("sudo", ["sh", "-c", `echo ${MEM_MAX} > ${cg}/memory.max && echo 0 > ${cg}/memory.swap.max`]);

  const env = {
    HOME: home,
    PATH: `${join(NODE, "bin")}:/usr/bin`,
    LANG: "C.UTF-8",
    // The lane has no machine of its own to tidy up after, and nothing to update itself into.
    ANTHROPIC_MODEL: MODEL,
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
  // The token reaches the adapter through the environment sudo keeps
  // (--preserve-env), never through a command line other processes can read.
  const inner = ARM === "bwrap" ? jail({ work, home, gitDir: join(REPO, ".git"), env }) : ["env", ...unset.flatMap((k) => ["-u", k]), ...envList(env), ADAPTER_BIN];
  // Root puts itself in the lane's cgroup, then drops to the user and execs:
  // everything the lane starts is counted and capped from its first byte.
  const child = spawn(
    "sudo",
    ["-n", "--preserve-env=CLAUDE_CODE_OAUTH_TOKEN", "sh", "-c", `echo $$ > ${cg}/cgroup.procs && exec setpriv --reuid=${UID} --regid=${GID} --init-groups "$@"`, "lane", ...inner],
    { cwd: work, stdio: ["pipe", "pipe", "pipe"] },
  );
  if (PROBE) {
    let o = "";
    child.stdout.on("data", (d) => (o += d));
    child.stderr.on("data", (d) => (o += d));
    await new Promise((r) => child.on("exit", r));
    console.log(o);
    sh("sudo", ["rmdir", cg], true);
    sh("git", ["-C", REPO, "worktree", "remove", "--force", work], true);
    sh("git", ["-C", REPO, "branch", "-q", "-D", `lane/${id}`], true);
    return { id, probe: true };
  }
  let stderr = "";
  child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
  const mem = sampler(cg);
  const rpc = acp(child);
  const out = { id, worktreeMs, ok: false };
  try {
    await rpc.call("initialize", { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
    out.initializeMs = Date.now() - t0;
    const s = await rpc.call("session/new", { cwd: work, mcpServers: [] });
    out.readyMs = Date.now() - t0;
    out.model = s.models?.currentModelId;
    rpc.onUpdate = (u) => {
      if (u.sessionUpdate === "tool_call" && !out.firstToolMs) {
        out.firstToolMs = Date.now() - t0;
        out.firstTool = u.title;
      }
      if (u.sessionUpdate === "agent_message_chunk" && !out.firstTextMs) out.firstTextMs = Date.now() - t0;
      if (u.sessionUpdate === "agent_message_chunk" && u.content?.type === "text") out.answer = (out.answer ?? "") + u.content.text;
    };
    const p = await rpc.call("session/prompt", { sessionId: s.sessionId, prompt: [{ type: "text", text: TASK }] });
    out.doneMs = Date.now() - t0;
    out.stopReason = p.stopReason;
    out.ok = p.stopReason === "end_turn";
    out.turnPeakMiB = mib(mem.peak);
    // Steady: the lane idle with its session open, after the turn.
    await sleep(5000);
    out.steadyMiB = mib(readNum(join(cg, "memory.current")));
    out.steadyAnonMiB = mib(anon(cg));
  } catch (e) {
    out.error = String(e.message ?? e).slice(0, 300) + " :: " + stderr.slice(-300);
  } finally {
    mem.stop();
    out.peakMiB = mib(readNum(join(cg, "memory.peak")));
    child.kill("SIGTERM");
    await sleep(500);
    sh("sudo", ["sh", "-c", `echo 1 > ${cg}/cgroup.kill; sleep 0.2; rmdir ${cg}`], true);
    sh("git", ["-C", REPO, "worktree", "remove", "--force", work], true);
    if (!KEEP) sh("git", ["-C", REPO, "branch", "-q", "-D", `lane/${id}`], true);
    rmSync(dir, { recursive: true, force: true });
  }
  out.answer = out.answer?.slice(0, 200);
  return out;
}

// jail is the bubblewrap command line: the system read-only, the tools
// read-only, the worktree and its repository's .git writable, a private HOME,
// and nothing else of the user's — no other worktree, no state.db, no ~/.ssh.
function jail({ work, home, gitDir, env }) {
  const ro = (p) => (existsSync(p) ? ["--ro-bind", p, p] : []);
  return [
    "bwrap",
    "--unshare-all", "--share-net", "--die-with-parent", "--new-session",
    "--ro-bind", "/usr", "/usr",
    "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64", "--symlink", "usr/sbin", "/sbin",
    ...["/etc/ssl", "/etc/ca-certificates", "/etc/passwd", "/etc/group", "/etc/hosts", "/etc/nsswitch.conf", "/etc/localtime", "/etc/resolv.conf", "/run/systemd/resolve"].flatMap(ro),
    "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
    "--ro-bind", NODE, NODE,
    "--ro-bind", ADAPTER, ADAPTER,
    "--bind", home, home,
    "--bind", gitDir, gitDir,
    "--bind", work, work,
    "--chdir", work,
    ...unset.flatMap((k) => ["--unsetenv", k]), ...Object.entries(env).flatMap(([k, v]) => ["--setenv", k, v]),
    ...(PROBE ? ["sh", "-c", PROBE] : [ADAPTER_BIN]),
  ];
}

// acp speaks JSON-RPC over the adapter's stdio, one message per line, and
// allows whatever permission the agent asks for (the jail is the boundary).
function acp(child) {
  let next = 1;
  const pending = new Map();
  const self = { onUpdate: () => {} };
  const send = (m) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
  createInterface({ input: child.stdout }).on("line", (line) => {
    let m;
    try { m = JSON.parse(line); } catch { return; }
    if (m.id != null && pending.has(m.id) && !m.method) {
      const { ok, fail } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? fail(new Error(JSON.stringify(m.error))) : ok(m.result);
    } else if (m.method === "session/update") {
      self.onUpdate(m.params.update);
    } else if (m.method === "session/request_permission") {
      const opt = m.params.options.find((o) => o.kind?.startsWith("allow")) ?? m.params.options[0];
      send({ id: m.id, result: { outcome: { outcome: "selected", optionId: opt.optionId } } });
    } else if (m.id != null && m.method) {
      send({ id: m.id, error: { code: -32601, message: "not supported by the PoC client" } });
    }
  });
  child.on("exit", (code) => pending.forEach(({ fail }) => fail(new Error(`adapter exited ${code}`))));
  self.call = (method, params) =>
    new Promise((ok, fail) => {
      const id = next++;
      pending.set(id, { ok, fail });
      send({ id, method, params });
      setTimeout(() => fail(new Error(`${method} timed out`)), 300_000).unref();
    });
  return self;
}

function sampler(cg) {
  const s = { peak: 0 };
  const t = setInterval(() => {
    try { s.peak = Math.max(s.peak, readNum(join(cg, "memory.current"))); } catch {}
  }, 100);
  s.stop = () => clearInterval(t);
  return s;
}

function anon(cg) {
  const m = /^anon (\d+)$/m.exec(readFileSync(join(cg, "memory.stat"), "utf8"));
  return m ? Number(m[1]) : 0;
}
function readNum(p) { return Number(readFileSync(p, "utf8").trim()); }
function mib(b) { return Math.round(b / 1048576); }
function envList(env) { return Object.entries(env).map(([k, v]) => `${k}=${v}`); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function sh(cmd, a, quiet) {
  try { return execFileSync(cmd, a, { stdio: ["ignore", "pipe", "pipe"] }).toString(); }
  catch (e) { if (!quiet) throw e; }
}
function die(m) { console.error(m); process.exit(2); }
function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1]?.startsWith("--") ? "1" : a[++i];
  return o;
}
