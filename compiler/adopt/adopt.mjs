#!/usr/bin/env node
/**
 * Generic OSS adoption engine (plan Phase 2, "ADOPT > ADAPT > COMPOSE > GENERATE").
 *
 *   node compiler/adopt/adopt.mjs --item button          # one public item
 *   node compiler/adopt/adopt.mjs --items input,select   # several
 *   node compiler/adopt/adopt.mjs --all                  # the whole adoptable queue, dependency order
 *   node compiler/adopt/adopt.mjs --all --layer component
 *
 * One engine, not one script per component:
 *   resolve canonical source -> transitive internal closure -> styles layer -> copy with zero rewrite into
 *   the source-owned payload tree (registry/untitledui/<upstream path>) -> dedupe by content hash ->
 *   provenance header -> per-item adoption record -> registry metadata -> fail-soft status.
 *
 * Deterministic. No model call, no network. Files that already exist byte-identically are not rewritten.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const REPO = resolve(args.repo ?? "/tmp/untitled-react");
const REF = resolve(".design-compiler/references");
const LIB = "untitledui";
const PAYLOAD = resolve(args.payload ?? "registry/untitledui");
const ALL = process.argv.includes("--all");
const LAYER_FILTER = args.layer ?? null;

const index = JSON.parse(readFileSync(resolve(REF, LIB, "index.json"), "utf8"));
const graph = JSON.parse(readFileSync(resolve(REF, LIB, "graph.json"), "utf8"));
const revisionInfo = JSON.parse(readFileSync(resolve(REF, LIB, "revision.json"), "utf8"));
const byPath = new Map(index.entries.map((e) => [e.path, e]));

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

// ---------------------------------------------------------------- item catalogue
/** The unit of installation is a developer-meaningful item, not a source file. */
const catalogue = [];
for (const entry of index.entries) {
  if (entry.layer === "component" || entry.layer === "component-part") {
    for (const exp of entry.exports) {
      if (!["component", "compound-namespace", "default-component"].includes(exp.kind)) continue;
      if (exp.name === "(default)") continue;
      catalogue.push({
        id: kebab(exp.name),
        title: exp.name,
        export: exp.name,
        path: entry.path,
        kind: entry.kind,
        layer: entry.layer,
        installable: Boolean(entry.publicRegistryCandidate),
        distribution: entry.publicRegistryCandidate ? "public-source" : "closure",
      });
    }
  } else if (entry.layer === "recipe" || entry.layer === "foundation" || entry.layer === "asset" || entry.layer === "helper") {
    const id = kebab(entry.path.split("/").pop().replace(/\.tsx?$/, ""));
    catalogue.push({
      id,
      title: id,
      export: entry.exports.find((e) => e.kind !== "type")?.name ?? null,
      path: entry.path,
      kind: entry.kind,
      layer: entry.layer,
      installable: entry.layer === "recipe" || entry.layer === "foundation",
      distribution: entry.layer === "helper" || entry.layer === "asset" ? "closure" : "public-source",
    });
  }
}

// Disambiguate: the same export name can exist in different files (ModalOverlay appears in both
// modal.tsx and slideout-menu.tsx). A registry id must never silently point at the wrong file.
const pathsById = new Map();
for (const c of catalogue) {
  if (!pathsById.has(c.id)) pathsById.set(c.id, new Set());
  pathsById.get(c.id).add(c.path);
}
const ambiguous = new Map();
for (const [id, paths] of pathsById) if (paths.size > 1) ambiguous.set(id, [...paths].sort());
for (const c of catalogue) {
  if (!ambiguous.has(c.id)) continue;
  const dir = c.path.split("/").slice(0, -1).pop() ?? "";
  c.id = `${c.id}--${kebab(dir)}`;
}
// second pass: two files in the same directory can still collide -> qualify by filename
const afterFirst = new Map();
for (const c of catalogue) {
  if (!afterFirst.has(c.id)) afterFirst.set(c.id, new Set());
  afterFirst.get(c.id).add(c.path);
}
for (const c of catalogue) {
  const paths = afterFirst.get(c.id);
  if (!paths || paths.size < 2) continue;
  const file = c.path.split("/").pop().replace(/\.tsx?$/, "");
  c.id = `${c.id}--${kebab(file)}`;
}

// de-duplicate by id, preferring public registry candidates
const RESERVED_IDS = new Set(["index"]);
const items = new Map();
for (const c of catalogue) {
  if (RESERVED_IDS.has(c.id)) continue; // would collide with registry/index.json
  const existing = items.get(c.id);
  if (!existing || (!existing.installable && c.installable)) items.set(c.id, c);
}
const itemList = [...items.values()];

// ---------------------------------------------------------------- closure resolution
/** a candidate counts only if it is a file: an extension-less match can be a directory. */
const isFile = (p) => {
  try {
    return statSync(resolve(REPO, p)).isFile();
  } catch {
    return false;
  }
};

const resolveInternal = (from, spec) => {
  const candidates = (base) => [base, `${base}.tsx`, `${base}.ts`, `${base}/index.ts`, `${base}/index.tsx`, `${base}.css`].filter(isFile);
  if (spec.startsWith("@/")) return candidates(spec.slice(2)).find((c) => byPath.has(c) || existsSync(resolve(REPO, c))) ?? null;
  if (spec.startsWith(".")) {
    const dir = from.split("/").slice(0, -1).join("/");
    return candidates(resolve("/", dir, spec).slice(1)).find((c) => byPath.has(c) || existsSync(resolve(REPO, c))) ?? null;
  }
  return null;
};

const STYLE_LAYER = ["styles/globals.css", "styles/theme.css", "styles/typography.css"];

const closureOf = (rootPath) => {
  const files = new Set();
  const external = new Set();
  const queue = [rootPath];
  while (queue.length) {
    const path = queue.shift();
    if (files.has(path)) continue;
    files.add(path);
    const abs = resolve(REPO, path);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, "utf8");
    const specs = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).concat([...src.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]));
    for (const spec of specs) {
      const target = resolveInternal(path, spec);
      if (target) queue.push(target);
      else if (!spec.startsWith(".") && !spec.startsWith("@/")) external.add(spec);
    }
  }
  return { files: [...files], external: [...external] };
};

/** Every adopted item depends on the adopted stylesheet layer (the upstream app imports it at the root). */
const styleClosure = STYLE_LAYER.filter((p) => existsSync(resolve(REPO, p)));

const header = (upstreamPath) =>
  [
    `/* Adopted from ${revisionInfo.repository}@${revisionInfo.revision.slice(0, 12)} — ${upstreamPath}`,
    ` * ${revisionInfo.license} licensed upstream source (${revisionInfo.copyright ?? "see upstream LICENSE"}).`,
    ` * Adopted with the smallest necessary project-local transformations; deltas are recorded in`,
    ` * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */`,
    "",
  ].join("\n");

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// ---------------------------------------------------------------- adopt
const adoptedThisRun = new Map(); // upstreamPath -> {destination, sha, copied}
const copiedFiles = [];
const itemRecords = [];
const failures = [];

const copyFile = (upstreamPath) => {
  if (adoptedThisRun.has(upstreamPath)) return adoptedThisRun.get(upstreamPath);
  const abs = resolve(REPO, upstreamPath);
  if (!existsSync(abs)) {
    const rec = { upstreamPath, destination: null, sha: null, copied: false, error: "missing upstream file" };
    adoptedThisRun.set(upstreamPath, rec);
    return rec;
  }
  const source = readFileSync(abs, "utf8");
  const destination = resolve(PAYLOAD, upstreamPath);
  const isCode = /\.(tsx?|css)$/.test(upstreamPath);
  const alreadyHeader = existsSync(destination) && readFileSync(destination, "utf8").includes(`Adopted from ${revisionInfo.repository}@`);
  const content = alreadyHeader ? readFileSync(destination, "utf8") : isCode ? `${header(upstreamPath)}${source}` : source;
  const existing = existsSync(destination) ? readFileSync(destination, "utf8") : null;
  const copied = existing !== content;
  if (copied) {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
    copiedFiles.push(relative(process.cwd(), destination));
  }
  const rec = { upstreamPath, destination: relative(process.cwd(), destination), upstreamSha256: hash(source), sha: hash(content), copied, bytes: Buffer.byteLength(content), kind: byPath.get(upstreamPath)?.kind ?? "UNKNOWN" };
  adoptedThisRun.set(upstreamPath, rec);
  return rec;
};

const layerOrder = graph.dependencyOrder ?? [];
const orderedIds = new Map();
layerOrder.forEach((layer, i) => layer.forEach((p) => orderedIds.set(p, i)));

let queue = ALL ? itemList : (args.items ?? args.item ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((id) => items.get(id) ?? { id, path: null, missing: true });
if (LAYER_FILTER) queue = queue.filter((i) => i.layer === LAYER_FILTER);
if (ALL) {
  queue.sort((a, b) => (orderedIds.get(a.path) ?? 999) - (orderedIds.get(b.path) ?? 999) || a.id.localeCompare(b.id));
}

for (const item of queue) {
  if (!item.path) {
    failures.push({ item: item.id, status: "UNKNOWN_ITEM", reason: "no catalogue entry with this id" });
    continue;
  }
  const { files, external } = closureOf(item.path);
  const styleFiles = item.layer === "component" || item.layer === "component-part" || item.layer === "recipe" ? styleClosure : [];
  const records = [...files, ...styleFiles].map(copyFile);
  const missing = records.filter((r) => r.error);
  const status = missing.length ? "BLOCKED" : records.some((r) => r.copied) ? "SOURCE_ADOPTED" : "SOURCE_ADOPTED_UNCHANGED";
  itemRecords.push({
    $schema: "design-compiler/Adoption@p1",
    item: item.id,
    title: item.title,
    export: item.export,
    layer: item.layer,
    installable: item.installable,
    distribution: item.distribution,
    library: LIB,
    repository: revisionInfo.repository,
    revision: revisionInfo.revision,
    license: revisionInfo.license,
    adopted: true,
    copiedThisRun: records.some((r) => r.copied),
    status,
    closureSize: records.length,
    files: records.filter((r) => !r.error),
    sharedStyleDependencies: styleFiles,
    externalDependencies: [...new Set(external)].sort(),
    transforms: [],
    transformPolicy: "zero rewriting by default: upstream path shape is preserved under the payload root so `@/` aliases resolve; only demonstrated portability defects may add entries here",
  });
  if (missing.length) failures.push({ item: item.id, status: "BLOCKED", reason: `missing upstream files: ${missing.map((m) => m.upstreamPath).join(", ")}` });
  writeFileSync(resolve(REF, LIB, `adoption-${item.id}.json`), JSON.stringify(itemRecords[itemRecords.length - 1], null, 2));
}

const byStatus = itemRecords.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
const report = {
  $schema: "design-compiler/AdoptionRun@p1",
  at: new Date().toISOString(),
  library: LIB,
  repository: revisionInfo.repository,
  revision: revisionInfo.revision,
  mode: ALL ? "all" : "selected",
  itemsRequested: queue.length,
  itemsAdopted: itemRecords.length,
  byStatus,
  byLayer: itemRecords.reduce((a, r) => ({ ...a, [r.layer]: (a[r.layer] ?? 0) + 1 }), {}),
  filesWritten: copiedFiles.length,
  uniqueFilesInPayload: adoptedThisRun.size,
  failures,
  ambiguousExportNames: [...ambiguous.entries()].map(([id, paths]) => ({ exportName: id, paths, disambiguatedTo: paths.map((p) => `${id}--${kebab(p.split("/").slice(0, -1).pop() ?? "")}`) })),
  items: itemRecords.map((r) => ({ item: r.item, layer: r.layer, status: r.status, closureSize: r.closureSize, installable: r.installable })),
};
writeFileSync(resolve(REF, LIB, "adoption-run.json"), JSON.stringify(report, null, 2));

console.log(
  JSON.stringify(
    {
      mode: report.mode,
      itemsAdopted: report.itemsAdopted,
      byStatus,
      byLayer: report.byLayer,
      filesWritten: report.filesWritten,
      uniqueFilesInPayload: report.uniqueFilesInPayload,
      payload: relative(process.cwd(), PAYLOAD),
      failures: failures.slice(0, 10),
      sampleItems: report.items.slice(0, 12).map((i) => `${i.item} (${i.layer}, ${i.closureSize} files)`),
    },
    null,
    2,
  ),
);
process.exit(failures.length ? 1 : 0);
