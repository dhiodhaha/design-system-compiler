import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Framework-agnostic DS dev harness (Vite React). No Next/TanStack imports anywhere in src/components.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // upstream adopted sources import through `@/...` exactly as in the reference repository
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: { index: "index.html", specimen: "specimen.html", grid: "grid.html", behavior: "behavior.html", adopted: "adopted.html", parity: "parity.html" },
    },
  },
});
