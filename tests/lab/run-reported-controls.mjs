import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {reportedControlsScenario,reportedControlsRestored} from './reported-controls-scenario.mjs';
import {paintedInkContrast,paintedSample} from './painted-contrast.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/reported-controls');mkdirSync(output,{recursive:true});
const server=await serveLab(join(root,'tests/e2e/site'));let browser;const checks=[];
try{
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`),page=await browser.open();
  for(const mode of ['auto','recolor']){
    await options.eval(`chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,brightness:88,contrast:72,dimImages:false,siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(450);
    await page.go(`${server.origin}/reported-controls.html${mode==='recolor'?'?light':''}`);await wait(700);
    const result=await page.eval(`(${reportedControlsScenario.toString()})()`);checks.push(...result.map(c=>({...c,name:mode+' / '+c.name})));
    const shot=await page.screenshot();writeFileSync(join(output,mode+'.png'),shot);
    const likePaint=await page.eval("(()=>{const r=document.getElementById('song-like-icon').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,bg:getComputedStyle(document.getElementById('song-like')).backgroundColor.match(/[\\d.]+/g).slice(0,3).map(Number)}})()");
    const iconPaint=paintedSample(shot,likePaint.x,likePaint.y),inkLum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const iconRatio=(Math.max(inkLum(iconPaint),inkLum(likePaint.bg))+.05)/(Math.min(inkLum(iconPaint),inkLum(likePaint.bg))+.05);
    checks.push({name:mode+' / Suno selected icon screenshot contrast',ok:iconRatio>=3,detail:JSON.stringify({iconPaint,bg:likePaint.bg,iconRatio})});
    const bounds=await page.eval("(()=>{const text=document.getElementById('promo-ink').getBoundingClientRect(),art=document.getElementById('yellow-art').getBoundingClientRect();return {text:{x:text.x,y:text.y,width:text.width,height:text.height},art:{x:art.x+20,y:art.y+art.height-20}}})()");
    const ink=paintedInkContrast(shot,bounds.text,[255,211,116]),art=paintedSample(shot,bounds.art.x,bounds.art.y);
    checks.push({name:mode+' / painted promotion preserves readable ink and original artwork',ok:ink.ok&&art?.every((v,i)=>Math.abs(v-[255,211,116][i])<=3),detail:JSON.stringify({ink,art})});
    await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(450);
    checks.push(...(await page.eval(`(${reportedControlsRestored.toString()})()`)).map(c=>({...c,name:mode+' / '+c.name})));
  }
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'deepen'}})");await wait(450);
  await page.go(server.origin+'/reported-controls.html');await wait(700);
  checks.push({name:'Explicit Deepen blacks only preserves bright generated surfaces',ok:await page.eval("getComputedStyle(document.getElementById('save-chrome'),'::after').backgroundColor==='rgb(255, 191, 25)'"),detail:''});
  checks.push({name:'Explicit Deepen preserves native raised card depth',ok:await page.eval("getComputedStyle(document.getElementById('native-panel')).backgroundColor==='rgb(28, 28, 28)'"),detail:''});
}finally{await browser?.close();await server.close()}
writeFileSync(join(output,'results.json'),JSON.stringify(checks,null,2));for(const c of checks)console.log((c.ok?'PASS ':'FAIL ')+c.name+' '+c.detail);
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/reported-controls-chrome.json'),JSON.stringify({engine:'Chrome',checks},null,2));
if(checks.some(c=>!c.ok))process.exitCode=1;
