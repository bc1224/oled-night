import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {layerUtilitiesScenario,layerUtilitiesRestored} from './layer-utilities-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/layer-utilities');mkdirSync(output,{recursive:true});
const server=await serveLab(join(root,'tests/e2e/site'));let browser;const checks=[];
try{
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
  for(const [mode,appearance] of [['auto','oled'],['recolor','oled'],['recolor','soft']]){
    await options.eval(`chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,brightness:88,contrast:72,dimImages:false,appearance:${JSON.stringify(appearance)},siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(450);
    await page.go(server.origin+'/layer-utilities.html');await wait(700);
    checks.push(...(await page.eval(`(${layerUtilitiesScenario.toString()})()`)).map(c=>({...c,name:mode+' / '+appearance+' / '+c.name})));
    writeFileSync(join(output,mode+'-'+appearance+'.png'),await page.screenshot());
    await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(450);
    checks.push({...await page.eval(`(${layerUtilitiesRestored.toString()})()`),name:mode+' / '+appearance+' / Layer utilities disable restores authored text, fills and layer order'});
  }
}finally{await browser?.close();await server.close()}
writeFileSync(join(output,'results.json'),JSON.stringify(checks,null,2));
for(const c of checks)console.log((c.ok?'PASS ':'FAIL ')+c.name+' '+c.detail);
if(checks.some(c=>!c.ok))process.exitCode=1;
