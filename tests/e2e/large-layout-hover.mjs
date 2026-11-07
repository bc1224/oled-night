// Real unpacked runtime and native pointer input on a synthetic article layout.
// Pointer crossings over gaps of a large layout container must not re-read the
// whole layout. A bare state selector (":focus-visible", ":hover > x") once
// made the bounded descendant analysis fail and fall back to a full refresh.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {launchChrome,wait} from '../lab/browser.mjs';

const root=resolve(import.meta.dirname,'../..');
const paragraphs=Array.from({length:240},(_,i)=>`<p>Paragraph ${i} with <a href="#r${i}">a link</a> and <span class="note">note</span>.</p>`).join('');
const cards=Array.from({length:6},(_,i)=>`<div class="card" id="card${i}"><span class="title" id="title${i}">Card ${i}</span><span class="body">Card body</span></div>`).join('');
const fixture=`<!doctype html><html><head><style>
body{margin:0;background:#fff;color:#202122;font:15px sans-serif}
#layout{padding:60px 120px;display:grid;gap:40px}
#article p{margin:0 0 18px} a{color:#36c} .note{color:#54595d}
.card{background:#f8f9fa;border:1px solid #ccc;padding:12px;margin:0 0 12px}.card .title{color:#202122}
.card:hover .title{color:#c00}
:focus-visible{outline:2px solid #36c}
:hover > .unused-hint{color:#333}
:is(button,a):active{opacity:.9}
</style></head><body><div id="layout"><div id="cards">${cards}</div><div id="article">${paragraphs}</div></div></body></html>`;
let browser;
try{
  browser=await launchChrome({onEvent:m=>{if(m.method==='Fetch.requestPaused')browser.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(fixture).toString('base64')},m.sessionId).catch(()=>{})}});
  const {id}=await browser.send('Extensions.loadUnpacked',{path:resolve(process.env.EXT_PATH||root)});
  const options=await browser.open(`chrome-extension://${id}/options.html`);
  await options.eval(`chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,appearance:'oled',brightness:88})`);
  const page=await browser.open();
  await browser.send('Fetch.enable',{patterns:[{urlPattern:'*'}]},page.sessionId);
  await page.size(1280,900);
  await page.go('https://layout.example.test/article');await wait(2500);
  for(let i=0;i<40&&!await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')`);i++)await wait(250);
  assert.equal(await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')`),true,'extension active');
  const total=await page.eval(`document.getElementById('layout').getElementsByTagName('*').length`);
  await page.eval(`window.__measured=new Set();new MutationObserver(r=>{for(const x of r)if(x.oldValue===null)window.__measured.add(x.target)}).observe(document.documentElement,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['data-oled-night-measure','data-oled-night-measure-self','data-oled-night-measure-pseudo']});1`);
  // Left and right padding of #layout: the pointer target is the large container itself.
  for(let i=0;i<8;i++){await page.hover(i%2?40:1240,300+i*40);await wait(60);await page.hover(640,8);await wait(60)}
  await wait(1500);
  const measured=await page.eval(`window.__measured.size`);
  console.log(`layout gap hover re-read ${measured} of ${total} layout elements`);
  assert.ok(measured<=60,`gap hover re-read ${measured} of ${total} elements; expected a bounded path`);
  // Authored descendant hover rules still repaint readably.
  const read=`(()=>{const t=document.getElementById('title2');const c=getComputedStyle(t).color;const b=getComputedStyle(t.parentElement).backgroundColor;return c+'|'+b})()`;
  const resting=await page.eval(read);
  const box=await page.eval(`(()=>{const r=document.getElementById('card2').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await page.hover(box.x,box.y);await wait(400);
  const hovered=await page.eval(read);
  console.log('card title resting',resting,'hovered',hovered);
  assert.notEqual(hovered.split('|')[0],resting.split('|')[0],'card hover rule still applies to its title');
  const lum=c=>{const [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
  const [fg,bg]=hovered.split('|');const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);
  assert.ok(ratio>=4.5,`hovered title contrast ${ratio.toFixed(2)}`);
  console.log('PASS large layout hover stays bounded and readable');
}finally{await browser?.close()}
