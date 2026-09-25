#!/usr/bin/env node
/**
 * OSS ↔ Figma crosswalk builder (COVERAGE_STRATEGY.md §8, REFERENCE_LIBRARY.md "Mapping reference → Figma").
 *
 *   node compiler/reference/crosswalk.mjs
 *
 * Deterministic signals only, each recorded as evidence:
 *   S1 exact normalized name            (camelCase-aware, generic container words preserved)
 *   S2 OSS name tokens contained in the Figma family name  ("Input field" ⊃ input)
 *   S3 variant-vocabulary overlap       (Figma axis values ∩ OSS variant table values)
 *   S4 capability overlap               (href/loading/disabled/icon slots vs Figma axes)
 *   S5 directory family agreement       (all candidates from one upstream family directory => merge)
 *
 * Relationship rules:
 *   1 candidate, S1/S2 strong                -> EXACT_OSS_MATCH
 *   candidates in one directory (S5)         -> OSS_COMPONENT_SET_MERGE   (Figma stores it as sets)
 *   candidates across directories            -> OSS_COMPONENT_SPLIT       (one Figma family, many primitives)
 *   no candidate, icon-ish family            -> EXTERNAL_PACKAGE          (official icon packages)
 *   no candidate, composite/large family     -> OSS_COMPOSITION           (recipes/blocks over known parts)
 *   nothing provable                         -> UNRESOLVED / FIGMA_ONLY
 *
 * Name similarity alone never marks a mapping verified.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REF = ".design-compiler/references";
const LIB = "untitledui";
const OSS = JSON.parse(readFileSync(resolve(REF, LIB, "index.json"), "utf8"));
const FIGMA = JSON.parse(readFileSync(resolve(REF, "figma", "figma-surface.json"), "utf8"));

/** camelCase-aware normalization; keeps meaningful words like "group". */
const camelToKebab = (s) => String(s ?? "").replace(/([a-z0-9])([A-Z])/g, "$1-$2");
const norm = (s) =>
  camelToKebab(s)
    .toLowerCase()
    .replace(/^[\s_\-–—]+/, "")
    .replace(/[\s_\-–—]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
/** strip only the container prefix (e.g. "Buttons/") and leading underscores */
/** page names in the PRO file carry decorative prefixes ("      ↳ Content") */
const cleanPage = (n) => String(n ?? "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
const familyBase = (name) => norm(String(name).split("/").pop());
const tokens = (s) => new Set(norm(s).split("-").filter((t) => t && t.length > 1));
const singular = (s) => s.replace(/s$/, "");

const figmaVocab = (family) => {
  const out = new Set();
  for (const axis of Object.values(family.axes ?? {})) for (const v of axis.values ?? []) out.add(norm(v));
  return out;
};

const ossComponents = [];
for (const entry of OSS.entries) {
  // demos/stories/tests document behaviour but are never mapping targets
  if (!entry.publicRegistryCandidate && entry.layer !== "foundation") continue;
  for (const exp of entry.exports) {
    if (!["component", "compound-namespace", "default-component"].includes(exp.kind)) continue;
    if (exp.name === "(default)") continue;
    const comp = entry.components?.find((c) => c.name === exp.name);
    const vocabulary = new Set();
    for (const keys of Object.values(entry.variantVocabulary ?? {})) for (const k of keys) vocabulary.add(norm(k));
    ossComponents.push({
      name: exp.name,
      path: entry.path,
      dir: entry.path.split("/").slice(0, -1).join("/"),
      kind: entry.kind,
      layer: entry.layer,
      publicRegistryCandidate: entry.publicRegistryCandidate,
      vocabulary,
      capabilities: new Set(entry.capabilities ?? []),
      propNames: Object.keys(comp?.props ?? {}).filter((k) => !k.startsWith("(")),
      figmaNames: entry.candidateFigmaNames ?? [],
      nameKeys: new Set([norm(exp.name), ...(entry.candidateFigmaNames ?? []).map(norm)]),
    });
  }
}

const byName = new Map();
for (const c of ossComponents) for (const key of c.nameKeys) {
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(c);
}

/** Icon exports of the official packages: resolved from the installed package builds (deterministic). */
const iconIndex = (() => {
  const out = { "@untitledui/icons": new Map(), "@untitledui/file-icons": new Map() };
  const readDir = (pkg) => {
    const dir = resolve("node_modules", pkg, "dist");
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.endsWith(".d.ts") && f !== "index.d.ts");
  };
  for (const [pkg, map] of Object.entries(out)) {
    for (const file of readDir(pkg)) {
      const name = file.replace(/\.d\.ts$/, "");
      map.set(norm(name), name);
    }
  }
  return out;
})();

/** Persisted vocabulary aliases: design-system wording -> upstream primitive (mapping memory). */
const ALIASES = (() => {
  const path = resolve(REF, LIB, "aliases.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")).aliases ?? {};
})();

const isIconFamily = (key) => /^(icon|misc-icons?|avatar|logo|flag|payment|integration|social|file-type|featured|star|check|cursor|dot|emoji|folder|rating|payment-method|check-item|line-pattern|background|mockup|hand-drawn)/.test(key);
const uniq = (arr) => [...new Map(arr.map((x) => [`${x.path}#${x.name}`, x])).values()];

const mappings = [];
const usedOss = new Set();

for (const family of FIGMA.families ?? []) {
  const name = family.name;
  const base = familyBase(name);
  const fvocab = figmaVocab(family);
  const evidence = [];
  const ftokens = [...tokens(name)].filter((t) => t.length > 2);

  // S1 exact name
  let candidates = uniq([...(byName.get(base) ?? []), ...(byName.get(singular(base)) ?? [])]);
  let signal = candidates.length ? "S1" : null;

  // S2 name containment: every OSS name token appears in the Figma family name
  if (!candidates.length) {
    candidates = uniq(
      ossComponents.filter((c) => {
        const ct = [...tokens(c.name)];
        return ct.length > 0 && ct.every((t) => ftokens.includes(t) || ftokens.includes(singular(t)));
      }),
    );
    if (candidates.length) signal = "S2";
  }

  // S3 variant-vocabulary overlap
  let overlap = [...fvocab].filter((v) => candidates.some((c) => c.vocabulary.has(v)));
  if (!candidates.length) {
    const scored = ossComponents
      .map((c) => ({ c, score: [...fvocab].filter((v) => c.vocabulary.has(v)).length }))
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score);
    if (scored.length) {
      const top = scored[0].score;
      const near = scored.filter((x) => x.score >= Math.max(3, top - 1));
      const dirs = new Set(near.map((x) => x.c.dir));
      const sameSiblings = new Set(near.map((x) => x.c.name));
      // only trust vocabulary alone when it lands on one family directory with a coherent export set
      if (dirs.size === 1 && sameSiblings.size <= 8) {
        candidates = near.map((x) => x.c);
        signal = "S3";
        evidence.push(`variant-vocabulary overlap alone (${top} shared values) in ${[...dirs][0]}`);
      }
    }
    overlap = [...fvocab].filter((v) => candidates.some((c) => c.vocabulary.has(v)));
  }

  // S4 capability overlap
  const caps = new Set();
  if (fvocab.has("loading")) caps.add("loading");
  if (fvocab.has("disabled")) caps.add("disabled");
  if (fvocab.has("hover") || fvocab.has("focused")) caps.add("icon-slots");
  const capOverlap = candidates.length ? [...caps].filter((c) => candidates.some((x) => x.capabilities.has(c))) : [];
  if (capOverlap.length) evidence.push(`capability overlap: ${capOverlap.join(", ")}`);

  // S5 directory agreement
  const dirs = new Set(candidates.map((c) => c.dir));
  let relationship = "UNRESOLVED";
  let code = [];

  if (candidates.length) {
    code = candidates.slice(0, 12).map((c) => ({ source: c.path, export: c.name, layer: c.layer }));
    const dirWord = [...dirs].map((d) => d.split("/").pop()).join("/");
    evidence.push(`signal ${signal}`, `candidates: ${code.map((c) => c.export).join(", ")}`);
    if (overlap.length) evidence.push(`variant vocabulary overlap (${overlap.length}): ${overlap.slice(0, 6).join(", ")}`);
    if (candidates.length === 1) {
      relationship = "EXACT_OSS_MATCH";
    } else if (dirs.size === 1) {
      relationship = "OSS_COMPONENT_SET_MERGE";
      evidence.push(`all candidates live in one upstream family directory (${dirWord})`);
    } else {
      relationship = "OSS_COMPONENT_SPLIT";
      evidence.push(`candidates span directories: ${[...dirs].join(", ")}`);
    }
  } else {
    // icon families resolve to the official packages by name, on any page they appear
    const iconHit =
      iconIndex["@untitledui/icons"].get(base) ?? iconIndex["@untitledui/icons"].get(singular(base)) ?? iconIndex["@untitledui/file-icons"].get(base);
    const iconPage = /^(icons|misc icons|logos|background elements|miscellaneous assets|design annotations|content)$/i.test(cleanPage(family.page));
    if (iconHit) {
      relationship = "EXTERNAL_PACKAGE";
      code = [{ source: `@untitledui/icons (installed package)`, export: iconHit, layer: "external-package" }];
      evidence.push(`Figma family "${name}" resolves to the installed @untitledui/icons export \`${iconHit}\` by normalized name`);
    } else if (iconPage || isIconFamily(base)) {
      relationship = "EXTERNAL_PACKAGE";
      evidence.push(`icon/asset page "${family.page}" family with no matching installed icon export`);
    } else if ((family.variantCount ?? 0) >= 20) {
      relationship = "OSS_COMPOSITION";
      evidence.push(`large composite family (${family.variantCount} variants) with no single OSS primitive; expected to compose verified components`);
    } else {
      relationship = "FIGMA_ONLY";
      evidence.push("no OSS component matched by name, tokens or vocabulary");
    }
  }
  // Axis-value expansion, strict: only an axis value that *exactly* names another OSS primitive adds a
  // second code target (e.g. Type="Payment input" -> PaymentInput). Values that merely sound like UI
  // (Modal Type="payment"/"2FA"/"invite"...) are recipes/compositions over known components, so they are
  // recorded as recipe candidates instead of inventing code targets or a giant union prop.
  if (candidates.length) {
    const axisFindings = [];
    const recipeValues = [];
    const GENERIC = new Set(["default", "true", "false", "none", "hover", "focused", "disabled", "loading", "false", "yes", "no", "light", "dark", "sm", "md", "lg", "xl", "xs"]);
    for (const [axisName, axis] of Object.entries(family.axes ?? {})) {
      for (const value of axis.values ?? []) {
        const vkey = norm(value);
        if (!vkey || vkey.length < 3 || GENERIC.has(vkey)) continue;
        // an axis value that is just this component's own variant vocabulary is not a recipe or a target
        if (candidates.some((c) => c.vocabulary.has(vkey))) continue;
        const aliasTargets = (ALIASES[vkey] ?? []).flatMap((exportName) => ossComponents.filter((c) => c.name === exportName));
        const hit = uniq([...(byName.get(vkey) ?? []), ...(byName.get(singular(vkey)) ?? []), ...aliasTargets]).filter(
          (c) => !code.some((x) => x.source === c.path && x.export === c.name),
        );
        if (hit.length) {
          for (const c of hit.slice(0, 2)) {
            axisFindings.push({ axis: axisName, value, export: c.name, source: c.path, via: aliasTargets.includes(c) ? "alias" : "name" });
            code.push({ source: c.path, export: c.name, layer: c.layer });
          }
        } else {
          recipeValues.push({ axis: axisName, value });
        }
      }
    }
    if (axisFindings.length) {
      relationship = "OSS_COMPONENT_SPLIT";
      evidence.push(...axisFindings.slice(0, 6).map((f) => `axis ${f.axis}="${f.value}" -> ${f.export}`));
    }
    // recipe values only reshape the relationship when there is no exact primitive: an EXACT/MERGE/SPLIT
    // family keeps its relationship and simply carries recipe candidates alongside.
    if (recipeValues.length >= 5 && relationship === "EXACT_OSS_MATCH" && signal !== "S1" && candidates.length === 1 && !axisFindings.length) {
      relationship = "OSS_COMPOSITION";
      evidence.push(`${recipeValues.length} axis values (e.g. ${recipeValues.slice(0, 4).map((r) => `${r.axis}="${r.value}"`).join(", ")}) describe recipes/compositions over ${candidates[0].name}, not new primitives`);
    } else if (recipeValues.length) {
      evidence.push(`${recipeValues.length} axis values are recipe/composition inputs, not primitives`);
    }
    family.recipeCandidates = recipeValues;
  }

  // "_"-prefixed Figma families are internal parts of a family, not separate public components
  if (name.startsWith("_") && candidates.length) {
    relationship = "OSS_COMPONENT_SET_MERGE";
    evidence.push("underscore-prefixed Figma family: internal part of the matched family");
  }

  for (const c of code) usedOss.add(`${c.source}#${c.export}`);
  mappings.push({
    figma: { componentSetId: family.id, name, page: family.page, variants: family.variantCount ?? 0, axes: family.axes ?? null },
    recipeCandidates: family.recipeCandidates ?? undefined,
    code,
    relationship,
    evidence,
    verified: relationship === "EXACT_OSS_MATCH" && Boolean(signal),
  });
}

const allOss = ossComponents.filter((c) => c.publicRegistryCandidate);
const unmappedOss = allOss
  .filter((c) => !usedOss.has(`${c.path}#${c.name}`))
  .map((c) => ({ source: c.path, export: c.name, kind: c.kind, layer: c.layer, figmaNames: c.figmaNames }));

const byRelationship = mappings.reduce((a, m) => ({ ...a, [m.relationship]: (a[m.relationship] ?? 0) + 1 }), {});
writeFileSync(
  resolve(REF, LIB, "crosswalk.json"),
  JSON.stringify({ $schema: "design-compiler/Crosswalk@p0", library: LIB, revision: OSS.revision, figmaFile: FIGMA.fileKey, totals: { figmaFamilies: mappings.length, ossComponents: allOss.length, byRelationship, verified: mappings.filter((m) => m.verified).length }, mappings }, null, 2),
);
writeFileSync(
  resolve(REF, LIB, "gaps.json"),
  JSON.stringify(
    {
      $schema: "design-compiler/Gaps@p0",
      library: LIB,
      figmaFile: FIGMA.fileKey,
      figmaOnly: mappings.filter((m) => m.relationship === "FIGMA_ONLY").map((m) => ({ id: m.figma.componentSetId, name: m.figma.name, page: m.figma.page, variants: m.figma.variants })),
      compositionCandidates: mappings.filter((m) => m.relationship === "OSS_COMPOSITION").map((m) => ({ id: m.figma.componentSetId, name: m.figma.name, page: m.figma.page, variants: m.figma.variants })),
      externalPackage: mappings.filter((m) => m.relationship === "EXTERNAL_PACKAGE").map((m) => ({ id: m.figma.componentSetId, name: m.figma.name, page: m.figma.page, variants: m.figma.variants })),
      unresolved: mappings.filter((m) => m.relationship === "UNRESOLVED").map((m) => ({ id: m.figma.componentSetId, name: m.figma.name, page: m.figma.page, variants: m.figma.variants })),
      ossWithoutFigmaFamily: unmappedOss,
      notes: [
        "absence from the current PRO STYLES v8.0 file is NOT_PRESENT_IN_CURRENT_FIGMA_FILE, never 'does not exist in Figma'",
        "OSS components with no Figma family here are typical application components that this file does not contain",
      ],
    },
    null,
    2,
  ),
);

const example = (re) => mappings.filter((m) => re.test(m.figma.name)).map((m) => `${m.figma.name} (${m.figma.variants}) -> ${m.relationship} -> ${[...new Set(m.code.map((c) => c.export))].join("+") || "-"}`);
console.log(JSON.stringify({ figmaFamilies: mappings.length, ossComponents: allOss.length, byRelationship, verified: mappings.filter((m) => m.verified).length, button: example(/buttons?\//i), input: example(/input/i), tooltip: example(/tooltip/i), modal: example(/^_?Modal/i), badge: example(/badge/i), select: example(/select|dropdown|combobox/i), ossWithoutFigmaFamily: unmappedOss.length }, null, 2));
