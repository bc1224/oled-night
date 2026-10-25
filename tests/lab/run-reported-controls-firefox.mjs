import {createServer} from 'node:http';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import webExt from 'web-ext';
import {reportedControlsScenario,reportedControlsRestored} from './reported-controls-scenario.mjs';
import {bookingSurfacesScenario,bookingSurfacesRestored} from './booking-surfaces-scenario.mjs';
import {componentReceipt} from './component-receipt.mjs';
import {retainedSurfacesScenario} from './retained-surfaces-scenario.mjs';
import {layeredSurfacesScenario,layeredSurfacesRestored} from './layered-surfaces-scenario.mjs';
import {logoContrastProbe,logoContrastPaint,logoContrastRestored} from './logo-contrast-scenario.mjs';
import {googleAnalyticsScenario,googleAnalyticsProbe,googleAnalyticsRestored} from './google-analytics-scenario.mjs';
import {googleAnalyticsPaint} from './google-analytics-paint.mjs';
import {appStoreIconsProbe,appStoreIconsRestored,appStoreIconsToggle} from './app-store-icons-scenario.mjs';
import {appStoreIconsPaint} from './app-store-icons-paint.mjs';
const root=resolve(import.meta.dirname,'../..'),temp=mkdtempSync(join(tmpdir(),'oled-reported-controls-'));
let receive,runner,timer;const result=new Promise(r=>receive=r);
const server=createServer((req,res)=>{
  if(req.method==='POST'&&req.url==='/result'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{receive(JSON.parse(body));res.end('ok')}catch{res.writeHead(400);res.end()}});return}
  const path=new URL(req.url,'http://localhost').pathname;
  if(!['/app-store-icons.html','/google-analytics.html','/reported-controls.html','/calendar-booking.html','/retained-surfaces.html','/layered-surfaces.html','/logo-contrast.html','/logo-contrast.svg','/logo-contrast-white.svg','/logo-contrast-badge.svg'].includes(path)){res.writeHead(404);res.end();return}
  res.setHeader('content-type',path.endsWith('.svg')?'image/svg+xml':'text/html');res.end(readFileSync(join(root,'tests/e2e/site',path.slice(1))));
});
let report={engine:'Firefox',checks:[]};
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  cpSync(join(root,'dist/firefox'),temp,{recursive:true});
  const manifest=JSON.parse(readFileSync(join(temp,'manifest.json')));manifest.background.scripts.push('reported-driver.js');writeFileSync(join(temp,'manifest.json'),JSON.stringify(manifest));
  writeFileSync(join(temp,'reported-driver.js'),`const scenario=${reportedControlsScenario.toString()},restored=${reportedControlsRestored.toString()},booking=${bookingSurfacesScenario.toString()},bookingRestored=${bookingSurfacesRestored.toString()},retained=${retainedSurfacesScenario.toString()},layered=${layeredSurfacesScenario.toString()},layeredRestored=${layeredSurfacesRestored.toString()},logoProbe=${logoContrastProbe.toString()},logoRestored=${logoContrastRestored.toString()},ga=${googleAnalyticsScenario.toString()},gaProbe=${googleAnalyticsProbe.toString()},gaRestored=${googleAnalyticsRestored.toString()},appStoreProbe=${appStoreIconsProbe.toString()},appStoreRestored=${appStoreIconsRestored.toString()},appStoreToggle=${appStoreIconsToggle.toString()};
  (async()=>{
    const out=[],captures=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));let tab,completed=false;
    const inspect=async func=>(await browser.scripting.executeScript({target:{tabId:tab.id},func}))[0].result;
    try{
      await browser.storage.sync.clear();
      for(const mode of ['auto','recolor']){
        await browser.storage.sync.set({extensionEnabled:true,globalEnabled:true,brightness:88,contrast:72,dimImages:false,siteRules:mode==='auto'?{}:{'127.0.0.1':'recolor'}});
        tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/reported-controls.html'+(mode==='recolor'?'?light':'')});await sleep(1200);
        out.push(...(await inspect(scenario)).map(c=>({...c,name:mode+' / '+c.name})));
        await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
        out.push(...(await inspect(restored)).map(c=>({...c,name:mode+' / '+c.name})));
        await browser.tabs.remove(tab.id);tab=null;
      }
      for(const mode of ['auto','recolor']){
        await browser.storage.sync.set({extensionEnabled:true,siteRules:mode==='auto'?{}:{'127.0.0.1':'recolor'}});
        tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/retained-surfaces.html'+(mode==='recolor'?'?light':'')});await sleep(1200);
        out.push(...(await inspect(retained)).map(c=>({...c,name:mode+' / '+c.name})));
        await browser.tabs.remove(tab.id);tab=null;
        tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/calendar-booking.html'});await sleep(1200);
        out.push(...(await inspect(booking)).map(c=>({...c,name:mode+' / '+c.name})));
        await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
        out.push({...await inspect(bookingRestored),name:mode+' / Calendar disable restores authored surfaces'});
        await browser.tabs.remove(tab.id);tab=null;
      }
      for(const mode of ['auto','recolor']){
        await browser.storage.sync.set({extensionEnabled:true,siteRules:mode==='auto'?{}:{'127.0.0.1':'recolor'}});
        tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/layered-surfaces.html'});await sleep(1200);
        out.push(...(await inspect(layered)).map(c=>({...c,name:mode+' / '+c.name})));
        await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
        out.push({...await inspect(layeredRestored),name:mode+' / TikTok Studio disable restores authored layers'});
        await browser.tabs.remove(tab.id);tab=null;
      }
      await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'auto'}});
      tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/logo-contrast.html'});await sleep(1200);
      captures.push({probe:await inspect(logoProbe),image:await browser.tabs.captureVisibleTab(tab.windowId,{format:'png'})});
      await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
      out.push(await inspect(logoRestored));await browser.tabs.remove(tab.id);tab=null;
      for(const appearance of ['oled','soft']){
        await browser.storage.sync.set({extensionEnabled:true,appearance,siteRules:{'127.0.0.1':'recolor'}});
        tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/google-analytics.html'});await sleep(1200);
        out.push(...(await inspect(ga)).map(c=>({...c,name:appearance+' / '+c.name})));
        captures.push({kind:'google-analytics-'+appearance,probe:await inspect(gaProbe),image:await browser.tabs.captureVisibleTab(tab.windowId,{format:'png'})});
        await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
        out.push(await inspect(gaRestored));await browser.tabs.remove(tab.id);tab=null;
      }
      for(const mode of ['auto','recolor']){
        await browser.storage.sync.set({extensionEnabled:true,appearance:'oled',siteRules:mode==='auto'?{}:{'127.0.0.1':'recolor'}});
        tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/app-store-icons.html'});await sleep(1200);
        for(const state of ['initial','native-filter-removed','native-filter-restored']){
          if(state!=='initial'){await inspect(appStoreToggle);await sleep(500)}
          captures.push({kind:'app-store-'+mode+'-'+state,probe:await inspect(appStoreProbe),image:await browser.tabs.captureVisibleTab(tab.windowId,{format:'png'})});
        }
        await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
        out.push(await inspect(appStoreRestored));await browser.tabs.remove(tab.id);tab=null;
      }
      await browser.storage.sync.set({appearance:'oled'});
      await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'deepen'}});
      tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/reported-controls.html'});await sleep(1200);
      out.push({name:'Explicit Deepen blacks only preserves bright generated surfaces',ok:await inspect(()=>getComputedStyle(document.getElementById('save-chrome'),'::after').backgroundColor==='rgb(255, 191, 25)')});
      out.push({name:'Explicit Deepen preserves native raised card depth',ok:await inspect(()=>getComputedStyle(document.getElementById('native-panel')).backgroundColor==='rgb(28, 28, 28)')});
      await browser.tabs.remove(tab.id);tab=null;
      tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/retained-surfaces.html'});await sleep(1200);
      out.push(...(await inspect(retained)).map(c=>({...c,name:'deepen / '+c.name})));
      completed=true;
    }catch(e){out.push({name:'Firefox reported control execution',ok:false,detail:String(e)})}
    finally{if(tab)await browser.tabs.remove(tab.id)}
    await fetch(${JSON.stringify(origin)}+'/result',{method:'POST',body:JSON.stringify({engine:'Firefox',completed,checks:out,captures})});
  })();`);
  runner=await webExt.cmd.run({sourceDir:temp,artifactsDir:temp,firefox:process.env.FIREFOX_PATH||(process.platform==='win32'?'C:/Program Files/Mozilla Firefox/firefox.exe':'firefox'),args:['-headless','--width=1024','--height=1000'],noReload:true,noInput:true},{shouldExitProgram:false});
  report=await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Reported controls Firefox timed out')),180000)})]);
  if(!Array.isArray(report.checks))throw Error('Malformed Firefox result');
  for(const capture of report.captures){const bytes=Buffer.from(capture.image.split(',')[1],'base64');mkdirSync(join(root,'dist/reported-controls'),{recursive:true});writeFileSync(join(root,'dist/reported-controls/firefox-'+(capture.kind||'logo-contrast')+'.png'),bytes);report.checks.push(...(capture.kind?.startsWith('app-store')?appStoreIconsPaint(bytes,capture.probe):capture.kind?.startsWith('google-analytics')?googleAnalyticsPaint(bytes,capture.probe):logoContrastPaint(bytes,capture.probe)))}
  delete report.captures;
}catch(e){report={engine:'Firefox',completed:false,checks:[{name:'Firefox reported control runner',ok:false,detail:String(e)}]}}
finally{clearTimeout(timer);await runner?.exit();await new Promise(r=>server.close(r));rmSync(temp,{recursive:true,force:true})}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/reported-controls-firefox.json'),JSON.stringify(componentReceipt('Firefox',{...report,fixtures:['app-store-icons.html','google-analytics.html','reported-controls.html','calendar-booking.html','retained-surfaces.html','layered-surfaces.html','logo-contrast.html'],modes:['auto','recolor','deepen']}),null,2));
for(const c of report.checks.filter(c=>!c.ok))console.log('FAIL '+c.name+': '+c.detail);
console.log(report.checks.filter(c=>c.ok).length+'/'+report.checks.length+' Firefox reported control checks passed');
if(!report.completed||report.checks.some(c=>!c.ok))process.exitCode=1;
