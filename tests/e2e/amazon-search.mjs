import assert from "node:assert/strict";
import { resolve } from "node:path";
import { launchChrome, wait } from "../lab/browser.mjs";

const card = `<div class="s-result-item" data-component-type="s-search-result">
  <div class="puis-card-container"><img class="s-image" alt="lights">
  <h2 class="a-color-base">Holiday lights</h2><span class="a-price">$20</span>
  <span class="a-color-secondary">Warm white</span>
  <div class="a-section a-spacing-none a-text-center"><div class="a-section s-color-swatch-container s-color-swatch-container-left-aligned">
  <span class="s-color-swatch-outer-circle"><span class="s-color-swatch-inner-circle-fill" style="background-color:#c0392b"></span></span>
  <div><a aria-label="+18 other colors/patterns" class="a-link-normal s-color-swatch-link" href="#"><u>+18</u></a></div></div></div>
  <span class="a-button a-button-primary"><button class="a-button-text">Add to cart</button></span></div></div>`;
// Widgets that set their own colors (live search page, November 2026): the
// Prime delivery line, the same-day carousel, sponsored carousel cards, the
// "Narrow your search" tiles, a widget on Amazon's color tokens and the cart.
const widgets = `<div class="s-widget-container"><div id="CardInstanceTest" class="a-section"><div>
  <div class="a-section a-spacing-none a-padding-none qh-wrap"><div class="a-section qcx_desktopHeaderContainer__x">
  <div class="qcx_desktopDeliveryTitle__x"><span id="carouselTitle">Delivered in </span><strong class="qcx_minutesFull__x" id="minutes">39 minutes</strong></div></div>
  <div class="a-cardui-deck qcx_desktopCards__x"><div class="a-cardui qcx_desktopProductCard__x">
  <span class="qcx_desktopProductNameShortTitle__x" id="deckName">Wireless headphones</span><span class="qcx_desktopRatingValue__x" id="deckRating">4.5</span>
  <span class="qcx_desktopReviewCount__x" id="deckReviews">(1.3K)</span><span class="a-size-small qcx_desktopProductDeliveryText__x a-text-bold" id="deckDelivery">Delivered in 39 minutes</span>
  </div></div></div></div></div></div>
  <div class="s-result-item"><span class="a-icon-wrapper a-icon-prime-with-text"><span class="a-icon-text udm-secondary-delivery-message" id="primeLine">FREE delivery Tomorrow</span></span></div>
  <ol class="a-carousel"><li class="a-carousel-card"><div class="sp_item" id="spCard"><span class="a-size-small a-color-base" id="spTitle">Sponsored headphones</span>
  <span class="a-size-small a-color-secondary" id="spMuted">Typical price</span></div></li>
  <li class="a-carousel-card s-tile"><div class="a-section scx-stt-tile-container" id="tile"><span id="tileLabel">Workout</span></div></li></ol>
  <div class="token-widget" id="tokenCard"><span id="tokenText">Token colored text</span></div>
  <span class="a-badge"><span class="a-badge-label"><span class="a-badge-text" id="badgeText">Amazon Exclusive</span></span></span>
  <div class="haul-puis-widget-faceout-container"><a class="a-link-normal haul-puis-widget-product-info-container" href="#">
  <div class="a-section a-spacing-none a-text-left haul-info"><span class="a-price" id="haulPrice">$9.99</span></div></a></div>
  <a class="a-link-normal s-link-style" href="#"><span class="a-size-base a-color-link s-underline-text" id="linkSpan">One-time purchase</span></a>`;
const cart = `<div id="nav-flyout-ewc" class="nav-flyout"><div class="nav-flyout-body ewc-beacon"><div id="ewc-compact-body">
  <span id="ewcSubtotal">Subtotal</span><span class="a-size-base a-color-price a-text-bold" id="ewcPrice">$25.99</span><span id="ewcShip">FREE Same-Day delivery</span>
  <div class="a-stepper-inner-container" id="ewcStepper"><span id="ewcQty">1</span></div></div></div></div>`;
const html = `<!doctype html><style>
  body,.puis-card-container{color:#0f1111;background:#fff}
  .a-color-base,.a-price{color:#0f1111!important}.a-color-secondary{color:#565959!important}
  .s-image{mix-blend-mode:multiply}.a-button-primary{background:#ffd814}
  .a-button-text{color:#0f1111;background:transparent}
  .a-button-normal,.a-button-normal .a-button-inner{background:#fff}
  .s-color-swatch-container{display:flex;background:#fff}.s-color-swatch-inner-circle-fill{display:inline-block;width:12px;height:12px}
  .s-color-swatch-link{color:#2162a1}
  .qh-wrap,.a-cardui-deck{background:#f5f3ef}.a-cardui{background:#fff}[class*=DeliveryTitle]{color:#0f1111}[class*=minutesFull]{color:#ff6600}
  [class*=ProductName],[class*=RatingValue],[class*=DeliveryText]{color:#0f1111}[class*=ReviewCount]{color:#565959}
  .a-icon-prime-with-text{color:#0f1111}.sp_item{background:#fff}.scx-stt-tile-container{background:#f5f5f5;color:#0f1111}
  .token-widget{background:var(--aok-sfs-color-page-primary-normal-bg,#fff);color:var(--aok-sfs-color-page-primary-normal-fg,#0f1111)}
  .nav-flyout-body,#ewc-compact-body{background:#fff}.a-color-price{color:#b12704}.a-stepper-inner-container{background:#fff;color:#0f1111}
  .a-badge-label{background:#fff;border:1px solid #232f3e}.a-badge-text{color:var(--aok-sfs-color-page-primary-normal-fg,#0f1111)}
  .haul-info{background:#fff}.a-color-link{color:#2162a1}
  </style><body><header><input id="twotabsearchtextbox">${cart}</header>
  <div id="s-refinements"><ul><li class="s-sprite-grid"><span class="a-list-item"><a class="a-link-normal s-navigation-item">
  <span class="a-button a-button-normal a-button-toggle a-button-small buttonsprite"><span class="a-button-inner">
  <button class="a-button-text"><span class="a-size-base a-color-base" id="sizeLabel">M</span></button></span></span></a></span></li></ul></div>
  <main id="search">${widgets}${card.repeat(100)}</main></body>`;
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
      sizeInk:getComputedStyle(document.getElementById('sizeLabel')).color,
      // "+18 other colors" swatch link: its ink and the first opaque surface behind it.
      swatch:(()=>{const u=card.querySelector('.s-color-swatch-link u');let n=u,back='';
        while(n&&n.nodeType===1){const c=getComputedStyle(n).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){back=c;break}n=n.parentElement}
        return {ink:getComputedStyle(u).color,back,chip:getComputedStyle(card.querySelector('.s-color-swatch-inner-circle-fill')).backgroundColor};})()};
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
  assert.ok(ratio(initial.swatch.ink,initial.swatch.back)>=4.5,`Color swatch link must reach 4.5:1: ${initial.swatch.ink} on ${initial.swatch.back}`);
  assert.equal(initial.swatch.chip,"rgb(192, 57, 43)","Color swatch chips keep their own color");
  const widgetInk = () => page.eval(`(() => {
    const painted = node => { for (let n = node; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor;
      if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return getComputedStyle(document.documentElement).backgroundColor; };
    return Object.fromEntries(['carouselTitle','minutes','deckName','deckRating','deckReviews','deckDelivery','primeLine','spTitle','spMuted','tileLabel','tokenText','badgeText','haulPrice','linkSpan','ewcSubtotal','ewcPrice','ewcShip','ewcQty']
      .map(id => { const e = document.getElementById(id); return [id, {ink: getComputedStyle(e).color, back: painted(e)}]; }));
  })()`);
  const live = await widgetInk();
  for (const [id, {ink, back}] of Object.entries(live)) assert.ok(ratio(ink, back) >= 4.5, `${id} must reach 4.5:1: ${ink} on ${back}`);
  for (const id of ["deckName", "primeLine", "spTitle", "tileLabel", "tokenText", "haulPrice", "linkSpan", "ewcSubtotal"]) assert.ok(lum(live[id].back) < 0.05, `${id} sits on a dark surface: ${live[id].back}`);
  assert.equal(live.minutes.ink, "rgb(255, 102, 0)", "The orange delivery time keeps its color");
  assert.equal(live.badgeText.back, "rgb(255, 255, 255)", "A white badge keeps its face and its dark ink");
  assert.equal(live.ewcQty.back, "rgb(255, 255, 255)", "The cart quantity stepper keeps its white face for its dark icons");
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
  assert.deepEqual(restored.swatch,{ink:"rgb(33, 98, 161)",back:"rgb(255, 255, 255)",chip:"rgb(192, 57, 43)"});
  const authored = await widgetInk();
  assert.deepEqual(authored.tokenText, {ink:"rgb(15, 17, 17)", back:"rgb(255, 255, 255)"}, "Disabling restores Amazon's token fallbacks");
  assert.deepEqual(authored.primeLine.ink, "rgb(15, 17, 17)");
  assert.deepEqual(authored.ewcShip.back, "rgb(255, 255, 255)");
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
