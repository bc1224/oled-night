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
  return out;
}

export function reportedControlsRestored(){
  const color=id=>getComputedStyle(document.getElementById(id)).backgroundColor;
  return [
    {name:'disable restores authored switch thumb',ok:color('reload-thumb')==='rgb(18, 18, 18)'},
    {name:'disable restores authored generated button surface',ok:getComputedStyle(document.getElementById('save-chrome'),'::after').backgroundColor==='rgb(255, 191, 25)'},
    {name:'disable restores authored checkbox boundary',ok:getComputedStyle(document.getElementById('plain-check')).borderTopColor==='rgb(153, 153, 153)'},
    {name:'disable preserves original promotional ink',ok:getComputedStyle(document.getElementById('promo-ink')).color==='rgb(17, 17, 17)'}
  ];
}
