// Renders the store demo video (1920x1080, about 25 s, silent with captions) from the
// real extension in a throwaway headless Chrome, then joins the scenes with ffmpeg:
//   node tools/store-video.mjs            -> dist/oled-night-demo.mp4
// Needs network access for the live Wikipedia page and ffmpeg on PATH.
// Wikipedia text is CC BY-SA 4.0; the end card credits it.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "dist", "oled-night-demo.mp4");
const work = mkdtempSync(join(tmpdir(), "oled-night-video-"));
mkdirSync(dirname(outFile), { recursive: true });
const WIKI_HOST = "en.wikipedia.org";
const WIKI_URL = `https://${WIKI_HOST}/wiki/Aurora`;
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pngData = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
const W = 1920, H = 1080, ZOOM = 1.5;

const pages = new Map([["/dashboard.html", readFileSync(join(root, "store", "demo-dashboard.html"))]]);
const server = http.createServer((req, res) => {
  const body = pages.get(req.url.split("?")[0]);
  if (!body) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "oled-night-video-profile-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-pipe", "--enable-unsafe-extension-debugging", `--user-data-dir=${profile}`,
  "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1", "--lang=en-US", "about:blank"], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
let nextId = 0, buffer = "";
const pending = new Map();
chrome.stdio[4].on("data", (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf("\0")) >= 0) { const m = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); if (m.id) pending.get(m.id)?.(m); }
});
const send = (method, params = {}, sessionId) => new Promise((r) => { const id = ++nextId; pending.set(id, r); chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0"); });

async function tab(width, height, { background = false, zoom = 1 } = {}) {
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank", background });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: Math.round(width / zoom), height: Math.round(height / zoom), deviceScaleFactor: zoom, mobile: false }, sessionId);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] }, sessionId);
  return {
    targetId,
    go: async (url, wait = 1500) => { await send("Page.navigate", { url }, sessionId); await sleep(wait); },
    html: async (markup, wait = 500) => {
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

const font = "font-family: 'Segoe UI', system-ui, sans-serif;";
const caption = (text) => text ? `<div style="position:absolute;left:56px;bottom:56px;padding:18px 28px;border-radius:16px;background:rgba(10,10,14,.88);box-shadow:0 0 0 1px #2c2c38,0 20px 60px rgba(0,0,0,.5);color:#f5f5f7;font-size:40px;font-weight:650;letter-spacing:-.01em">${text}</div>` : "";

try {
  const { result } = await send("Extensions.loadUnpacked", { path: root });
  const extId = result.id;
  const ext = await tab(800, 600);
  await ext.go(`chrome-extension://${extId}/options.html`);
  const set = (patch) => ext.eval(`chrome.storage.sync.set(${JSON.stringify(patch)}).then(() => true)`);
  const shots = {};
  const capture = async (t, name, url, wait) => { await t.go(url, wait); shots[name] = join(work, `${name}.png`); await t.shot(shots[name]); };

  // Dashboard demo, off and on.
  const page = await tab(W, H, { zoom: ZOOM });
  await set({ siteRules: { "127.0.0.1": "off" } });
  await capture(page, "dashBefore", `${base}/dashboard.html`, 1500);
  await set({ siteRules: {} });
  await capture(page, "dashAfter", `${base}/dashboard.html`, 1500);

  // Per-site choices in Settings.
  await set({ siteRules: { [WIKI_HOST]: "on", "docs.example.com": "deepen", "sheets.example.com": "invert", "news.example.com": "recolor", "bank.example.com": "off" } });
  await page.go(`chrome-extension://${extId}/options.html`, 1200);
  await page.eval(`(() => { const d = document.getElementById("sitesPanel"); d.open = true; window.scrollTo(0, d.getBoundingClientRect().top + scrollY - 24); return true; })()`);
  await sleep(300);
  shots.settings = join(work, "settings.png");
  await page.shot(shots.settings);
  await set({ siteRules: {} });

  // Live Wikipedia, off and on. Created last so it is the active tab the popup reads.
  const wiki = await tab(W, H, { zoom: ZOOM });
  await set({ siteRules: { [WIKI_HOST]: "off" } });
  await capture(wiki, "wikiBefore", WIKI_URL, 5000);
  await set({ siteRules: {} });
  await capture(wiki, "wikiAfter", WIKI_URL, 5000);
  const status = await wiki.eval("document.documentElement.outerHTML.length");
  if (!status || status < 50000) throw new Error("Wikipedia did not load; check network access.");

  // Popup for the Wikipedia tab, at 2x.
  await send("Target.activateTarget", { targetId: wiki.targetId });
  const popup = await tab(720, 1200, { background: true, zoom: 2 });
  await popup.go(`chrome-extension://${extId}/popup.html`, 1200);
  const popupHost = await popup.eval(`document.getElementById("hostname").textContent`);
  if (!popupHost.includes("wikipedia")) throw new Error(`popup shows "${popupHost}", expected the Wikipedia tab`);
  const popupHeight = await popup.eval("Math.ceil(document.body.getBoundingClientRect().height)");
  shots.popup = join(work, "popup.png");
  await popup.shot(shots.popup, { x: 0, y: 0, width: 360, height: popupHeight });

  // Compose captioned 1920x1080 stills with the extension off for the canvas.
  await set({ siteRules: { "127.0.0.1": "off", "localhost": "off" } });
  const canvas = await tab(W, H);
  await canvas.go("about:blank", 200);
  const icon = pngData(join(root, "assets", "icon-128.png"));
  const still = async (name, markup) => {
    await canvas.html(`<body style="margin:0;width:${W}px;height:${H}px;background:#000;${font};color:#f5f5f7;overflow:hidden;position:relative">${markup}</body>`);
    const file = join(work, `scene-${name}.png`);
    await canvas.shot(file);
    return file;
  };
  const shotScene = (name, text) => still(name, `<img src="${pngData(shots[name])}" style="position:absolute;inset:0;width:${W}px;height:${H}px">${caption(text)}`);
  const popupScale = Math.min(2.2, 900 / popupHeight);
  const scenes = [
    [await still("title", `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">
      <div style="display:flex;align-items:center;gap:30px"><img src="${icon}" style="width:150px;height:150px"><div style="font-size:110px;font-weight:700;letter-spacing:-.03em">OLED Night</div></div>
      <div style="font-size:48px;color:#b4b4be">True-black dark mode for every website</div></div>`), 2.6],
    [await shotScene("wikiBefore", "A bright page at night"), 2.2],
    [await shotScene("wikiAfter", "One click: true black (#000000), images keep their colors"), 3.8],
    [await still("popup", `<img src="${pngData(shots.wikiAfter)}" style="position:absolute;inset:0;width:${W}px;height:${H}px;filter:brightness(.45)">
      <img src="${pngData(shots.popup)}" style="position:absolute;right:120px;top:${Math.round((H - popupHeight * popupScale) / 2) - 30}px;width:${Math.round(360 * popupScale)}px;border-radius:${Math.round(14 * popupScale)}px;box-shadow:0 0 0 1px #2c2c38,0 40px 120px rgba(155,140,255,.25)">
      ${caption("Control each site from the popup")}`), 3.6],
    [await shotScene("dashBefore", "Works on web apps too"), 2.0],
    [await shotScene("dashAfter", "Charts and photos keep their colors"), 3.4],
    [await shotScene("settings", "Pick a mode for any site"), 3.2],
    [await still("end", `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px">
      <div style="display:flex;align-items:center;gap:30px"><img src="${icon}" style="width:130px;height:130px"><div style="font-size:96px;font-weight:700;letter-spacing:-.03em">OLED Night</div></div>
      <div style="font-size:44px;color:#b4b4be">Free and open source for Chrome and Firefox</div>
      <div style="font-size:30px;color:#8a8a96">Private by design: no analytics, no account</div></div>
      <div style="position:absolute;bottom:28px;width:100%;text-align:center;font-size:20px;color:#55555f">Wikipedia page "Aurora", text CC BY-SA 4.0. Images by their respective authors.</div>`), 3.4]
  ];

  // Join with ffmpeg: wipes for before/after pairs, crossfades elsewhere.
  const FADE = 0.6;
  const transitions = ["fade", "wipeleft", "fade", "fade", "wipeleft", "fade", "fade"];
  const args = ["-y", "-loglevel", "error"];
  for (const [file, seconds] of scenes) args.push("-loop", "1", "-framerate", "30", "-t", String(seconds + FADE), "-i", file);
  let filter = "", last = "0:v", offset = 0;
  scenes.slice(0, -1).forEach(([, seconds], i) => {
    offset += seconds;
    const out = i === scenes.length - 2 ? "v" : `x${i}`;
    filter += `[${last}][${i + 1}:v]xfade=transition=${transitions[i]}:duration=${FADE}:offset=${offset.toFixed(2)}[${out}];`;
    last = out;
  });
  args.push("-filter_complex", `${filter}[v]format=yuv420p[out]`, "-map", "[out]", "-r", "30", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", outFile);
  const ff = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (ff.status !== 0) throw new Error(`ffmpeg failed (${ff.status})`);
  console.log(`Wrote ${outFile} (${scenes.reduce((s, [, d]) => s + d, 0).toFixed(1)} s)`);
} finally {
  chrome.kill();
  server.close();
  await sleep(400);
  for (const dir of [profile, process.env.KEEP_VIDEO_FRAMES ? null : work]) if (dir) try { rmSync(dir, { recursive: true, force: true }); } catch {}
  if (process.env.KEEP_VIDEO_FRAMES) console.log(`Frames kept in ${work}`);
}
