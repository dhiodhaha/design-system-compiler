import { createRoot } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { CASES } from "./migration-harness";
import "../registry/untitledui/styles/globals.css";
import "./styles/fonts.css";

/**
 * Hydration smoke for the migration: the same cases are rendered with `renderToString`, injected as real
 * server HTML, then hydrated in place. React reports mismatches through console.error/warn, so the report
 * captures those rather than trusting that "it rendered".
 *
 * This runs both halves in the browser (there is no Node SSR server in this project); it therefore proves
 * hydration agreement between the server render of the case tree and its client render — not a network-level
 * SSR pipeline.
 */
declare global {
  interface Window {
    __hydration?: { hydrated: boolean; mismatches: string[]; caseCount: number; ssrBytes: number; error?: string };
  }
}

const tree = (
  <div className="bg-primary p-8">
    {CASES.map((testCase) => (
      <section key={testCase.id} data-case={testCase.id} data-unit={testCase.unit} className="mb-6 border-b border-secondary pb-6">
        <p data-case-label className="mb-2 font-mono text-xs text-tertiary">
          {testCase.id}
        </p>
        <div data-case-body>{testCase.node}</div>
      </section>
    ))}
  </div>
);

const host = document.getElementById("hydration");
if (host) {
  const mismatches: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  const record = (args: unknown[]) => {
    const text = args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    if (/hydrat|did not match|server rendered|mismatch/i.test(text)) mismatches.push(text.slice(0, 400));
  };
  console.error = (...args: unknown[]) => (record(args), originalError(...args));
  console.warn = (...args: unknown[]) => (record(args), originalWarn(...args));

  let ssrBytes = 0;
  try {
    const html = renderToString(tree);
    ssrBytes = html.length;
    host.innerHTML = html;
    hydrateRoot(host, tree, {
      onRecoverableError: (error: unknown) => mismatches.push(`recoverable: ${error instanceof Error ? error.message : String(error)}`.slice(0, 400)),
    });
    window.__hydration = { hydrated: true, mismatches, caseCount: CASES.length, ssrBytes };
  } catch (error) {
    window.__hydration = { hydrated: false, mismatches, caseCount: CASES.length, ssrBytes, error: error instanceof Error ? error.message : String(error) };
  }

  // a second root that renders case errors visibly if hydration blew the tree away
  const probe = document.createElement("div");
  probe.id = "hydration-probe";
  document.body.appendChild(probe);
  createRoot(probe);
}
