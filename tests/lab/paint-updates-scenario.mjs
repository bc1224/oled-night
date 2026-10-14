export async function paintUpdatesScenario(){
 const row=document.querySelector('.row'),audit=window.OLEDLabAudit,out=[];
 let changes=0;const watch=new MutationObserver(records=>changes+=records.filter(r=>r.attributeName==='style').length);watch.observe(row,{attributes:true});
 row.classList.add('hl');await new Promise(r=>setTimeout(r,80));watch.disconnect();
 out.push({name:'single paint change does not rewrite unrelated overrides',ok:changes<=2,detail:changes+' inline style mutations'});
 out.push({name:'updated surface stays dark and readable',ok:audit.lum(getComputedStyle(row).backgroundColor)<.16&&audit.contrast(getComputedStyle(row).color,audit.background(row))>=4.5});
 row.style.cssText='background:#fff;color:#222';await new Promise(r=>setTimeout(r,80));
 out.push({name:'framework style replacement repairs missing overrides',ok:row.hasAttribute('data-oled-night')&&audit.lum(getComputedStyle(row).backgroundColor)<.16&&audit.contrast(getComputedStyle(row).color,audit.background(row))>=4.5});
 return out;
}
