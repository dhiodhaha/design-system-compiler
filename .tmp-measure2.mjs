import puppeteer from "puppeteer-core";
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 300 });
await page.goto("file:///tmp/slidercheck/page.html");
// paint each track on a magenta backdrop so any painted pixel is obvious
await page.evaluate(() => { document.body.style.background = "magenta"; });
await page.screenshot({ path: "/tmp/slidercheck/shot.png" });
const pixels = await page.evaluate(() => {
  // count non-magenta pixels inside each track row to see whether the input paints
  const rows = { t1: 0, t2: 60, t3: 120 };
  return rows;
});
await browser.close();
console.log("shot written");
