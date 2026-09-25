import puppeteer from "puppeteer-core";
const CHROME = "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1400 });
await page.goto("http://127.0.0.1:5199/tmp-verify.html", { waitUntil: "networkidle0" });
const out = {};

// tags keyboard: focus first row, ArrowRight moves to second, Delete removes (rendered with a handler)
out.tagsKeyboard = await page.evaluate(() => {
  const section = document.querySelector('[data-case="tags-render"]');
  const rows = [...section.querySelectorAll('[role="row"]')];
  rows[0].focus();
  const focusBefore = document.activeElement.textContent.trim();
  return { focusBefore, rowCount: rows.length, gridcellDisplay: getComputedStyle(section.querySelector('[role="gridcell"]')).display, gridRole: section.querySelector('[role="grid"]')?.getAttribute("role"), gridLabel: section.querySelector('[role="grid"]')?.getAttribute("aria-label") };
});
await page.keyboard.press("ArrowRight");
out.tagsAfterArrowRight = await page.evaluate(() => document.activeElement?.textContent?.trim());

// tabs: manual activation then Enter selects
await page.evaluate(() => document.querySelector('[data-case="tabs-default"] [role="tab"]').focus());
await page.keyboard.press("ArrowRight");
out.tabs = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')];
  return { focused: document.activeElement?.textContent?.trim(), selected: tabs.filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.textContent.trim()), panel: document.querySelector('[data-case="tabs-default"] [role="tabpanel"]')?.textContent };
});
await page.keyboard.press("Enter");
out.tabsAfterEnter = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[data-case="tabs-default"] [role="tab"]')];
  return { selected: tabs.filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.textContent.trim()), panel: document.querySelector('[data-case="tabs-default"] [role="tabpanel"]')?.textContent, tabIndexes: tabs.map((t) => t.getAttribute("tabindex")) };
});

// slider: fill width and thumb position for value 30/100
out.slider = await page.evaluate(() => {
  const section = document.querySelector('[data-case="slider-default"]');
  const spans = [...section.querySelectorAll('span')].map((s) => ({ cls: s.className.split(" ").slice(0, 2).join(" "), style: s.getAttribute("style"), rect: s.getBoundingClientRect().width }));
  const thumb = section.querySelector('[data-index]');
  return { spans, thumbLeft: thumb?.getBoundingClientRect().x, rootRole: section.querySelector('[role="group"]')?.getAttribute("role"), valuetext: section.querySelector('input[type="range"]')?.getAttribute("aria-valuetext") };
});
// slider keyboard on the second case
await page.evaluate(() => document.querySelector('[data-case="slider-keyboard"] input[type=range]').focus());
await page.keyboard.press("ArrowRight");
out.sliderKeyboard = await page.evaluate(() => document.querySelector('[data-case="slider-keyboard"] input[type=range]').value);

// input-tags: add two tags, remove the last with the close button, check the grid + aria-live
await page.type('[data-case="input-tags"] input', "beta", { delay: 10 });
await page.keyboard.press("Enter");
out.inputTags = await page.evaluate(() => {
  const section = document.querySelector('[data-case="input-tags"]');
  const rows = [...section.querySelectorAll('[role="row"]')];
  const grid = section.querySelector('[role="grid"]');
  return {
    rows: rows.map((r) => r.textContent.trim()),
    grid: !!grid,
    live: grid?.getAttribute("aria-live"),
    rowTabIndexes: rows.map((r) => r.getAttribute("tabindex")),
    closeButtons: section.querySelectorAll('[role="row"] button').length,
  };
});
// backspace in an empty input focuses the last tag; Delete removes it
await page.evaluate(() => document.querySelector('[data-case="input-tags"] input').focus());
await page.keyboard.press("Backspace");
out.inputTagsAfterBackspace = await page.evaluate(() => document.activeElement?.textContent?.trim());
await page.keyboard.press("Delete");
out.inputTagsAfterDelete = await page.evaluate(() => [...document.querySelectorAll('[data-case="input-tags"] [role="row"]')].map((r) => r.textContent.trim()));

// input-number: label association + stepper semantics
out.inputNumber = await page.evaluate(() => {
  const section = document.querySelector('[data-case="input-number"]');
  const label = section.querySelector("label");
  const input = section.querySelector("input:not([type=number])");
  const hidden = section.querySelector("input[type=number]");
  const buttons = [...section.querySelectorAll("button")];
  return {
    htmlFor: label?.getAttribute("for"),
    inputId: input?.id,
    labelledby: input?.getAttribute("aria-labelledby"),
    hiddenInput: hidden ? { name: hidden.getAttribute("name"), tabIndex: hidden.getAttribute("tabindex"), ariaHidden: hidden.getAttribute("aria-hidden") } : null,
    buttons: buttons.map((b) => ({ label: b.getAttribute("aria-label"), tabIndex: b.getAttribute("tabindex") })),
    value: input?.value,
  };
});
// increment via the stepper button
await page.click('[data-case="input-number"] button[aria-label="Increase"]');
out.inputNumberAfterClick = await page.evaluate(() => document.querySelector('[data-case="input-number"] input:not([type=number])').value);

// payment: sanitised onChange
out.payment = await page.evaluate(() => {
  const section = document.querySelector('[data-case="input-payment"]');
  return { value: section.querySelector("input").value, inputMode: section.querySelector("input").getAttribute("inputmode"), maxLength: section.querySelector("input").getAttribute("maxlength") };
});

// file-upload: child click opens the native dialog (spy on input.click)
out.fileUpload = await page.evaluate(() => {
  const section = document.querySelector('[data-case="file-upload"]');
  const input = section.querySelector('input[type=file]');
  let clicked = 0;
  input.click = () => { clicked += 1; };
  section.querySelector("button").click();
  return { accept: input.getAttribute("accept"), multiple: input.multiple, display: getComputedStyle(input).display, clicked, childTag: section.querySelector("button")?.tagName, inputTabIndex: input.getAttribute("tabindex") };
});

// form: submit through Base UI's Form
out.form = await page.evaluate(() => {
  const section = document.querySelector('[data-case="form-submit"]');
  const form = section.querySelector("form");
  return { noValidate: form.getAttribute("novalidate"), onSubmitAttr: typeof form.onsubmit, inputName: section.querySelector("input").getAttribute("name"), inputId: section.querySelector("input").id, labelFor: section.querySelector("label")?.getAttribute("for") };
});
await browser.close();
console.log(JSON.stringify(out, null, 1));
