// Rendered regressions for fixes that shipped with unit tests only:
// 0.6.77 Amazon country storefronts and home cards, 0.6.82 barely blue
// Google fields, 0.6.79 popup keyboard focus, rating prompt and welcome page.
// Real storefront hosts are served from local fixtures by request interception.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launchChrome, wait } from "../lab/browser.mjs";

const site = join(import.meta.dirname, "site");
const pages = { "www.amazon.co.uk": "amazon-home.html", "www.amazon.de": "amazon-home.html", "shop.example": "amazon-home.html", "calendar.example": "calendar-fields.html" };
const browser = await launchChrome({ onEvent(event) {
  if (event.method !== "Fetch.requestPaused") return;
  const file = pages[new URL(event.params.request.url).hostname];
  browser.send("Fetch.fulfillRequest", { requestId: event.params.requestId, responseCode: file ? 200 : 404,
    responseHeaders: [{ name: "Content-Type", value: "text/html" }], body: file ? readFileSync(join(site, file)).toString("base64") : "" }, event.sessionId);
} });
let failures = 0, passes = 0;
const check = (name, ok, detail = "") => { ok ? passes++ : failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const channels = value => (String(value).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
try {
  const { id } = await browser.send("Extensions.loadUnpacked", { path: resolve(process.env.EXT_PATH || resolve(import.meta.dirname, "../..")) });
  const options = await browser.open(`chrome-extension://${id}/options.html`);
  const page = await browser.open();
  await browser.send("Fetch.enable", { patterns: Object.keys(pages).map(host => ({ urlPattern: `https://${host}/*` })) }, page.sessionId);
  const probe = id => page.eval(`(() => { const e = document.getElementById(${JSON.stringify(id)}), s = getComputedStyle(e);
    return { bg: s.backgroundColor, outline: s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor, color: s.color,
      site: document.documentElement.getAttribute("data-oled-night-site"), mode: document.documentElement.getAttribute("data-oled-night-mode"),
      page: getComputedStyle(document.body).backgroundColor }; })()`);

  // 0.6.77: every Amazon country storefront gets the Amazon profile, and OLED
  // home cards are true black with a thin outline instead of raised grey.
  for (const host of ["www.amazon.co.uk", "www.amazon.de"]) {
    await page.go(`https://${host}/`); await wait(1200);
    const card = await probe("homeCard"), deck = await probe("gwm-Deck-btf");
    check(`amazon ${host}: the storefront gets the Amazon profile`, card.site === "amazon" && card.mode === "oled", `${card.site} / ${card.mode}`);
    check(`amazon ${host}: home cards are true black with an outline`, card.bg === "rgb(0, 0, 0)" && card.outline === "solid 1px rgb(44, 45, 51)", `${card.bg}, ${card.outline}`);
    check(`amazon ${host}: the lower deck is true black`, deck.bg === "rgb(0, 0, 0)", deck.bg);
  }
  await page.go("https://shop.example/"); await wait(1200);
  const generic = await probe("homeCard");
  check("amazon: the same markup on another store gets no Amazon profile", generic.site !== "amazon" && !generic.outline.startsWith("solid 1px rgb(44, 45, 51)"), `${generic.site}, ${generic.outline}`);

  // 0.6.82: barely blue Google fields become near-neutral dark grey; clearly
  // tinted surfaces keep their hue.
  await page.go("https://calendar.example/"); await wait(1200);
  for (const id of ["locationField", "guestsField", "descriptionField"]) {
    const [r, g, b] = channels((await probe(id)).bg);
    check(`calendar: ${id} is a near-neutral dark grey`, Math.max(r, g, b) < 60 && b - r <= 10, `rgb(${r}, ${g}, ${b})`);
  }
  const [cr, , cb] = channels((await probe("tintedChip")).bg);
  check("calendar: a clearly tinted chip keeps its blue", cb - cr >= 15, `${cr}..${cb}`);

  // 0.6.79: the popup shows keyboard focus on every control reached by Tab.
  const popup = await browser.open(`chrome-extension://${id}/popup.html`); await wait(700);
  const unseen = [];
  let reached = 0;
  for (let n = 0; n < 16; n++) {
    await popup.key("Tab"); await wait(60);
    const focus = await popup.eval(`(() => { const e = document.activeElement; if (!e || e === document.body) return null;
      const target = e.matches('.switch input, .segments input') ? e.nextElementSibling : e, s = getComputedStyle(target);
      const lum = c => { const [r, g, b] = (c.match(/[0-9.]+/g) || []).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const ring = lum(s.outlineColor), page = lum(getComputedStyle(document.body).backgroundColor);
      // Chrome's default "auto" ring is a dark two-tone ring that disappears on this popup.
      return { name: e.id || e.getAttribute('aria-label') || e.localName, outline: s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 1 &&
        (Math.max(ring, page) + .05) / (Math.min(ring, page) + .05) >= 3 }; })()`);
    if (!focus) continue;
    reached++;
    if (!focus.outline) unseen.push(focus.name);
  }
  check("popup: keyboard focus is visible on every control reached by Tab", reached >= 6 && unseen.length === 0, `${reached} stops, no outline: ${unseen.join(", ")}`);
  await browser.send("Target.closeTarget", { targetId: popup.targetId });

  // 0.6.79: the rating link waits for a week and five opens, then stays gone once dismissed.
  const ratingShown = async () => { const tab = await browser.open(`chrome-extension://${id}/popup.html`); await wait(600);
    const shown = await tab.eval("!document.getElementById('ratePrompt').hidden"); return { tab, shown }; };
  await options.eval("chrome.storage.local.set({installedAt: Date.now(), popupOpens: 10, rateDone: false})");
  let opened = await ratingShown();
  check("rating: hidden during the first week", !opened.shown);
  await browser.send("Target.closeTarget", { targetId: opened.tab.targetId });
  await options.eval("chrome.storage.local.set({installedAt: Date.now() - 8 * 864e5, popupOpens: 3, rateDone: false})");
  opened = await ratingShown();
  check("rating: hidden before the fifth popup open", !opened.shown);
  await browser.send("Target.closeTarget", { targetId: opened.tab.targetId });
  opened = await ratingShown();
  check("rating: offered after a week and five opens", opened.shown && /chromewebstore\.google\.com\/detail\/oled-night\/.*\/reviews$/.test(await opened.tab.eval("document.getElementById('rateLink').href")));
  await opened.tab.eval("document.getElementById('rateDismiss').click()"); await wait(200);
  check("rating: dismissing hides it", await opened.tab.eval("document.getElementById('ratePrompt').hidden"));
  await browser.send("Target.closeTarget", { targetId: opened.tab.targetId });
  opened = await ratingShown();
  check("rating: never offered again once dismissed", !opened.shown);
  await browser.send("Target.closeTarget", { targetId: opened.tab.targetId });

  // 0.6.79: the welcome page renders its sections and current shortcuts.
  const welcome = await browser.open(`chrome-extension://${id}/welcome.html`); await wait(700);
  const page079 = await welcome.eval(`({ title: document.querySelector('h1')?.textContent.trim(), sections: document.querySelectorAll('h2').length,
    shortcut: document.getElementById('extensionShortcut')?.textContent.trim(), settings: !!document.getElementById('openSettings') })`);
  check("welcome: renders its title, sections, shortcuts and settings link", !!page079.title && page079.sections >= 3 && !!page079.shortcut && page079.settings, JSON.stringify(page079));
} finally { await browser.close(); }
console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
