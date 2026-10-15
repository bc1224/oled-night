import {sampleNavigationPaint,navigationPaint} from './smoke-policy.mjs';
// Arm inside the page before dispatching native input: waiting 200ms after input
// loses the entry interval. Keep every sample; never average away a pale one.
export async function watchHover(tab,point){
  await tab.eval(`window.__cvsHoverWatch=(${sampleNavigationPaint.toString()})(${JSON.stringify(point)},(${navigationPaint.toString()}),{frames:24});true`);
  await tab.hover(point.x,point.y);
  return tab.eval('window.__cvsHoverWatch');
}
export async function cvsScenario(page,origin){
  const checks=[],add=(name,ok,detail='')=>checks.push({name,ok,detail});
  await page.size(1200,1000);await page.go(origin+'/lab/fixtures/cvs-hover.html');
  add('CVS stress / extension active',await page.eval("document.documentElement.hasAttribute('data-oled-night-root')"));
  // A framework may attach roots to an existing, already-scanned host. Make
  // that order explicit; loading speed must not decide whether this is tested.
  await page.eval('window.CVSHoverLab.resetHost()');
  await page.eval('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,0))))');
  await page.eval('window.CVSHoverLab.mount()');
  for(let round=0;round<5;round++){
    // Replace nested links and adopted sheets, then drive real sibling moves.
    await page.eval('window.CVSHoverLab.hydrate()');
    for(let i=0;i<3;i++){
      const point=await page.eval(`(()=>{const e=window.CVSHoverLab.links()[${i}],r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      const result=await watchHover(page,point);
      if(result.pale)result.context=await page.eval(`(()=>{const links=window.CVSHoverLab.links(),r=links[0].getRootNode();return {hidden:document.hidden,mode:document.documentElement.getAttribute('data-oled-night-page'),sheets:r.adoptedStyleSheets.map(s=>s.cssRules.length),links:links.map(e=>({marked:e.getAttribute('data-oled-night'),bg:getComputedStyle(e).backgroundColor,variable:e.style.getPropertyValue('--oln-bg')}))}})()`);
      add(`CVS stress / hydration ${round+1} sibling ${i+1} no pale sample`,!result.pale&&result.samples===24,JSON.stringify(result));
      add(`CVS stress / hydration ${round+1} sibling ${i+1} actually hovered and readable`,await page.eval(`(()=>{const e=window.CVSHoverLab.links()[${i}],a=window.OLEDLabAudit;return e.matches(':hover')&&a.contrast(getComputedStyle(e).color,a.background(e))>=4.5})()`));
    }
  }
  // Authored CSSOM edits in a later event microtask have no DOM mutation.
  await page.hover(1,1);await page.eval('window.CVSHoverLab.deferredHover()');
  await page.eval('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,0))))');
  const deferredPoint=await page.eval(`(()=>{const r=document.getElementById('deferred-hover').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const deferred=await watchHover(page,deferredPoint);
  add('CVS stress / deferred CSSOM hover has no pale sample',!deferred.pale&&deferred.samples===24,JSON.stringify(deferred));
  await page.hover(1,1);await page.eval('window.CVSHoverLab.frameHover()');
  await page.eval('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,0))))');
  const firstEntry=await page.eval(`(()=>{const sheet=document.getElementById('frame-sheet').sheet,index=sheet.insertRule('#frame-hover{background:rgb(227,241,255)}',sheet.cssRules.length);return new Promise(resolve=>requestAnimationFrame(()=>setTimeout(()=>{const color=getComputedStyle(document.getElementById('frame-hover')).backgroundColor;sheet.deleteRule(index);resolve(color)},0)))})()`);
  add('CVS stress / CSSOM surface stays dark before first interaction',!/^rgb\(227,\s*241,\s*255\)$/.test(firstEntry),firstEntry);
  const framePoint=await page.eval(`(()=>{const r=document.getElementById('frame-hover').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const frame=await watchHover(page,framePoint);
  add('CVS stress / frame CSSOM hover has no pale sample',!frame.pale&&frame.samples===24,JSON.stringify(frame));
  // Demonstrate sensitivity with the same real browser sampler, not a passing
  // count alone: an explicitly injected pale hover must be caught.
  await page.eval(`(()=>{const e=window.CVSHoverLab.links()[2];e.style.setProperty('background-color','#fff','important')})()`);
  const point=await page.eval(`(()=>{const r=window.CVSHoverLab.links()[2].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const fault=await watchHover(page,point);add('CVS stress / detects injected pale hover',fault.pale);
  await page.eval(`window.CVSHoverLab.hydrate()`);
  return checks;
}
