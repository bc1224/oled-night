// Real unpacked runtime, native keyboard input, and a synthetic Gmail origin.
// No live mailbox or account is accessed by this regression.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {launchChrome,wait} from '../lab/browser.mjs';

const root=resolve(import.meta.dirname,'../..');
const rules=Array.from({length:28500},(_,i)=>`.unused-${i} .nested[data-state="ready"]:hover{color:#ddd;background:transparent}`).join('\n');
const rows=Array.from({length:1000},(_,i)=>`<div class="row"><span>Message ${i}</span><b>Subject</b><span>Preview</span></div>`).join('');
const prefixSheets=Array.from({length:18},(_,sheet)=>'<style>'+Array.from({length:32},(_,rule)=>`.prefix-${sheet}-${rule}{color:#aaa;background:transparent}`).join('\n')+'</style>').join('');
const fixture=`<!doctype html><html><head>${prefixSheets}<style>
body{background:#202124;color:#e8eaed;font:14px Arial}.row{height:24px}.row span,b{color:#e8eaed}
input{background:#303134;color:#e8eaed} .late{background:#202124;color:#ddd}
${rules}
body.visual-mode .late{background:#fff;color:#111}
</style></head><body><input id="search" aria-label="Search mail"><div class="late">Late rule</div><div id="history">${rows}</div>
<script>let sequence=0;const search=document.getElementById('search');search.addEventListener('input',()=>document.body.classList.toggle('unused-inbox-state',++sequence%2===0));const fieldRule=[...document.styleSheets[18].cssRules].find(rule=>rule.selectorText==='input');search.addEventListener('keydown',event=>{if(event.key==='ArrowUp')fieldRule.style.backgroundColor='#fff'});</script></body></html>`;
let browser;const results=[];
try{
 browser=await launchChrome({onEvent:m=>{if(m.method==='Fetch.requestPaused')browser.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(fixture).toString('base64')},m.sessionId).catch(e=>console.error(e.message))}});
 const {id}=await browser.send('Extensions.loadUnpacked',{path:resolve(process.env.EXT_PATH||root)});
 const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
 await browser.send('Fetch.enable',{patterns:[{urlPattern:'*'}]},page.sessionId);
 await browser.send('Performance.enable',{},page.sessionId);
 const metrics=async()=>Object.fromEntries((await browser.send('Performance.getMetrics',{},page.sessionId)).metrics.map(m=>[m.name,m.value]));
 for(const enabled of [false,true,false,true]){
  await options.eval(`chrome.storage.sync.set({extensionEnabled:${enabled},globalEnabled:true,appearance:'oled',brightness:88,siteRules:{'mail.google.com':'global'}})`);
  await page.go('https://mail.google.com/oled-night-synthetic-large-css');await wait(1200);
  assert.equal(await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')`),enabled);
  await page.eval(`document.getElementById('search').focus()`);await wait(500);
  if(enabled&&process.env.OLED_GMAIL_DIAGNOSTIC){await browser.send('Profiler.enable',{},page.sessionId);await browser.send('Profiler.start',{},page.sessionId)}
  const before=await metrics(),deliveries=[];
  for(const key of 'abcdefghijklmnopqrstuvwxyz'){
   const start=performance.now();
   await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key,text:key},page.sessionId);
   await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key},page.sessionId);
   deliveries.push(performance.now()-start);await wait(25);
  }
  const after=await metrics();
  assert.equal(await page.eval(`document.getElementById('search').value`),'abcdefghijklmnopqrstuvwxyz');
  const sorted=deliveries.toSorted((a,b)=>a-b);
  const result={enabled,scriptMs:(after.ScriptDuration-before.ScriptDuration)*1000,styleMs:(after.RecalcStyleDuration-before.RecalcStyleDuration)*1000,stylePasses:after.RecalcStyleCount-before.RecalcStyleCount,deliveryP95:sorted[Math.ceil(sorted.length*.95)-1]};
  results.push(result);console.log(JSON.stringify(result));
  if(enabled&&process.env.OLED_GMAIL_DIAGNOSTIC){
   const {profile}=await browser.send('Profiler.stop',{},page.sessionId),counts=new Map();
   for(const sample of profile.samples||[])counts.set(sample,(counts.get(sample)||0)+1);
   console.log(JSON.stringify({diagnostic:profile.nodes.map(n=>({name:n.callFrame.functionName,line:n.callFrame.lineNumber+1,self:counts.get(n.id)||0})).sort((a,b)=>b.self-a.self).slice(0,16)}));
  }
  if(enabled){
   await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp'},page.sessionId);
   const fieldPaint=await page.eval(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(getComputedStyle(document.getElementById('search')).backgroundColor))))`);
   assert.notEqual(fieldPaint,'rgb(255, 255, 255)','native keyboard CSSOM field updates must still be dark before display');
   await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowUp'},page.sessionId);
   await page.eval(`document.body.classList.add('visual-mode')`);await wait(700);
   const paint=await page.eval(`(()=>{const s=getComputedStyle(document.querySelector('.late'));return{background:s.backgroundColor,color:s.color}})()`);
   assert.notEqual(paint.background,'rgb(255, 255, 255)','genuine class paint beyond the large stylesheet must still be darkened');
  }
 }
 mkdirSync(join(root,'dist/performance'),{recursive:true});writeFileSync(join(root,'dist/performance/gmail-large-css.json'),JSON.stringify(results,null,2));
 const native=results.filter(r=>!r.enabled),active=results.filter(r=>r.enabled);
 const mean=(a,key)=>a.reduce((s,r)=>s+r[key],0)/a.length;
 assert(mean(active,'scriptMs')<=mean(native,'scriptMs')+100,'large stylesheets must not add repeated CSSOM proof work during typing');
 assert(mean(active,'deliveryP95')<=mean(native,'deliveryP95')+8,'native keyboard delivery must leave half a frame for the page to render');
 assert(mean(active,'stylePasses')<=mean(native,'stylePasses')+208,'native text input must coalesce recoloring before paint instead of forcing repeated style flushes for each key event');
 assert.deepEqual(browser.errors,[]);
}finally{await browser?.close()}
