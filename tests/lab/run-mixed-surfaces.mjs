import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {mixedSurfaceScenario} from './mixed-surface-scenario.mjs';
import {bookingScenario} from './booking-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),server=await serveLab(join(root,'tests/e2e/site'));let browser;const out=[];
try{
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`);
  await options.eval('chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,siteRules:{}})');await wait(400);
  for(const file of ['native-banner','email-newsletter','booking-form']){
    const page=await browser.open(`${server.origin}/${file}.html`);await wait(500);
    await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
    const scenario=file==='booking-form'?bookingScenario:mixedSurfaceScenario;
    out.push(...(await page.eval(`(${scenario.toString()})()`)).map(c=>({...c,name:file+' / '+c.name})));
  }
}finally{await browser?.close();await server.close()}
for(const c of out)console.log((c.ok?'PASS ':'FAIL ')+c.name+' '+c.detail);
if(out.some(c=>!c.ok))process.exitCode=1;
