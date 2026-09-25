import puppeteer from "puppeteer-core";
const CHROME = "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1400 });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
await page.goto("http://127.0.0.1:5199/tmp-verify.html", { waitUntil: "networkidle0" });
const out = {};

// instrument: did the grid keydown handler run and what did focusTag see?
out.tagsArrow = await page.evaluate(() => {
  const section = document.querySelector('[data-case="tags-render"]');
  const grid = section.querySelector('[role="grid"]');
  const rows = [...section.querySelectorAll('[role="row"]')];
  const events = [];
  grid.addEventListener("keydown", (e) => events.push(`grid saw ${e.key}`), true);
  rows[0].focus();
  window.__focus = () => document.activeElement?.textContent?.trim();
  return { before: window.__focus(), gridTabIndex: grid.getAttribute("tabindex"), rows: rows.map((r) => ({ t: r.textContent.trim(), ti: r.getAttribute("tabindex") })) };
});
await page.keyboard.press("ArrowRight");
out.afterArrow = await page.evaluate(() => ({ focused: window.__focus(), rows: [...document.querySelectorAll('[data-case="tags-render"] [role="row"]')].map((r) => r.getAttribute("tabindex")) }));

// tabs: click vs Enter vs Space
out.tabsClick = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')];
  tabs[1].click();
  return tabs.map((t) => t.getAttribute("aria-selected"));
});
out.tabsStateAfterClick = await page.evaluate(() => ({
  selected: [...document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')].filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.textContent.trim()),
  panel: document.querySelector('[data-case="tabs-default"] [role="tabpanel"]')?.textContent,
  styledSelected: [...document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')].map((t) => t.className.includes("bg-brand-primary_alt")),
}));
await page.evaluate(() => document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')[2].focus());
await page.keyboard.press("Enter");
out.tabsAfterEnter = await page.evaluate(() => ({
  selected: [...document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')].filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.textContent.trim()),
  focused: document.activeElement?.textContent?.trim(),
}));
await page.keyboard.press("Space");
out.tabsAfterSpace = await page.evaluate(() => [...document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')].filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.textContent.trim()));
await browser.close();
console.log(JSON.stringify(out, null, 1));
