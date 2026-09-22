// Isolated Chrome comparison. BENCH_VARIANT=base|oled|darkreader.
// DARKREADER_PATH must point to an official unpacked MV3 release.
// Run variants sequentially; see PERFORMANCE.md for methodology.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workload = process.env.BENCH_WORKLOAD || 'classes';
if (!['classes','transforms'].includes(workload)) throw Error('Unknown workload');
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
    for (let i = 0; i < 2500; i++) rows += `<div class="row" ${workload==='transforms'?'style="background:#fff;color:#202124"':''}><span class="c"><b>Sender ${i}</b></span><span class="c">Subject ${i}</span><span class="c">snippet</span></div>`;
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

const variant=process.env.BENCH_VARIANT || 'base';
const results=[];
try {
  if(variant!=='base') {
    const loaded=await send('Extensions.loadUnpacked',{path:variant==='darkreader'?resolve(process.env.DARKREADER_PATH):EXT});
    if(!loaded.result?.id) throw Error(JSON.stringify(loaded));
    await sleep(1000);
    const targets=(await send('Target.getTargets')).result.targetInfos;
    for(const t of targets) if(t.type==='page' && t.url!=='about:blank') await send('Target.closeTarget',{targetId:t.targetId});
  }
  const page=await openTab();
  await send('Performance.enable',{},page.sessionId);
  const metrics=async()=>Object.fromEntries((await send('Performance.getMetrics',{},page.sessionId)).result.metrics.map(m=>[m.name,m.value]));
  const processes=async()=>(await send('SystemInfo.getProcessInfo')).result.processInfo;
  for(const file of (workload==='transforms'?['rows.html']:['light.html','rows.html'])) {
    for(let repeat=0;repeat<3;repeat++) {
      const navStart=performance.now();
      await page.go(site('127.0.0.1',file),2000);
      const pageState=await page.eval("({bg:getComputedStyle(document.body).backgroundColor,oln:document.documentElement.hasAttribute('data-oled-night-root'),dr:!!document.querySelector('style.darkreader'),mode:document.documentElement.dataset.darkreaderMode,loadMs:performance.getEntriesByType('navigation')[0].loadEventEnd})");
      if(variant==='oled'&&!pageState.oln || variant==='darkreader'&&!pageState.dr || variant==='base'&&(pageState.oln||pageState.dr))throw Error('Invalid variant activation '+JSON.stringify(pageState));
      await send('HeapProfiler.collectGarbage',{},page.sessionId);
      const ids=(await processes()).map(p=>p.id);
      let privateMiB=null;
      if(process.platform==='win32') {
        const bytes=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Measure-Object PrivateMemorySize64 -Sum).Sum`],{encoding:'utf8',windowsHide:true}).trim();
        privateMiB=+(Number(bytes)/1048576).toFixed(1);
      }
      const idleBefore=await metrics(), cpuBefore=await processes();const idleStart=performance.now();
      await sleep(2000);
      const idleMs=performance.now()-idleStart,cpuIdle=await processes(), idleAfter=await metrics();
      const workStart=performance.now();
      const timing=await page.eval(`(async()=>{const rows=[...document.querySelectorAll('.row')];let ticks=0,worst=0,last=performance.now();const stop=last+3000;
        await new Promise(done=>{const tick=()=>{const now=performance.now();worst=Math.max(worst,now-last);last=now;ticks++;
          for(let k=0;k<Math.min(20,rows.length);k++){const row=rows[(ticks*20+k)%rows.length];if(${JSON.stringify(workload)}==='transforms')row.style.transform='translateX('+(ticks%2)+'px)';else row.classList.toggle('hl');}
          scrollTo(0,(ticks*60)%10000);if(now<stop)setTimeout(tick,16);else done();};tick();});return {ticks,worstMs:Math.round(worst)};})()`);
      const workMs=performance.now()-workStart, cpuAfter=await processes(),workAfter=await metrics();
      const cpuDelta=(before,after)=>after.reduce((sum,p)=>{const old=before.find(v=>v.id===p.id);return sum+(old?Math.max(0,p.cpuTime-old.cpuTime):0);},0)*1000;
      results.push({variant,file,repeat,pageState,privateMiB,jsHeapMiB:+(idleBefore.JSHeapUsedSize/1048576).toFixed(2),idleMs:Math.round(idleMs),workMs:Math.round(workMs),idleBrowserCpuMs:Math.round(cpuDelta(cpuBefore,cpuIdle)),workBrowserCpuMs:Math.round(cpuDelta(cpuIdle,cpuAfter)),idleRendererTaskMs:Math.round((idleAfter.TaskDuration-idleBefore.TaskDuration)*1000),workRendererTaskMs:Math.round((workAfter.TaskDuration-idleAfter.TaskDuration)*1000),...timing});
      console.log(JSON.stringify(results.at(-1)));
    }
  }
  writeFileSync(join(EXT,'dist',`benchmark-${variant}.json`),JSON.stringify({variant,workload,browser:(await send('Browser.getVersion')).result,results},null,2));
} finally {
  chrome.kill();server.close();await sleep(500);
  try{rmSync(profile,{recursive:true,force:true});}catch{}
}
