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
 await send('Tracing.start',{categories:'devtools.timeline,blink,disabled-by-default-devtools.timeline.invalidationTracking',transferMode:'ReturnAsStream'},page.sessionId);
 const metric=async()=>Object.fromEntries((await send('Performance.getMetrics',{},page.sessionId)).result.metrics.map(m=>[m.name,m.value]));
 const before=await metric();await send('Profiler.enable',{},page.sessionId);await send('Profiler.start',{},page.sessionId);
 const measured=await page.eval(`(${workload.toString()})()`);
 const {result:{profile}}=await send('Profiler.stop',{},page.sessionId);
 writeFileSync(join(output,'failed-row-workload.cpuprofile'),JSON.stringify(profile));
 writeFileSync(join(output,'failed-row-state.json'),JSON.stringify({state,measured},null,2));
 const traceDone=send.nextEvent('Tracing.tracingComplete');await send('Tracing.end',{},page.sessionId);const {stream}=await traceDone;let trace='';
 while(true){const response=await send('IO.read',{handle:stream},page.sessionId);if(response.error)throw Error('Trace stream read: '+response.error.message);const r=response.result;trace+=r.base64Encoded?Buffer.from(r.data,'base64').toString():r.data;if(r.eof)break}await send('IO.close',{handle:stream},page.sessionId);writeFileSync(join(output,'failed-row-trace.json'),trace);
 const after=await metric(),comparisons=[{variant:'original',work:measured,scriptMs:1000*(after.ScriptDuration-before.ScriptDuration),styleMs:1000*(after.RecalcStyleDuration-before.RecalcStyleDuration),layoutMs:1000*(after.LayoutDuration-before.LayoutDuration)}];
 for(const variant of ['inspector-disabled','device-metrics','other-tabs-closed']){
  if(variant==='inspector-disabled'){await send('CSS.disable',{},page.sessionId);await send('DOM.disable',{},page.sessionId)}
  if(variant==='device-metrics')await send('Emulation.setDeviceMetricsOverride',{width:1000,height:800,deviceScaleFactor:1,mobile:false},page.sessionId);
  if(variant==='other-tabs-closed')await extension.eval(`(async()=>{const tabs=await chrome.tabs.query({});for(const t of tabs)if(t.url!==${JSON.stringify(url)}&&!t.url?.startsWith('chrome-extension:'))await chrome.tabs.remove(t.id)})()`);
  const a=await metric(),work=await page.eval(`(${workload.toString()})()`),b=await metric();comparisons.push({variant,work,scriptMs:1000*(b.ScriptDuration-a.ScriptDuration),styleMs:1000*(b.RecalcStyleDuration-a.RecalcStyleDuration),layoutMs:1000*(b.LayoutDuration-a.LayoutDuration)});
 }
 writeFileSync(join(output,'failed-row-comparisons.json'),JSON.stringify(comparisons,null,2));console.log('ROW RENDERING COMPARISONS '+JSON.stringify(comparisons));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),costs=new Map();
 for(let i=0;i<(profile.samples||[]).length;i++){const frame=nodes.get(profile.samples[i])?.callFrame;if(!frame)continue;const key=frame.functionName+' '+frame.url+':'+(frame.lineNumber+1);costs.set(key,(costs.get(key)||0)+(profile.timeDeltas?.[i]||0)/1000)}
 console.log('ROW PERFORMANCE DIAGNOSTIC '+JSON.stringify({state,measured,selfCpu:[...costs].sort((a,b)=>b[1]-a[1]).slice(0,20)}));
}
