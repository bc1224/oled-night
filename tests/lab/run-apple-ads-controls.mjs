import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {appleAdsControlsScenario,appleAdsControlsProbe,appleAdsControlsRestored} from './apple-ads-controls-scenario.mjs';
import {appleAdsControlsPaint} from './apple-ads-controls-paint.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/apple-ads-controls');mkdirSync(output,{recursive:true});
const server=await serveLab(join(root,'tests/e2e/site'));let browser;const checks=[];
try{
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,brightness:88,contrast:72,dimImages:false,siteRules:{'127.0.0.1':'recolor'}})");
  await page.go(server.origin+'/apple-ads-controls.html');await wait(700);
  checks.push(...await page.eval(`(${appleAdsControlsScenario.toString()})()`));
  await page.eval("document.getElementById('keyword').focus()");
  for(const type of ['keyDown','keyUp'])await browser.send('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);await wait(200);
  checks.push({name:'Apple Ads real Space key selects native checkbox',ok:await page.eval("document.getElementById('keyword').checked"),detail:''});
  for(const type of ['keyDown','keyUp'])await browser.send('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);await wait(200);await page.eval('document.activeElement.blur()');
  const shot=await page.screenshot();writeFileSync(join(output,'chrome.png'),shot);
  checks.push(...appleAdsControlsPaint(shot,await page.eval(`(${appleAdsControlsProbe.toString()})()`)));
  await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(450);
  checks.push(await page.eval(`(${appleAdsControlsRestored.toString()})()`));
}finally{await browser?.close();await server.close()}
writeFileSync(join(output,'results.json'),JSON.stringify(checks,null,2));
for(const c of checks)console.log((c.ok?'PASS ':'FAIL ')+c.name+' '+c.detail);
if(checks.some(c=>!c.ok))process.exitCode=1;
