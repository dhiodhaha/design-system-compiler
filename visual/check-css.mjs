#!/usr/bin/env node
/**
 * Generated CSS validity gate — ROADMAP P1: "no invalid generated CSS".
 *
 *   node visual/check-css.mjs
 *
 * A stylesheet that parses is not automatically correct, but a stylesheet that does *not* parse is
 * silently dropped by browsers, which shows up later as an unexplained visual regression. This gate
 * fails the pipeline on parse errors, empty selectors, unknown properties and detached declarations.
 */
import { readFileSync } from "node:fs";
import * as csstree from "css-tree";

const targets = ["src/styles/button.theme.css", "src/styles/tokens.css"];
const report = { files: {}, status: "PASS", failures: [] };

for (const file of targets) {
  const css = readFileSync(file, "utf8");
  const parseErrors = [];
  const ast = csstree.parse(css, { positions: true, onParseError: (e) => parseErrors.push({ message: e.message, line: e.line, column: e.column }) });

  const emptySelectors = [];
  const unknownProperties = [];
  const detachedDeclarations = [];
  let declarations = 0;
  let rules = 0;

  csstree.walk(ast, {
    visit: "Rule",
    enter(node) {
      rules++;
      const prelude = csstree.generate(node.prelude).trim();
      if (!prelude) emptySelectors.push({ line: node.loc?.start.line ?? null, prelude });
    },
  });
  csstree.walk(ast, {
    visit: "Declaration",
    enter(node) {
      declarations++;
      const property = node.property;
      if (property.startsWith("--")) return; // custom properties are intentionally unvalidated
      // var() cannot be validated at parse time (it resolves at computed-value time).
      if (/var\(/.test(csstree.generate(node.value))) return;
      const unprefixed = property.replace(/^-\w+-/, "");
      // descriptors css-tree's property table does not carry, but browsers do
      const DESCRIPTOR_ALLOWLIST = new Set(["font-display", "src", "d", "mask-image", "mask-clip", "mask-composite"]);
      if (DESCRIPTOR_ALLOWLIST.has(unprefixed)) return;
      const known = csstree.lexer.getProperty(unprefixed);
      if (!known) unknownProperties.push(property);
      else if (csstree.lexer.matchProperty(unprefixed, node.value).matched === null) {
        // value does not match the grammar: browsers keep the declaration but drop invalid values
        detachedDeclarations.push(property);
      }
    },
  });

  report.files[file] = {
    rules,
    declarations,
    parseErrors,
    emptySelectors,
    unknownProperties: [...new Set(unknownProperties)],
    invalidValues: [...new Set(detachedDeclarations)],
  };
  for (const [kind, list] of Object.entries({ parseErrors, emptySelectors, unknownProperties, invalidValues: detachedDeclarations })) {
    if (list.length) report.failures.push(`${file}: ${kind} (${list.length})`, ...list.slice(0, 3).map((x) => `  ${JSON.stringify(x)}`));
  }
}

report.status = report.failures.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === "PASS" ? 0 : 1);
