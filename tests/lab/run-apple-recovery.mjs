import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {appleRecoveryScenario} from './apple-recovery-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),server=await serveLab(join(root,'tests/e2e/site'));let browser;const checks=[];
try{
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:root});
  const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
  for(const width of [1200,390])for(const mode of ['auto','recolor']){
    await options.eval(`chrome.storage.sync.set({extensionEnabled:true,siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(300);
    await page.size(width,900);await page.go(`${server.origin}/apple-recovery.html`);await wait(300);await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
    checks.push(...(await page.eval(`(${appleRecoveryScenario.toString()})()`)).map(c=>({...c,name:width+' / '+mode+' / '+c.name})));
    await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(300);
    checks.push({name:width+' / '+mode+' / disable restores original input',ok:await page.eval("getComputedStyle(document.getElementById('recovery-code')).backgroundColor==='rgba(255, 255, 255, 0.8)'&&!document.documentElement.hasAttribute('data-oled-night-root')")});
  }
}finally{if(browser)await browser.close();await server.close()}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/apple-recovery.json'),JSON.stringify(checks,null,2));
for(const c of checks.filter(c=>!c.ok))console.log('FAIL '+c.name+' '+c.detail);
console.log(checks.filter(c=>c.ok).length+'/'+checks.length+' Apple recovery checks passed');if(checks.some(c=>!c.ok))process.exitCode=1;
