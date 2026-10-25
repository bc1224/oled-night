import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {googleAnalyticsScenario,googleAnalyticsProbe,googleAnalyticsRestored} from './google-analytics-scenario.mjs';
import {googleAnalyticsPaint} from './google-analytics-paint.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/google-analytics');mkdirSync(output,{recursive:true});
const server=await serveLab(join(root,'tests/e2e/site')),checks=[];let browser;
try{
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
  for(const appearance of ['oled','soft']){
    await options.eval(`chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,appearance:${JSON.stringify(appearance)},brightness:88,contrast:72,dimImages:false,siteRules:{'127.0.0.1':'recolor'}})`);await wait(450);
    await page.go(server.origin+'/google-analytics.html');await wait(600);
    checks.push(...(await page.eval(`(${googleAnalyticsScenario.toString()})()`)).map(c=>({...c,name:appearance+' / '+c.name})));
    const shot=await page.screenshot();writeFileSync(join(output,appearance+'.png'),shot);
    checks.push(...googleAnalyticsPaint(shot,await page.eval(`(${googleAnalyticsProbe.toString()})()`)));
    await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(450);
    checks.push(await page.eval(`(${googleAnalyticsRestored.toString()})()`));
  }
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,appearance:'oled',siteRules:{'127.0.0.1':'deepen'}})");await wait(450);
  await page.go(server.origin+'/google-analytics.html');await wait(600);
  await page.eval("document.documentElement.setAttribute('data-oled-night-site','google-analytics')");
  checks.push({...await page.eval(`(${googleAnalyticsRestored.toString()})()`),name:'Explicit Deepen preserves original GA chart and map paint'});
}finally{await browser?.close();await server.close()}
writeFileSync(join(output,'results.json'),JSON.stringify(checks,null,2));
for(const c of checks)console.log((c.ok?'PASS ':'FAIL ')+c.name+' '+c.detail);
if(checks.some(c=>!c.ok))process.exitCode=1;
