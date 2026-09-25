import puppeteer from "puppeteer-core";
const CHROME = "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1400 });
await page.goto("http://127.0.0.1:5199/tmp-verify.html", { waitUntil: "networkidle0" });
const snap = () => page.evaluate(() => ({
  active: document.activeElement?.textContent?.trim(),
  rows: [...document.querySelectorAll('[data-case="tags-render"] [role="row"]')].map((r) => ({ t: r.textContent.trim(), ti: r.getAttribute("tabindex"), key: r.getAttribute("data-tag-key"), ariaDisabled: r.getAttribute("aria-disabled") })),
}));
await page.evaluate(() => document.querySelector('[data-case="tags-render"] [role="row"]').focus());
await new Promise((r) => setTimeout(r, 300));
const a = await snap();
await page.keyboard.press("ArrowRight");
await new Promise((r) => setTimeout(r, 300));
const b = await snap();
await page.keyboard.press("Delete");
await new Promise((r) => setTimeout(r, 300));
const c = await snap();
console.log(JSON.stringify({ afterFocus: a, afterArrowRight: b, afterDelete: c }, null, 1));
await browser.close();
