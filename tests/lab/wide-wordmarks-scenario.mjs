export async function wideWordmarksScenario() {
  const out=[],readability=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const luminance=value=>{const c=value.match(/[\d.]+/g).slice(0,3).map(v=>{v=+v/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const ink=id=>getComputedStyle(document.getElementById(id)).fill;
  const button=document.getElementById('wordmark-button');
  const blend=(paint,back,alpha)=>'rgb('+paint.match(/[\d.]+/g).slice(0,3).map((v,i)=>Math.round(+v*alpha+back.match(/[\d.]+/g)[i]*(1-alpha))).join(', ')+')';
  const check=state=>{const style=getComputedStyle(button),back=getComputedStyle(document.body).backgroundColor,alpha=+style.opacity,fill=blend(ink('wordmark-ink'),back,alpha),bg=blend(style.backgroundColor,back,alpha),ratio=contrast(fill,bg);readability.push({state,fill,bg,ratio,ok:ratio>=3})};
  check('rest');button.focus();await sleep(80);check('focus');
  out.push({name:'wordmark focus outline remains visible',ok:getComputedStyle(button).outlineStyle!=='none'&&contrast(getComputedStyle(button).outlineColor,getComputedStyle(document.body).backgroundColor)>=3});
  button.click();await sleep(180);check('expanded');
  const lateRatio=contrast(ink('late-ink'),getComputedStyle(button).backgroundColor);readability.push({state:'late animated path',ratio:lateRatio,ok:lateRatio>=3});
  button.disabled=true;await sleep(80);check('disabled');button.disabled=false;
  out.push({name:'colored wordmark paint is preserved',ok:ink('colored-wordmark')==='rgb(214, 66, 103)',detail:ink('colored-wordmark')});
  out.push({name:'unlabelled wide artwork is preserved',ok:ink('ordinary-art')==='rgb(24, 24, 24)',detail:ink('ordinary-art')});
  out.push({name:'large logo artwork is preserved',ok:ink('tall-art')==='rgb(24, 24, 24)',detail:ink('tall-art')});
  const menu=document.getElementById('menu-button');
  const checkStrokes=state=>{const bg=getComputedStyle(menu).backgroundColor;for(const e of menu.querySelectorAll('.menu-line')){const style=getComputedStyle(e);if(+style.opacity===0)continue;const ratio=contrast(style.backgroundColor,bg);readability.push({state,ratio,ok:ratio>=3})}};
  checkStrokes('hamburger');menu.querySelector('.menu-line').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,composed:true}));await sleep(180);checkStrokes('hamburger pointer');menu.click();await sleep(100);checkStrokes('close');menu.focus();await sleep(80);checkStrokes('close focus');
  out.push({name:'menu animation keeps its hidden middle stroke',ok:getComputedStyle(menu.querySelectorAll('.menu-line')[1]).opacity==='0'});
  const strip=getComputedStyle(document.getElementById('decorative-strip')).backgroundColor;
  out.push({name:'standalone separators remain surfaces',ok:luminance(strip)<.1,detail:strip});
  await sleep(350);
  out.push({name:'adjacent hero opacity animation completes without input',ok:getComputedStyle(document.getElementById('entrance-word')).opacity==='1'});
  out.unshift({name:'Compact navigation graphics stay readable through state and animation updates',ok:readability.every(c=>c.ok),detail:JSON.stringify(readability)});
  return out;
}
