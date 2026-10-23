import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Capture a separate diagnostic only after the unchanged benchmark has failed.
// Profiling must not change the measurements that decide whether a release passes.
export async function rowPerformanceDiagnostic({send,page,extension,url,workload,root}) {
 const output=join(root,'dist/performance');mkdirSync(output,{recursive:true});
 const state=await extension.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(url)}});return(await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
  const row=document.querySelector('.row'),leaf=row?.querySelector('.c');let closedRoot;
  try{closedRoot={api:typeof globalThis.chrome?.dom?.openOrClosedShadowRoot,result:!!globalThis.chrome?.dom?.openOrClosedShadowRoot(row)}}catch(e){closedRoot={error:String(e)}}
  return {userAgent:navigator.userAgent,closedRoot,rows:document.querySelectorAll('.row').length,active:document.documentElement.getAttribute('data-oled-night-mode'),row:row?.outerHTML.slice(0,1600),leaf:leaf&&{color:getComputedStyle(leaf).color},sheets:[...document.styleSheets].map(s=>{try{return {id:s.ownerNode?.id,rules:[...s.cssRules].slice(0,8).map(r=>r.cssText)}}catch(e){return {error:String(e)}}}).slice(0,5)};
 }}))[0].result})()`);
 await send('Profiler.enable',{},page.sessionId);await send('Profiler.start',{},page.sessionId);
 const measured=await page.eval(`(${workload.toString()})()`);
 const {result:{profile}}=await send('Profiler.stop',{},page.sessionId);
 writeFileSync(join(output,'failed-row-workload.cpuprofile'),JSON.stringify(profile));
 writeFileSync(join(output,'failed-row-state.json'),JSON.stringify({state,measured},null,2));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),costs=new Map();
 for(let i=0;i<(profile.samples||[]).length;i++){const frame=nodes.get(profile.samples[i])?.callFrame;if(!frame)continue;const key=frame.functionName+' '+frame.url+':'+(frame.lineNumber+1);costs.set(key,(costs.get(key)||0)+(profile.timeDeltas?.[i]||0)/1000)}
 console.log('ROW PERFORMANCE DIAGNOSTIC '+JSON.stringify({state,measured,selfCpu:[...costs].sort((a,b)=>b[1]-a[1]).slice(0,20)}));
}
