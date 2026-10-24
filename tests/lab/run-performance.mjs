// Focused runner for the unchanged performance workloads used by the full lab.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {buildLab} from '../../tools/build-lab.mjs';
import {serveLab} from './server.mjs';
import {launchChrome,wait} from './browser.mjs';
import {frameWorkload,frameChecks} from '../../docs/lab/performance.js';
import {largeUpdatesScenario} from './large-updates-scenario.mjs';
import {restoredSelectionScenario} from './restored-selection-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),out=join(root,'dist/performance');
mkdirSync(out,{recursive:true});
const server=await serveLab(buildLab({output:join(out,'site')}).output);
let browser;const pairs=[],resources=[],checks=[];
try{
 browser=await launchChrome();
 const {id}=await browser.send('Extensions.loadUnpacked',{path:resolve(process.env.OLED_PERF_PACKAGE||join(root,'dist/chrome'))});
 const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
 await browser.send('Performance.enable',{},page.sessionId);
 const metrics=async()=>Object.fromEntries((await browser.send('Performance.getMetrics',{},page.sessionId)).metrics.map(m=>[m.name,m.value]));
 const widths=process.argv.includes('--correctness')?[]:process.env.OLED_PERF_WIDTH?[Number(process.env.OLED_PERF_WIDTH)]:[1200,390];
 for(const width of widths){
  const samples=[];await page.size(width,1000);
  for(const order of [[true,false],[false,true],[true,false]]){
   const pair={pageOnly:true};
   for(const enabled of order){
    await options.eval(`chrome.storage.sync.set({extensionEnabled:${enabled},globalEnabled:true,siteRules:{'127.0.0.1':'recolor'}})`);await wait(500);
    await page.go(`${server.origin}/lab/fixtures/large-updates.html`);await wait(2000);
    pair.pageOnly&&=await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')===${enabled}&&document.querySelectorAll('.row').length===2500`);
    await page.hover(200,650);await wait(160);
    const before=await metrics();pair[enabled?'active':'native']=await page.eval(`(${frameWorkload.toString()})()`);const after=await metrics();
    resources.push({width,enabled,frames:pair[enabled?'active':'native'].frames,scriptMs:1000*(after.ScriptDuration-before.ScriptDuration),layoutMs:1000*(after.LayoutDuration-before.LayoutDuration),styleMs:1000*(after.RecalcStyleDuration-before.RecalcStyleDuration),stylePasses:after.RecalcStyleCount-before.RecalcStyleCount});
   }
   samples.push(pair);
  }
  pairs.push({width,samples});checks.push(...frameChecks(samples).map(c=>({...c,name:`${width}px / ${c.name}`})));
  console.log(JSON.stringify({width,checks:checks.filter(c=>c.name.startsWith(width+'px'))}));
 }
 if(process.argv.includes('--correctness')){
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,siteRules:{'127.0.0.1':'recolor'}})");await wait(500);
  await page.go(`${server.origin}/lab/fixtures/large-updates.html`);await wait(2000);
  await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
  // Keep this candidate regression separate from the historical, single-fault
  // report baseline used by the full lab. It must fail on the old runtime.
  checks.push(await page.eval(`(async()=>{
   const row=document.querySelector('.row:last-child'),before=getComputedStyle(row).backgroundColor;
   row.classList.add('hl');await new Promise(r=>setTimeout(r,80));
   const after=getComputedStyle(row).backgroundColor;
   return {name:'proven offscreen background changes paint immediately without viewport tracking',ok:after!==before&&window.OLEDLabAudit.lum(after)<.16,detail:JSON.stringify({before,after})};
  })()`));
  const counts=await options.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(server.origin+'/lab/fixtures/large-updates.html')}});return (await chrome.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts})()`);
  checks.push({name:'cheap background updates retain no viewport observations or deferred paint',ok:counts.observedPaint===0&&counts.deferredPaint===0,detail:JSON.stringify(counts)});
  await page.eval("document.querySelector('.row:last-child').classList.remove('hl')");await wait(80);
  await options.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(server.origin+'/lab/fixtures/large-updates.html')}});await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{const native=globalThis.getComputedStyle;globalThis.__oledPointerCalls=[];globalThis.__oledRestorePointerProbe=()=>{globalThis.getComputedStyle=native};globalThis.getComputedStyle=function(node,...args){if(document.documentElement.hasAttribute('data-lab-pointer-probe')&&globalThis.__oledPointerCalls.length<8)globalThis.__oledPointerCalls.push({node:node.localName+'.'+node.className,stack:new Error().stack});return native.call(this,node,...args)}}})})()`);
  try{checks.push(...await page.eval(`(${largeUpdatesScenario.toString()})()`))}finally{const calls=await options.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(server.origin+'/lab/fixtures/large-updates.html')}});return(await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{globalThis.__oledRestorePointerProbe?.();return globalThis.__oledPointerCalls}}))[0].result})()`);if(checks.some(c=>!c.ok))console.log('POINTER READ CALLERS '+JSON.stringify(calls))}
  checks.push(...await page.eval(`(${restoredSelectionScenario.toString()})()`));
  console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok)}));
 }
 if(process.env.OLED_PERF_PROFILE){
  await options.eval("chrome.storage.sync.set({extensionEnabled:true})");await wait(500);await page.go(`${server.origin}/lab/fixtures/large-updates.html`);await wait(2000);
  await browser.send('Profiler.enable',{},page.sessionId);await browser.send('Profiler.start',{},page.sessionId);await page.eval(`(${frameWorkload.toString()})()`);
  const {profile}=await browser.send('Profiler.stop',{},page.sessionId);writeFileSync(join(out,'active.cpuprofile'),JSON.stringify(profile));
 }
 writeFileSync(join(out,'results.json'),JSON.stringify({pairs,resources,checks,origin:server.origin},null,2));
 if(checks.some(c=>!c.ok))process.exitCode=1;
}finally{if(browser)await browser.close();await server.close();}
