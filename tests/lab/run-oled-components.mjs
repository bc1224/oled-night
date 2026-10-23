import {componentReceipt} from './component-receipt.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';import {serveLab} from './server.mjs';import {oledComponentsProbe,oledComponentsRestored} from './oled-components-scenario.mjs';import {oledComponentsPaint} from './oled-components-paint.mjs';
const root=resolve(import.meta.dirname,'../..'),server=await serveLab(join(root,'tests/e2e/site')),out=join(root,'dist/oled-components');mkdirSync(out,{recursive:true});const checks=[],version=JSON.parse(readFileSync(join(root,'dist/chrome/manifest.json'))).version;let b;
try{b=await launchChrome();const {id}=await b.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});const options=await b.open(`chrome-extension://${id}/options.html`),page=await b.open();await page.size(1200,1000);
 for(const mode of ['auto','recolor']){await options.eval(`chrome.storage.sync.set({extensionEnabled:true,siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(300);await page.go(server.origin+'/oled-components.html');await wait(500);
 const capture=async state=>{const probe=await page.eval(`(${oledComponentsProbe.toString()})()`),shot=await page.screenshot();writeFileSync(join(out,mode+'-'+state+'.png'),shot);checks.push(...oledComponentsPaint(shot,probe,state,version).map(c=>({...c,name:mode+' / '+c.name})))};
 await capture('in');await page.eval("document.getElementById('unit-in').focus()");
 for(const type of ['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},page.sessionId);await wait(200);await capture('cm');
 checks.push({coverage:'selection',name:mode+' / native keyboard changes radio value and focus',ok:await page.eval("document.activeElement.id==='unit-cm'&&document.querySelector('input[name=units]:checked').value==='cm'")});
 await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(300);checks.push({...await page.eval(`(${oledComponentsRestored.toString()})()`),coverage:'selection',name:mode+' / disable restoration'});
 }
}finally{await b?.close();await server.close()}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/oled-components-chrome.json'),JSON.stringify(componentReceipt('Chrome',{completed:true,fixtures:['oled-components.html'],modes:['auto','recolor'],states:['in','cm','disabled'],coverage:['media','selection','surface'],checks}),null,2));console.log(JSON.stringify(checks.filter(c=>!c.ok),null,2));console.log(checks.filter(c=>c.ok).length+'/'+checks.length);if(checks.some(c=>!c.ok))process.exitCode=1;
