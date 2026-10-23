// User-facing paint seam: real extension styles, native state changes, and
// nested shadow DOM. Synthetic content models the four attached screenshots.
export async function reportedControlsScenario(){
  const wait=()=>new Promise(resolve=>setTimeout(resolve,450));
  const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const luminance=value=>rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const composite=(a,b)=>{const values=(a.match(/[\d.]+/g)||[]).map(Number),alpha=values[3]??1,base=rgb(b);return 'rgb('+values.slice(0,3).map((v,i)=>Math.round(v*alpha+base[i]*(1-alpha))).join(', ')+')'};
  const backdrop=element=>{for(let node=element;node;node=node.parentElement||node.getRootNode()?.host){const bg=getComputedStyle(node).backgroundColor;if((bg.match(/[\d.]+/g)||[]).length===3||Number((bg.match(/[\d.]+/g)||[])[3])>=.99)return bg}return 'rgb(0, 0, 0)'};
  const out=[],check=(name,ok,detail)=>out.push({name,ok,detail:JSON.stringify(detail)});
  const parsedCheck=document.getElementById('ads-grid').shadowRoot.getElementById('campaign-check'),parsedPaint=getComputedStyle(parsedCheck);
  const parsedRatio=Math.max(ratio(parsedPaint.borderTopColor,backdrop(parsedCheck.parentElement)),ratio(parsedPaint.backgroundColor,backdrop(parsedCheck.parentElement)));
  check('Ordinary shadow root attached during DOMContentLoaded has a visible unchecked control before interaction',!parsedCheck.checked&&parsedRatio>=3,{ratio:parsedRatio,bg:parsedPaint.backgroundColor,border:parsedPaint.borderTopColor});
  const shadowLabel=parsedCheck.parentElement,shadowLabelStyle=getComputedStyle(shadowLabel),shadowLabelRatio=ratio(shadowLabelStyle.webkitTextFillColor||shadowLabelStyle.color,backdrop(shadowLabel));
  check('Light shadow component keeps its label readable on a native dark page',shadowLabelRatio>=4.5,{ratio:shadowLabelRatio,bg:backdrop(shadowLabel),ink:shadowLabelStyle.color});
  const rating=document.getElementById('review-rating'),stars=Array.from(rating.querySelectorAll('svg'));
  const starInk=svg=>{const s=getComputedStyle(svg.querySelector('polygon')),fill=rgb(s.fill);return getComputedStyle(svg).filter.includes('invert(1)')?'rgb('+fill.map(v=>255-v).join(',')+')':s.fill};
  const starPaints=stars.map(starInk);
  check('Backcountry all five review stars remain visible with filled ratings distinct',starPaints.every(ink=>ratio(ink,backdrop(rating))>=3)&&starPaints[0]!==starPaints[3]&&rating.getAttribute('aria-label')==='3 out of 5 stars',{starPaints,bg:backdrop(rating)});
  const ratedPart=stars[0].querySelector('polygon');ratedPart.style.fill='#008a60';await wait();
  check('Read-only colored rating artwork keeps its authored color',getComputedStyle(ratedPart).fill==='rgb(0, 138, 96)'&&getComputedStyle(stars[0]).filter==='none',{});
  ratedPart.style.removeProperty('fill');await wait();
  check('Review star remains visible after a live ink update',ratio(starInk(stars[0]),backdrop(rating))>=3,{});
  const lateStar=document.createElementNS('http://www.w3.org/2000/svg','svg');lateStar.setAttribute('viewBox','0 0 16 16');lateStar.innerHTML='<g stroke="none"><polygon points="8,0 10,5 16,6 12,10 13,16 8,13 3,16 4,10 0,6 6,5"/></g>';stars[0].parentElement.append(lateStar);await wait();
  check('Late-added read-only review star remains visible',ratio(starInk(lateStar),backdrop(rating))>=3,{});lateStar.remove();
  const composer=document.getElementById('composer-shell'),editor=document.getElementById('composer-editor'),footer=document.getElementById('composer-footer');
  for(const expanded of [false,true,false,true]){
    editor.textContent=expanded?'A synthetic multiline draft.\nAnother line.':'';
    composer.classList.toggle('expanded',expanded);await wait();
    const shellBg=getComputedStyle(composer).backgroundColor,footerBg=getComputedStyle(footer).backgroundColor;
    check('ChatGPT '+(expanded?'expanded':'empty')+' composer keeps one visible surface',shellBg==='rgb(33, 33, 33)'&&(!expanded||footerBg===shellBg)&&editor.textContent===(expanded?'A synthetic multiline draft.\nAnother line.':''),{shellBg,footerBg});
  }
  const product=document.getElementById('chatgpt-product');
  check('ChatGPT product photo remains loaded without a darkening blend',product.complete&&product.naturalWidth>0&&getComputedStyle(product).mixBlendMode==='normal',{loaded:product.complete&&product.naturalWidth>0,blend:getComputedStyle(product).mixBlendMode});
  for(const blend of ['darken','normal','multiply']){
    product.style.mixBlendMode=blend;await wait();
    check('ChatGPT product remains visible after live '+blend+' update',getComputedStyle(product).mixBlendMode==='normal'&&getComputedStyle(product).filter==='none',{blend:getComputedStyle(product).mixBlendMode,filter:getComputedStyle(product).filter});
  }
  product.style.removeProperty('mix-blend-mode');await wait();
  const latePicture=document.createElement('picture'),lateProduct=document.createElement('img');lateProduct.id='late-chatgpt-product';lateProduct.className='product-photo';lateProduct.alt='Late synthetic jacket';lateProduct.src=product.src;latePicture.append(lateProduct);product.parentElement.append(latePicture);await wait();
  check('ChatGPT late picture product remains visible',lateProduct.complete&&lateProduct.naturalWidth>0&&getComputedStyle(lateProduct).mixBlendMode==='normal',{blend:getComputedStyle(lateProduct).mixBlendMode});
  latePicture.remove();
  const panel=document.getElementById('native-panel'),panelPage=document.getElementById('native-panel-page');
  const panelColor=getComputedStyle(panel).backgroundColor,pageColor=getComputedStyle(panelPage).backgroundColor;
  check('Hetzner native raised cards remain distinct from the OLED page',luminance(panelColor)>=.005&&luminance(panelColor)<.03&&panelColor!==pageColor,{panelColor,pageColor});
  check('Hetzner authored card levels remain distinct',panelColor!==getComputedStyle(document.getElementById('native-panel-other')).backgroundColor,{panelColor});
  check('Flat native page layouts still become true black',getComputedStyle(document.getElementById('flat-layout')).backgroundColor==='rgb(0, 0, 0)',{});
  panel.style.backgroundColor='#222';await wait();
  check('Hetzner raised card survives a live color update',getComputedStyle(panel).backgroundColor==='rgb(34, 34, 34)',{color:getComputedStyle(panel).backgroundColor});
  panel.style.removeProperty('background-color');await wait();
  const like=document.getElementById('song-like'),likeIcon=document.getElementById('song-like-icon');
  for(const selected of [true,false,true]){
    if((like.getAttribute('aria-pressed')==='true')!==selected)like.click();await wait();
    const s=getComputedStyle(likeIcon),bg=getComputedStyle(like).backgroundColor;
    const fill=rgb(s.fill),ink=s.filter.includes('invert(1)')?'rgb('+fill.map(v=>255-v).join(',')+')':s.fill;
    check('Suno liked icon '+selected+' remains readable after final paint',ratio(ink,bg)>=3&&like.getAttribute('aria-pressed')===String(selected),{ink,bg,filter:s.filter,ratio:ratio(ink,bg)});
  }
  const likePath=likeIcon.querySelector('path');likePath.style.color='rgb(0, 200, 5)';await wait();
  check('Later colored currentColor artwork retains its authored hue',getComputedStyle(likePath).fill==='rgb(0, 200, 5)',{fill:getComputedStyle(likePath).fill});
  likePath.style.removeProperty('color');await wait();
  const toggle=document.getElementById('reload'),thumb=document.getElementById('reload-thumb');
  for(const checked of [false,true,false]){
    if((toggle.getAttribute('aria-checked')==='true')!==checked)toggle.click();await wait();
    const track=getComputedStyle(toggle),knob=getComputedStyle(thumb),r=ratio(track.backgroundColor,knob.backgroundColor);
    check('Suno switch '+checked+' has visible thumb and unchanged state',r>=3&&toggle.getAttribute('aria-checked')===String(checked),{r,track:track.backgroundColor,thumb:knob.backgroundColor});
  }
  const gold=document.getElementById('gold-switch'),goldTrack=getComputedStyle(gold),goldThumb=getComputedStyle(gold.firstElementChild);
  check('Switch thumb follows a recolored bright track',ratio(goldTrack.backgroundColor,goldThumb.backgroundColor)>=3,{track:goldTrack.backgroundColor,thumb:goldThumb.backgroundColor});
  const button=getComputedStyle(document.getElementById('save-chrome'),'::after'),label=getComputedStyle(document.getElementById('save-label'));
  const text=label.webkitTextFillColor||label.color,r=ratio(text,button.backgroundColor);
  check('PostHog enabled yellow button label is readable',r>=4.5,{r,text,bg:button.backgroundColor});
  check('PostHog disabled action remains disabled',document.getElementById('disabled-save').disabled,{});
  const promo=getComputedStyle(document.getElementById('promo-ink')),promoText=promo.webkitTextFillColor||promo.color,promoRatio=ratio(promoText,'rgb(255, 211, 116)');
  check('Uber Eats text over yellow creative keeps dark readable ink',promoRatio>=4.5,{promoRatio,promoText});
  check('Uber Eats creative remains unfiltered',getComputedStyle(document.getElementById('yellow-art')).filter==='none',{});
  const caption=document.getElementById('promo-caption'),captionStyle=getComputedStyle(caption);
  check('Caption outside artwork still adapts to dark mode',ratio(captionStyle.webkitTextFillColor||captionStyle.color,backdrop(caption))>=4.5,{});
  const surface=document.getElementById('ads-grid').shadowRoot,checks=[document.getElementById('plain-check'),surface.getElementById('campaign-check')];
  for(const [i,input] of checks.entries()){
    for(const checked of [false,true,false]){
      if(input.checked!==checked)input.click();await wait();const style=getComputedStyle(input);
      const outside=backdrop(input.parentElement),border=composite(style.borderTopColor,style.backgroundColor),r=Math.max(ratio(border,outside),ratio(style.backgroundColor,outside));
      check('Apple Ads '+(i?'shadow':'light DOM')+' checkbox '+checked+' visible boundary and state',r>=3&&input.checked===checked,{r,bg:style.backgroundColor,border,outside});
      if(checked){const tick=getComputedStyle(input,'::after');check('Apple Ads '+(i?'shadow':'light DOM')+' checked mark is readable',ratio(tick.webkitTextFillColor||tick.color,style.backgroundColor)>=3,{tick:tick.color,bg:style.backgroundColor})}
    }
  }
  const profile=document.getElementById('profile-card'),profileColor=getComputedStyle(profile).backgroundColor;
  for(const id of ['profile-heading','profile-more']){
    const bg=getComputedStyle(document.getElementById(id)).backgroundColor;
    check('LinkedIn matching '+id+' stays continuous with its native dark card',bg===profileColor&&bg==='rgb(27, 31, 35)',{bg,profileColor});
  }
  check('LinkedIn genuinely darker inset remains distinct',getComputedStyle(document.getElementById('profile-distinct')).backgroundColor==='rgb(0, 0, 0)',{});
  const late=document.createElement('div');late.id='profile-late';late.style.background='#1b1f23';late.textContent='Late-loaded education';profile.append(late);await wait();
  check('LinkedIn late matching content retains the card surface',getComputedStyle(late).backgroundColor===profileColor,{bg:getComputedStyle(late).backgroundColor});late.remove();
  const more=document.getElementById('profile-more');more.focus();await wait();
  const moreStyle=getComputedStyle(more),moreBg=moreStyle.backgroundColor;
  check('LinkedIn truncation control retains readable, distinct keyboard focus',document.activeElement===more&&more.matches(':focus-visible')&&moreBg!==profileColor&&moreStyle.outlineStyle!=='none'&&ratio(moreStyle.webkitTextFillColor||moreStyle.color,moreBg)>=4.5,{bg:moreBg,focusVisible:more.matches(':focus-visible'),outline:moreStyle.outlineStyle});more.blur();await wait();
  profile.style.background='#202020';await wait();
  check('LinkedIn changed parent paint does not preserve a different inset',getComputedStyle(document.getElementById('profile-heading')).backgroundColor==='rgb(0, 0, 0)',{});
  profile.style.removeProperty('background');await wait();
  check('LinkedIn matching paint is restored after a parent update',getComputedStyle(document.getElementById('profile-heading')).backgroundColor===profileColor&&getComputedStyle(more).backgroundColor===profileColor,{});
  const lateLocal=document.createElement('button');lateLocal.id='late-local';lateLocal.setAttribute('aria-label','Late local action');lateLocal.setAttribute('data-paint-icon','');
  lateLocal.style.cssText='width:40px;height:40px;border:0;border-radius:50%;background:#fff;color:#000;display:grid;place-items:center';
  lateLocal.innerHTML='<svg style="width:24px;height:24px;fill:currentColor" viewBox="0 0 24 24"><use href="#late-send"/></svg>';document.body.append(lateLocal);lateLocal.scrollIntoView({block:'center'});await wait();
  const definition=document.createElementNS('http://www.w3.org/2000/svg','svg');definition.style.display='none';
  definition.innerHTML='<symbol id="late-send" viewBox="0 0 24 24"><path fill="#000" d="M11 21V8l-5 5-2-2 8-8 8 8-2 2-5-5v13z"/></symbol>';document.body.append(definition);await wait();
  const localFilter=getComputedStyle(lateLocal.querySelector('svg')).filter,localBackground=getComputedStyle(lateLocal).backgroundColor,localRatio=ratio(localFilter==='invert(1)'?'rgb(255,255,255)':'rgb(0,0,0)',localBackground);
  check('a local symbol arriving after its button repairs the visible icon',localRatio>=3,{localFilter,localBackground,localRatio});
  return out;
}

export function reportedControlsRestored(){
  const color=id=>getComputedStyle(document.getElementById(id)).backgroundColor;
  return [
    {name:'disable restores authored local sprite paint and button surface',ok:getComputedStyle(document.querySelector('#late-local svg')).filter==='none'&&color('late-local')==='rgb(255, 255, 255)'&&getComputedStyle(document.querySelector('#late-send path')).fill==='rgb(0, 0, 0)'},
    {name:'disable restores light shadow component background and dark label',ok:color('ads-grid')==='rgb(255, 255, 255)'&&getComputedStyle(document.getElementById('ads-grid').shadowRoot.querySelector('label')).color==='rgb(34, 34, 34)'},
    {name:'disable restores all authored LinkedIn surfaces',ok:['profile-card','profile-heading','profile-more'].every(id=>color(id)==='rgb(27, 31, 35)')&&color('profile-distinct')==='rgb(17, 17, 17)'},
    {name:'disable restores authored black review stars and removes inversion',ok:getComputedStyle(document.querySelector('#review-rating polygon')).fill==='rgb(0, 0, 0)'&&getComputedStyle(document.querySelector('#review-rating svg')).filter==='none'},
    {name:'disable restores both authored composer surfaces',ok:color('composer-shell')==='rgb(33, 33, 33)'&&color('composer-footer')==='rgb(33, 33, 33)'},
    {name:'disable restores authored ChatGPT image blend and tile',ok:getComputedStyle(document.getElementById('chatgpt-product')).mixBlendMode==='multiply'&&getComputedStyle(document.getElementById('chatgpt-product').parentElement).backgroundColor==='rgb(244, 244, 244)'},
    {name:'disable restores authored native card and page colors',ok:color('native-panel')==='rgb(28, 28, 28)'&&color('native-panel-page')==='rgb(21, 21, 21)'},
    {name:'disable restores selected currentColor icon without a filter',ok:getComputedStyle(document.getElementById('song-like-icon')).fill==='rgb(23, 23, 23)'&&getComputedStyle(document.getElementById('song-like-icon')).filter==='none'},
    {name:'disable restores authored switch thumb',ok:color('reload-thumb')==='rgb(18, 18, 18)'},
    {name:'disable restores authored generated button surface',ok:getComputedStyle(document.getElementById('save-chrome'),'::after').backgroundColor==='rgb(255, 191, 25)'},
    {name:'disable restores authored checkbox boundary',ok:getComputedStyle(document.getElementById('plain-check')).borderTopColor==='rgb(153, 153, 153)'},
    {name:'disable preserves original promotional ink',ok:getComputedStyle(document.getElementById('promo-ink')).color==='rgb(17, 17, 17)'}
  ];
}
