import {createServer} from 'node:http';import {createServer as tcpServer} from 'node:net';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import webExt from 'web-ext';
import {compactSwitchProbe,compactSwitchPaint,compactSwitchRestored} from './compact-switches-scenario.mjs';import {componentReceipt} from './component-receipt.mjs';import {firefoxKeys} from './firefox-keys.mjs';
const root=resolve(import.meta.dirname,'../..'),temp=mkdtempSync(join(tmpdir(),'oled-compact-switches-')),output=join(root,'dist/compact-switches');mkdirSync(output,{recursive:true});
let receive,runner,timer,keys,report;const result=new Promise(r=>receive=r),checks=[];
const server=createServer((req,res)=>{(async()=>{
 if(req.method==='POST'&&req.url==='/key'){if(!keys)keys=await firefoxKeys(keyPort);await keys.space();res.end('ok');return}
 if(req.method==='POST'&&req.url==='/result'){let body='';for await(const c of req)body+=c;receive(JSON.parse(body));res.end('ok');return}
 const file=new URL(req.url,'http://localhost').pathname.slice(1);
 if(!['compact-switches.html','audit.js'].includes(file)){res.writeHead(404);res.end();return}
 res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(readFileSync(join(root,file==='audit.js'?'docs/lab':'tests/e2e/site',file)));
 })().catch(e=>{checks.push({name:'Firefox compact keyboard transport',ok:false,detail:String(e)});res.writeHead(500);res.end('error')})});
const reservation=tcpServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const keyPort=reservation.address().port;await new Promise(r=>reservation.close(r));
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 cpSync(join(root,'dist/firefox'),temp,{recursive:true});const manifest=JSON.parse(readFileSync(join(temp,'manifest.json')));manifest.background.scripts.push('compact-driver.js');writeFileSync(join(temp,'manifest.json'),JSON.stringify(manifest));
 writeFileSync(join(temp,'compact-driver.js'),`const probe=${compactSwitchProbe.toString()},restored=${compactSwitchRestored.toString()};
 (async()=>{const checks=[],captures=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));let tab,completed=false;
 const inspect=async func=>(await browser.scripting.executeScript({target:{tabId:tab.id},func}))[0].result;
 try{await browser.storage.sync.clear();for(const mode of ['auto','recolor']){
  await browser.storage.sync.set({extensionEnabled:true,globalEnabled:true,brightness:88,contrast:72,dimImages:false,siteRules:mode==='auto'?{}:{'127.0.0.1':'recolor'}});
  tab=await browser.tabs.create({url:${JSON.stringify(origin)}+'/compact-switches.html'});await sleep(1000);
  const capture=async state=>captures.push({mode,state,probe:await inspect(probe),image:await browser.tabs.captureVisibleTab(tab.windowId,{format:'png'})});
  await capture(false);
  await browser.scripting.executeScript({target:{tabId:tab.id},files:['compact-audit.js']});
  const audit=await inspect(()=>OLEDLabAudit.audit(document));checks.push(...audit.map(c=>({...c,name:mode+' / QA page / '+c.name})));
  checks.push({coverage:'identity',name:mode+' / QA audit covers both generated switches',ok:audit.filter(c=>c.coverage==='selection'&&c.name.includes('switch thumb')).length===2});
  for(const expected of [true,false,true]){for(const id of ['pseudo-switch','before-switch']){
   await browser.scripting.executeScript({target:{tabId:tab.id},func:id=>document.getElementById(id).focus(),args:[id]});
   const key=await fetch(${JSON.stringify(origin)}+'/key',{method:'POST'});if(!key.ok)throw Error('Native Firefox Space failed');await sleep(250);
   const detail=(await browser.scripting.executeScript({target:{tabId:tab.id},func:id=>{const e=document.getElementById(id),s=getComputedStyle(e);return {focused:document.activeElement===e,state:e.getAttribute('aria-checked'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth)}},args:[id]}))[0].result;
   checks.push({coverage:'selection',name:mode+' / '+id+' native Space toggles '+expected+' with visible focus',ok:detail.focused&&detail.state===String(expected)&&detail.outline!=='none'&&detail.width>0,detail:JSON.stringify(detail)});
  }
  await capture(expected)}await browser.storage.sync.set({extensionEnabled:false});await sleep(350);checks.push({...await inspect(restored),name:mode+' / disable restoration'});await browser.tabs.remove(tab.id);tab=null;
 }completed=true}catch(e){checks.push({name:'Firefox compact switch execution',ok:false,detail:String(e)})}finally{if(tab)await browser.tabs.remove(tab.id)}
 await fetch(${JSON.stringify(origin)}+'/result',{method:'POST',body:JSON.stringify({completed,checks,captures})})})();`);
 cpSync(join(root,'docs/lab/audit.js'),join(temp,'compact-audit.js'));
 runner=await webExt.cmd.run({sourceDir:temp,artifactsDir:temp,firefox:process.env.FIREFOX_PATH||(process.platform==='win32'?'C:/Program Files/Mozilla Firefox/firefox.exe':'firefox'),args:['-headless','--marionette','--width=1000','--height=900'],pref:{'marionette.port':keyPort,'layout.css.devPixelsPerPx':'1.0'},noReload:true,noInput:true},{shouldExitProgram:false});
 report=await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Firefox compact switches timed out')),90000)})]);
 for(const c of report.captures){const bytes=Buffer.from(c.image.split(',')[1],'base64');writeFileSync(join(output,'firefox-'+c.mode+'-'+c.state+'.png'),bytes);checks.push(...compactSwitchPaint(bytes,c.probe,c.state,manifest.version,c.mode).map(x=>({...x,name:c.mode+' / '+x.name})))}checks.push(...report.checks);
}catch(e){checks.push({name:'Firefox compact switch runner',ok:false,detail:String(e)})}
finally{clearTimeout(timer);keys?.close();await runner?.exit();await new Promise(r=>server.close(r));rmSync(temp,{recursive:true,force:true})}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});writeFileSync(join(root,'dist/lab-results/compact-switches-firefox.json'),JSON.stringify(componentReceipt('Firefox',{completed:report?.completed===true,fixtures:['compact-switches.html'],modes:['auto','recolor'],states:['off','on','keyboard focus','disabled'],coverage:['selection','surface'],checks}),null,2));
for(const c of checks.filter(c=>!c.ok))console.log('FAIL '+c.name+' '+c.detail);console.log(checks.filter(c=>c.ok).length+'/'+checks.length+' Firefox compact switch checks');
if(!report?.completed||checks.some(c=>!c.ok))process.exitCode=1;
