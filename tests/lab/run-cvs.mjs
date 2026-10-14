import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildLab} from '../../tools/build-lab.mjs';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {cvsScenario} from './cvs-scenario.mjs';

// Publish this known failing regression separately from the passing component
// receipt. The command still exits nonzero; never count failures as passes.
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/lab-results');
mkdirSync(output,{recursive:true});
const server=await serveLab(buildLab().output);let browser;const checks=[];
try{
  browser=await launchChrome();
  const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`);
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,siteRules:{'127.0.0.1':'recolor'}})");
  await wait(500);
  checks.push(...await cvsScenario(await browser.open(),server.origin));
  checks.push({name:'CVS stress / no uncaught exceptions',ok:browser.errors.length===0,detail:browser.errors.join('; ')});
}catch(e){checks.push({name:'CVS stress / execution',ok:false,detail:e.stack})}
finally{await browser?.close();await server.close()}
const report={sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),version:JSON.parse(execFileSync('node',['-p',"JSON.stringify(require('./manifest.json').version)"],{cwd:root,encoding:'utf8'})),checkedAt:new Date().toISOString(),checks};
writeFileSync(join(output,'cvs-stress.json'),JSON.stringify(report,null,2));
for(const c of checks.filter(c=>!c.ok))console.log('FAIL '+c.name+': '+c.detail);
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} CVS regression checks passed (separate from component total)`);
if(checks.some(c=>!c.ok))process.exitCode=1;
