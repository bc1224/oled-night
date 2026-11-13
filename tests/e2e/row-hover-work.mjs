// Hovering or scrolling over Gmail-style rows must not recheck each row more
// than once per crossing. The fixture's :has() hover rule leaves the extension
// unable to prove what a row hover repaints, as on real Gmail, so this checks
// the conservative path. decide() calls are counted exactly by V8 coverage.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launchChrome, wait } from "../lab/browser.mjs";

const html = readFileSync(join(import.meta.dirname, "site", "row-hover.html")).toString("base64");
const browser = await launchChrome({ onEvent(event) {
  if (event.method !== "Fetch.requestPaused") return;
  browser.send("Fetch.fulfillRequest", { requestId: event.params.requestId, responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "text/html" }], body: html }, event.sessionId);
} });
let failures = 0, passes = 0;
const check = (name, ok, detail = "") => { ok ? passes++ : failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
try {
  await browser.send("Extensions.loadUnpacked", { path: resolve(process.env.EXT_PATH || resolve(import.meta.dirname, "../..")) });
  const page = await browser.open(), S = page.sessionId;
  await browser.send("Fetch.enable", { patterns: [{ urlPattern: "https://inbox.example/*" }] }, S);
  await browser.send("Target.activateTarget", { targetId: page.targetId });
  await browser.send("Profiler.enable", {}, S);
  await page.go("https://inbox.example/"); await wait(2500);
  // takePreciseCoverage resets the counts, so each call returns calls since the last one.
  const decides = async () => { const { result } = await browser.send("Profiler.takePreciseCoverage", {}, S); let n = 0;
    for (const script of result) if (script.url.endsWith("/content.js")) for (const fn of script.functions) if (fn.functionName === "decide") n += fn.ranges[0].count;
    return n; };
  await browser.send("Profiler.startPreciseCoverage", { callCount: true, detailed: false }, S);
  const x = 500;
  await browser.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: 20 }, S); await wait(400); await decides();
  for (let i = 1; i <= 20; i++) { await browser.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: 20 + i * 41 }, S); await wait(40); }
  await wait(400); const sweep = await decides();
  for (let i = 0; i < 20; i++) { await browser.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y: 300, deltaX: 0, deltaY: 41 }, S); await wait(60); }
  await wait(400); const scroll = await decides();
  const info = await page.eval(`({ mode: document.documentElement.getAttribute("data-oled-night-mode"), row: document.getElementById("row5").getElementsByTagName("*").length + 1,
    hovered: [...document.querySelectorAll("tr.zA")].find(row => row.matches(":hover"))?.id || null })`);
  check("row hover: the extension themes the dark inbox", info.mode === "crush", info.mode);
  // A crossing changes hover on two rows: the one left and the one entered.
  const budget = 2.4 * info.row;
  check("row hover: moving across rows rechecks each changed row once", sweep / 20 <= budget, `${(sweep / 20).toFixed(1)} decides per crossing, ${info.row} elements per row`);
  check("row hover: scrolling under a resting pointer rechecks each changed row once", scroll / 20 <= budget, `${(scroll / 20).toFixed(1)} decides per wheel tick`);
  check("row hover: the pointer still hovers a row after scrolling", !!info.hovered, info.hovered);
} finally { await browser.close(); }
console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
