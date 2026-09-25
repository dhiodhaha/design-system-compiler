#!/usr/bin/env node
/**
 * Persists documentation-scout output into `.design-compiler/base-ui-migration/docs/`.
 *
 *   node compiler/migration/persist-docs.mjs <report.json> [<report.json> ...]
 *
 * Scouts cannot always write repository files, so they return their per-primitive API notes inside the job
 * report — either as fenced ```json blocks or as a `notes[]` array. Both shapes are accepted here. Each note
 * is validated as JSON before it is written; a note that fails to parse is reported (never guessed), and
 * primitive names containing a slash are flattened to `a-b.json` so the directory stays flat.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = ".design-compiler/base-ui-migration/docs";
mkdirSync(OUT, { recursive: true });

const written = [];
const failed = [];

const persist = (note, source) => {
  // a fence may carry an ARRAY of notes (one per primitive)
  if (Array.isArray(note)) {
    for (const item of note) persist(item, source);
    return;
  }
  const rawName = note?.primitive ?? note?.name ?? note?.component ?? note?.path?.split("/").pop()?.replace(/\.json$/, "");
  if (!rawName || typeof note !== "object") {
    failed.push({ source, reason: "no primitive/name key" });
    return;
  }
  const name = String(rawName).replace(/^_/, "").replace(/\//g, "-");
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(note, null, 2));
  written.push(name);
};

for (const path of process.argv.slice(2)) {
  const report = JSON.parse(readFileSync(path, "utf8"));
  const text = typeof report.report === "string" ? report.report : JSON.stringify(report.report ?? "");

  // shape 1: notes[] array (validated directly)
  const notes = report.report?.notes ?? report.notes;
  if (Array.isArray(notes)) for (const note of notes) persist(note, `${path}#notes[]`);

  // shape 2: fenced ```json blocks inside a text report
  for (const match of text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
    try {
      persist(JSON.parse(match[1]), `${path}#fence`);
    } catch (error) {
      failed.push({ source: `${path}#fence`, reason: `invalid JSON: ${error.message.slice(0, 70)}` });
    }
  }

  // shape 3: file-hint + fence pairs ("path/to/<name>.json" then a JSON block)
  const hinted = [...text.matchAll(/([\w./-]+\.json)[^\n]*\n+```json\s*\n([\s\S]*?)\n```/g)];
  for (const [, hint, body] of hinted) {
    try {
      persist(JSON.parse(body), `${path}#hint:${hint}`);
    } catch (error) {
      failed.push({ source: `${path}#hint:${hint}`, reason: `invalid JSON: ${error.message.slice(0, 70)}` });
    }
  }
}

console.log(JSON.stringify({ wrote: written.length, distinct: [...new Set(written)].length, primitives: [...new Set(written)].sort(), failed }, null, 2));
