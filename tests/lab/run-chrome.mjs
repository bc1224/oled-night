import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildLab} from '../../tools/build-lab.mjs';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {matrixStates,responsiveness,performanceChecks} from './scenarios.mjs';
import {checkScreenshot} from './visual.mjs';
import {cases} from './catalog.mjs';
import {frameMutationScenario} from './frame-mutation-scenario.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/lab-results');mkdirSync(output,{recursive:true});
const checks=[],add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const site=buildLab().output,server=await serveLab(site);let browser;
try {
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`);
  const settings=async enabled=>{await options.eval(`chrome.storage.sync.set({extensionEnabled:${enabled},globalEnabled:true,siteRules:{'127.0.0.1':'recolor'}})`);await wait(500)};
  await settings(true);const page=await browser.open();
  for(const [theme,width] of [['light',1200],['dark',1200],['light',390]]){
    const label=`${theme}-${width}`;await page.size(width,1000);await page.go(`${server.origin}/lab/fixtures/matrix.html?theme=${theme}`);await wait(800);
    const stateChecks=await page.eval(`(${matrixStates.toString()})()`);checks.push(...stateChecks.map(c=>({...c,name:label+' / '+c.name})));
    checks.push(...(await page.eval(`(${frameMutationScenario.toString()})()`)).map(c=>({...c,name:label+' / '+c.name})));
    await page.eval('scrollTo(0,0)');await page.hover(1,1);await wait(150);checks.push(checkScreenshot({name:`chrome-${label}`,actual:await page.screenshot(),directory:join(root,'tests/lab/baselines',process.platform),artifacts:output,candidate:process.argv.includes('--candidates')}));
    if(width===1200){for(const target of ['primary','cell-a','shadow-first','shadow-second','shadow-third']){
      const point=await page.eval(`(()=>{const e=window.OLEDLabAudit.elements(document).find(e=>e.id===${JSON.stringify(target)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      // Read after the frame's callbacks: an earlier rAF callback can see the
      // native color before our recolor callback, although it never gets painted.
      await page.eval(`(()=>{const e=window.OLEDLabAudit.elements(document).find(e=>e.id===${JSON.stringify(target)});window.__labHoverFrames=[];const until=performance.now()+220;function sample(){window.__labHoverFrames.push(getComputedStyle(e).backgroundColor);if(performance.now()<until)requestAnimationFrame(()=>setTimeout(sample,0))}requestAnimationFrame(()=>setTimeout(sample,0))})()`);
      await page.hover(point.x,point.y);await wait(250);
      const paints=await page.eval(`({colors:window.__labHoverFrames,ok:window.__labHoverFrames.length>3&&window.__labHoverFrames.every(c=>window.OLEDLabAudit.lum(c)<.16)})`);add(label+' / hover has no pale painted frame '+target,paints.ok,[...new Set(paints.colors)].join(' | '));
      const c=await page.eval(`(()=>{const e=window.OLEDLabAudit.elements(document).find(e=>e.id===${JSON.stringify(target)}),s=getComputedStyle(e),a=window.OLEDLabAudit;return {dark:a.lum(s.backgroundColor)<.16,ratio:a.contrast(s.color,a.background(e)),bg:s.backgroundColor}})()`);
      add(label+' / native pointer hover '+target,c.dark&&c.ratio>=4.5,JSON.stringify(c));
    }}
    await page.eval(`document.getElementById('primary').focus()`);await page.key('Tab');await wait(120);add(label+' / real Tab moves focus and shows an outline',await page.eval(`document.activeElement===document.getElementById('secondary')&&getComputedStyle(document.activeElement).outlineStyle!=='none'`));
    await settings(false);add(label+' / disable restores original rendering',await page.eval(`!document.documentElement.hasAttribute('data-oled-night-root')&&getComputedStyle(document.body).backgroundColor===${JSON.stringify(theme==='light'?'rgb(242, 243, 245)':'rgb(16, 17, 20)')}`));
    const faults=await page.eval(`(()=>{const e=document.getElementById('heading');e.style.color=getComputedStyle(document.body).backgroundColor;const r=window.OLEDLabAudit.audit(document,{requireExtension:false}).find(r=>r.name==='heading text');e.style.removeProperty('color');return r})()`);add(label+' / audit detects unreadable injected text',faults.ok===false,faults.detail);
    await settings(true);add(label+' / re-enable reapplies extension',await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')`));
  }
  await page.size(1200,1000);await page.go(`${server.origin}/lab/fixtures/matrix.html`);await settings(false);const native=await page.eval(`(${responsiveness.toString()})()`);await settings(true);const active=await page.eval(`(${responsiveness.toString()})()`);checks.push(...performanceChecks(native,active));
  const lab=await browser.open(`${server.origin}/lab/`);await wait(500);add('gallery lists all '+cases.length+' cases',await lab.eval(`document.querySelectorAll('#cases button').length===${cases.length}`));
  add('gallery search filters cases',await lab.eval(`(()=>{const s=document.getElementById('search');s.value='Reddit';s.dispatchEvent(new Event('input'));return document.querySelectorAll('#cases button').length>0&&document.querySelectorAll('#cases button').length<${cases.length}})()`));await lab.eval(`document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'))`);
  await lab.size(390,850);add('mobile gallery has no horizontal overflow',await lab.eval(`document.documentElement.scrollWidth<=innerWidth`));writeFileSync(join(output,'gallery-mobile.png'),await lab.screenshot());
  await lab.size(1400,950);writeFileSync(join(output,'gallery-desktop.png'),await lab.screenshot());
  add('no uncaught page exceptions',browser.errors.length===0,browser.errors.join('; '));
}catch(e){add('Chrome lab execution',false,e.stack)}finally{await browser?.close();await server.close()}
const report={engine:'Chrome',candidate:process.argv.includes('--candidates'),version:JSON.parse(execFileSync('node',['-p',"JSON.stringify(require('./manifest.json').version)"],{cwd:root,encoding:'utf8'})),sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),checks};
writeFileSync(join(output,'chrome.json'),JSON.stringify(report,null,2));for(const c of checks.filter(c=>!c.ok))console.log('FAIL '+c.name+': '+c.detail);console.log(`${checks.filter(c=>c.ok).length}/${checks.length} Chrome lab checks passed`);if(checks.some(c=>!c.ok))process.exitCode=1;
