// Synthetic, site-agnostic comparison: none | baseline (BASELINE_EXT) | candidate (CANDIDATE_EXT), on a dark page (deepen mode)
// and a light page (full recolor). Measures per-trigger main-thread cost and snapshots every
// element's final colors so the candidate can be checked for identical output.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const EXTS = { base: null, baseline: process.env.BASELINE_EXT, candidate: process.env.CANDIDATE_EXT };
const ORDER = (process.env.ORDER || 'base,baseline,candidate').split(',');
const QUICK = !!process.env.QUICK;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function page(dark) {
  const bg = dark ? "#313338" : "#ffffff", panel = dark ? "#2b2d31" : "#f2f3f5", text = dark ? "#dbdee1" : "#202124", muted = dark ? "#949ba4" : "#5f6368";
  let rules = "";
  for (let i = 0; i < 300; i++) rules += `.alt .m${i % 50} .t{color:${dark ? "#b5bac1" : "#3c4043"}} .modality .m${i % 50}:focus-within{outline:1px solid #5865f2} .x${i}{margin:0}\n`;
  let rows = "";
  for (let i = 0; i < 300; i++) rows += `<li class="msg m${i % 50}" tabindex="-1"><div class="av"></div><div class="body"><h3 class="hd"><span class="name">User ${i}</span><time class="ts">10:0${i % 10}</time></h3><div class="t">Message text ${i} with <a href="#">a link</a> and <code>code</code></div><div class="acc"><button class="btn">React</button></div></div></li>`;
  return `<!doctype html><html class="${dark ? "theme-dark" : "theme-light"}"><head><style>
  :root{--bg:${bg};--panel:${panel};--text:${text};--muted:${muted}}
  html.accent-b{--panel:${dark ? "#1e1f22" : "#e3e5e8"}}
  html.inverted{--bg:#111214;--panel:#1e1f22;--text:#f2f3f5;--muted:#949ba4}
  body{background:var(--bg);color:var(--text);font:14px sans-serif;margin:0}
  .side{background:var(--panel);width:200px;float:left;height:100vh}
  .msg{list-style:none;display:flex;gap:8px;padding:4px;border-bottom:1px solid ${dark ? "#3f4147" : "#e8eaed"};transition:background-color .3s,color .3s}
  .msg:hover{background:${dark ? "#2e3035" : "#f8f9fa"}}
  .av{width:32px;height:32px;border-radius:50%;background:#5865f2}
  .hd{margin:0;font-size:14px}.ts{color:var(--muted);margin-left:6px}
  .t a{color:#00a8fc}.btn{background:var(--panel);color:var(--text);border:1px solid #4e5058;transition:background-color .2s}
  .menu{position:fixed;top:40px;left:220px;background:${dark ? "#111214" : "#fff"};color:var(--text);box-shadow:0 8px 16px rgba(0,0,0,.24);padding:6px}
  .menu [role=menuitem]{padding:6px;color:var(--text)} .menu [role=menuitem].hl{background:#4752c4;color:#fff}
  .editor{min-height:40px;background:var(--panel);color:var(--text);margin:8px;padding:8px}
  ${rules}</style></head><body><nav class="side"><div class="t">Sidebar</div></nav>
  <main id="main"><ol id="list">${rows}</ol><div class="editor" contenteditable="true" role="textbox" id="ed">draft</div></main></body></html>`;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(page(req.url.includes("dark")));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

async function runVariant(name, ext) {
  const profile = mkdtempSync(join(tmpdir(), "oln-global-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-pipe", "--enable-unsafe-extension-debugging", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--window-size=1200,900", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows", "about:blank"], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const to = chrome.stdio[3], from = chrome.stdio[4];
  let id = 0, buf = ""; const pending = new Map();
  from.on("data", (c) => { buf += c; let e; while ((e = buf.indexOf("\0")) >= 0) { const m = JSON.parse(buf.slice(0, e)); buf = buf.slice(e + 1); if (m.id) pending.get(m.id)?.(m); } });
  const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); to.write(JSON.stringify({ id: i, method, params, sessionId }) + "\0"); });
  const out = { variant: name, pages: {} };
  try {
    if (ext) { const l = await send("Extensions.loadUnpacked", { path: resolve(ext) }); if (!l.result?.id) throw Error(JSON.stringify(l)); await sleep(1000); }
    const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
    const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
    for (const kind of ["dark", "light"]) {
      await send("Page.navigate", { url: `http://127.0.0.1:${port}/${kind}` }, sessionId);
      await sleep(2500);
      out.pages[kind] = await ev(`(${inPage.toString()})(${JSON.stringify(!!ext)}, ${QUICK})`);
      console.log(name, kind, JSON.stringify(out.pages[kind].cost));
    }
  } finally { chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
  return out;
}

// Runs inside the page.
async function inPage(expectExt, quick) {
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const h = document.documentElement;
  if (expectExt !== h.hasAttribute("data-oled-night-root")) throw Error("activation mismatch");
  const cost = async (fn) => { await frame(); let a = 0, b = 0; requestAnimationFrame(() => { a = performance.now(); }); fn(); for (let i = 0; i < 3; i++) await Promise.resolve(); await new Promise((r) => requestAnimationFrame(() => { b = performance.now(); r(); })); return b - a; };
  const med = async (fn, n = 15) => { const o = []; for (let i = 0; i < n; i++) { o.push(await cost(fn)); await sleep(30); } o.sort((x, y) => x - y); return +o[n >> 1].toFixed(2); };
  const snap = () => [...document.querySelectorAll("body *")].map((e) => { const c = getComputedStyle(e); return `${e.localName}.${e.className}|${e.getAttribute("data-oled-night")}|${c.backgroundColor}|${c.color}|${c.borderBottomColor}|${c.boxShadow}`; }).join("\n");
  let transitions = 0; const countAnims = () => { transitions = Math.max(transitions, document.getAnimations().filter((a) => a instanceof CSSTransition).length); };
  const settle = async () => { await frame(); countAnims(); await frame(); countAnims(); await sleep(700); await frame(); };
  const ed = document.getElementById("ed"), msg = document.querySelector(".msg .t"), results = { cost: {}, snaps: {}, elements: document.querySelectorAll("*").length };
  results.cost.htmlModalityClass = await med(() => h.classList.toggle("modality"), quick ? 31 : 15);
  if (quick) return results;
  h.classList.remove("modality"); await settle();
  results.cost.leafClass = await med(() => msg.classList.toggle("x1"));
  results.cost.keyupEditor = await med(() => ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Shift" })));
  results.cost.pointeroverMessage = await med(() => msg.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })));
  const rows = [...document.querySelectorAll('.msg .t')]; let k = 0;
  results.cost.pointerMoveBetweenRows = await med(() => { const from = rows[k % 50], to = rows[(k + 1) % 50]; k++; from.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: to })); to.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: from })); });
  const btns = [...document.querySelectorAll('.btn')]; let j = 0;
  results.cost.focusMoveBetweenButtons = await med(() => { const from = btns[j % 50], to = btns[(j + 1) % 50]; j++; from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to })); to.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: from })); });
  results.cost.focusinEditor = await med(() => ed.dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
  await settle(); results.snaps.initial = snap();
  // Real color changes driven by classes on <html>: same polarity, then descendant rule, then polarity flip.
  h.classList.add("accent-b"); await settle(); results.snaps.accentTheme = snap();
  h.classList.add("alt"); await settle(); results.snaps.descendantRule = snap();
  const menu = document.createElement("div"); menu.className = "menu"; menu.innerHTML = '<div role="menuitem">Reply</div><div role="menuitem" class="target">Copy</div>';
  document.body.append(menu); await settle(); results.snaps.menuOpen = snap();
  const item = menu.querySelector(".target"); item.classList.add("hl"); item.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })); await settle(); results.snaps.menuHighlight = snap();
  ed.focus(); ed.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); await settle(); results.snaps.editorFocus = snap();
  h.classList.add("inverted"); await sleep(300); await settle(); results.snaps.inheritedTheme = snap();
  results.transitionsDuringChecks = transitions;
  results.mode = h.getAttribute("data-oled-night-page") || (h.hasAttribute("data-oled-night-root") ? "on" : "off");
  return results;
}

if (QUICK) {
  const rows = [];
  for (const name of ORDER) { const r = await runVariant(name, EXTS[name]); rows.push({ name, dark: r.pages.dark.cost.htmlModalityClass, light: r.pages.light.cost.htmlModalityClass }); }
  server.close(); console.log(JSON.stringify(rows)); writeFileSync(process.env.OUT || "interaction-ab.json", JSON.stringify(rows, null, 2)); process.exit(0);
}
const VARIANTS = EXTS;
const all = {};
for (const [name, ext] of Object.entries(VARIANTS)) all[name] = await runVariant(name, ext);
server.close();
const report = { costs: {}, identicalToBaseline: {}, transitions: {} };
for (const [name, r] of Object.entries(all)) for (const kind of ["dark", "light"]) {
  report.costs[`${name}/${kind}`] = r.pages[kind].cost;
  report.transitions[`${name}/${kind}`] = r.pages[kind].transitionsDuringChecks;
}
for (const kind of ["dark", "light"]) {
  const a = all.baseline.pages[kind].snaps, b = all.candidate.pages[kind].snaps;
  report.identicalToBaseline[kind] = Object.fromEntries(Object.keys(a).map((k) => {
    const la = a[k].split("\n"), lb = b[k].split("\n");
    const idx = la.map((v, i) => v !== lb[i] ? i : -1).filter((i) => i >= 0);
    if (idx.length) report.samples = { ...(report.samples || {}), [`${kind}/${k}`]: idx.slice(0, 3).map((i) => ({ i, baseline: la[i], candidate: lb[i], base: all.base.pages[kind].snaps[k].split("\n")[i] })) };
    return [k, idx.length ? `${idx.length} of ${la.length} elements differ` : "identical"];
  }));
  report.identicalToBaseline[`${kind}-changedVsNoExtension`] = all.base.pages[kind].snaps.accentTheme !== a.accentTheme;
}
writeFileSync(process.env.OUT || "interaction-benchmark.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
