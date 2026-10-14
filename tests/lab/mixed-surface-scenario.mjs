// Shared rendered-behavior assertions, also serialized into the Firefox adapter.
export async function mixedSurfaceScenario(nativeColors=true){
  const out=window.OLEDLabAudit.audit(document),$=id=>document.getElementById(id),css=e=>getComputedStyle(e);
  const check=(name,ok,detail='')=>out.push({name,ok:!!ok,detail});
  if($('email-photo')){
    check('email image remains visible',$('email-photo').naturalWidth>0&&css($('email-photo')).opacity==='1');
    check('creative ink remains authored dark',css($('creative-copy')).color==='rgb(17, 17, 17)',css($('creative-copy')).color);
    check('creative artwork remains unfiltered',css($('email-art')).filter==='none');
  }else{
    const accent=css($('accent')).color;
    if(nativeColors)check('native colored status preserved',accent==='rgb(0, 200, 5)',accent);
    else{const [r,g,b]=accent.match(/[\d.]+/g).map(Number);check('recolored status retains green meaning',g>r+40&&g>b+40,accent)}
    $('tour').click();check('tour action remains functional',$('tour').dataset.clicked==='yes');
    $('tour').focus();await new Promise(r=>setTimeout(r,150));
    const a=window.OLEDLabAudit,s=css($('tour'));
    check('focused tour is dark and readable',a.lum(s.backgroundColor)<.16&&a.contrast(s.color,a.background($('tour')))>=4.5,s.backgroundColor);
    check('focused tour has an outline',s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0);
    $('tour').blur();
  }
  const late=document.createElement('p');late.style.color='#222';late.textContent='Synthetic late-arriving copy';
  ($('email-panel')||$('banner')).append(late);await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
  const a=window.OLEDLabAudit,ratio=a.contrast(css(late).color,a.background(late));
  check('late copy readable before another painted frame',ratio>=4.5,ratio.toFixed(2)+':1');late.remove();
  return out;
}

export function mixedSurfaceOriginal(){
  const out=[],$=id=>document.getElementById(id),css=e=>getComputedStyle(e),check=(name,ok)=>out.push({name,ok:!!ok,detail:''});
  check('disable removes extension marks',!document.documentElement.hasAttribute('data-oled-night-root'));
  check('original light panel restored',css($('email-panel')||$('banner')).backgroundColor==='rgb(255, 255, 255)');
  check('original authored ink restored',css($('email-heading')||$('tour')).color===($('email-heading')?'rgb(34, 34, 34)':'rgb(51, 51, 51)'));
  return out;
}

export function mixedSurfaceDeepen(){
  const out=[],$=id=>document.getElementById(id),css=e=>getComputedStyle(e),check=(name,ok)=>out.push({name,ok:!!ok,detail:''});
  check('explicit deepen keeps native light panel',css($('email-panel')||$('banner')).backgroundColor==='rgb(255, 255, 255)');
  check('explicit deepen keeps native ink',css($('email-heading')||$('tour')).color===($('email-heading')?'rgb(34, 34, 34)':'rgb(51, 51, 51)'));
  return out;
}
