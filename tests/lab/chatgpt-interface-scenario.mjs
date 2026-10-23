// Synthetic interactions through the rendered page, shared by both engines.
// No account actions, real messages, microphone access or private data.
export async function chatgptInterfaceScenario(){
  const checks=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
  const css=e=>getComputedStyle(e),$=id=>document.getElementById(id);
  const lum=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const paint=button=>{
    const filter=css(button.querySelector('svg')).filter;
    // The controlled fixture's explicit source paint is black. Chrome also
    // checks composited PNG pixels, including the dialog's native button face.
    const ink=filter==='invert(1)'?1:filter==='none'?0:NaN,bg=lum(css(button).backgroundColor);
    return {id:button.id,filter,ratio:(Math.max(ink,bg)+.05)/(Math.min(ink,bg)+.05)};
  };
  const fixedIcons=()=>[...document.querySelectorAll('[data-paint-icon]')].filter(e=>e.getBoundingClientRect().width).map(paint);
  check('disabled Send retains disabled behavior',$('send-disabled').disabled);
  $('send-disabled').focus();check('disabled Send is excluded from keyboard focus',document.activeElement!==$('send-disabled'));
  $('send-external').focus();await wait(100);
  check('Send can receive keyboard focus',document.activeElement===$('send-external'));
  check('Send retains a visible focus outline',css($('send-external')).outlineStyle!=='none'&&parseFloat(css($('send-external')).outlineWidth)>0);
  if($('tools-menu').hidden)$('tools').click();await wait(180);
  check('tools menu opens with expanded semantics',!$('tools-menu').hidden&&$('tools').getAttribute('aria-expanded')==='true');
  $('composer-state').click();await wait(180);
  check('Send changes to Stop and repairs the replacement symbol',$('composer-state').getAttribute('aria-label')==='Stop'&&paint($('composer-state')).ratio>=3);
  $('composer-state').click();await wait(180);
  check('Stop changes back to Send and remains repaired',$('composer-state').getAttribute('aria-label')==='Send'&&paint($('composer-state')).ratio>=3);
  $('settings').click();await wait(180);
  const dialogPaint=paint($('dialog-close'));
  check('dialog opens with a readable close control',$('preferences').open&&dialogPaint.ratio>=3,JSON.stringify(dialogPaint));
  $('dialog-close').click();check('dialog closes without changing its action',$('preferences').open===false);
  $('late-response')?.remove();
  const button=document.createElement('button');button.id='late-response';button.className='stop';button.setAttribute('aria-label','Late response action');button.setAttribute('data-paint-icon','');
  button.innerHTML='<svg viewBox="0 0 24 24"><use href="chatgpt-sprite.svg#send"/></svg>';$('response-actions').append(button);await wait(180);
  const icons=fixedIcons();check('all visible composer, menu, sidebar and response sprite patterns are readable',icons.every(i=>i.ratio>=3),JSON.stringify(icons));
  check('authored SVG tiles and stylesheet-colored symbols are not inverted',['sprite-tile','sprite-dark-tile','css-logo'].every(id=>css($(id).querySelector('svg')).filter==='none'));
  check('interface has no horizontal overflow',document.documentElement.scrollWidth<=innerWidth);
  // Leave the opened menu and late response action visible for actual PNG tests.
  document.activeElement?.blur();return {ok:checks.every(c=>c.ok),checks};
}
