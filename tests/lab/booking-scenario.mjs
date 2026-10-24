export async function bookingScenario(){
  const out=window.OLEDLabAudit.audit(document),$=id=>document.getElementById(id),css=e=>getComputedStyle(e),a=window.OLEDLabAudit;
  const check=(name,ok,detail='')=>out.push({name,ok:!!ok,detail});
  for(const id of ['booking-value','booking-last','booking-email']){
    const e=$(id),s=css(e),paint=s.webkitTextFillColor||s.color,ratio=a.contrast(paint,a.background(e));
    check(id+' filled value uses primary readable ink',a.lum(paint)>.6&&ratio>=4.5,paint+' / '+ratio.toFixed(2)+':1');
  }
  const hint=getComputedStyle($('booking-placeholder'),'::placeholder');
  check('placeholder is readable and distinct',a.contrast(hint.color,a.background($('booking-placeholder')))>=4.5&&hint.color!==css($('booking-value')).color,hint.color);
  check('named colored logo receives local ink correction without inversion or glow',css($('booking-logo')).filter.includes('oled-night-logo-ink')&&!/invert|drop-shadow/.test(css($('booking-logo')).filter),css($('booking-logo')).filter);
  check('masked back icon remains visible',a.lum(css($('booking-back')).backgroundColor)>.5,css($('booking-back')).backgroundColor);
  $('booking-value').focus();await new Promise(r=>setTimeout(r,150));
  check('field focus has an outline',css($('booking-value')).outlineStyle!=='none');
  check('ordinary content image unchanged',css($('booking-photo')).filter==='none');
  check('disabled field remains disabled',$('booking-disabled').disabled);
  return out;
}
