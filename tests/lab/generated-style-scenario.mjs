export async function generatedStyleScenario(){
 document.getElementById('generate').click();await new Promise(r=>setTimeout(r,200));
 const out=[{name:'generated-content regression runs with extension active',ok:document.documentElement.hasAttribute('data-oled-night-root')}],a=window.OLEDLabAudit;
 for(const [element,pseudo] of [[document.getElementById('late-label'),'::before'],[document.getElementById('generated-host').shadowRoot.getElementById('shadow-label'),'::after'],[document.getElementById('part-host').shadowRoot.getElementById('part-label'),'::before']]){
  const s=getComputedStyle(element,pseudo);
  out.push({name:'CSSOM '+pseudo+' remains dark and readable in '+(element.getRootNode()===document?'document':'adopted shadow'),ok:s.content!=='none'&&a.lum(s.backgroundColor)<.16&&a.contrast(s.color,s.backgroundColor)>=4.5,detail:JSON.stringify({content:s.content,bg:s.backgroundColor,ink:s.color})});
 }
 return out;
}
