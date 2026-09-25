#!/usr/bin/env node
/**
 * Official-source adoption (OSS source policy: adopt, do not rewrite).
 *
 *   node compiler/adopt/adopt.mjs --entry components/base/buttons/button.tsx [--entries a,b] [--dry]
 *
 * Copies the pinned upstream source plus its transitive internal dependency closure into a source-owned
 * tree, preserving the upstream directory shape so `@/...` aliases keep resolving without rewriting.
 *
 * Guarantees:
 *   • only files inside the pinned revision are read, and each copy carries a provenance header
 *     (repository, revision, upstream path, MIT notice) unless one is already present
 *   • applied transformations are recorded as an explicit delta list, never silent
 *   • the adoption record lists upstream/local hashes so a sync can prove what changed
 *   • no model call
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const REPO = resolve(args.repo ?? "/tmp/untitled-react");
const OUT = resolve(args.out ?? ".design-compiler/references/untitledui");
const TARGET = resolve(args.target ?? "src");
const DRY = process.argv.includes("--dry");
const entries = (args.entries ?? args.entry ?? "").split(",").map((s) => s.trim()).filter(Boolean);

if (!entries.length) {
  console.error("usage: adopt.mjs --entry <upstream/path.tsx[,more]> [--repo DIR] [--target src] [--dry]");
  process.exit(1);
}

const index = JSON.parse(readFileSync(resolve(OUT, "index.json"), "utf8"));
const revisionInfo = JSON.parse(readFileSync(resolve(OUT, "revision.json"), "utf8"));
const byPath = new Map(index.entries.map((e) => [e.path, e]));

/** Resolve an upstream import specifier to a repository path. */
const resolveInternal = (from, spec) => {
  const candidates = (base) => [base, `${base}.tsx`, `${base}.ts`, `${base}/index.ts`, `${base}/index.tsx`, `${base}.css`];
  if (spec.startsWith("@/")) {
    const base = spec.slice(2);
    return candidates(base).find((c) => byPath.has(c) || existsSync(resolve(REPO, c))) ?? null;
  }
  if (spec.startsWith(".")) {
    const dir = from.split("/").slice(0, -1).join("/");
    const base = resolve("/", dir, spec).slice(1);
    return candidates(base).find((c) => byPath.has(c) || existsSync(resolve(REPO, c))) ?? null;
  }
  return null;
};

/** Transitive internal closure: local source, styles and hooks travel with the component. */
const closure = new Set();
const external = new Set();
const queue = [...entries];
while (queue.length) {
  const path = queue.shift();
  if (closure.has(path)) continue;
  closure.add(path);
  const entry = byPath.get(path);
  const abs = resolve(REPO, path);
  if (!entry || !existsSync(abs)) continue;
  for (const spec of entry.dependencies) {
    const target = resolveInternal(path, spec);
    if (target) queue.push(target);
    else if (!spec.startsWith(".") && !spec.startsWith("@/")) external.add(spec);
  }
}

const header = (upstreamPath) =>
  [
    `/* Adopted from ${revisionInfo.repository}@${revisionInfo.revision.slice(0, 12)} — ${upstreamPath}`,
    ` * ${revisionInfo.license} licensed upstream source, adopted with the smallest necessary project-local`,
    ` * transformations. Local deltas, if any, are listed in .design-compiler/references/untitledui/adoption-*.json.`,
    ` * Do not hand-edit: re-run compiler/adopt/adopt.mjs to re-adopt. */`,
    "",
  ].join("\n");

const files = [];
const transforms = [];
for (const path of [...closure].sort()) {
  const source = readFileSync(resolve(REPO, path), "utf8");
  const localPath = path; // upstream shape preserved under the source root, so @/ aliases resolve untouched
  const destination = resolve(TARGET, localPath);
  const alreadyAdopted = existsSync(destination) && readFileSync(destination, "utf8").includes(`Adopted from ${revisionInfo.repository}@`);
  const content = alreadyAdopted ? readFileSync(destination, "utf8") : `${header(path)}${source}`;
  files.push({
    upstreamPath: path,
    localPath: localPath,
    upstreamSha256: createHash("sha256").update(source).digest("hex").slice(0, 16),
    localSha256: createHash("sha256").update(content).digest("hex").slice(0, 16),
    bytes: Buffer.byteLength(content),
    kind: byPath.get(path)?.kind ?? "UNKNOWN",
    adopted: !alreadyAdopted,
  });
  if (!DRY && !alreadyAdopted) {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
}

const record = {
  $schema: "design-compiler/Adoption@p0",
  library: "untitledui",
  repository: revisionInfo.repository,
  revision: revisionInfo.revision,
  license: revisionInfo.license,
  adoptedAt: new Date().toISOString().slice(0, 10),
  dryRun: DRY,
  entries,
  closureSize: files.length,
  files,
  externalDependencies: [...external].sort(),
  transforms,
  transformPolicy:
    "no rewriting by default: upstream path shape is preserved so `@/` aliases resolve; only demonstrated portability defects may add an entry here",
};

mkdirSync(OUT, { recursive: true });
const recordPath = resolve(OUT, `adoption-${entries[0].split("/").pop().replace(/\.[^.]+$/, "")}.json`);
writeFileSync(recordPath, JSON.stringify(record, null, 2));

console.log(
  JSON.stringify(
    {
      dryRun: DRY,
      entries,
      closureSize: files.length,
      byKind: files.reduce((a, f) => ({ ...a, [f.kind]: (a[f.kind] ?? 0) + 1 }), {}),
      files: files.map((f) => `${f.upstreamPath} -> ${TARGET === resolve("src") ? "src/" : TARGET + "/"}${f.localPath}`).slice(0, 20),
      externalDependencies: record.externalDependencies,
      transforms: transforms.length,
      record: relative(process.cwd(), recordPath),
    },
    null,
    2,
  ),
);
