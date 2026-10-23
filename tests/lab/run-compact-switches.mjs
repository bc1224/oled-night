import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {componentReceipt} from './component-receipt.mjs';
import {compactSwitchProbe,compactSwitchPaint,compactSwitchRestored} from './compact-switches-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/compact-switches');mkdirSync(output,{recursive:true});
const server=await serveLab(join(root,'tests/e2e/site')),version=JSON.parse(readFileSync(join(root,'dist/chrome/manifest.json'))).version;let browser,completed=false;const checks=[];
try{
 browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
 const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();await page.size(1000,800);
 for(const mode of ['auto','recolor']){
  await options.eval(`chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,brightness:88,contrast:72,dimImages:false,siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);
  await wait(350);await page.go(server.origin+'/compact-switches.html');await wait(650);
  const capture=async state=>{const probe=await page.eval(`(${compactSwitchProbe.toString()})()`),shot=await page.screenshot();writeFileSync(join(output,`${mode}-${state}.png`),shot);checks.push(...compactSwitchPaint(shot,probe,state,version,mode).map(c=>({...c,name:mode+' / '+c.name})))};
  await capture(false);
  await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
  const audit=await page.eval("OLEDLabAudit.audit(document)");checks.push(...audit.map(c=>({...c,name:mode+' / QA page / '+c.name})));
  checks.push({coverage:'identity',name:mode+' / QA audit covers both generated switches',ok:audit.filter(c=>c.coverage==='selection'&&c.name.includes('switch thumb')).length===2});
  for(const expected of [true,false,true]){for(const id of ['pseudo-switch','before-switch']){
   await page.eval(`document.getElementById('${id}').focus()`);
   for(const type of ['keyDown','keyUp'])await browser.send('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);
   await wait(250);
   checks.push({coverage:'selection',name:mode+' / '+id+' native Space toggles '+expected+' with visible focus',ok:await page.eval(`(()=>{const e=document.getElementById('${id}'),s=getComputedStyle(e);return document.activeElement===e&&e.getAttribute('aria-checked')==='${expected}'&&s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0})()`)});
  }
  await capture(expected)}
  await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(350);checks.push({...await page.eval(`(${compactSwitchRestored.toString()})()`),name:mode+' / disable restoration'});
 }
 completed=true;
}finally{await browser?.close();await server.close()}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/compact-switches-chrome.json'),JSON.stringify(componentReceipt('Chrome',{completed,fixtures:['compact-switches.html'],modes:['auto','recolor'],states:['off','on','keyboard focus','disabled'],coverage:['selection','media','surface'],checks}),null,2));
for(const c of checks.filter(c=>!c.ok))console.log('FAIL '+c.name+' '+c.detail);console.log(checks.filter(c=>c.ok).length+'/'+checks.length+' Chrome compact switch checks');
if(!completed||checks.some(c=>!c.ok))process.exitCode=1;
