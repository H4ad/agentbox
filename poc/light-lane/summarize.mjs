#!/usr/bin/env node
// Summarizes lane.mjs results: p50 and max per arm and concurrency.
//   node summarize.mjs results/bwrap-n1.json results/direct-n1.json ...
import { readFileSync } from "node:fs";

const rows = [];
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, "utf8"));
  const runs = d.results.flatMap((r) => r.runs);
  const ok = runs.filter((r) => r.ok);
  const col = (k) => ok.map((r) => r[k]).filter((v) => v != null);
  rows.push({
    arm: `${d.arm} n=${d.n}`,
    ok: `${ok.length}/${runs.length}`,
    readyS: stat(col("readyMs"), 1000),
    firstToolS: stat(col("firstToolMs"), 1000),
    doneS: stat(col("doneMs"), 1000),
    peakMiB: stat(col("peakMiB")),
    steadyMiB: stat(col("steadyMiB")),
    steadyAnonMiB: stat(col("steadyAnonMiB")),
    allLanesPeakMiB: stat(d.results.map((r) => r.totalPeakMiB)),
  });
}
const keys = Object.keys(rows[0] ?? {});
console.log(`| ${keys.join(" | ")} |\n| ${keys.map(() => "---").join(" | ")} |`);
for (const r of rows) console.log(`| ${keys.map((k) => r[k]).join(" | ")} |`);

// "p50 (max)", in seconds when div is 1000.
function stat(xs, div = 1) {
  if (!xs.length) return "–";
  const s = [...xs].sort((a, b) => a - b);
  const f = (v) => (div === 1 ? String(Math.round(v)) : (v / div).toFixed(2));
  return `${f(s[Math.floor((s.length - 1) / 2)])} (${f(s[s.length - 1])})`;
}
