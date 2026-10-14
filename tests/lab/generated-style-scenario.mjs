export async function generatedStyleScenario(){
 document.getElementById('generate').click();
 const frames=[],until=performance.now()+450;
 await new Promise(done=>{function sample(){const s=getComputedStyle(document.getElementById('late-transition'));frames.push({background:s.backgroundColor,width:parseFloat(s.width)});if(performance.now()<until)requestAnimationFrame(sample);else done()}requestAnimationFrame(sample)});
 const out=[{name:'generated-content regression runs with extension active',ok:document.documentElement.hasAttribute('data-oled-night-root')}],a=window.OLEDLabAudit;
 out.push({name:'late CSSOM color transition never paints pale',ok:frames.length>1&&frames.every(f=>a.lum(f.background)<.16),detail:JSON.stringify(frames)});
 out.push({name:'late CSSOM width transition retains layout motion',ok:frames.some(f=>f.width>125&&f.width<235)&&Math.abs(frames.at(-1).width-240)<1,detail:JSON.stringify(frames.map(f=>f.width))});
 for(const [element,pseudo] of [[document.getElementById('late-label'),'::before'],[document.getElementById('generated-host').shadowRoot.getElementById('shadow-label'),'::after'],[document.getElementById('part-host').shadowRoot.getElementById('part-label'),'::before']]){
  const s=getComputedStyle(element,pseudo);
  out.push({name:'CSSOM '+pseudo+' remains dark and readable in '+(element.getRootNode()===document?'document':'adopted shadow'),ok:s.content!=='none'&&a.lum(s.backgroundColor)<.16&&a.contrast(s.color,s.backgroundColor)>=4.5,detail:JSON.stringify({content:s.content,bg:s.backgroundColor,ink:s.color})});
 }
 return out;
}
