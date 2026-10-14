import {createServer} from 'node:http';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import webExt from 'web-ext';
import {matrixStates,responsiveness,performanceChecks} from './scenarios.mjs';
import {lateShadowScenario} from './late-shadow-scenario.mjs';
import {frameMutationScenario} from './frame-mutation-scenario.mjs';
import {mixedSurfaceScenario,mixedSurfaceOriginal,mixedSurfaceDeepen} from './mixed-surface-scenario.mjs';
import {bookingScenario} from './booking-scenario.mjs';
import {coldShadowScenario} from './cold-shadow-scenario.mjs';
import {generatedStyleScenario} from './generated-style-scenario.mjs';
import {runtimeDigest,regressionChecks} from './runtime-proof.mjs';
const root=resolve(import.meta.dirname,'../..'),temp=mkdtempSync(join(tmpdir(),'oled-night-firefox-lab-'));let runner,timer;
let receive;const result=new Promise(r=>receive=r);
const server=createServer((req,res)=>{
  if(req.url==='/result'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{receive(JSON.parse(body));res.end('ok')}catch{res.writeHead(400);res.end()}});return}
  const file=new URL(req.url,'http://localhost').pathname.slice(1);if(!['matrix.html','audit.js','ordinary-image.svg','email-newsletter.html','native-banner.html','booking-form.html','report-preview.html','generated-style.html','report-utils.js'].includes(file)){res.writeHead(404);res.end();return}
  const path=file==='report-utils.js'?join(root,file):file==='matrix.html'?join(root,'tests/lab',file):file==='audit.js'?join(root,'docs/lab',file):join(root,'tests/e2e/site',file);
  res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(readFileSync(path));
});
let checks=[],completed=false;
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  cpSync(join(root,'dist/firefox'),temp,{recursive:true});cpSync(join(root,'docs/lab/audit.js'),join(temp,'lab-audit.js'));
  const manifest=JSON.parse(readFileSync(join(temp,'manifest.json')));manifest.background.scripts.push('lab-driver.js');writeFileSync(join(temp,'manifest.json'),JSON.stringify(manifest));
  const driver=`const TEST_ORIGIN=${JSON.stringify(origin)}; const matrixStates=${matrixStates.toString()}; const responsiveness=${responsiveness.toString()}; const performanceChecks=${performanceChecks.toString()}; const lateShadowScenario=${lateShadowScenario.toString()}; const frameMutationScenario=${frameMutationScenario.toString()}; const mixedSurfaceScenario=${mixedSurfaceScenario.toString()}; const mixedSurfaceOriginal=${mixedSurfaceOriginal.toString()}; const mixedSurfaceDeepen=${mixedSurfaceDeepen.toString()};`+readFileSync(join(root,'tests/lab/firefox-driver.js'),'utf8');
  writeFileSync(join(temp,'lab-driver.js'),`const regressionChecks=${regressionChecks.toString()};const bookingScenario=${bookingScenario.toString()};const coldShadowScenario=${coldShadowScenario.toString()};const generatedStyleScenario=${generatedStyleScenario.toString()};`+driver);
  runner=await webExt.cmd.run({sourceDir:temp,artifactsDir:temp,firefox:process.env.FIREFOX_PATH||(process.platform==='win32'?'C:/Program Files/Mozilla Firefox/firefox.exe':'firefox'),args:['-headless'],noReload:true,noInput:true},{shouldExitProgram:false});
  const report=await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Firefox lab timed out')),120000)})]);
  if (!Array.isArray(report.checks)) throw Error('Malformed Firefox lab result');
  checks=report.checks;completed=report.completed===true;
}catch(e){checks.push({name:'Firefox lab execution',ok:false,detail:String(e)})}finally{clearTimeout(timer);if(runner)await runner.exit();await new Promise(r=>server.close(r));rmSync(temp,{recursive:true,force:true})}
const output=join(root,'dist/lab-results');mkdirSync(output,{recursive:true});writeFileSync(join(output,'firefox.json'),JSON.stringify({engine:'Firefox',completed,runtimeHash:runtimeDigest(file=>readFileSync(join(root,'dist/firefox',file))),version:JSON.parse(readFileSync(join(root,'manifest.json'))).version,sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),checks},null,2));for(const c of checks.filter(c=>!c.ok))console.log('FAIL '+c.name+': '+c.detail);console.log(`${checks.filter(c=>c.ok).length}/${checks.length} Firefox lab checks passed`);if(!completed || checks.some(c=>!c.ok))process.exitCode=1;
