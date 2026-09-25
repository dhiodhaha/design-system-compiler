import puppeteer from "puppeteer-core";
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const page = await browser.newPage();
await page.goto("file:///tmp/slidercheck/page.html");
const out = await page.evaluate(() => {
  const describe = (el) => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, position: cs.position, margin: cs.margin, padding: cs.padding, borderRadius: cs.borderRadius, fontSize: cs.fontSize, display: cs.display, offsetParentNull: el.offsetParent === null };
  };
  return {
    racInput: describe(document.getElementById("rac-input")),
    racThumb: describe(document.getElementById("rac-thumb")),
    buiInput: describe(document.getElementById("bui-input")),
    buiInputFixed: describe(document.getElementById("bui-input-fixed")),
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
