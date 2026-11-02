import {componentReceipt} from './component-receipt.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';import {serveLab} from './server.mjs';import {oledComponentsProbe,oledComponentsRestored} from './oled-components-scenario.mjs';import {oledComponentsPaint} from './oled-components-paint.mjs';
import {instagramRadioProbe,instagramRadioPaint,instagramRadioRestored} from './instagram-radios.mjs';
const root=resolve(import.meta.dirname,'../..'),packageRoot=resolve(process.env.OLED_LAB_PACKAGE_ROOT||root),server=await serveLab(join(root,'tests/e2e/site')),out=join(root,'dist/oled-components');mkdirSync(out,{recursive:true});const checks=[],version=JSON.parse(readFileSync(join(packageRoot,'dist/chrome/manifest.json'))).version;let b;
try{b=await launchChrome();const {id}=await b.send('Extensions.loadUnpacked',{path:join(packageRoot,'dist/chrome')});const options=await b.open(`chrome-extension://${id}/options.html`),page=await b.open();await page.size(1200,1000);
 for(const mode of ['auto','recolor']){await options.eval(`chrome.storage.sync.set({extensionEnabled:true,siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(300);await page.go(server.origin+'/oled-components.html');await wait(500);
 const capture=async state=>{const probe=await page.eval(`(${oledComponentsProbe.toString()})()`),shot=await page.screenshot();writeFileSync(join(out,mode+'-'+state+'.png'),shot);checks.push(...oledComponentsPaint(shot,probe,state,version).map(c=>({...c,name:mode+' / '+c.name})))};
 await capture('in');await page.eval("document.getElementById('unit-in').focus()");
 for(const type of ['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},page.sessionId);await wait(200);await capture('cm');
 checks.push({coverage:'selection',name:mode+' / native keyboard changes radio value and focus',ok:await page.eval("document.activeElement.id==='unit-cm'&&document.querySelector('input[name=units]:checked').value==='cm'")});
 await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(300);checks.push({...await page.eval(`(${oledComponentsRestored.toString()})()`),coverage:'selection',name:mode+' / disable restoration'});
 }
 for(const appearance of ['oled','soft'])for(const mode of ['auto','recolor'])for(const native of ['dark','light']){
  const label=[appearance,mode,native].join(' / '), expected=mode==='auto'&&native==='dark'?(appearance==='oled'?'crush':'none'):appearance;
  await options.eval(`chrome.storage.sync.set({extensionEnabled:true,appearance:${JSON.stringify(appearance)},siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(150);
  await page.go(server.origin+'/instagram-radios.html'+(native==='light'?'?light':''));
  const capture=async state=>{const probe=await page.eval(`(${instagramRadioProbe.toString()})()`),shot=await page.screenshot();writeFileSync(join(out,`radio-${appearance}-${mode}-${native}-${state}.png`),shot);checks.push(...instagramRadioPaint(shot,probe,state,version,expected).map(c=>({...c,name:label+' / '+c.name})))};
  await capture('off');await page.eval("document.getElementById('off').focus()");
  for(const type of ['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},page.sessionId);await wait(200);await capture('on');
  checks.push({coverage:'selection',name:label+' / keyboard changes sibling radio and focus',ok:await page.eval("document.activeElement.id==='on'&&document.getElementById('on').checked")});
  await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(200);checks.push({...await page.eval(`(${instagramRadioRestored.toString()})()`),name:label+' / pause restores sibling marker'});
 }
}finally{await b?.close();await server.close()}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/oled-components-chrome.json'),JSON.stringify(componentReceipt('Chrome',{completed:true,fixtures:['oled-components.html','instagram-radios.html'],modes:['auto','recolor'],states:['in','cm','off','on','native light','native dark','OLED','Soft Dark','disabled'],coverage:['media','selection','surface'],checks}),null,2));console.log(JSON.stringify(checks.filter(c=>!c.ok),null,2));console.log(checks.filter(c=>c.ok).length+'/'+checks.length);if(checks.some(c=>!c.ok))process.exitCode=1;
