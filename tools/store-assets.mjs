// Renders the Chrome Web Store images into store/images/ using the real
// extension in a throwaway headless Chrome:
//   screenshot-1-before-after.png  1280x800
//   screenshot-2-popup.png         1280x800
//   screenshot-3-dashboard.png     1280x800 (charts and product photo, before and after)
//   screenshot-4-welcome.png       1280x800 (first-install welcome page)
//   screenshot-5-settings.png      1280x800 (Settings and per-site choices)
//   promo-small.png                440x280
//   promo-marquee.png              1400x560
//   social-preview.png             1280x640 (GitHub social preview, website og:image)
//   node tools/store-assets.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "store", "images");
mkdirSync(outDir, { recursive: true });
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pngData = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;

const pages = new Map([["/demo.html", readFileSync(join(root, "store", "demo.html"))], ["/dashboard.html", readFileSync(join(root, "store", "demo-dashboard.html"))]]);
const server = http.createServer((req, res) => {
  const body = pages.get(req.url.split("?")[0]);
  if (!body) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "oled-night-store-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-pipe", "--enable-unsafe-extension-debugging", `--user-data-dir=${profile}`,
  "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1", "about:blank"], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
let nextId = 0, buffer = "";
const pending = new Map();
chrome.stdio[4].on("data", (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf("\0")) >= 0) { const m = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); if (m.id) pending.get(m.id)?.(m); }
});
const send = (method, params = {}, sessionId) => new Promise((r) => { const id = ++nextId; pending.set(id, r); chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0"); });

// zoom > 1 renders a smaller CSS viewport at a higher pixel ratio: the same
// 1280x800 output, but content is larger and easier to read in the store.
const ZOOM = 1.6;
async function tab(width, height, background = false, zoom = 1) {
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank", background });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: Math.round(width / zoom), height: Math.round(height / zoom), deviceScaleFactor: zoom, mobile: false }, sessionId);
  return {
    go: async (url, wait = 1500) => { await send("Page.navigate", { url }, sessionId); await sleep(wait); },
    html: async (markup, wait = 600) => {
      const { result: { frameTree } } = await send("Page.getFrameTree", {}, sessionId);
      await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html: markup }, sessionId);
      await sleep(wait);
    },
    eval: async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value,
    shot: async (file, clip) => {
      const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }, sessionId);
      writeFileSync(file, Buffer.from(r.result.data, "base64"));
    }
  };
}

try {
  const { result } = await send("Extensions.loadUnpacked", { path: root });
  const extId = result.id;
  const ext = await tab(800, 600);
  await ext.go(`chrome-extension://${extId}/options.html`);
  const set = (patch) => ext.eval(`chrome.storage.sync.set(${JSON.stringify(patch)}).then(() => true)`);

  // Same page with the extension off and on.
  // The mail demo has three columns, so it gets a milder zoom than the dashboard.
  const mail = await tab(1280, 800, false, 1.25);
  await set({ siteRules: { "127.0.0.1": "off" } });
  await mail.go(`${base}/demo.html`);
  await mail.shot(join(tmpdir(), "oled-before.png"));
  await set({ siteRules: {} });
  await mail.go(`${base}/demo.html`);
  await mail.shot(join(tmpdir(), "oled-after.png"));
  const page = await tab(1280, 800, false, ZOOM);
  await set({ siteRules: { "127.0.0.1": "off" } });
  await page.go(`${base}/dashboard.html`);
  await page.shot(join(tmpdir(), "oled-dash-before.png"));
  await set({ siteRules: {} });
  await page.go(`${base}/dashboard.html`);
  await page.shot(join(tmpdir(), "oled-dash-after.png"));

  // Real extension pages at store size.
  const pagesTab = await tab(1280, 800, false, ZOOM);
  await pagesTab.go(`chrome-extension://${extId}/welcome.html`, 1200);
  await pagesTab.shot(join(outDir, "screenshot-4-welcome.png"));
  await set({ siteRules: { "mail.example.com": "on", "docs.example.com": "deepen", "sheets.example.com": "invert", "news.example.com": "recolor", "bank.example.com": "off" } });
  await pagesTab.go(`chrome-extension://${extId}/options.html`, 1200);
  await pagesTab.eval(`(() => { const d = document.getElementById("sitesPanel"); d.open = true; window.scrollTo(0, d.getBoundingClientRect().top + scrollY - 24); return true; })()`);
  await sleep(300);
  await pagesTab.shot(join(outDir, "screenshot-5-settings.png"));
  await set({ siteRules: {} });

  // Popup, rendered at its real size. Opened as a background tab so the demo
  // page stays the active tab the popup reads its site and status from.
  const popup = await tab(360 * 2, 600 * 2, true, 2);
  await popup.go(`chrome-extension://${extId}/popup.html`, 800);
  // Chrome caps extension popups at 600px tall; fail loudly if it no longer fits.
  const popupHeight = await popup.eval("Math.ceil(document.body.getBoundingClientRect().height)");
  if (popupHeight > 600) throw new Error(`popup is ${popupHeight}px tall; Chrome shows at most 600px`);
  await popup.shot(join(tmpdir(), "oled-popup.png"), { x: 0, y: 0, width: 360, height: popupHeight });

  // Compose the store images on a canvas page with the extension turned off for it.
  await set({ siteRules: { "127.0.0.1": "off", "localhost": "off" } });
  const canvas = await tab(1280, 800);
  await canvas.go("about:blank", 200);
  const font = "font-family: 'Segoe UI', system-ui, sans-serif;";
  const splitShot = async (beforeFile, afterFile, out) => {
    const before = pngData(join(tmpdir(), beforeFile)), after = pngData(join(tmpdir(), afterFile));
    await canvas.html(`<body style="margin:0;width:1280px;height:800px;background:#000;${font};color:#f5f5f7;overflow:hidden">
    <div style="position:absolute;inset:0;background:url(${before}) 0 0/1280px 800px"></div>
    <div style="position:absolute;inset:0;clip-path:polygon(52% 0,100% 0,100% 100%,40% 100%);background:url(${after}) 0 0/1280px 800px"></div>
    <div style="position:absolute;top:0;bottom:0;left:40%;width:3px;background:#9b8cff;transform-origin:top left;transform:skewX(-8.5deg) translateX(118px)"></div>
    <div style="position:absolute;left:28px;bottom:28px;padding:10px 16px;border-radius:10px;background:rgba(255,255,255,.92);color:#111;font-weight:600">Before</div>
    <div style="position:absolute;right:28px;bottom:28px;padding:10px 16px;border-radius:10px;background:#9b8cff;color:#000;font-weight:700">OLED Night</div></body>`);
    await canvas.shot(join(outDir, out));
  };
  await splitShot("oled-before.png", "oled-after.png", "screenshot-1-before-after.png");
  await splitShot("oled-dash-before.png", "oled-dash-after.png", "screenshot-3-dashboard.png");

  // The popup fills most of the height so its controls are readable at store size.
  const popupScale = Math.min(1.9, 720 / popupHeight);
  await canvas.html(`<body style="margin:0;width:1280px;height:800px;background:#000;${font};color:#f5f5f7;display:flex;align-items:center;gap:56px;padding:0 64px 0 80px;box-sizing:border-box">
    <div style="flex:1"><div style="font-size:46px;font-weight:700;letter-spacing:-.03em;line-height:1.08">True black.<br>Readable text.<br>Images untouched.</div>
      <p style="margin-top:24px;font-size:20px;line-height:1.5;color:#a4a4ad">Per-site modes, brightness and contrast, image dimming, a schedule, and shortcuts.</p></div>
    <img src="${pngData(join(tmpdir(), "oled-popup.png"))}" style="width:${Math.round(360 * popupScale)}px;border-radius:${Math.round(14 * popupScale)}px;box-shadow:0 0 0 1px #26262e,0 30px 80px rgba(155,140,255,.18)"></body>`);
  await canvas.shot(join(outDir, "screenshot-2-popup.png"));

  const promo = await tab(440, 280);
  await promo.go("about:blank", 200);
  await promo.html(`<body style="margin:0;width:440px;height:280px;background:#000;${font};color:#f5f5f7;display:flex;align-items:center;gap:22px;padding:0 36px;box-sizing:border-box">
    <img src="${pngData(join(root, "assets", "icon-128.png"))}" style="width:96px;height:96px">
    <div><div style="font-size:34px;font-weight:700;letter-spacing:-.03em">OLED Night</div><div style="margin-top:8px;font-size:16px;color:#a4a4ad;line-height:1.4">True-black dark mode<br>for every site</div></div></body>`);
  await promo.shot(join(outDir, "promo-small.png"));

  // Large art: the Chrome Web Store marquee tile and the GitHub/website social preview.
  const split = pngData(join(outDir, "screenshot-1-before-after.png"));
  const icon = pngData(join(root, "assets", "icon-128.png"));
  const marquee = await tab(1400, 560);
  await marquee.go("about:blank", 200);
  const afterArt = pngData(join(tmpdir(), "oled-dash-after.png"));
  await marquee.html(`<body style="margin:0;width:1400px;height:560px;background:#000;${font};color:#f5f5f7;display:flex;align-items:center;gap:64px;padding:0 0 0 88px;box-sizing:border-box;overflow:hidden">
    <div style="flex:0 0 470px"><div style="display:flex;align-items:center;gap:20px"><img src="${icon}" style="width:88px;height:88px"><div style="font-size:58px;font-weight:700;letter-spacing:-.03em">OLED Night</div></div>
      <div style="margin-top:30px;font-size:38px;font-weight:600;line-height:1.2">True-black dark mode<br>for every site</div></div>
    <img src="${afterArt}" alt="OLED Night on a dashboard" style="width:800px;height:500px;border-radius:16px 0 0 16px;box-shadow:0 0 0 1px #2a2a34,0 30px 90px rgba(155,140,255,.25)"></body>`);
  await marquee.shot(join(outDir, "promo-marquee.png"));

  const social = await tab(1280, 640);
  await social.go("about:blank", 200);
  await social.html(`<body style="margin:0;width:1280px;height:640px;background:#000;${font};color:#f5f5f7;overflow:hidden;position:relative">
    <div style="position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:18px"><img src="${icon}" style="width:72px;height:72px"><div><div style="font-size:46px;font-weight:700;letter-spacing:-.03em;line-height:1">OLED Night</div><div style="margin-top:8px;font-size:21px;color:#a4a4ad">True-black (#000000) dark mode for Chrome and Firefox</div></div></div>
    <img src="${split}" alt="OLED Night before and after" style="position:absolute;left:64px;right:64px;top:196px;width:1152px;height:720px;border-radius:14px;box-shadow:0 0 0 1px #26262e,0 30px 90px rgba(155,140,255,.2)"></body>`);
  await social.shot(join(outDir, "social-preview.png"));
  console.log(`Wrote store images to ${outDir}`);
} finally {
  chrome.kill();
  server.close();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
