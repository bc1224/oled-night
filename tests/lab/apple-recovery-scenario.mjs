export async function appleRecoveryScenario(){
  const out=[],$=id=>document.getElementById(id),a=window.OLEDLabAudit;
  const check=(name,ok,detail='')=>out.push({name,ok:!!ok,detail});
  const field=$('recovery-code');
  for(const id of ['recovery-email','recovery-code']){
    const e=$(id),s=getComputedStyle(e),bg=a.background(e),ink=s.webkitTextFillColor||s.color;
    check(id+' has dark surface and readable value',a.lum(s.backgroundColor)<.16&&a.contrast(ink,bg)>=4.5,`${s.backgroundColor} / ${ink}`);
  }
  check('empty verification field label is readable',a.contrast(getComputedStyle($('code-label')).color,a.background(field))>=4.5);
  field.focus();field.value='SAMPLE';field.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,150));
  check('verification response remains editable with visible focus',!field.disabled&&field.value==='SAMPLE'&&getComputedStyle(field).outlineStyle!=='none');
  check('verification artwork keeps native paint',getComputedStyle($('recovery-image')).filter==='none'&&!$('recovery-image').hasAttribute('data-oled-night'));
  check('provider widget and its input remain untouched',!$('provider').hasAttribute('data-oled-night')&&!$('provider-control').hasAttribute('data-oled-night'));
  check('disabled Continue remains disabled',document.querySelector('button').disabled);
  return out;
}
