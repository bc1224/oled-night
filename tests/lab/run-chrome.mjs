import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildLab} from '../../tools/build-lab.mjs';
import {launchChrome,wait} from './browser.mjs';
import {serveLab} from './server.mjs';
import {matrixStates,responsiveness,performanceChecks} from './scenarios.mjs';
import {checkScreenshot} from './visual.mjs';
import {cases} from './catalog.mjs';
import {frameMutationScenario,nativeFrameFocusScenario} from './frame-mutation-scenario.mjs';
import {mixedSurfaceScenario,mixedSurfaceOriginal,mixedSurfaceDeepen} from './mixed-surface-scenario.mjs';
import {appleRecoveryScenario} from './apple-recovery-scenario.mjs';
import {bookingScenario} from './booking-scenario.mjs';
import {coldShadowScenario} from './cold-shadow-scenario.mjs';
import {generatedStyleScenario} from './generated-style-scenario.mjs';
import {checkoutScenario} from './checkout-scenario.mjs';
import {paintUpdatesScenario} from './paint-updates-scenario.mjs';
import {largeUpdatesScenario} from './large-updates-scenario.mjs';
import {churnWorkload,judgeChurn} from '../e2e/churn-benchmark.mjs';
import {reportPreviewScenario} from './report-preview-scenario.mjs';
import {visibleIconPixels} from './checkout-paint.mjs';
import {PNG} from 'pngjs';
import {chatgptControlsScenario} from './chatgpt-controls-scenario.mjs';
import {reportBaselineEntry} from './report-baseline.mjs';
import {frameWorkload,frameChecks,mountComponents,removeComponents,emptyRowLifecycle} from '../../docs/lab/performance.js';
import {runtimeDigest,regressionChecks} from './runtime-proof.mjs';
const root=resolve(import.meta.dirname,'../..'),output=join(root,'dist/lab-results');mkdirSync(output,{recursive:true});
const packageRoot=resolve(process.env.OLED_LAB_PACKAGE_ROOT||root);
await reportBaselineEntry('Chrome',root,output,resolve(root,'tests/lab/run-chrome.mjs'),new Set(cases.map(c=>c.id)),'dist/chrome');
const checks=[],add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const site=buildLab().output,server=await serveLab(site);let browser,completed=false;
try {
  browser=await launchChrome();const {id}=await browser.send('Extensions.loadUnpacked',{path:join(packageRoot,'dist/chrome')});
  const options=await browser.open(`chrome-extension://${id}/options.html`);
  const settings=async enabled=>{await options.eval(`chrome.storage.sync.set({extensionEnabled:${enabled},globalEnabled:true,siteRules:{'127.0.0.1':'recolor'}})`);await wait(500)};
  await settings(true);const page=await browser.open();
  const proof=async (fixture,items)=>regressionChecks(fixture,await page.eval("document.documentElement.hasAttribute('data-oled-night-root')"),items);
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,siteRules:{}})");await wait(500);
  await page.size(1024,1000);await page.go(`${server.origin}/lab/fixtures/chatgpt-controls.html`);await wait(900);
  const chatgptAuto=await page.eval(`(${chatgptControlsScenario.toString()})()`);
  const pixelLum=rgb=>{const [r,g,b]=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
  const pixelRatio=(a,b)=>{const x=pixelLum(a),y=pixelLum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const sampleIcons=async()=>{
    const boxes=await page.eval(`(()=>Object.fromEntries(['stop-light','stop-dark'].map(id=>{const s=document.querySelector('#'+id+' svg'),r=s.getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height}]})))()`);
    const shot=PNG.sync.read(await page.screenshot()),sampled=(x,y)=>{const i=(Math.floor(y)*shot.width+Math.floor(x))*4;return [...shot.data.subarray(i,i+3)]};
    return Object.entries(boxes).map(([id,b])=>{const icon=sampled(b.x+b.width/2,b.y+b.height/2),surface=sampled(b.x+1,b.y+b.height/2);return {id,icon,surface,ratio:pixelRatio(icon,surface)}});
  };
  const paintedAuto=await sampleIcons();
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,siteRules:{'127.0.0.1':'recolor'}})");await wait(700);await page.go(`${server.origin}/lab/fixtures/chatgpt-controls.html`);await wait(900);
  const chatgptRecolor=await page.eval(`(${chatgptControlsScenario.toString()})()`),paintedRecolor=await sampleIcons();
  const name='ChatGPT controls keep text and Stop icon readable';
  const textOk=(!chatgptAuto.enabled||chatgptAuto.textRatio>=4.5)&&(!chatgptRecolor.enabled||chatgptRecolor.textRatio>=4.5);
  const actualOk=textOk&&paintedAuto.every(p=>p.ratio>=3)&&paintedRecolor.every(p=>p.ratio>=3)&&chatgptAuto.icons.every(i=>i.styleRatio>=3)&&chatgptRecolor.icons.every(i=>i.styleRatio>=3);
  checks.push(...await proof('chatgpt-controls',[{name,ok:actualOk,detail:JSON.stringify({auto:{textRatio:chatgptAuto.textRatio,icons:chatgptAuto.icons,painted:paintedAuto},recolor:{textRatio:chatgptRecolor.textRatio,icons:chatgptRecolor.icons,painted:paintedRecolor}})}]));
  await settings(true);
  for(const [theme,width] of [['light',1200],['dark',1200],['light',390]]){
    const label=`${theme}-${width}`;await page.size(width,1000);await page.go(`${server.origin}/lab/fixtures/matrix.html?theme=${theme}`);await wait(800);
    checks.push(...(await page.eval(`(${coldShadowScenario.toString()})()`)).map(c=>({...c,name:label+' / '+c.name})));
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
  await options.eval("chrome.storage.sync.set({siteRules:{}})");
  add('native focus regression uses Automatic mode',await options.eval("chrome.storage.sync.get('siteRules').then(s=>!s.siteRules?.['127.0.0.1'])"));
  await page.go(`${server.origin}/lab/fixtures/matrix.html?theme=dark`);await wait(500);
  checks.push(...await proof('frame-mutation',await page.eval(`(${nativeFrameFocusScenario.toString()})()`)));
  await settings(true);
  await page.size(1200,1000);await page.go(`${server.origin}/lab/fixtures/matrix.html`);await settings(false);const native=await page.eval(`(${responsiveness.toString()})()`);await settings(true);const active=await page.eval(`(${responsiveness.toString()})()`);checks.push(...performanceChecks(native,active));
  for(const width of [1200,390])for(const file of ['email-newsletter','native-banner']){
    const label=file+'-'+width;await page.size(width,1000);
    await options.eval("chrome.storage.sync.set({extensionEnabled:true,siteRules:{}})");await wait(400);
    await page.go(`${server.origin}/lab/fixtures/${file}.html`);await wait(500);
    // The historical fixtures get the same audit seam as the matrix.
    await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
    checks.push(...(await proof(file,await page.eval(`(${mixedSurfaceScenario.toString()})()`))).map(c=>({...c,name:label+' / Automatic / '+c.name})));
    await options.eval("chrome.storage.sync.set({extensionEnabled:false})");await wait(400);
    checks.push(...(await page.eval(`(${mixedSurfaceOriginal.toString()})()`)).map(c=>({...c,name:label+' / '+c.name})));
    await options.eval("chrome.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'deepen'}})");await wait(400);
    checks.push(...(await page.eval(`(${mixedSurfaceDeepen.toString()})()`)).map(c=>({...c,name:label+' / '+c.name})));
    await settings(true);
    checks.push(...(await proof(file,await page.eval(`(${mixedSurfaceScenario.toString()})(false)`))).map(c=>({...c,name:label+' / Recolor / '+c.name})));
  }
  await settings(true);
  for(const width of [1200,390]){
    await page.size(width,1000);await page.go(`${server.origin}/lab/fixtures/booking-form.html`);await wait(500);
    await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
    checks.push(...(await proof('booking-form',await page.eval(`(${bookingScenario.toString()})()`))).map(c=>({...c,name:'booking-'+width+' / '+c.name})));
    await settings(false);
    add('booking-'+width+' / disable restores field ink and logo',await page.eval("getComputedStyle(document.getElementById('booking-value')).webkitTextFillColor==='rgb(119, 119, 119)'&&getComputedStyle(document.getElementById('booking-logo')).filter==='none'"));
    await settings(true);
  }
  for(const width of [1200,390])for(const mode of ['auto','recolor']){
    await page.size(width,1000);await options.eval(`chrome.storage.sync.set({extensionEnabled:true,siteRules:${mode==='auto'?'{}':"{'127.0.0.1':'recolor'}"}})`);await wait(400);
    await page.go(`${server.origin}/lab/fixtures/apple-recovery.html`);await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
    checks.push(...(await proof('apple-recovery',await page.eval(`(${appleRecoveryScenario.toString()})()`))).map(c=>({...c,name:'apple-recovery-'+width+' / '+mode+' / '+c.name})));
    await settings(false);add('apple-recovery / disable restores original',await page.eval("getComputedStyle(document.getElementById('recovery-code')).backgroundColor==='rgba(255, 255, 255, 0.8)'"));
  }
  await settings(true);
  await page.go(`${server.origin}/lab/fixtures/generated-style.html`);await wait(400);
  await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
  checks.push(...await proof('generated-style',await page.eval(`(${generatedStyleScenario.toString()})()`)));
  for(const width of [1200,390]) {
    await page.size(width,1000);await options.eval("chrome.storage.sync.set({extensionEnabled:true,siteRules:{}})");await wait(400);
    await page.go(`${server.origin}/lab/fixtures/checkout.html`);await wait(500);
    await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
    checks.push(...(await proof('checkout',await page.eval(`(${checkoutScenario.toString()})()`))).map(c=>({...c,name:'checkout-'+width+' / '+c.name})));
    const iconPaint=[];
    for(const icon of ['checkout-back','checkout-card-icon','checkout-crypto-icon']) {
      const rect=await page.eval(`(()=>{const parent=document.getElementById(${JSON.stringify(icon)}),e=parent.querySelector('svg')||parent;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);await wait(100);
      const bytes=await page.screenshot();writeFileSync(join(output,icon+'-'+width+'-active.png'),bytes);
      iconPaint.push({icon,active:visibleIconPixels(bytes,rect)});
    }
    await settings(false);
    add('checkout-'+width+' / disabling restores native icons',await page.eval("getComputedStyle(document.querySelector('#checkout-back svg')).filter==='none'&&getComputedStyle(document.getElementById('checkout-crypto-icon')).filter==='none'"));
    for(const sample of iconPaint) {
      const rect=await page.eval(`(()=>{const parent=document.getElementById(${JSON.stringify(sample.icon)}),e=parent.querySelector('svg')||parent;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);await wait(100);
      const bytes=await page.screenshot();writeFileSync(join(output,sample.icon+'-'+width+'-native.png'),bytes);sample.native=visibleIconPixels(bytes,rect);
      checks.push({fixture:'checkout',kind:'assertion',name:'checkout-'+width+' / '+sample.icon+' gains visible painted icon pixels',ok:sample.active-sample.native>=8,detail:JSON.stringify(sample)});
    }
  }
  await settings(true);await page.size(1200,1000);await page.go(`${server.origin}/lab/fixtures/paint-updates.html`);await wait(500);
  await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
  checks.push(...await proof('paint-updates',await page.eval(`(${paintUpdatesScenario.toString()})()`)));
  await browser.send('Performance.enable',{},page.sessionId);
  const metrics=async()=>Object.fromEntries((await browser.send('Performance.getMetrics',{},page.sessionId)).metrics.map(m=>[m.name,m.value]));
  const pairs=[],resources=[];
  for(const order of [[true,false],[false,true],[true,false]]) {
    const pair={pageOnly:true};for(const enabled of order) {
      await settings(enabled);await page.go(`${server.origin}/lab/fixtures/paint-updates.html`);await wait(500);
      pair.pageOnly&&=await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')===${enabled}`);
      const before=await metrics();pair[enabled?'active':'native']=await page.eval(`(${frameWorkload.toString()})()`);const after=await metrics();
      if(enabled)resources.push({frames:pair.active.frames,script:after.ScriptDuration-before.ScriptDuration,styles:after.RecalcStyleCount-before.RecalcStyleCount});
    }pairs.push(pair);
  }
  // Every pair verifies extension activation and complete native restoration.
  checks.push(...frameChecks(pairs).map(c=>({...c,fixture:'paint-updates',kind:'assertion'})));
  add('mail updates use at most 2.25 style passes per animation tick',resources.every(r=>r.styles<=2.25*(r.frames+1)+3),JSON.stringify(resources));
  add('mail updates spend at most 8ms of script work per animation tick',resources.every(r=>r.script/(r.frames+1)<.008),JSON.stringify(resources));
  await settings(true);await page.go(`${server.origin}/lab/fixtures/paint-updates.html`);await wait(500);
  const counts=()=>options.eval(`(async()=>{const [t]=await chrome.tabs.query({url:${JSON.stringify(server.origin+'/lab/fixtures/paint-updates.html')}});const r=await chrome.tabs.sendMessage(t.id,{type:'oled-night-report'});return r.counts})()`);
  let baselineHeap,baselineNodes;const heaps=[],nodes=[];
  for(let cycle=0;cycle<6;cycle++) {
    await page.eval(`(${mountComponents.toString()})()`);await wait(200);const mounted=await counts();
    await page.eval(`(${removeComponents.toString()})()`);await wait(80);const removed=await counts();
    add('removed mail components released / cycle '+cycle,mounted.shadowRoots>=160&&removed.shadowRoots===0,JSON.stringify({mounted:mounted.shadowRoots,removed:removed.shadowRoots}));
    await browser.send('HeapProfiler.collectGarbage',{},page.sessionId);const sample=await metrics(),heap=sample.JSHeapUsedSize;
    if(cycle===0){baselineHeap=heap;baselineNodes=sample.Nodes}else {heaps.push(heap);nodes.push(sample.Nodes)}
  }
  add('repeated component removal grows collected JS heap by less than 1MiB',heaps.every(h=>h-baselineHeap<1048576),JSON.stringify({baselineHeap,heaps}));
  add('removed components do not accumulate more than 512 collected DOM nodes',nodes.every(n=>n-baselineNodes<512),JSON.stringify({baselineNodes,nodes}));
  await settings(true);await page.go(`${server.origin}/lab/fixtures/large-updates.html`);await wait(2000);
  await page.eval(readFileSync(join(root,'docs/lab/audit.js'),'utf8'));
  checks.push(...await proof('large-updates',await page.eval(`(${largeUpdatesScenario.toString()})()`)));
  await page.eval(`document.querySelector('.row').classList.add('hl')`);await wait(120);
  add('shared background declarations remain bounded',await page.eval(`(()=>{const rules=[...document.getElementById('oled-night-sheet').sheet.cssRules].filter(r=>r.selectorText?.includes('data-oled-night-bg'));return rules.length>0&&rules.length<=128})()`));
  await settings(false);
  add('disable removes shared paint and restores native selected row',await page.eval(`!document.querySelector('[data-oled-night-bg]')&&getComputedStyle(document.querySelector('.row')).backgroundColor==='rgb(242, 246, 252)'`));
  await settings(true);
  // The synchronous re-enable scan can consume the timer's whole delay.
  // Give initial IntersectionObserver geometry delivery two rendering turns;
  // the unchanged idle ownership budget still catches retained observations.
  await page.eval('new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(done,0))))');
  const largeCounts=()=>options.eval(`(async()=>{const [t]=await chrome.tabs.query({url:${JSON.stringify(server.origin+'/lab/fixtures/large-updates.html')}});return (await chrome.tabs.sendMessage(t.id,{type:'oled-night-report'})).counts})()`);
  const settledOwnership=await largeCounts();
  await page.eval(`(${emptyRowLifecycle.toString()})()`);const emptyOwnership=await largeCounts();
  add('emptying then removing a virtual row releases its retained shell',emptyOwnership.paintContainers===settledOwnership.paintContainers,JSON.stringify({before:settledOwnership,after:emptyOwnership}));
  add('idle inbox releases per-row geometry observation after initial sampling',settledOwnership.observedPaint<=64,JSON.stringify(settledOwnership));
  add('detached queued mail rows are released', (await largeCounts()).deferredPaint===0);
  for(const width of [1200,390]) {
  const firstLargeCheck=checks.length;await page.size(width,1000);
  const largePairs=[],largeFramePairs=[],largeResources=[];
  for(const order of [[true,false],[false,true],[true,false]]) {
    const pair={pageOnly:true},framePair={pageOnly:true};for(const enabled of order) {
      await settings(enabled);await page.go(`${server.origin}/lab/fixtures/large-updates.html`);await wait(2000);
      pair.pageOnly&&=await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')===${enabled}`);
      const before=await metrics();pair[enabled?'active':'native']=await page.eval(`(${churnWorkload.toString()})()`);const after=await metrics();
      if(enabled){const count=await largeCounts();largeResources.push({workload:'churn',frames:pair.active.frames,script:after.ScriptDuration-before.ScriptDuration,styles:after.RecalcStyleCount-before.RecalcStyleCount,queued:count.deferredPaint,observed:count.observedPaint})}
      await page.go(`${server.origin}/lab/fixtures/large-updates.html`);await wait(2000);
      framePair.pageOnly&&=await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')===${enabled}`);
      // Exercise real pointer crossings when streamed content moves beneath it.
      await page.hover(200,650);await wait(160);
      const frameBefore=await metrics();framePair[enabled?'active':'native']=await page.eval(`(${frameWorkload.toString()})()`);const frameAfter=await metrics();
      if(enabled){const count=await largeCounts();largeResources.push({workload:'frames',frames:framePair.active.frames+1,script:frameAfter.ScriptDuration-frameBefore.ScriptDuration,styles:frameAfter.RecalcStyleCount-frameBefore.RecalcStyleCount,queued:count.deferredPaint,observed:count.observedPaint})}
    }largePairs.push(pair);largeFramePairs.push(framePair);
  }
  add('2,500-row churn retains 70% native throughput without 150ms stalls',judgeChurn(largePairs).ok,JSON.stringify(judgeChurn(largePairs)));
  add('large mail updates use at most 2.25 style passes per tick',largeResources.every(r=>r.styles<=2.25*r.frames+3),JSON.stringify(largeResources));
  add('large mail updates spend at most 8ms script work per tick',largeResources.every(r=>r.script/r.frames<.008),JSON.stringify(largeResources));
  add('offscreen observer ownership stays bounded at 2,048 branches',largeResources.every(r=>Number.isInteger(r.queued)&&r.queued<=2048),JSON.stringify(largeResources));
  add('viewport observation stays bounded at 4,096 containers',largeResources.every(r=>Number.isInteger(r.observed)&&r.observed<=4096),JSON.stringify(largeResources));
  add('steady animated updates observe at most 64 postponed branches',largeResources.every(r=>Number.isInteger(r.observed)&&r.observed<=64),JSON.stringify(largeResources));
  checks.push(...frameChecks(largeFramePairs).map(c=>({...c,name:'2,500 rows / '+c.name,fixture:'large-updates',kind:'assertion'})));
  await settings(true);await page.go(`${server.origin}/lab/fixtures/large-updates.html`);await wait(2000);
  await browser.send('HeapProfiler.collectGarbage',{},page.sessionId);const largeHeapBefore=await metrics();
  await page.eval("document.getElementById('list').replaceChildren()");await wait(80);
  const clearedCounts=await largeCounts();
  add('removing the whole inbox releases viewport and pending ownership',clearedCounts.observedPaint===0&&clearedCounts.deferredPaint===0&&clearedCounts.paintContainers===0,JSON.stringify(clearedCounts));
  await browser.send('HeapProfiler.collectGarbage',{},page.sessionId);const largeHeapAfter=await metrics();
  add('removed large inbox does not retain more than 1MiB extra heap or 512 extra DOM nodes',largeHeapAfter.JSHeapUsedSize-largeHeapBefore.JSHeapUsedSize<1048576&&largeHeapAfter.Nodes-largeHeapBefore.Nodes<512,JSON.stringify({before:largeHeapBefore.JSHeapUsedSize,after:largeHeapAfter.JSHeapUsedSize,nodesBefore:largeHeapBefore.Nodes,nodesAfter:largeHeapAfter.Nodes}));
  add('garbage collection releases at least 10,000 removed inbox DOM nodes',largeHeapBefore.Nodes-largeHeapAfter.Nodes>=10000,JSON.stringify({nodesBefore:largeHeapBefore.Nodes,nodesAfter:largeHeapAfter.Nodes}));
  const publicResources=await page.eval(`(async()=>{document.getElementById('resources').click();for(let n=0;n<200;n++){await new Promise(r=>setTimeout(r,50));try{const result=JSON.parse(document.getElementById('result').textContent);if(result.cycles===6)return result}catch{}}return null})()`);
  add('public component cleanup measurement completes and restores fixture DOM',publicResources?.fixtureDomRestored===true&&publicResources.componentsPerCycle===160,JSON.stringify(publicResources));
  for(let n=firstLargeCheck;n<checks.length;n++)checks[n].name='large inbox '+width+' / '+checks[n].name;
  }
  await page.go(`${server.origin}/lab/fixtures/report-preview.html`);await wait(400);
  checks.push(...await page.eval(`(${reportPreviewScenario.toString()})()`));
  const lab=await browser.open(`${server.origin}/lab/`);await wait(500);add('gallery lists all '+cases.length+' cases',await lab.eval(`document.querySelectorAll('#cases button').length===${cases.length}`));
  add('gallery search filters cases',await lab.eval(`(()=>{const s=document.getElementById('search');s.value='Reddit';s.dispatchEvent(new Event('input'));return document.querySelectorAll('#cases button').length>0&&document.querySelectorAll('#cases button').length<${cases.length}})()`));await lab.eval(`document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'))`);
  await lab.size(390,850);add('mobile gallery has no horizontal overflow',await lab.eval(`document.documentElement.scrollWidth<=innerWidth`));writeFileSync(join(output,'gallery-mobile.png'),await lab.screenshot());
  await lab.size(1400,950);writeFileSync(join(output,'gallery-desktop.png'),await lab.screenshot());
  add('no uncaught page exceptions',browser.errors.length===0,browser.errors.join('; '));
  completed=true;
}catch(e){add('Chrome lab execution',false,e.stack)}finally{await browser?.close();await server.close()}
const report={engine:'Chrome',completed,runtimeHash:runtimeDigest(file=>readFileSync(join(packageRoot,'dist/chrome',file))),candidate:process.argv.includes('--candidates'),version:JSON.parse(readFileSync(join(packageRoot,'dist/chrome/manifest.json'))).version,sha:execFileSync('git',['rev-parse','HEAD'],{cwd:packageRoot,encoding:'utf8'}).trim(),checks};
writeFileSync(join(output,'chrome.json'),JSON.stringify(report,null,2));for(const c of checks.filter(c=>!c.ok))console.log('FAIL '+c.name+': '+c.detail);console.log(`${checks.filter(c=>c.ok).length}/${checks.length} Chrome lab checks passed`);if(checks.some(c=>!c.ok))process.exitCode=1;
