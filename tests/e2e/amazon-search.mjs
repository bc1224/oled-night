import assert from "node:assert/strict";
import { resolve } from "node:path";
import { launchChrome, wait } from "../lab/browser.mjs";

const card = `<div class="s-result-item" data-component-type="s-search-result">
  <div class="puis-card-container"><img class="s-image" alt="lights">
  <h2 class="a-color-base">Holiday lights</h2><span class="a-price">$20</span>
  <span class="a-color-secondary">Warm white</span>
  <span class="a-button a-button-primary"><button class="a-button-text">Add to cart</button></span></div></div>`;
const html = `<!doctype html><style>
  body,.puis-card-container{color:#0f1111;background:#fff}
  .a-color-base,.a-price{color:#0f1111!important}.a-color-secondary{color:#565959!important}
  .s-image{mix-blend-mode:multiply}.a-button-primary{background:#ffd814}
  .a-button-text{color:#0f1111;background:transparent}
  .a-button-normal,.a-button-normal .a-button-inner{background:#fff}
  </style><body><header><input id="twotabsearchtextbox"></header>
  <div id="s-refinements"><ul><li class="s-sprite-grid"><span class="a-list-item"><a class="a-link-normal s-navigation-item">
  <span class="a-button a-button-normal a-button-toggle a-button-small buttonsprite"><span class="a-button-inner">
  <button class="a-button-text"><span class="a-size-base a-color-base" id="sizeLabel">M</span></button></span></span></a></span></li></ul></div>
  <main id="search">${card.repeat(100)}</main></body>`;
const browser = await launchChrome({onEvent(event) {
  if (event.method === "Fetch.requestPaused") browser.send("Fetch.fulfillRequest", {
    requestId:event.params.requestId, responseCode:200,
    responseHeaders:[{name:"Content-Type",value:"text/html"}],body:Buffer.from(html).toString("base64")
  },event.sessionId);
}});
try {
  const {id} = await browser.send("Extensions.loadUnpacked",{path:resolve(process.env.EXT_PATH || resolve(import.meta.dirname,"../.."))});
  const options = await browser.open(`chrome-extension://${id}/options.html`);
  const page = await browser.open();
  await browser.send("Fetch.enable",{patterns:[{urlPattern:"*"}]},page.sessionId);
  await page.go("https://www.amazon.com/s?k=christmas+lights");
  const probe = () => page.eval(`(() => {
    const search=document.querySelector('#search'), card=search.lastElementChild;
    const css=selector=>getComputedStyle(card.querySelector(selector));
    return {marked:search.querySelectorAll('[data-oled-night]').length, page:getComputedStyle(document.body).backgroundColor,
      panel:css('.puis-card-container').backgroundColor,title:css('h2').color,price:css('.a-price').color,
      secondary:css('.a-color-secondary').color,photo:css('img').mixBlendMode,
      button:css('.a-button').backgroundColor,buttonText:css('button').color,
      // Size filter toggles (white .a-button-normal) under the forced light ink.
      size:[document.querySelector('.a-button-normal'),document.querySelector('.a-button-normal .a-button-inner')].map(n=>getComputedStyle(n).backgroundColor),
      sizeInk:getComputedStyle(document.getElementById('sizeLabel')).color};
  })()`);
  const initial = await probe();
  assert.equal(initial.marked,0,"Search cards must render without per-element rewriting");
  assert.equal(initial.page,"rgb(0, 0, 0)");
  assert.equal(initial.panel,initial.page);
  assert.equal(initial.title,"rgb(224, 224, 224)");
  assert.equal(initial.price,initial.title);
  assert.notEqual(initial.secondary,initial.title);
  assert.ok(Number(initial.secondary.match(/\d+/)[0])>=140);
  assert.equal(initial.photo,"normal");
  assert.equal(initial.button,"rgb(255, 216, 20)");
  assert.equal(initial.buttonText,"rgb(15, 17, 17)");
  const lum=v=>{const [r,g,b]=v.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  for (const paint of initial.size) assert.ok(ratio(initial.sizeInk,paint)>=4.5,`Size filter label must reach 4.5:1: ${initial.sizeInk} on ${paint}`);
  await page.eval(`document.querySelector('#search').insertAdjacentHTML('beforeend',${JSON.stringify(card.repeat(50))})`);
  await wait(150);
  assert.deepEqual(await probe(),initial,"New result cards must get the same palette without a scan");
  await options.eval("chrome.storage.sync.set({appearance:'soft',brightness:80})");await wait(250);
  assert.equal((await probe()).page,"rgb(16, 16, 20)");
  assert.equal((await probe()).title,"rgb(204, 204, 204)");
  await options.eval("chrome.storage.sync.set({extensionEnabled:false})");await wait(250);
  const restored=await probe();
  assert.equal(restored.photo,"multiply");
  assert.equal(restored.panel,"rgb(255, 255, 255)");
  assert.equal(restored.title,"rgb(15, 17, 17)");
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,siteRules:{'www.amazon.com':'invert'}})");
  await wait(250);
  assert.equal(await page.eval("document.documentElement.dataset.oledNightMode"),"invert");
  await options.eval("chrome.storage.sync.set({siteRules:{}})");
  await wait(250);
  assert.equal((await probe()).marked,0);
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,appearance:'oled'})");
  await page.go("https://www.amazon.com/dp/test");
  assert.ok((await probe()).marked>0,"Product detail pages keep the regular engine");
  console.log("Amazon search palette, incremental results, controls, tuning, restore and route scope passed");
} finally {await browser.close()}
