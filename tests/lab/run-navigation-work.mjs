import {componentReceipt} from './component-receipt.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {serveLab} from './server.mjs';
import {launchChrome,wait} from './browser.mjs';
import {navigationWorkScenario,initialSheetLoadScenario} from './navigation-work-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),server=await serveLab(join(root,'tests/e2e/site'));let b;const checks=[];
try{
 b=await launchChrome();const {id}=await b.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});const options=await b.open(`chrome-extension://${id}/options.html`);
 await options.eval("chrome.storage.sync.set({siteRules:{'127.0.0.1':'recolor'}})");await wait(300);await b.open(server.origin+'/navigation-work.html');await wait(1800);
 const inspect=func=>options.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(server.origin+'/navigation-work.html')}});return(await chrome.scripting.executeScript({target:{tabId:tab.id},func:${func.toString()}}))[0].result})()`);
 if(!process.argv.includes('--initial-sheet-only'))checks.push(...await inspect(navigationWorkScenario));
 await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(100);await options.eval('chrome.storage.sync.set({extensionEnabled:true})');await wait(400);
 checks.push(...await inspect(initialSheetLoadScenario));
}finally{await b?.close();await server.close()}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/navigation-work-chrome.json'),JSON.stringify(componentReceipt('Chrome',{completed:true,fixtures:['navigation-work.html'],modes:['recolor'],states:['loaded','changed','restored'],coverage:['text','performance'],checks}),null,2));console.log(JSON.stringify(checks,null,2));if(checks.some(c=>!c.ok))process.exitCode=1;
