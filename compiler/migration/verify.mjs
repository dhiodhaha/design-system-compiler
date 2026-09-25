#!/usr/bin/env node
/**
 * The single authoritative verification command for the Base UI migration.
 *
 *   pnpm verify:base-ui-migration [--fast]
 *
 * Every gate is a real check with a real exit code — none of them is "skipped silently":
 *
 *   1  React Aria residue scan (canonical runtime must contain none)
 *   2  typechecks: app, adopted payload, PRO compositions
 *   3  invariant tests
 *   4  SSR: benchmark/adopted + PRO
 *   5  migration capture + parity against the frozen React Aria baseline
 *   6  hydration smoke (SSR render then hydrate, mismatch-free)
 *   7  state-selector audit (no React-Aria state variant left silently dead)
 *   8  registry reconciliation + consistency
 *   9  visual canaries (unless --fast)
 *  10  migration matrix terminal-state check
 *
 * Browser gates need the dev server (default http://127.0.0.1:5173).
 */
import { execFileSync } from "node:child_process";

const FAST = process.argv.includes("--fast");
const PORT = (process.argv.find((a) => a.startsWith("--port=")) ?? "--port=5173").split("=")[1];

const gates = [
  { id: "residue", cmd: ["node", ["compiler/migration/residue.mjs"]], gate: "no React Aria import remains in canonical runtime code" },
  { id: "typecheck:app", cmd: ["node", ["node_modules/typescript5/bin/tsc", "--noEmit"]] },
  { id: "typecheck:payload", cmd: ["node", ["node_modules/typescript5/bin/tsc", "-p", "registry/untitledui/tsconfig.json"]] },
  { id: "typecheck:pro", cmd: ["node", ["node_modules/typescript5/bin/tsc", "-p", "registry/pro/tsconfig.json"]] },
  { id: "tests:invariants", cmd: ["node", ["--test", "tests/invariants.test.mjs"]] },
  { id: "ssr:adopted", cmd: ["bun", ["tests/ssr.tsx"]] },
  { id: "ssr:pro", cmd: ["bun", ["tests/ssr-pro.tsx"]] },
  { id: "migration:capture", cmd: ["node", ["compiler/migration/capture.mjs", "--label", "migrated", "--port", PORT]] },
  { id: "migration:parity", cmd: ["node", ["compiler/migration/parity.mjs", "--label", "migrated"]] },
  { id: "hydration", cmd: ["node", ["compiler/migration/hydration.mjs", "--port", PORT]] },
  { id: "state-selectors", cmd: ["node", ["compiler/migration/audit-state-selectors.mjs"]] },
  { id: "registry:reconcile", cmd: ["node", ["compiler/state/reconcile.mjs"]] },
  { id: "registry:consistency", cmd: ["node", ["compiler/state/consistency.mjs"]] },
  ...(FAST ? [] : [{ id: "visual:canaries", cmd: ["node", ["visual/verify-matrix.mjs", "--dpr", "2", "--canaries"]] }]),
  { id: "migration:terminal", cmd: ["node", ["compiler/migration/report.mjs"]], gate: "every migration unit reached a terminal state" },
];

const results = [];
for (const entry of gates) {
  const [bin, argv] = entry.cmd;
  const started = Date.now();
  let status = "PASS";
  let output = "";
  try {
    output = execFileSync(bin, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20 * 60 * 1000 });
  } catch (error) {
    status = "FAIL";
    output = `${error.stdout ?? ""}${error.stderr ?? ""}` || String(error.message);
  }
  const ms = Date.now() - started;
  results.push({ gate: entry.id, status, ms, summary: summarize(entry.id, output) , note: entry.gate ?? null });
  const line = `${status === "PASS" ? "✓" : "✗"} ${entry.id.padEnd(22)} ${String(ms / 1000).padStart(6)}s  ${results.at(-1).summary}`;
  console.log(line);
}

function summarize(id, output) {
  try {
    const parsed = JSON.parse(output);
    if (id === "residue") return `canonical runtime files with React Aria: ${parsed.totals?.canonicalRuntimeFiles ?? "?"}`;
    if (id === "migration:parity") return `cases ${parsed.comparedCases}, failures ${parsed.failures}, notes ${parsed.notes}`;
    if (id === "migration:capture") return `cases ${parsed.cases}, interactions ${parsed.withInteraction}`;
    if (id === "hydration") return `hydrated=${parsed.hydrated} cases=${parsed.cases} mismatches=${parsed.mismatches}`;
    if (id === "state-selectors") return `dead selectors ${parsed.deadSelectors}, pending ${parsed.pendingMigration}`;
    if (id === "registry:consistency") return `checks ${parsed.checks}, failures ${parsed.failures?.length ?? 0}`;
    if (id === "migration:terminal") return `units ${parsed.totals?.units}, not terminal ${parsed.notTerminal?.length ?? 0}, residue gate ${parsed.residue?.gate?.passed}`;
    return "";
  } catch {
    const last = output.trim().split("\n").filter(Boolean).at(-1) ?? "";
    return last.slice(0, 100);
  }
}

const failed = results.filter((r) => r.status === "FAIL");
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "PASS" : "FAIL",
      gates: results.length,
      failed: failed.map((f) => ({ gate: f.gate, summary: f.summary })),
      fast: FAST,
    },
    null,
    2,
  ),
);
process.exit(failed.length ? 1 : 0);
