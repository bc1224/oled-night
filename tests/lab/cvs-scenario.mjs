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
  for(let round=0;round<5;round++){
    // Replace nested links and adopted sheets, then drive real sibling moves.
    await page.eval('window.CVSHoverLab.hydrate()');
    for(let i=0;i<3;i++){
      const point=await page.eval(`(()=>{const e=window.CVSHoverLab.links()[${i}],r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      const result=await watchHover(page,point);
      add(`CVS stress / hydration ${round+1} sibling ${i+1} no pale sample`,!result.pale&&result.samples===24,JSON.stringify(result));
      add(`CVS stress / hydration ${round+1} sibling ${i+1} actually hovered and readable`,await page.eval(`(()=>{const e=window.CVSHoverLab.links()[${i}],a=window.OLEDLabAudit;return e.matches(':hover')&&a.contrast(getComputedStyle(e).color,a.background(e))>=4.5})()`));
    }
  }
  // Demonstrate sensitivity with the same real browser sampler, not a passing
  // count alone: an explicitly injected pale hover must be caught.
  await page.eval(`(()=>{const e=window.CVSHoverLab.links()[2];e.style.setProperty('background-color','#fff','important')})()`);
  const point=await page.eval(`(()=>{const r=window.CVSHoverLab.links()[2].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const fault=await watchHover(page,point);add('CVS stress / detects injected pale hover',fault.pale);
  await page.eval(`window.CVSHoverLab.hydrate()`);
  return checks;
}
