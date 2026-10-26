// Browser-side instrumentation observes real input and the next render boundary.
export function startReplyTyping() {
  const editor=document.getElementById('replyEditor');
  const draft=document.getElementById('replyDraft');draft.textContent='Draft:';editor.focus();
  const range=document.createRange();range.setStart(draft.firstChild,draft.firstChild.length);range.collapse(true);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  const result={inputs:0,latencies:[],longTasks:[],outsideWrites:0,repeatedMeasurements:0,subtreeSwitches:0};
  let armed=false,started;
  const measured=new WeakSet();
  const outside=document.getElementById('replyHistory');
  const observer=new MutationObserver(records=>{
    if(!armed)return;
    result.outsideWrites+=records.length;
    // A bounded cursor may finish its initial focus pass during typing. Each
    // unchanged quote/history leaf may be measured once, never once per key.
    for(const record of records)if(record.attributeName==='data-oled-night-measure-self'&&record.oldValue===null&&!record.target.childElementCount){
      if(measured.has(record.target))result.repeatedMeasurements++;
      measured.add(record.target);
    }
  });
  observer.observe(outside,{attributes:true,attributeOldValue:true,subtree:true,attributeFilter:['data-oled-night-measure','data-oled-night-measure-self','data-oled-night']});
  observer.observe(document.getElementById('replyQuote'),{attributes:true,attributeOldValue:true,subtree:true,attributeFilter:['data-oled-night-measure','data-oled-night-measure-self','data-oled-night']});
  const scopes=new MutationObserver(records=>{if(armed)result.subtreeSwitches+=records.filter(record=>record.oldValue===null).length});
  scopes.observe(editor,{attributes:true,attributeOldValue:true,attributeFilter:['data-oled-night-measure']});
  const tasks=typeof PerformanceObserver==='function'?new PerformanceObserver(list=>{
    if(armed)result.longTasks.push(...list.getEntries().map(entry=>entry.duration));
  }):null;
  if(tasks)tasks.observe({type:'longtask',buffered:false});
  const beforeInput=()=>{armed=true;started=performance.now()};
  const input=()=>{const began=started;result.inputs++;requestAnimationFrame(()=>result.latencies.push(performance.now()-began))};
  editor.addEventListener('beforeinput',beforeInput,true);
  editor.addEventListener('input',input);
  globalThis.__replyTyping={finish(){
    observer.disconnect();scopes.disconnect();tasks?.disconnect();editor.removeEventListener('beforeinput',beforeInput,true);editor.removeEventListener('input',input);
    const sorted=[...result.latencies].sort((a,b)=>a-b);
    return {...result,p95:sorted[Math.ceil(sorted.length*.95)-1],text:draft.textContent.replace(/\u00a0/g,' '),color:getComputedStyle(draft).color};
  }};
}
