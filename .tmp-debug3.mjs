import puppeteer from "puppeteer-core";
const CHROME = "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1400 });
await page.goto("http://127.0.0.1:5199/tmp-verify.html", { waitUntil: "networkidle0" });
const out = await page.evaluate(() => {
  const section = document.querySelector('[data-case="tags-render"]');
  const grid = section.querySelector('[role="grid"]');
  const rows = [...section.querySelectorAll('[role="row"]')];
  const seen = [];
  document.addEventListener("keydown", (e) => seen.push(`${e.key}@${e.target.textContent?.trim().slice(0, 6)}`), true);
  rows[0].focus();
  const ev = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
  const dispatched = rows[0].dispatchEvent(ev);
  return {
    seen,
    dispatched,
    defaultPrevented: ev.defaultPrevented,
    focusedAfter: document.activeElement?.textContent?.trim(),
    rowTabIndexes: rows.map((r) => r.getAttribute("tabindex")),
    gridProps: { role: grid.getAttribute("role"), ti: grid.getAttribute("tabindex"), label: grid.getAttribute("aria-label") },
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
