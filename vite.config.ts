import { fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Framework-agnostic DS dev harness (Vite React). No Next/TanStack imports anywhere in src/components.
export default defineConfig({
  // upstream adopted sources import through `@/...` exactly as in the reference repository.
  // Resolution order: the adopted payload first (canonical source), then the app's own src/.
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "payload-first-@-alias",
      enforce: "pre",
      resolveId(source) {
        if (!source.startsWith("@/")) return null;
        const payload = fileURLToPath(new URL(`./registry/untitledui/${source.slice(2)}`, import.meta.url));
        // files only: returning a directory resolved in dev but broke the production build
        for (const candidate of [`${payload}.tsx`, `${payload}.ts`, `${payload}/index.tsx`, `${payload}/index.ts`]) {
          if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
        }
        return null; // fall through to the `@` -> src alias below
      },
    } satisfies Plugin,
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: { index: "index.html", specimen: "specimen.html", grid: "grid.html", behavior: "behavior.html", adopted: "adopted.html", parity: "parity.html", pro: "pro.html", catalog: "catalog.html", migration: "migration.html", hydration: "hydration.html" },
    },
  },
});
