// End-to-end regression suite: loads the real unpacked extension into a
// throwaway headless Chrome profile and checks every site behavior we rely on.
//   node tests/e2e/run.mjs            (set CHROME_PATH if Chrome isn't found)
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// EXT_PATH lets the suite run against an unzipped release instead of the source tree.
const EXT = process.env.EXT_PATH ? resolve(process.env.EXT_PATH) : resolve(here, "..", "..");
const SITE = join(here, "site");
mkdirSync(join(EXT,"dist"),{recursive:true});
const CHROME = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium"
].find(existsSync);
if (!CHROME) { console.error("Chrome not found; set CHROME_PATH"); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lum = (rgb) => {
  const [r, g, b] = (rgb.match(/[\d.]+/g) || []).slice(0, 3).map((v) => { const c = +v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
};

// Test site; /slow.js stalls so a page can be observed mid-load.
const server = http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/slow.js") { setTimeout(() => { res.writeHead(200, { "content-type": "text/javascript" }); res.end("1"); }, 3000); return; }
  if (path === "/rows.html") {
    let rows = "";
    for (let i = 0; i < 2500; i++) rows += `<div class="row"><span class="c"><b>Sender ${i}</b></span><span class="c">Subject ${i}</span><span class="c">snippet</span></div>`;
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><html><head><style>body{background:#fff;color:#202124}.row{display:flex;background:#fff;border-bottom:1px solid #eee}.row.hl{background:#f2f6fc}.c{padding:2px 6px;color:#5f6368}</style></head><body><div id="list">${rows}</div></body></html>`);
    return;
  }
  try { const body = readFileSync(join(SITE, path)); res.writeHead(200, { "content-type": path.endsWith('.svg') ? "image/svg+xml" : "text/html" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const site = (host, file) => `http://${host}:${port}/${file}`;

const profile = mkdtempSync(join(tmpdir(), "oled-night-e2e-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-pipe", "--enable-unsafe-extension-debugging", `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--window-size=1000,800",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "about:blank"], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
const toChrome = chrome.stdio[3], fromChrome = chrome.stdio[4];
let nextId = 0, buffer = "";
const pending = new Map();
const exceptions = [];
fromChrome.on("data", (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf("\0")) >= 0) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id) pending.get(message.id)?.(message);
    else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
  }
});
const send = (method, params = {}, sessionId) => new Promise((r) => { const id = ++nextId; pending.set(id, r); toChrome.write(JSON.stringify({ id, method, params, sessionId }) + "\0"); });

async function openTab(url, background = false) {
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank", background });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  const tab = {
    sessionId, targetId,
    eval: async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "evaluation failed");
      return r.result?.result?.value;
    },
    go: async (to, wait = 1500) => { await send("Page.navigate", { url: to }, sessionId); await sleep(wait); }
  };
  if (url) await tab.go(url);
  return tab;
}

let failures = 0, passes = 0;
function check(name, ok, detail = "") {
  if (ok) passes++; else failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

try {
  const loaded = await send("Extensions.loadUnpacked", { path: EXT });
  const extId = loaded.result?.id;
  check("extension loads", !!extId, loaded.error?.message || "");
  if (!extId) throw new Error("cannot continue without the extension");

  const ext = await openTab(`chrome-extension://${extId}/options.html`);
  const setSettings = (patch) => ext.eval(`chrome.storage.sync.set(${JSON.stringify(patch)}).then(() => true)`);
  const resetSettings = () => ext.eval("chrome.storage.sync.clear().then(() => true)");
  check("options page renders", (await ext.eval("document.querySelectorAll('#newMode option').length")) === 5);

  check("Chrome options retain theme controls", await ext.eval("!document.getElementById('getTheme').closest('section').hidden && document.getElementById('shortcutHelp').hidden"));

  const page = await openTab();
  const css = (id, prop, pseudo) => page.eval(`getComputedStyle(document.getElementById(${JSON.stringify(id)})${pseudo ? `, ${JSON.stringify(pseudo)}` : ""})[${JSON.stringify(prop)}]`);

  // Light page: recolor, text emphasis, icons, borders, tints, frames, streaming.
  await page.go(site("127.0.0.1", "light.html"), 1800);
  check("version stamped", (await page.eval("document.documentElement.dataset.oledNightVersion")) === JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8")).version);
  check("page background black", (await page.eval("getComputedStyle(document.body).backgroundColor")) === "rgb(0, 0, 0)");
  const [primary, secondary, muted] = await Promise.all(["primary", "secondary", "muted"].map((id) => css(id, "color")));
  check("text keeps primary > secondary > muted", lum(primary) > lum(secondary) && lum(secondary) > lum(muted) && lum(muted) > 0.1, `${primary} / ${secondary} / ${muted}`);
  const underline = await css("tab", "borderBottomColor");
  check("colored border keeps its hue", /rgb\((\d+), (\d+), (\d+)\)/.test(underline) && +underline.match(/\d+/g)[2] > +underline.match(/\d+/g)[0] + 60, underline);
  check("dark icon becomes light", lum(await css("iconpath", "fill")) > 0.5);
  check("colored icon unchanged", (await css("bluecircle", "fill")) === "rgb(26, 115, 232)");
  check("pale tints become dark", lum(await css("info", "backgroundColor")) < 0.03 && lum(await css("alert", "backgroundColor")) < 0.03);
  check("button label is primary", lum(await css("btn", "color")) > 0.6);
  check("streamed text matches existing text", (await css("streamed", "color")) === (await css("first", "color")));
  const frame = await page.eval("(() => { const d = document.getElementById('frame').contentDocument; return { bg: getComputedStyle(d.body).backgroundColor, text: getComputedStyle(d.getElementById('w')).color }; })()");
  check("iframe content darkened", frame.bg === "rgb(0, 0, 0)" && lum(frame.text) > 0.5, JSON.stringify(frame));
  const report = await ext.eval(`(async () => { const [t] = await chrome.tabs.query({ url: "${site("127.0.0.1", "light.html")}" }); return chrome.tabs.sendMessage(t.id, { type: "oled-night-report" }); })()`);
  check("diagnostic report", report?.active === true && Array.isArray(report.lowContrast) && report.counts.styled > 10, `styled=${report?.counts?.styled} lowContrast=${report?.lowContrast?.length}`);
  check("report lists frames", Array.isArray(report?.frames) && report.frames.length === 1 && report.frames[0].darkened === true, JSON.stringify(report?.frames));
  check("report finds no unreadable text", report?.lowContrast?.length === 0, JSON.stringify(report?.lowContrast?.slice(0, 3)));

  await page.go(site("127.0.0.1", "report-fields.html"));
  const fieldReport=await ext.eval(`(async()=>{const [t]=await chrome.tabs.query({url:"${site("127.0.0.1", "report-fields.html")}"});return chrome.tabs.sendMessage(t.id,{type:'oled-night-report'});})()`);
  check('reports diagnose field text-fill contrast without field contents', fieldReport.lowContrast.filter(e=>e.element.includes('private')).length===4 && !JSON.stringify(fieldReport).includes('SENTINEL') && !fieldReport.lowContrast.some(e=>e.element.includes('transparentIcon')));

  // Gmail profile: unread vs read rows stay distinguishable on black.
  await page.go(site("127.0.0.1", "gmail.html"), 1800);
  const unreadText = await css("unreadSubject", "color"), readText = await css("readSubject", "color");
  check("gmail: unread text brighter than read", lum(unreadText) > lum(readText) * 1.8 && lum(readText) > 0.1, `${unreadText} vs ${readText}`);
  check("gmail: unread rows get an accent bar", (await css("unread", "boxShadow")).includes("inset") && (await css("read", "boxShadow")) === "none");

  // Site CSS reproduced from Apple's auth widget and RES on dark Reddit.
  check("gmail: trimmed-content ellipsis visible", (await css("ellipsis", "filter")).includes("invert(1)") && (await css("ellipsis", "opacity")) === "0.85");
  check("gmail: cross-origin logo gains edge without inversion", (await css("mailLogo", "filter")).includes("drop-shadow") && !(await css("mailLogo", "filter")).includes("invert"));
  check("gmail: other remote images untouched", (await css("mailPhoto", "filter")) === "none");
  await setSettings({globalEnabled:false}); await sleep(400);
  check("gmail: disabling restores images", (await css("mailLogo", "filter")) === "none" && (await css("ellipsis", "filter")) === "none");
  await resetSettings();

  await page.go(site("127.0.0.1", "apple-auth.html"), 1800);
  check("Apple: text-fill and password dots readable", lum(await css("email", "webkitTextFillColor")) > 0.5 && lum(await css("password", "webkitTextFillColor")) > 0.5);
  check("Apple: pale autofill shadow replaced with black", (await css("email", "boxShadow")).startsWith("rgb(0, 0, 0)") && (await css("email", "backgroundColor")) === "rgb(0, 0, 0)");
  await page.eval("document.getElementById('password').focus()");
  check("Apple: focus keeps black fill and visible outline", (await css("password", "boxShadow")).startsWith("rgb(0, 0, 0)") && (await css("password", "outlineStyle")) === "solid");
  await page.eval("document.getElementById('email').disabled=true");
  check("Apple: disabled field stays readable", lum(await css("email", "webkitTextFillColor")) > 0.5);
  await setSettings({ globalEnabled: false });
  await sleep(400);
  check("Apple: disabling restores original text fill", (await css("password", "webkitTextFillColor")) === "rgb(29, 29, 31)");
  await resetSettings();
  await page.go(site("127.0.0.1", "reddit-res.html"), 1800);
  check("RES: white floater black in deepen mode", (await css("floater", "backgroundColor")) === "rgb(0, 0, 0)");
  check("RES: icon and text visible", (await css("RESAccountSwitcherIcon", "filter")) === "invert(1)" && lum(await css("gear", "color")) > 0.5);
  check("RES: unrelated white content unchanged", (await css("unrelated", "backgroundColor")) === "rgb(255, 255, 255)");
  await setSettings({ globalEnabled: false });
  await sleep(400);
  check("RES: disabling restores toolbar and icon", (await css("floater", "backgroundColor")) === "rgb(255, 255, 255)" && (await css("RESAccountSwitcherIcon", "filter")) === "none");
  await resetSettings();

  // Selected dropdown CSS loaded after our sheet must not win the cascade.
  await page.go(site("127.0.0.1", "dropdowns.html"), 1800);
  let dropdown = await page.eval("dropdownResult('promotion')");
  check("dropdown: late important selection readable", dropdown.dark && dropdown.contrast >= 4.5, JSON.stringify(dropdown));
  check("dropdown: selection distinct from unselected", (await css("promotion", "backgroundColor")) !== (await css("traffic", "backgroundColor")));
  await page.eval("document.getElementById('dynamicOption').setAttribute('aria-selected','true')");
  await sleep(400);
  dropdown = await page.eval("dropdownResult('dynamicOption')");
  check("dropdown: aria-only selection recolored", dropdown.dark && dropdown.contrast >= 4.5 && dropdown.marked.includes('bg'), JSON.stringify(dropdown));
  await page.eval("document.getElementById('dynamicOption').setAttribute('aria-selected','false'); document.getElementById('dynamicOption').setAttribute('data-highlighted','')");
  await sleep(400);
  dropdown = await page.eval("dropdownResult('dynamicOption')");
  check("dropdown: highlighted state readable", dropdown.dark && dropdown.contrast >= 4.5);
  await page.eval("document.getElementById('promotion').focus()");
  check("dropdown: keyboard focus retained", (await css("promotion", "outlineStyle")) === "solid");
  const hoverRect = await page.eval("(() => { const r=document.getElementById('hoverOption').getBoundingClientRect(); return {x:r.x+10,y:r.y+10}; })()");
  await send("Input.dispatchMouseEvent", {type:"mouseMoved", ...hoverRect}, page.sessionId);
  await sleep(80);
  dropdown = await page.eval("dropdownResult('hoverOption')");
  check("dropdown: hovered option readable", dropdown.dark && dropdown.contrast >= 4.5);
  dropdown = await page.eval("dropdownResult('nativeOption')");
  check("dropdown: native option readable", dropdown.dark && dropdown.contrast >= 4.5);
  check('color picker and swatch retain original data colors',await page.eval("!document.getElementById('colorPicker').hasAttribute('data-oled-night') && getComputedStyle(document.getElementById('swatch')).backgroundColor === 'rgb(251, 235, 156)' && !document.getElementById('nativeColor').hasAttribute('data-oled-night')"));
  check('Amazon disclosure and close sprites visible', (await css('amazonArrow','filter')) === 'brightness(0) invert(1)' && (await css('amazonClose','filter')) === 'brightness(0) invert(1)');
  check('Amazon border chevron readable; other sprites unchanged', lum(await css('amazonMore','borderRightColor')) > .5 && (await css('amazonOther','filter')) === 'none');
  await page.eval("document.getElementById('amazonArrow').className='a-icon a-icon-section-collapse sprite-icon'"); await sleep(80);
  check('Amazon expanded arrow remains visible', (await css('amazonArrow','filter')) === 'brightness(0) invert(1)');
  const amazonHeader=await page.eval("dropdownResult('amazonHeader')");
  check('Amazon expanded header important background readable',amazonHeader.dark && amazonHeader.contrast>=4.5,JSON.stringify(amazonHeader));
  const importantRow = await page.eval("dropdownResult('importantRow')");
  check("highlight: multi-class and tag important rule stays readable", importantRow.contrast >= 4.5 && (await css('importantRow','backgroundColor')) !== 'rgb(251, 235, 156)', JSON.stringify(importantRow));
  const transparentRect = await page.eval("(() => { const r=document.getElementById('transparentLink').getBoundingClientRect(); return {x:r.x+5,y:r.y+5}; })()");
  await send("Input.dispatchMouseEvent", {type:"mouseMoved", ...transparentRect}, page.sessionId); await sleep(80);
  dropdown = await page.eval("dropdownResult('transparentRow')");
  check("dropdown: transparent ancestor becomes readable on real hover", dropdown.dark && dropdown.contrast >= 4.5 && dropdown.marked.includes('bg'), JSON.stringify(dropdown));
  const hoverBackground = await css("transparentRow", "backgroundColor");
  await send("Input.dispatchMouseEvent", {type:"mousePressed", button:"left", clickCount:1, ...transparentRect}, page.sessionId); await sleep(80);
  const activeBackground = await css("transparentRow", "backgroundColor");
  const activeContrast = await page.eval("dropdownResult('transparentRow').contrast");
  check("dropdown: active state updated", activeBackground !== hoverBackground && activeContrast >= 4.5, JSON.stringify({hoverBackground,activeBackground,activeContrast,active:await page.eval("document.getElementById('transparentRow').matches(':active')")}));
  await send("Input.dispatchMouseEvent", {type:"mouseReleased", button:"left", clickCount:1, ...transparentRect}, page.sessionId);
  await page.eval("document.activeElement.blur()");
  await send("Input.dispatchMouseEvent", {type:"mouseMoved", x:990,y:790}, page.sessionId); await sleep(80);
  check("dropdown: pointer exit restores transparent row", (await css("transparentRow", "backgroundColor")) === "rgba(0, 0, 0, 0)");
  await page.eval("document.getElementById('transparentLink').focus()"); await sleep(80);
  dropdown = await page.eval("dropdownResult('transparentRow')");
  check("dropdown: keyboard focus-within readable", dropdown.dark && dropdown.marked.includes('bg'));
  await page.eval("document.getElementById('genericField').focus()"); await sleep(80);
  check("fields: focus background, text-fill and caret readable", lum(await css("genericField", "backgroundColor")) < .05 && lum(await css("genericField", "webkitTextFillColor")) > .5 && lum(await css("genericField", "caretColor")) > .5);
  check("fields: placeholder and focus indicator retained", await page.eval("getComputedStyle(document.getElementById('genericField'),'::placeholder').color !== 'rgb(68, 68, 68)' && getComputedStyle(document.getElementById('genericField')).outlineStyle === 'solid'"));
  check("fields: focus-within wrapper darkened", lum(await css("fieldWrap", "backgroundColor")) < .05);
  await page.eval("document.getElementById('genericField').setAttribute('style','width:100%'); document.getElementById('genericField').removeAttribute('data-oled-night')"); await sleep(400);
  check("fields: framework attribute reset repaired", lum(await css("genericField", "webkitTextFillColor")) > .5 && await page.eval("document.getElementById('genericField').getAttribute('data-oled-night')?.includes('field')"));
  await page.eval("document.getElementById('genericField').blur(); document.getElementById('genericField').focus()"); await sleep(100);
  check("fields: cached decision does not skip missing overrides", lum(await css("genericField", "webkitTextFillColor")) > .5);
  await send("DOM.enable", {}, page.sessionId); await send("CSS.enable", {}, page.sessionId);
  const doc = await send("DOM.getDocument", {}, page.sessionId);
  const fieldNode = await send("DOM.querySelector", {nodeId:doc.result.root.nodeId,selector:'#genericField'}, page.sessionId);
  const forcedAutofill = await send("CSS.forcePseudoState", {nodeId:fieldNode.result.nodeId,forcedPseudoClasses:['autofill']}, page.sessionId);
  check("fields: native autofill paint covered with dark inset", !forcedAutofill.error && await page.eval("document.getElementById('genericField').matches(':autofill') && getComputedStyle(document.getElementById('genericField')).boxShadow.includes('1000px')") && lum(await css("genericField", "webkitTextFillColor")) > .5);
  await send("CSS.forcePseudoState", {nodeId:fieldNode.result.nodeId,forcedPseudoClasses:[]}, page.sessionId);
  await page.eval("document.getElementById('shadowInteraction').shadowRoot.querySelector('button').focus()"); await sleep(80);
  check("dropdown: shadow focus-only surface darkened", await page.eval("getComputedStyle(document.getElementById('shadowInteraction').shadowRoot.querySelector('button')).backgroundColor !== 'rgb(238, 238, 238)'"));
  await setSettings({globalEnabled:false}); await sleep(400);
  check("Amazon off restores icons", (await css("amazonArrow","filter")) === "none" && (await css("amazonMore","borderRightColor")) === "rgb(17, 17, 17)");
  check("dropdown: off restores original selection", (await css("promotion", "backgroundColor")) === "rgb(229, 235, 238)");
  await page.eval("document.getElementById('genericField').focus()"); await sleep(80);
  check("fields: off restores focus and text-fill", (await css("genericField", "backgroundColor")) === "rgb(245, 245, 245)" && (await css("genericField", "webkitTextFillColor")) === "rgb(34, 34, 34)");
  await resetSettings();

  // Shopping-site patterns: multiply-blended product photos and dark logos.
  await page.go(site("127.0.0.1", "shop.html"), 1800);
  check("multiply-blended product photos stay visible", (await css("product", "mixBlendMode")) === "normal" && (await css("promo", "mixBlendMode")) === "normal");
  check("dark transparent logo is flipped light", (await page.eval("document.getElementById('logo').hasAttribute('data-oled-night-logo')")) && /invert/.test(await css("logo", "filter")));
  check("colored logo and photos are left alone", (await css("colorLogo", "filter")) === "none" && (await css("photo", "filter")) === "none");

  // Icons drawn through masks, text-clipped backgrounds, and charts that add shapes later.
  await page.go(site("127.0.0.1", "ink.html"), 2600);
  check("masked icons turn light, not invisible", lum(await css("maskIcon", "backgroundColor")) > 0.5);
  check("text-clipped headings stay readable", lum(await css("clipText", "backgroundColor")) > 0.5);
  check("chart shapes added later are darkened", lum(await css("early", "fill")) < 0.05 && lum(await css("late", "fill")) < 0.05, `${await css("early", "fill")} / ${await css("late", "fill")}`);

  // Already-dark page: only the darkest greys go black.
  await page.go(site("127.0.0.1", "dark.html"));
  check("dark site: page crushed to black", (await page.eval("getComputedStyle(document.body).backgroundColor")) === "rgb(0, 0, 0)");
  check("dark site: cards keep their shade", (await css("card", "backgroundColor")) === "rgb(43, 45, 49)");
  check("dark site: brand color and text untouched", (await css("accent", "backgroundColor")) === "rgb(88, 101, 242)" && (await css("card", "color")) === "rgb(219, 222, 225)");

  // Charts and color transitions.
  await page.go(site("127.0.0.1", "chart.html"), 700);
  const samples = [];
  for (let i = 0; i < 12; i++) { samples.push(await css("search", "backgroundColor")); await sleep(100); }
  check("color transitions never flash light", samples.every((c) => lum(c) < 0.05), [...new Set(samples)].join(" | "));
  check("chart fills darkened", lum(await css("s1", "stopColor")) < 0.1 && lum(await css("s2", "stopColor")) < 0.01 && lum(await css("solid", "fill")) < 0.05);
  check("chart line keeps color", (await css("line", "stroke")) === "rgb(0, 112, 201)");

  // Web components, modern color syntax, gradients, shadows.
  await page.go(site("127.0.0.1", "components.html"), 1800);
  check("modern color syntax text readable", lum(await css("pill", "color")) > 0.5 && lum(await css("title", "color")) > 0.5);
  check("white fade gradient darkened", /rgb\(0, 0, 0\)\)$/.test(await css("chat", "backgroundImage", "::after")));
  check("white glow shadow darkened", (await css("composer", "boxShadow")).startsWith("rgb(0, 0, 0)"));
  const shadow = await page.eval("(() => { const r = document.getElementById('grid').shadowRoot; const s = (el, p) => getComputedStyle(el)[p]; return { table: s(r.querySelector('table'), 'backgroundColor'), cell: s(r.getElementById('cell'), 'color'), late: s(r.getElementById('late'), 'color') }; })()");
  check("web component table darkened", lum(shadow.table) < 0.01 && lum(shadow.cell) > 0.3 && lum(shadow.late) > 0.3, JSON.stringify(shadow));
  check("images untouched by default", (await css("img", "filter")) === "none");

  // Per-site settings apply live, without reload.
  await setSettings({ siteTuning: { "127.0.0.1": { dimImages: true, brightness: 50 } } });
  await sleep(400);
  check("dim images per site", (await css("img", "filter")) === "brightness(0.78)");
  check("per-site brightness", (await page.eval("document.documentElement.style.getPropertyValue('--oln-light')")) === "50%");
  const other = await openTab(site("localhost", "components.html"));
  check("other sites keep global brightness", (await other.eval("document.documentElement.style.getPropertyValue('--oln-light')")) === "88%");
  check("closed components stay closed by default", (await other.eval("window.closedWasOpened")) === false);

  // Experimental: open closed web components (registered page-world script).
  await setSettings({ openClosedShadows: true });
  await sleep(800);
  await other.go(site("localhost", "components.html"), 1800);
  check("experimental: closed components reachable", (await other.eval("window.closedWasOpened")) === true);
  check("experimental: closed component darkened", lum(await other.eval("getComputedStyle(document.getElementById('closed').shadowRoot.querySelector('div')).backgroundColor")) < 0.01);
  await setSettings({ openClosedShadows: false });
  await sleep(500);

  // Site modes.
  await setSettings({ siteRules: { localhost: "invert" } });
  await other.go(site("localhost", "canvas.html"));
  check("invert mode flips page, flips images back", /invert\(1\)/.test(await other.eval("getComputedStyle(document.documentElement).filter")) && /invert\(1\)/.test(await other.eval("getComputedStyle(document.getElementById('photo')).filter")));
  await setSettings({ siteRules: { localhost: "deepen" } });
  await other.go(site("localhost", "light.html"));
  check("deepen-only leaves light page content alone", (await other.eval("getComputedStyle(document.getElementById('info')).backgroundColor")) === "rgb(232, 240, 254)");
  await setSettings({ siteRules: { localhost: "off" } });
  await other.go(site("localhost", "light.html"));
  check("off mode leaves site untouched", (await other.eval("document.documentElement.hasAttribute('data-oled-night-root') || !!document.getElementById('oled-night-early')")) === false);
  await setSettings({ siteRules: { localhost: "recolor" } });
  await other.go(site("localhost", "dark.html"));
  check("full recolor forces recolor on a dark site", (await other.eval("document.getElementById('accent').getAttribute('data-oled-night') || ''")).includes("bg"));
  await resetSettings();
  await sleep(300);

  // Schedule outside the window turns it off.
  const now = new Date();
  const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  await setSettings({ schedule: { enabled: true, start: hhmm(new Date(now.getTime() + 2 * 3600e3)), end: hhmm(new Date(now.getTime() + 3 * 3600e3)) } });
  await other.go(site("localhost", "light.html"));
  check("schedule: off outside the window", (await other.eval("document.documentElement.hasAttribute('data-oled-night-root')")) === false);
  await resetSettings();
  await sleep(300);

  // No white flash while a page is still loading.
  await page.go(site("127.0.0.1", "slow.html"), 400);
  const loading = await page.eval("({ state: document.readyState, bg: getComputedStyle(document.documentElement).backgroundColor })");
  check("black before the page finishes loading", loading.state === "loading" && loading.bg === "rgb(0, 0, 0)", JSON.stringify(loading));

  await page.go(site("127.0.0.1", "light.html"));
  await send("Target.activateTarget",{targetId:page.targetId});
  const newPanel=await page.eval(`new Promise(resolve=>setTimeout(()=>{
    const panel=document.createElement('section');panel.style.background='#fff';panel.style.color='#222';panel.textContent='New dynamic section';document.body.append(panel);
    queueMicrotask(()=>requestAnimationFrame(()=>resolve(getComputedStyle(panel).backgroundColor)));
  },0))`);
  check('new sections recolored in the next pre-paint batch',newPanel==='rgb(0, 0, 0)',newPanel);

  await page.go(site("127.0.0.1", "efficiency.html"));
  const efficiency = await page.eval("(async () => {\n const wait = () => new Promise(r=>setTimeout(r,150));\n const p=document.getElementById('parent'), c=document.getElementById('child'), v=document.getElementById('variable');\n const dark = node => { const c=getComputedStyle(node); return c.backgroundColor.match(/[0-9.]+/g).slice(0,3).every(n=>+n<30) && +c.color.match(/[0-9.]+/)[0]>180; };\n const results={}; let batches=0;\n const watch=new MutationObserver(records=>{batches+=records.some(r=>r.oldValue===null)?1:0});\n watch.observe(p,{attributes:true,subtree:true,attributeOldValue:true,attributeFilter:['data-oled-night-measure','data-oled-night-measure-self']});\n p.style.transform='translateX(1px)'; await wait(); batches=0;\n for(let i=0;i<20;i++)p.style.transform='translateX('+i+'px)';\n await wait(); results.transformSkips=batches===0;\n batches=0; c.classList.add('changed');p.classList.add('changed');c.dispatchEvent(new Event('focusin',{bubbles:true,composed:true}));\n await wait();results.coalesced=batches===1;\n p.style.setProperty('--surface','#eee'); await wait();results.variableDark=dark(v);\n p.setAttribute('style','--surface:#ddd;background:white');await wait();results.resetInheritance=dark(v);\n const sheet=document.createElement('style');sheet.textContent='#late{background:#eee!important;color:#222}';document.head.append(sheet);await wait();results.lateSheet=dark(document.getElementById('late'));\n sheet.firstChild.data='#late{background:rgb(230,230,230)!important;color:#111}';await wait();results.editedSheet=dark(document.getElementById('late'));\n batches=0;await wait();results.noFeedback=batches===0;watch.disconnect();return results;\n})()");
  for (const [name,ok] of Object.entries(efficiency)) check('efficiency: '+name,ok,JSON.stringify(efficiency));

  // Input-modality classes on <html> (Discord's mouse-mode) must not switch overrides off for the whole
  // document, yet real theme classes must still land on their final colors despite page transitions.
  await page.go(site("127.0.0.1", "scope-dark.html"));
  const scopeDark = await page.eval(`(async () => { const wait = (ms) => new Promise(r => setTimeout(r, ms)); const h = document.documentElement; let rootSwitches = 0;
    const watch = new MutationObserver(r => { rootSwitches += r.filter(x => x.oldValue === null).length; }); watch.observe(h, { attributes: true, attributeOldValue: true, attributeFilter: ['data-oled-night-measure', 'data-oled-night-noanim'] });
    for (let i = 0; i < 4; i++) { h.classList.toggle('mouse-mode'); await wait(60); } watch.disconnect();
    h.classList.add('accent'); await wait(700);
    return { rootSwitches, panel: getComputedStyle(document.getElementById('panel')).backgroundColor }; })()`);
  check("modality class on html: no whole-document switch", scopeDark.rootSwitches === 0, JSON.stringify(scopeDark));
  check("theme class with page transition: final color applied", scopeDark.panel === "rgb(0, 0, 0)", JSON.stringify(scopeDark));
  // Chrome restyles whole subtrees for attributes named in pseudo-element rules; keep the element switch out of them.
  const pseudoRules = await page.eval("document.getElementById('oled-night-sheet').textContent.split('}').filter(rule => rule.includes('::') && rule.includes('data-oled-night-measure-self')).length");
  check("element switch never named in pseudo-element rules", pseudoRules === 0, `${pseudoRules} rules`);
  // A root background that follows color-scheme keeps its original polarity (no flip-flop or re-enable).
  await page.go(site("127.0.0.1", "scope-scheme.html"));
  const scheme = await page.eval(`(async () => { const wait = (ms) => new Promise(r => setTimeout(r, ms)); const h = document.documentElement; let reenabled = 0;
    const watch = new MutationObserver(r => { reenabled += r.filter(x => x.oldValue !== null).length; }); watch.observe(h, { attributes: true, attributeOldValue: true, attributeFilter: ['data-oled-night-root'] });
    for (let i = 0; i < 4; i++) { h.classList.toggle('mouse-mode'); await wait(80); } watch.disconnect();
    return { reenabled, card: getComputedStyle(document.getElementById('card')).backgroundColor, mark: document.getElementById('card').getAttribute('data-oled-night') }; })()`);
  check("color-scheme-dependent page keeps polarity across html class changes", scheme.reenabled === 0 && /bg/.test(scheme.mark || "") && scheme.card !== "rgb(241, 243, 244)", JSON.stringify(scheme));
  // Moving between rows or typing rechecks only elements whose state changed right away; unchanged
  // ancestors are rechecked once interaction pauses (e.g. a :has() rule on an outer wrapper).
  await page.go(site("127.0.0.1", "scope-light.html"));
  const scopeLight = await page.eval(`(async () => { const wait = (ms) => new Promise(r => setTimeout(r, ms)); const $ = (id) => document.getElementById(id); let outerSwitches = 0;
    const watch = new MutationObserver(r => { outerSwitches += r.filter(x => x.oldValue === null).length; }); const names = ['data-oled-night-measure', 'data-oled-night-measure-self', 'data-oled-night-noanim', 'data-oled-night-noanim-self'];
    for (const id of ['main', 'sec']) watch.observe($(id), { attributes: true, attributeOldValue: true, attributeFilter: names });
    $('s1').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: $('s2') })); $('s2').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: $('s1') }));
    await wait(100); const moveSwitches = outerSwitches; watch.disconnect();
    $('field').focus(); $('field').value = 'typed'; $('field').dispatchEvent(new InputEvent('input', { bubbles: true })); await wait(800);
    const bg = getComputedStyle($('outer')).backgroundColor.match(/[0-9.]+/g).slice(0, 3).map(Number);
    return { moveSwitches, outer: bg, outerDark: bg.every(n => n < 40) }; })()`);
  check("pointer move between rows leaves unchanged ancestors alone", scopeLight.moveSwitches === 0, JSON.stringify(scopeLight));
  check("typing: ancestor :has() rule rechecked after pause", scopeLight.outerDark, JSON.stringify(scopeLight));

  // Performance under constant page churn and slider drags.
  await page.go(site("127.0.0.1", "rows.html"), 2500);
  const churn = await page.eval(`(async () => { const rows = [...document.querySelectorAll('.row')]; let worst = 0, last = performance.now(), frames = 0; const stop = last + 2000;
    await new Promise((done) => { (function tick() { const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++;
      for (let k = 0; k < 20; k++) rows[(Math.random() * rows.length) | 0].classList.toggle('hl');
      const p = document.createElement('p'); p.textContent = 'token ' + frames; document.getElementById('list').prepend(p);
      if (now < stop) setTimeout(tick, 16); else done(); })(); }); return { frames, worst: Math.round(worst) }; })()`);
  check("stays smooth under constant page changes", churn.frames > 90 && churn.worst < 150, JSON.stringify(churn));
  await sleep(500);
  await page.eval("window.tuningPasses=0;window.tuningWatch=new MutationObserver(r=>{window.tuningPasses+=r.length});window.tuningWatch.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['data-oled-night-measure','data-oled-night-measure-self']})");
  const slider = await ext.eval(`(async () => { const [t] = await chrome.tabs.query({ url: "${site("127.0.0.1", "rows.html")}" }); const start = performance.now();
    for (const b of [60, 70, 80, 90]) await chrome.tabs.sendMessage(t.id, { type: "oled-night-preview", patch: { brightness: b } }); return Math.round((performance.now() - start) / 4); })()`);
  await sleep(100);
  check('slider changes do not rescan the document',await page.eval("window.tuningWatch.disconnect();window.tuningPasses===0"));
  check("slider step is cheap", slider < 120, `${slider} ms per step`);

  await resetSettings();
  await page.go(site("127.0.0.1", "light.html"));
  await ext.eval(`(async()=>{const [t]=await chrome.tabs.query({url:"${site("127.0.0.1", "light.html")}"});await chrome.tabs.update(t.id,{active:true});})()`);
  const popup = await openTab(`chrome-extension://${extId}/popup.html`, true);
  check("popup renders site before defaults", await popup.eval("document.querySelector('section').className === 'site-panel' && !document.querySelector('#siteOnly') && document.getElementById('hostname').textContent === '127.0.0.1'"));
  const move = (id,value) => popup.eval(`(()=>{const e=document.getElementById('${id}');e.value=${value};e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'));})()`);
  const beforeText=await css('primary','color'), beforePanel=await css('info','backgroundColor');
  await move('brightness',60); await move('contrast',0); await sleep(400);
  check('site sliders visibly change text and panels', (await css('primary','color'))!==beforeText && (await css('info','backgroundColor'))!==beforePanel);
  let saved=await ext.eval('chrome.storage.sync.get(null)');
  check('site sliders preserve global defaults', saved.siteTuning['127.0.0.1'].brightness===60 && saved.siteTuning['127.0.0.1'].contrast===0 && saved.brightness===undefined);
  const moveDefault = (id, value) => ext.eval(`(()=>{const e=document.getElementById('${id}');e.value=${value};e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'));})()`);
  await moveDefault('defaultBrightness',95); await sleep(600);
  check('default slider preserves site override', await page.eval("document.documentElement.style.getPropertyValue('--oln-light') === '60%'"));
  await popup.eval("document.getElementById('siteEnabled').click()"); await sleep(400);
  check('site switch restores original page', await page.eval("!document.documentElement.hasAttribute('data-oled-night-root')"));
  await popup.eval("document.getElementById('siteEnabled').click()"); await sleep(400);
  check('site switch reapplies',await page.eval("document.documentElement.hasAttribute('data-oled-night-root')"));
  await popup.eval("document.getElementById('resetSite').click()"); await sleep(400);
  saved=await ext.eval('chrome.storage.sync.get(null)');
  check('use defaults clears only current site overrides', !saved.siteTuning['127.0.0.1'] && !saved.siteRules['127.0.0.1'] && saved.brightness===95 && await page.eval("document.documentElement.style.getPropertyValue('--oln-light') === '95%'"));
  // Every popup control, and a status line that matches what the page is actually doing.
  const popupFor = async (file, tab = page, pop = popup) => {
    await tab.go(site("127.0.0.1", file));
    await ext.eval(`(async()=>{const [t]=await chrome.tabs.query({url:"${site("127.0.0.1", file)}"});await chrome.tabs.update(t.id,{active:true});})()`);
    await pop.go(`chrome-extension://${extId}/popup.html`, 1200);
  };
  const ui = (pop = popup) => pop.eval("(() => { const $ = (id) => document.getElementById(id); return { status: $('status').textContent, controls: !$('siteControls').hidden, sliders: !$('siteControls').hidden && !$('siteTuning').hidden, recolor: !$('useRecolor').hidden, reload: !$('reloadTab').hidden, reset: !$('resetSite').hidden, site: $('siteEnabled').checked, mode: $('siteRule').value }; })()");
  const click = async (id) => { await popup.eval(`document.getElementById('${id}').click()`); await sleep(500); };
  const choose = async (id, value) => { await popup.eval(`(()=>{const e=document.getElementById('${id}');e.value='${value}';e.dispatchEvent(new Event('change'));})()`); await sleep(500); };
  const rootHas = (name) => page.eval(`document.documentElement.hasAttribute('${name}')`);
  await popupFor("light.html");
  let state = await ui();
  check("popup: recolored page reports recoloring with sliders", state.status === "On · recoloring this page" && state.sliders && !state.reset && state.mode === "auto", JSON.stringify(state));
  await click("dimImages");
  const dimmed = await rootHas("data-oled-night-dim");
  state = await ui();
  await click("dimImages");
  check("popup: dim images toggles this site and offers reset", dimmed && !(await rootHas("data-oled-night-dim")) && state.reset, JSON.stringify(state));
  await click("resetSite");
  await choose("siteRule", "invert");
  const inverted = await rootHas("data-oled-night-invert");
  await popupFor("light.html");
  state = await ui();
  check("popup: invert mode applies and hides sliders", inverted && state.status === "On · page inverted" && !state.sliders && !state.recolor && state.mode === "invert", JSON.stringify(state));
  await choose("siteRule", "auto");
  saved = await ext.eval("chrome.storage.sync.get(null)");
  check("popup: automatic mode returns the site to the default", !(await rootHas("data-oled-night-invert")) && !("127.0.0.1" in (saved.siteRules || {})));
  await popupFor("dark.html");
  state = await ui();
  const darkState = state;
  await click("useRecolor");
  state = await ui();
  saved = await ext.eval("chrome.storage.sync.get(null)");
  check("popup: already-dark page explains sliders and offers full recolor", /already dark/.test(darkState.status) && !darkState.sliders && darkState.recolor, JSON.stringify(darkState));
  check("popup: full recolor button recolors and shows sliders", saved.siteRules["127.0.0.1"] === "recolor" && state.status === "On · recoloring this page" && state.sliders, JSON.stringify(state));
  await click("resetSite");
  await popupFor("light.html");
  await click("globalEnabled");
  state = await ui();
  check("popup: all-sites off is explained on the site", !(await rootHas("data-oled-night-root")) && state.status === "Off · All sites is off below" && !state.site && !state.controls, JSON.stringify(state));
  await click("siteEnabled");
  check("popup: site switch turns this site on while the default is off", await rootHas("data-oled-night-root"));
  await click("resetSite");
  await click("globalEnabled");
  if (!(await page.eval("matchMedia('(prefers-color-scheme: dark)').matches"))) {
    await ext.eval("document.querySelector('input[name=appearance][value=auto]').click()"); await sleep(600);
    state = await ui();
    check("popup: follow system explains light-mode off", !(await rootHas("data-oled-night-root")) && state.status === "Off while your system is in light mode", JSON.stringify(state));
    await ext.eval("document.querySelector('input[name=appearance][value=oled]').click()"); await sleep(600);
  }
  // Settings: defaults first, site list collapsed, same mode names as the popup.
  await setSettings({ siteRules: { "a.example": "on", "b.example": "deepen" }, siteTuning: { "c.example": { dimImages: false } } });
  await ext.go(`chrome-extension://${extId}/options.html`, 800);
  const opts = await ext.eval("(() => ({ collapsed: !document.getElementById('sitesPanel').open, count: document.getElementById('siteCount').textContent, labels: [...document.querySelector('[data-host=\"a.example\"] select').options].map(o => o.text), a: document.querySelector('[data-host=\"a.example\"] select').selectedOptions[0].text, b: document.querySelector('[data-host=\"b.example\"] select').selectedOptions[0].text, c: document.querySelector('[data-host=\"c.example\"] small').textContent, reset: document.querySelector('[data-host=\"a.example\"] .remove').textContent, popupHasDefaults: false }))()");
  check("settings: site list collapsed with count and popup mode names", opts.collapsed && opts.count === "(3)" && opts.labels.join("|") === "Automatic|Full recolor|Deepen blacks only|Invert (canvas apps)|Off" && opts.a === "Automatic" && opts.b === "Deepen blacks only" && opts.c === "images not dimmed" && opts.reset === "Reset", JSON.stringify(opts));
  await ext.eval("document.querySelector('[data-host=\"c.example\"] .remove').click()"); await sleep(300);
  check("settings: reset removes a site", !(await ext.eval("!!document.querySelector('[data-host=\"c.example\"]')")));
  await resetSettings();
  await page.go(site("127.0.0.1", "light.html"));
  const before = await css("primary", "color");
  await moveDefault("defaultBrightness", 50); await sleep(700);
  check("settings: default brightness changes sites without their own values", (await css("primary", "color")) !== before && await page.eval("document.documentElement.style.getPropertyValue('--oln-light') === '50%'"));
  check("popup: defaults live in Settings, not the popup", await popup.eval("!document.getElementById('globalBrightness') && !document.querySelector('input[name=appearance]')"));
  await resetSettings();
  await send('Target.activateTarget',{targetId:popup.targetId});
  const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},popup.sessionId);
  writeFileSync(join(EXT,'dist','popup-audit.png'),Buffer.from(capture.result.data,'base64'));

  check("no uncaught errors in extension pages or test pages", exceptions.length === 0, exceptions.slice(0, 3).join(" | "));

  // After an extension update, already-open tabs lose their connection: say so and offer a reload.
  await page.go(site("127.0.0.1", "light.html"));
  await send("Extensions.loadUnpacked", { path: EXT });
  await sleep(1000);
  const ext2 = await openTab(`chrome-extension://${extId}/options.html`, true);
  await ext2.eval(`(async()=>{const [t]=await chrome.tabs.query({url:"${site("127.0.0.1", "light.html")}"});await chrome.tabs.update(t.id,{active:true});})()`);
  const popup2 = await openTab(`chrome-extension://${extId}/popup.html`, true);
  await sleep(1200);
  state = await ui(popup2);
  check("popup: disconnected tab asks for a reload", state.status === "Reload this tab to apply OLED Night" && state.reload && !state.controls, JSON.stringify(state));
  await popup2.eval("document.getElementById('reloadTab').click()").catch(() => {});
  await sleep(2000);
  const popup3 = await openTab(`chrome-extension://${extId}/popup.html`, true);
  await sleep(1200);
  state = await ui(popup3);
  check("popup: reload reconnects the tab", state.status === "On · recoloring this page" && !state.reload, JSON.stringify(state));
} catch (error) {
  failures++;
  console.log(`FAIL  suite aborted: ${error.message}`);
} finally {
  chrome.kill();
  server.close();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
