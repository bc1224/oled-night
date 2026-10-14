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
  return [{name:'frame-created surfaces dark and readable before another frame',ok,detail:JSON.stringify(colors)}];
}
