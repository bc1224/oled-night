// Observe parser-driven hydration through public DOM state and navigation timing.
export async function parserSurfaceResult(){
 const deadline=performance.now()+10000;
 while(document.readyState!=='complete'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,50));
 await new Promise(r=>setTimeout(r,300));
 const initial=JSON.parse(document.documentElement.getAttribute('data-parser-surface-initial')||'null');
 const card=getComputedStyle(document.getElementById('card')),heading=getComputedStyle(document.getElementById('heading'));
 return {coverage:'surface',name:'a dark card completed during parsing retains its matching surfaces without interaction',
  ok:initial?.loading&&initial.active&&parseFloat(initial.height)<64&&parseFloat(card.height)>=64&&card.backgroundColor==='rgb(27, 31, 35)'&&heading.backgroundColor===card.backgroundColor,
  detail:JSON.stringify({initial,height:card.height,card:card.backgroundColor,heading:heading.backgroundColor})};
}
export async function parserWorkResult(){
 const deadline=performance.now()+10000;
 while(document.readyState!=='complete'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,50));
 await new Promise(r=>setTimeout(r,300));
 const root=document.documentElement,last=document.querySelector('article:last-of-type'),nav=performance.getEntriesByType('navigation')[0];
 return {active:root.hasAttribute('data-oled-night-root'),initialActive:root.getAttribute('data-parser-initial-active')==='true',
  complete:document.readyState==='complete',cards:document.querySelectorAll('article').length,
  rootMeasurements:Number(root.getAttribute('data-parser-measurements')),loadMs:nav.loadEventEnd,framePaint:JSON.parse(root.getAttribute('data-parser-frame-paint')||'null'),
  ink:last&&getComputedStyle(last).color,background:last&&getComputedStyle(last).backgroundColor};
}
export function parserWorkChecks(off,on){
 return [
  {coverage:'performance',name:'parser hydration uses complete, equally sized on and off pages',ok:off.complete&&on.complete&&!off.active&&!off.initialActive&&on.active&&on.initialActive&&off.cards===200&&on.cards===200,detail:JSON.stringify({off,on})},
  // Genuine loading-frame updates still measure colors. Bound parser churn
  // below half the 200 fragments, instead of requiring an idle-page count.
  {coverage:'performance',name:'parser-driven root changes coalesce color measurements before paint',ok:on.rootMeasurements<100,detail:JSON.stringify({measurements:on.rootMeasurements,limit:100})},
  {coverage:'performance',name:'parser-heavy loading adds less than one second with OLED enabled',ok:on.loadMs<off.loadMs+1000,detail:JSON.stringify({off:off.loadMs,on:on.loadMs,overhead:on.loadMs-off.loadMs})},
  {coverage:'surface',name:'the last parsed card retains dark paint and readable text',ok:Number(on.background?.match(/\d+/)?.[0])<40&&Number(on.ink?.match(/\d+/)?.[0])>=180,detail:JSON.stringify({background:on.background,ink:on.ink})},
  {coverage:'surface',name:'animation-frame updates during parsing receive dark paint in the same frame',ok:on.framePaint?.loading&&on.framePaint.active&&Number(on.framePaint.background.match(/\d+/)?.[0])<40&&Number(on.framePaint.ink.match(/\d+/)?.[0])>=180,detail:JSON.stringify(on.framePaint)}
 ];
}
