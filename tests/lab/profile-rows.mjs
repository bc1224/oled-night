// Diagnostic counterfactuals, never release evidence or relaxed budget checks.
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {churnWorkload} from '../../docs/lab/performance.js';
const root=resolve(import.meta.dirname,'../..'),out=join(root,'dist/performance');mkdirSync(out,{recursive:true});
const rows=Array.from({length:2500},(_,i)=>`<div class="row"><span class="c"><b>Sender ${i}</b></span><span class="c">Subject ${i}</span><span class="c">snippet</span></div>`).join('');
const html=`<!doctype html><html><head><style>body{background:#fff;color:#202124}.row{display:flex;background:#fff;border-bottom:1px solid #eee}.row.hl{background:#f2f6fc}.c{padding:2px 6px;color:#5f6368}</style></head><body><div id="list">${rows}</div></body></html>`;
const server=createServer((_,res)=>{res.setHeader('content-type','text/html');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];
try{
 browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:root});const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();await page.size(1000,800);await browser.send('Performance.enable',{},page.sessionId);
 const metrics=async()=>Object.fromEntries((await browser.send('Performance.getMetrics',{},page.sessionId)).metrics.map(m=>[m.name,m.value]));
 for(const variant of ['native','active','light-scheme','root-none','no-row-sheet','no-extension-css','no-markers']){
  await options.eval(`chrome.storage.sync.clear().then(()=>chrome.storage.sync.set({extensionEnabled:${!variant.startsWith('native')},globalEnabled:true,siteRules:${variant==='auto'?'{}':"{'127.0.0.1':'recolor'}"}}))`);await wait(300);await page.go(`http://127.0.0.1:${server.address().port}/`);await wait(2000);let other;
  if(variant.endsWith('background'))other=await browser.open();else await browser.send('Page.bringToFront',{},page.sessionId);
  if(variant.startsWith('css-debugger')){await browser.send('DOM.enable',{},page.sessionId);await browser.send('CSS.enable',{},page.sessionId);if(variant==='css-debugger-disabled')await browser.send('CSS.disable',{},page.sessionId)}
  if(variant==='typed-tuning')await page.eval(`(()=>{const s=document.createElement('style');s.id='oled-night-diagnostic';s.textContent='@property --oln-light{syntax:"<percentage>";inherits:true;initial-value:88%}@property --oln-strength{syntax:"<number>";inherits:true;initial-value:.72}';document.head.append(s)})()`);
  if(variant==='unused-properties')await page.eval(`(()=>{const s=document.getElementById('oled-night-sheet').sheet;for(let i=s.cssRules.length-1;i>=0;i--){const r=s.cssRules[i];if(r.cssText.startsWith('@property')&&!['--oln-bg','--oln-fg','--oln-bb'].includes(r.name))s.deleteRule(i)}})()`);
  if(variant==='literal-paint')await page.eval(`(()=>{for(const e of document.querySelectorAll('[data-oled-night]')){const c=getComputedStyle(e);for(const [key,property] of [['bg','backgroundColor'],['fg','color'],['bb','borderBottomColor']])if(e.style.getPropertyValue('--oln-'+key))e.style.setProperty('--oln-'+key,c[property])}})()`);
  if(variant==='simple-guards')await page.eval(`(()=>{for(const e of document.querySelectorAll('style[id^="oled-night-"]')){const s=e.sheet;for(let i=s.cssRules.length-1;i>=0;i--){const r=s.cssRules[i];if(r.selectorText?.includes('[data-oled-night-measure] *')){const text=r.cssText.replaceAll(':not([data-oled-night-measure], [data-oled-night-measure] *)',':not([data-oled-night-measure])');s.deleteRule(i);s.insertRule(text,i)}}}})()`);
  if(variant==='light-scheme')await page.eval(`(()=>{const s=document.createElement('style');s.id='oled-night-diagnostic';s.textContent=':is(html,body,body *,#oled-night-diag-a#oled-night-diag-b){color-scheme:light!important}';document.head.append(s)})()`);
  if(variant==='root-none')await page.eval(`document.documentElement.setAttribute('data-oled-night-page','none')`);
  if(variant==='no-row-sheet')await page.eval(`document.getElementById('oled-night-row-paint').sheet.disabled=true`);
  if(variant==='no-extension-css')await page.eval(`(()=>{for(const e of document.querySelectorAll('style[id^="oled-night-"]'))e.sheet.disabled=true})()`);
  if(variant==='no-markers')await page.eval(`(()=>{for(const e of document.querySelectorAll('[data-oled-night]'))e.removeAttribute('data-oled-night')})()`);
  await wait(700);const before=await metrics(),work=await page.eval(`(${churnWorkload.toString()})()`),after=await metrics();
  const slider=variant==='native'?null:await options.eval(`(async()=>{const [t]=await chrome.tabs.query({url:'http://127.0.0.1:${server.address().port}/*'}),start=performance.now();for(const brightness of [60,70,80,90])await chrome.tabs.sendMessage(t.id,{type:'oled-night-preview',patch:{brightness}});return (performance.now()-start)/4})()`);
  const state=await page.eval(`({visibility:document.visibilityState,mode:document.documentElement.getAttribute('data-oled-night-mode'),brightness:document.documentElement.style.getPropertyValue('--oln-light'),marked:document.querySelectorAll('[data-oled-night]').length})`);
  const result={variant,state,work,slider,taskMs:1000*(after.TaskDuration-before.TaskDuration),scriptMs:1000*(after.ScriptDuration-before.ScriptDuration),styleMs:1000*(after.RecalcStyleDuration-before.RecalcStyleDuration),layoutMs:1000*(after.LayoutDuration-before.LayoutDuration)};results.push(result);console.log(JSON.stringify(result));writeFileSync(join(out,'row-counterfactuals.json'),JSON.stringify(results,null,2));if(other)await browser.send('Target.closeTarget',{targetId:other.targetId});if(variant.startsWith('css-debugger'))await browser.send('CSS.disable',{},page.sessionId);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
