// Focused, disposable renderer diagnosis; never attaches the owner's browser.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {buildLab} from '../../tools/build-lab.mjs';
import {coldShadowScenario} from './cold-shadow-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/lab-results');
mkdirSync(output,{recursive:true});const server=await serveLab(buildLab().output);let browser;
try{
 browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
 const options=await browser.open('chrome-extension://'+id+'/options.html');
 await options.eval("chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,siteRules:{'127.0.0.1':'recolor'}})");await wait(500);
 const page=await browser.open(server.origin+'/lab/fixtures/matrix.html');await wait(800);
 const inspect=()=>page.eval(`(()=>{const e=document.getElementById('shadow-nav').shadowRoot.getElementById('links').shadowRoot.getElementById('shadow-first'),s=getComputedStyle(e);return {color:s.color,fill:s.webkitTextFillColor,typedFill:e.computedStyleMap?.().get('-webkit-text-fill-color')?.toString(),bg:window.OLEDLabAudit.background(e),mark:e.getAttribute('data-oled-night'),style:e.getAttribute('style'),audit:window.OLEDLabAudit.audit(document).filter(c=>c.name.includes('shadow-first'))}})()`);
 const cold=await page.eval('('+coldShadowScenario.toString()+')()');console.log(JSON.stringify({cold}));
 if(cold.some(c=>!c.ok))process.exitCode=1;
 const original=await inspect();
 await page.eval("document.getElementById('shadow-nav').shadowRoot.getElementById('links').shadowRoot.getElementById('shadow-first').style.webkitTextFillColor='currentColor'");await wait(200);
 const explicitCurrentColor=await inspect();
 await page.eval("document.getElementById('shadow-nav').shadowRoot.getElementById('links').shadowRoot.getElementById('shadow-first').style.webkitTextFillColor='#222'");await wait(200);
 const explicitDark=await inspect();
 const report={browser:await browser.send('Browser.getVersion'),original,explicitCurrentColor,explicitDark};
 writeFileSync(join(output,'text-fill.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();await server.close()}
