// Document metadata must stay byte-identical. Next.js's head manager compares
// head tags with isEqualNode and re-inserts any that differ, so a marked
// <script> runs twice (Zillow loaded Google Maps twice and its map crashed).
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { launchChrome, wait } from "../lab/browser.mjs";

const headTags = `<meta data-managed name="description" content="Homes">
  <link data-managed rel="preload" as="style" href="data:text/css,">
  <style data-managed id="app-css">body{background:#fff;color:#222}.card{background:#f6f6f6;color:#333}</style>
  <script data-managed id="maps-loader">window.__runs=(window.__runs||0)+1</script>`;
const html = `<!doctype html><html><head><title>Homes</title>${headTags}</head><body>
  <div id="__next"><main><h1>Seattle homes</h1>${'<div class="card"><p>3 bd, 2 ba</p></div>'.repeat(40)}</main>
  <script id="__NEXT_DATA__" type="application/json">{"page":"/search"}</script>
  <noscript>Enable JavaScript</noscript></div>
  <template id="server-head">${headTags}</template>
  <script>
    // Model of Next.js head-manager: compare the head tags it owns with server markup.
    const originals=[...document.getElementById('server-head').content.children];
    window.__reinserted=[];
    setTimeout(()=>{for(const tag of document.head.querySelectorAll('[data-managed]')){
      if(originals.some(o=>o.isEqualNode(tag)))continue;
      const fresh=document.createElement(tag.localName);for(const a of tag.attributes)fresh.setAttribute(a.name,a.value);
      fresh.textContent=tag.textContent;tag.replaceWith(fresh);window.__reinserted.push(tag.outerHTML.slice(0,160));
    }},1500);
  </script></body></html>`;

const browser = await launchChrome({onEvent(event) {
  if (event.method === "Fetch.requestPaused") browser.send("Fetch.fulfillRequest", {
    requestId:event.params.requestId, responseCode:200,
    responseHeaders:[{name:"Content-Type",value:"text/html"}],body:Buffer.from(html).toString("base64")
  },event.sessionId);
}});
try {
  await browser.send("Extensions.loadUnpacked",{path:resolve(process.env.EXT_PATH || resolve(import.meta.dirname,"../.."))});
  const page = await browser.open();
  await browser.send("Fetch.enable",{patterns:[{urlPattern:"https://homes.example/*"}]},page.sessionId);
  await page.go("https://homes.example/seattle/");
  await wait(2500);
  const result = await page.eval(`({
    painted: getComputedStyle(document.body).backgroundColor,
    content: document.querySelectorAll('main [data-oled-night], main[data-oled-night]').length,
    metadata: [...document.querySelectorAll('head, head *, script, style, link, meta, noscript, template, title')]
      .filter(e => e.hasAttribute('data-oled-night') || e.hasAttribute('style'))
      .map(e => e.localName + (e.id ? '#' + e.id : '')),
    reinserted: window.__reinserted, runs: window.__runs
  })`);
  assert.equal(result.painted, "rgb(0, 0, 0)", "The extension must still darken the page");
  assert.ok(result.content > 0, "Rendered content must still be painted");
  assert.deepEqual(result.metadata, [], "Non-rendered metadata must not be marked or styled");
  assert.deepEqual(result.reinserted, [], "A head manager must see unchanged head tags");
  assert.equal(result.runs, 1, "Head scripts must execute exactly once");
  console.log("head-metadata: ok");
} finally { await browser.close(); }
