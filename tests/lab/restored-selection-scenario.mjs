// Current-runtime regression; keep the frozen historical workload unchanged.
export async function restoredSelectionScenario(){
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const rows=[...document.querySelectorAll('.row')],first=rows[0],far=rows.slice(-20);
 const original=far.map(row=>row.classList.contains('hl')),firstSelected=first.classList.contains('hl');
 const temporary=document.createElement('style');temporary.textContent='.row{border-bottom-color:#ddd}';
 let observer,writes=0;
 try{
  first.classList.add('hl');await sleep(80);const expected=getComputedStyle(first).backgroundColor;
  first.classList.toggle('hl',firstSelected);await sleep(80);
  document.head.append(temporary);await sleep(80);temporary.remove();await sleep(80);
  observer=new MutationObserver(records=>writes+=records.filter(record=>record.attributeName==='style').length);
  for(const row of far)observer.observe(row,{attributes:true});
  for(const row of far)row.classList.add('hl');await sleep(80);observer.disconnect();
  const colors=far.map(row=>getComputedStyle(row).backgroundColor);
  return [{name:'restored stylesheet proof applies offscreen selection before viewport delivery',ok:writes===0&&colors.every(color=>color===expected),detail:JSON.stringify({expected,colors,writes})}];
 }finally{
  observer?.disconnect();temporary.remove();first.classList.toggle('hl',firstSelected);
  for(const [index,row]of far.entries())row.classList.toggle('hl',original[index]);await sleep(80);
 }
}
