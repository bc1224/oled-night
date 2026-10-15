// A framework can insert its header inside a frame callback. Styling queued
// for the next frame then misses the current paint. Check that same frame,
// after its callback/mutation microtasks, rather than waiting another frame.
export async function frameMutationScenario() {
  const colors=[],panels=[];
  for(let round=0;round<5;round++){
    let panel;
    await new Promise(done=>requestAnimationFrame(()=>{
      panel=document.createElement('div');
      panel.style.cssText='background:#fff;color:#111;padding:16px';
      panel.textContent='New navigation surface';document.body.append(panel);panels.push(panel);
      setTimeout(()=>{const style=getComputedStyle(panel);colors.push({background:style.backgroundColor,color:style.color});done()},0);
    }));
  }
  const ok=colors.every(c=>window.OLEDLabAudit.lum(c.background)<.16&&window.OLEDLabAudit.contrast(c.color,c.background)>=4.5);
  for(const panel of panels)panel.remove();
  const sheet=document.createElement('style'),link=document.createElement('a');
  sheet.textContent='#frame-focus-probe{display:inline-block;padding:16px;color:#013f7c;background:transparent}#frame-focus-probe:focus{background:rgb(227,241,255);color:#013f7c}';
  link.id='frame-focus-probe';link.href='#example';link.textContent='Frame-boundary navigation';
  document.head.append(sheet);document.body.append(link);
  await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(done,0))));
  const focused=[];
  for(let round=0;round<5;round++){
    link.blur();
    await new Promise(done=>requestAnimationFrame(()=>{
      link.focus();
      setTimeout(()=>{const style=getComputedStyle(link);focused.push({focused:document.activeElement===link,background:style.backgroundColor,color:style.color});done()},0);
    }));
  }
  link.remove();sheet.remove();
  return [{name:'frame-created surfaces dark and readable before another frame',ok,detail:JSON.stringify(colors)},
    {name:'frame-boundary focus stays dark before another frame',ok:focused.every(c=>c.focused&&window.OLEDLabAudit.lum(c.background)<.16&&window.OLEDLabAudit.contrast(c.color,c.background)>=4.5),detail:JSON.stringify(focused)}];
}
