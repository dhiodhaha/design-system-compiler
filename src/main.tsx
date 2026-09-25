import { createRoot } from "react-dom/client";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <main className="p-8">
    <h1 className="text-lg font-semibold text-neutral-900">DS Compiler P0</h1>
    <p className="mt-2 text-sm text-neutral-600">
      Button slicing harness. Open <a className="underline" href="/specimen.html">/specimen.html</a> for the golden
      specimen.
    </p>
  </main>,
);
