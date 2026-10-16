// Runs unchanged in Chrome's page context and Firefox's executeScript seam.
// Literal authored colors, rather than extension attributes, are the oracle.
export async function colorPaletteScenario(){
  const pause=()=>new Promise(r=>setTimeout(r,350));
  const samples=()=>[...document.querySelectorAll('[data-expected]')].map(e=>{
    const hex=e.dataset.expected,s=getComputedStyle(e),rgb='rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
    let ancestorFilter=false;for(let p=e;p;p=p.parentElement)if(getComputedStyle(p).filter!=='none')ancestorFilter=true;
    return {color:hex,kind:e.className,actual:s.backgroundColor,ok:s.backgroundColor===rgb&&!ancestorFilter};
  });
  const initial=samples();
  // Reopening, new custom colors and updated samples must keep native paint.
  document.getElementById('toggle').click();document.getElementById('toggle').click();
  document.getElementById('add-colors').click();
  const changed=document.querySelector('[data-expected]');changed.style.backgroundColor='#a4c2f4';changed.dataset.expected='#a4c2f4';
  await pause();
  const updated=samples(),target=document.querySelector('[aria-label="#ffff00"]');target.focus();target.click();await pause();
  const menu=getComputedStyle(document.getElementById('palette')),interaction=document.getElementById('chosen').textContent==='#ffff00'&&document.activeElement===target;
  const darkMenu=menu.backgroundColor!=='rgb(255, 255, 255)'&&menu.color!=='rgb(32, 33, 36)';
  return {ok:initial.length===80&&initial.every(s=>s.ok)&&updated.length===92&&updated.every(s=>s.ok)&&interaction&&darkMenu,initialCount:initial.length,updatedCount:updated.length,failures:[...initial,...updated].filter(s=>!s.ok).slice(0,12),interaction,darkMenu};
}

export function colorPaletteRestored(){
  return !document.documentElement.hasAttribute('data-oled-night-root')&&getComputedStyle(document.getElementById('palette')).backgroundColor==='rgb(255, 255, 255)'&&[...document.querySelectorAll('[data-expected]')].every(e=>{
    const hex=e.dataset.expected;
    return getComputedStyle(e).backgroundColor==='rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
  });
}
