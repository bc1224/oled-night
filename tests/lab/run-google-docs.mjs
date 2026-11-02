import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {googleDocsScenario,googleDocsProbe,googleDocsRestored} from './google-docs-scenario.mjs';
import {googleDocsPaint} from './google-docs-paint.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/google-docs');mkdirSync(output,{recursive:true});
const server=await serveLab(join(root,'tests/e2e/site')),checks=[];let browser;
try{
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
  for(const [mode,appearance] of [['auto','oled'],['recolor','oled'],['recolor','soft']]){
    await options.eval(`chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,appearance:${JSON.stringify(appearance)},brightness:88,contrast:72,dimImages:false,siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(450);
    await page.go(server.origin+'/google-docs.html');await wait(600);
    checks.push(...(await page.eval(`(${googleDocsScenario.toString()})()`)).map(c=>({...c,name:mode+' / '+appearance+' / '+c.name})));
    const shot=await page.screenshot();writeFileSync(join(output,mode+'-'+appearance+'.png'),shot);
    checks.push(...googleDocsPaint(shot,await page.eval(`(${googleDocsProbe.toString()})()`)));
    await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(450);
    checks.push(await page.eval(`(${googleDocsRestored.toString()})()`));
  }
  for(const mode of ['deepen','invert']){
    await options.eval(`chrome.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':${JSON.stringify(mode)}}})`);await wait(450);
    await page.go(server.origin+'/google-docs.html');await wait(600);
    await page.eval("document.documentElement.setAttribute('data-oled-night-site','google-docs')");
    checks.push({...await page.eval(`(${googleDocsRestored.toString()})()`),name:mode+' / Docs canvas is not inverted a second time'});
  }
}finally{await browser?.close();await server.close()}
writeFileSync(join(output,'results.json'),JSON.stringify(checks,null,2));
for(const c of checks)console.log((c.ok?'PASS ':'FAIL ')+c.name+' '+c.detail);
if(checks.some(c=>!c.ok))process.exitCode=1;
