import {componentReceipt} from './component-receipt.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {serveLab} from './server.mjs';
import {launchChrome,wait} from './browser.mjs';
import {navigationWorkScenario} from './navigation-work-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),server=await serveLab(join(root,'tests/e2e/site'));let b;const checks=[];
try{b=await launchChrome();const {id}=await b.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});const options=await b.open(`chrome-extension://${id}/options.html`);await options.eval("chrome.storage.sync.set({siteRules:{'127.0.0.1':'recolor'}})");await wait(300);const page=await b.open(server.origin+'/navigation-work.html');await wait(1800);checks.push(...await page.eval(`(${navigationWorkScenario.toString()})()`));}finally{await b?.close();await server.close()}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/navigation-work-chrome.json'),JSON.stringify(componentReceipt('Chrome',{completed:true,fixtures:['navigation-work.html'],modes:['recolor'],states:['loaded','changed','restored'],coverage:['text','performance'],checks}),null,2));console.log(JSON.stringify(checks,null,2));if(checks.some(c=>!c.ok))process.exitCode=1;
