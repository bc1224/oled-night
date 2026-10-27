import {componentReceipt} from './component-receipt.mjs';
import {createServer} from 'node:http';import {createServer as tcpServer} from 'node:net';import {cpSync,mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import webExt from 'web-ext';
import {oledComponentsProbe,oledComponentsRestored} from './oled-components-scenario.mjs';import {oledComponentsPaint} from './oled-components-paint.mjs';import {navigationWorkScenario,initialSheetLoadScenario} from './navigation-work-scenario.mjs';import {firefoxKeys} from './firefox-keys.mjs';
import {chatStreamingScenario} from './chatgpt-streaming-scenario.mjs';
import {parserWorkResult,parserWorkChecks,parserSurfaceResult} from './parser-work-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),temp=mkdtempSync(join(tmpdir(),'oled-components-firefox-')),output=join(root,'dist/oled-components');mkdirSync(output,{recursive:true});
const initialOnly=process.argv.includes('--initial-sheet-only');
let receive,runner,timer,keys;const result=new Promise(r=>receive=r),checks=[];
const server=createServer((req,res)=>{(async()=>{
 if(req.method==='POST'&&req.url==='/progress'){let body='';for await(const c of req)body+=c;console.log('Firefox OLED phase: '+body.slice(0,100));res.end('ok');return}
 if(req.method==='POST'&&req.url==='/key'){if(!keys)keys=await firefoxKeys(keyPort);await keys.arrowRight();res.end('ok');return}
 if(req.method==='POST'&&req.url==='/result'){let body='';for await(const c of req)body+=c;receive(JSON.parse(body));res.end('ok');return}
 const name=new URL(req.url,'http://localhost').pathname.slice(1);if(name==='slow.js'){setTimeout(()=>{res.setHeader('content-type','text/javascript');res.end('1')},3000);return}if(!['oled-components.html','navigation-work.html','navigation-opaque.css','navigation-opaque-next.css','parser-work.html','parser-surface.html','chatgpt-streaming.html','dark-ui-icon.svg'].includes(name)){res.writeHead(404);res.end();return}
 res.setHeader('content-type',name.endsWith('.svg')?'image/svg+xml':name.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(join(root,'tests/e2e/site',name)));
 })().catch(e=>{checks.push({name:'Firefox native keyboard transport',ok:false,detail:String(e)});res.writeHead(500);res.end('error')})});
const reservation=tcpServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const keyPort=reservation.address().port;await new Promise(r=>reservation.close(r));let report;
try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 cpSync(join(root,'dist/firefox'),temp,{recursive:true});const manifest=JSON.parse(readFileSync(join(temp,'manifest.json')));manifest.background.scripts.push('oled-driver.js');writeFileSync(join(temp,'manifest.json'),JSON.stringify(manifest));
 writeFileSync(join(temp,'oled-driver.js'),`const probe=${oledComponentsProbe.toString()},restored=${oledComponentsRestored.toString()},navigation=${navigationWorkScenario.toString()},initialSheet=${initialSheetLoadScenario.toString()},chatStreaming=${chatStreamingScenario.toString()},parserResult=${parserWorkResult.toString()},parserChecks=${parserWorkChecks.toString()},parserSurface=${parserSurfaceResult.toString()};
 (async()=>{const checks=[],captures=[],sleep=ms=>new Promise(r=>setTimeout(r,ms)),progress=state=>fetch(${JSON.stringify(origin)}+'/progress',{method:'POST',body:state});let tab,completed=false;const inspect=async func=>(await browser.scripting.executeScript({target:{tabId:tab.id},func}))[0].result;
 try{await browser.storage.sync.clear();if(!${initialOnly}){for(const mode of ['auto','recolor']){
 await browser.storage.sync.set({extensionEnabled:true,siteRules:mode==='auto'?{}:{'127.0.0.1':'recolor'}});tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/oled-components.html'});await sleep(1000);
 const capture=async state=>captures.push({mode,state,probe:await inspect(probe),image:await browser.tabs.captureVisibleTab(tab.windowId,{format:'png'})});await capture('in');
 await progress(mode+' keyboard');await inspect(()=>document.getElementById('unit-in').focus());const key=await fetch(${JSON.stringify(origin)}+'/key',{method:'POST'});if(!key.ok)throw Error('Native Firefox keyboard failed');await sleep(250);await capture('cm');
 checks.push({coverage:'selection',name:mode+' / native keyboard changes radio value and focus',ok:await inspect(()=>document.activeElement.id==='unit-cm'&&document.querySelector('input[name=units]:checked').value==='cm')});
 await browser.storage.sync.set({extensionEnabled:false});await sleep(300);checks.push({...await inspect(restored),coverage:'selection',name:mode+' / disable restores authored paint and selected value'});await browser.tabs.remove(tab.id);tab=null;
 }
 await progress('native chat');await browser.storage.sync.set({extensionEnabled:false,siteRules:{}});tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/chatgpt-streaming.html?stress=1'});await sleep(700);
 await inspect(()=>{globalThis.OledNightColors.usesNativeChatTheme=()=>true});await browser.storage.sync.set({extensionEnabled:true});await sleep(300);checks.push(...await inspect(chatStreaming));
 await browser.storage.sync.set({extensionEnabled:false});await sleep(150);checks.push({coverage:'surface',name:'native chat disable restores authored surface and selection',ok:await inspect(()=>!document.documentElement.hasAttribute('data-oled-night-chatgpt')&&getComputedStyle(document.querySelector('main')).backgroundColor==='rgb(14, 14, 14)'&&document.getElementById('choice').checked)});await browser.tabs.remove(tab.id);tab=null;
 }
 await progress('navigation');await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'recolor'}});tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/navigation-work.html'});await sleep(1800);if(!${initialOnly}){checks.push(...await inspect(navigation));await browser.tabs.reload(tab.id);await sleep(1800)}await progress('initial stylesheet notifications');checks.push(...await inspect(initialSheet));
 if(!${initialOnly}){await browser.tabs.remove(tab.id);tab=null;await progress('parser hydration');const pair=[];for(const enabled of [false,true]){await browser.storage.sync.set({extensionEnabled:enabled,siteRules:{}});tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/parser-work.html'});await sleep(500);pair.push(await inspect(parserResult));await browser.tabs.remove(tab.id);tab=null}checks.push(...parserChecks(...pair));tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/parser-surface.html'});await sleep(500);checks.push(await inspect(parserSurface));await browser.tabs.remove(tab.id);tab=null}completed=true;await progress('complete');
 }catch(e){checks.push({name:'Firefox OLED regression execution',ok:false,detail:String(e)})}finally{if(tab)await browser.tabs.remove(tab.id)}await fetch(${JSON.stringify(origin)}+'/result',{method:'POST',body:JSON.stringify({engine:'Firefox',completed,checks,captures})})})();`);
 runner=await webExt.cmd.run({sourceDir:temp,artifactsDir:temp,firefox:process.env.FIREFOX_PATH||(process.platform==='win32'?'C:/Program Files/Mozilla Firefox/firefox.exe':'firefox'),args:['-headless','--marionette','--width=1200','--height=1200'],pref:{'marionette.port':keyPort,'layout.css.devPixelsPerPx':'1.0'},noReload:true,noInput:true},{shouldExitProgram:false});
 report=await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Firefox OLED regressions timed out')),120000)})]);
 for(const c of report.captures){const bytes=Buffer.from(c.image.split(',')[1],'base64');writeFileSync(join(output,'firefox-'+c.mode+'-'+c.state+'.png'),bytes);checks.push(...oledComponentsPaint(bytes,c.probe,c.state,manifest.version).map(x=>({...x,name:c.mode+' / '+x.name})))}checks.push(...report.checks);
}catch(e){checks.push({name:'Firefox OLED runner',ok:false,detail:String(e)})}finally{clearTimeout(timer);keys?.close();await runner?.exit();await new Promise(r=>server.close(r));rmSync(temp,{recursive:true,force:true})}
const receipt=componentReceipt('Firefox',{
 candidate:initialOnly,completed:report?.completed===true,
 fixtures:initialOnly?['navigation-work.html']:['oled-components.html','navigation-work.html','chatgpt-streaming.html','parser-work.html','parser-surface.html'],
 modes:initialOnly?['recolor']:['auto','recolor','native'],
 states:initialOnly?['loaded','changed','restored']:['in','cm','disabled','scroll','focus','dynamic update','streaming','native dark','native light','parsing'],
 coverage:initialOnly?['text','performance']:['text','media','selection','surface','performance'],checks
});
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/oled-components-firefox.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(checks.filter(c=>!c.ok),null,2));console.log(checks.filter(c=>c.ok).length+'/'+checks.length);if(!report?.completed||checks.some(c=>!c.ok))process.exitCode=1;
