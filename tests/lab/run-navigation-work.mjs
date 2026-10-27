import {componentReceipt} from './component-receipt.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {serveLab} from './server.mjs';
import {launchChrome,wait} from './browser.mjs';
import {navigationWorkScenario,initialSheetLoadScenario} from './navigation-work-scenario.mjs';
import {parserWorkResult,parserWorkChecks,parserSurfaceResult} from './parser-work-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),server=await serveLab(join(root,'tests/e2e/site'));let b;const checks=[];
const initialOnly=process.argv.includes('--initial-sheet-only');
try{
 b=await launchChrome();const {id}=await b.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});const options=await b.open(`chrome-extension://${id}/options.html`);
 await options.eval("chrome.storage.sync.set({siteRules:{'127.0.0.1':'recolor'}})");await wait(300);const page=await b.open(server.origin+'/navigation-work.html');await wait(1800);
 const inspect=func=>options.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(server.origin+'/navigation-work.html')}});return(await chrome.scripting.executeScript({target:{tabId:tab.id},func:${func.toString()}}))[0].result})()`);
 if(!initialOnly){
  checks.push(...await inspect(navigationWorkScenario));
  // Initial-load coverage starts from a fresh document, independent of the
  // preceding navigation scenario's dynamic sheets, shadows and frame probes.
  await b.send('Page.reload',{},page.sessionId);await wait(1800);
 }
 checks.push(...await inspect(initialSheetLoadScenario));
 if(!initialOnly){
  const pair=[];
  for(const active of [false,true]){
   await options.eval(`chrome.storage.sync.set({extensionEnabled:${active},siteRules:{}})`);await wait(100);
   await page.go(server.origin+'/parser-work.html');pair.push(await page.eval(`(${parserWorkResult.toString()})()`));
  }
  checks.push(...parserWorkChecks(...pair));
  await page.go(server.origin+'/parser-surface.html');checks.push(await page.eval(`(${parserSurfaceResult.toString()})()`));
 }
}finally{await b?.close();await server.close()}
const receipt=componentReceipt('Chrome',{
 candidate:initialOnly,completed:true,
 fixtures:initialOnly?['navigation-work.html']:['navigation-work.html','parser-work.html','parser-surface.html'],
 modes:initialOnly?['recolor']:['recolor','auto'],
 states:initialOnly?['loaded','changed','restored']:['loaded','changed','restored','parsing'],
 coverage:initialOnly?['text','performance']:['text','surface','performance'],checks
});
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/navigation-work-chrome.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(checks,null,2));if(checks.some(c=>!c.ok))process.exitCode=1;
