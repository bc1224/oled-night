export async function largeUpdatesScenario(){
 const out=[],check=(name,ok,detail='')=>out.push({name,ok:!!ok,detail}),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const rows=[...document.querySelectorAll('.row')], far=rows.slice(-20);
 const original=far.map(e=>e.style.getPropertyValue('--oln-bg'));
 let writes=0;const observer=new MutationObserver(records=>writes+=records.filter(r=>r.attributeName==='style').length);
 for(const row of far)observer.observe(row,{attributes:true});
 for(const row of far)row.classList.add('hl');await sleep(80);observer.disconnect();
 check('offscreen updates retain dark paint without rewriting all rows',writes===0,JSON.stringify({writes}));
 const row=far[0];row.scrollIntoView({block:'center'});await sleep(100);
 const css=getComputedStyle(row);check('approaching viewport refreshes pending row paint',row.style.getPropertyValue('--oln-bg')!==original[0]&&window.OLEDLabAudit.lum(css.backgroundColor)<.16,css.backgroundColor);
 check('refreshed row ink remains readable',window.OLEDLabAudit.contrast(getComputedStyle(row.querySelector('.c')).color,css.backgroundColor)>=4.5);
 // New text must be recolored immediately even when its containing row is offscreen.
 scrollTo(0,0);await sleep(100);const fresh=document.createElement('span');fresh.textContent='Fake new message';fresh.style.color='#111';far[1].append(fresh);await sleep(80);
 check('new offscreen text gets an immediate readable override',fresh.hasAttribute('data-oled-night')&&window.OLEDLabAudit.lum(getComputedStyle(fresh).color)>.4);
 far[2].style.cssText='background:#fff;color:#111';await sleep(80);
 check('framework removal of overrides is repaired offscreen',far[2].hasAttribute('data-oled-night')&&window.OLEDLabAudit.lum(getComputedStyle(far[2]).backgroundColor)<.16);
 const layout=document.createElement('style');layout.textContent='.row.hl{position:relative}';document.head.append(layout);await sleep(100);
 let eagerWrites=0;const fallback=new MutationObserver(records=>eagerWrites+=records.filter(r=>r.attributeName==='style').length);
 for(const item of far)fallback.observe(item,{attributes:true});
 for(const item of far)item.classList.remove('hl');await sleep(80);fallback.disconnect();
 check('late layout rules retain immediate conservative repaint',eagerWrites>0,String(eagerWrites));
 layout.remove();await sleep(100);for(const item of far)item.classList.add('hl');await sleep(80);
 for(const item of far)item.remove();await sleep(80);scrollTo(0,0);
 return out;
}
