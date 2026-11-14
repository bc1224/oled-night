// Borderless design-system form: fields outlined only by a one-pixel inset
// ring shadow, low-alpha relative-color borders, and radio markers drawn as
// children of role="radio" option cards. Each function runs inside the page.
export async function ringFieldsScenario(){
  const checks=[],check=(name,ok,detail)=>checks.push({name:'Ring fields '+name,ok:!!ok,detail:JSON.stringify(detail)}),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const pen=canvas.getContext('2d',{willReadFrequently:true});
  // Composite any CSS color syntax over its backdrop exactly as painted.
  const paint=(...layers)=>{pen.clearRect(0,0,1,1);for(const layer of layers){pen.fillStyle='#000';pen.fillStyle=layer;pen.fillRect(0,0,1,1)}return [...pen.getImageData(0,0,1,1).data.slice(0,3)]};
  const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  const surface=element=>{const stack=[];for(let node=element;node;node=node.parentElement)stack.unshift(getComputedStyle(node).backgroundColor);return paint('#000',...stack)};
  const tokens=shadow=>shadow.match(/(?:rgba?|hsla?|hwb|color|oklch|oklab|lch|lab)\([^()]*\)/gi)||[];
  const style=id=>getComputedStyle(document.getElementById(id));
  const ringRatio=element=>{const s=getComputedStyle(element),inside=surface(element),color=tokens(s.boxShadow)[0];return color?ratio(paint('rgb('+inside.join(' ')+')',color),inside):0};
  const edgeRatio=element=>{const s=getComputedStyle(element),outside=surface(element.parentElement);return s.borderTopStyle==='none'||s.borderTopWidth==='0px'?0:ratio(paint('rgb('+outside.join(' ')+')',s.borderTopColor),outside)};
  for(const id of ['country','region','name','work','light-ring','dark-ring']){
    const element=document.getElementById(id),value=ringRatio(element);
    check(id+' keeps a visible one-pixel field outline',value>=2&&/0px 0px 0px 1px inset/.test(getComputedStyle(element).boxShadow),{ratio:value,shadow:getComputedStyle(element).boxShadow});
  }
  const ink=style('work'),inkRatio=ratio(paint(ink.color),surface(document.getElementById('work')));
  check('field text stays readable',inkRatio>=7,{ratio:inkRatio});
  check('invalid field keeps its red state ring',/rgb\(212, 60, 60\) 0px 0px 0px 1px inset/.test(style('invalid').boxShadow),{shadow:style('invalid').boxShadow});
  const card=document.getElementById('card'),cardEdge=edgeRatio(card);
  check('unselected option card keeps a quiet visible border',cardEdge>=2&&cardEdge<5,{ratio:cardEdge,border:style('card').borderTopColor});
  const markEdge=edgeRatio(document.getElementById('mark'));
  check('unselected radio marker has a clear control boundary',markEdge>=3,{ratio:markEdge,border:style('mark').borderTopColor});
  const disabledEdge=edgeRatio(document.getElementById('mark-disabled'));
  check('disabled radio marker stays quieter than an enabled one',disabledEdge>=1.5&&disabledEdge<markEdge,{ratio:disabledEdge,enabled:markEdge});
  const selected=(markId,dotId,cardId)=>{const fill=paint(style(markId).backgroundColor),dot=paint(style(dotId).backgroundColor),around=surface(document.getElementById(cardId));return {fill:ratio(fill,around),dot:ratio(dot,fill),paint:{fill,dot,around}}};
  let state=selected('mark-checked','dot-checked','card-checked');
  check('selected radio marker and its dot are both visible',state.fill>=3&&state.dot>=3,state);
  check('selected option card keeps its accent border',/^rgb\((\d+), (\d+), (\d+)\)$/.test(style('card-checked').borderTopColor)&&(()=>{const [r,g,b]=paint(style('card-checked').borderTopColor);return b-r>=60})(),{border:style('card-checked').borderTopColor});
  // Selection moves the way the component does it: attributes only.
  const first=document.getElementById('card-checked');
  first.removeAttribute('data-checked');first.setAttribute('aria-checked','false');card.setAttribute('data-checked','');card.setAttribute('aria-checked','true');await sleep(450);
  state=selected('mark','dot','card');
  const released=edgeRatio(document.getElementById('mark-checked'));
  check('live selection change repaints both markers',state.fill>=3&&state.dot>=3&&released>=3,{...state,released});
  const name=document.getElementById('name');name.focus();await sleep(450);
  const focus=getComputedStyle(name).boxShadow,accent=tokens(focus).map(token=>paint(token)).some(([r,g,b])=>b-r>=60&&b>=150);
  check('focused field keeps its accent focus ring',document.activeElement===name&&accent&&tokens(focus).length===3,{focus});
  name.blur();await sleep(450);
  check('blurred field returns to its visible outline',ringRatio(name)>=2,{ratio:ringRatio(name),shadow:getComputedStyle(name).boxShadow});
  const late=document.createElement('input');late.className='field';late.id='late-field';late.value='Late synthetic field';document.getElementById('work').after(late);await sleep(450);
  check('late-added field gets a visible outline',ringRatio(late)>=2,{ratio:ringRatio(late),shadow:getComputedStyle(late).boxShadow});
  late.remove();
  const decorative=['raised','glow'].map(id=>style(id).boxShadow);
  check('decorative drop shadow and wide halo are not promoted to outlines',decorative.every(shadow=>!tokens(shadow).some(token=>lum(paint('#000',token))>.02)),{decorative});
  const gap=ratio(paint(tokens(style('avatar').boxShadow)[0]),surface(document.getElementById('avatars')));
  check('page-matched avatar gap ring stays invisible',gap<1.3,{ratio:gap,shadow:style('avatar').boxShadow});
  check('field and marker geometry are unchanged',parseFloat(style('mark').width)===16&&parseFloat(style('work').height)===72&&style('work').borderTopWidth==='0px',{});
  return checks;
}
export function ringFieldsProbe(){
  const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,width:r.width,height:r.height}};
  return {dpr:devicePixelRatio,fields:['country','region','name','work','light-ring','dark-ring'].map(rect),cards:['card-checked'].map(rect),markers:['mark-checked'].map(rect),selected:rect('mark'),selectedCard:rect('card')};
}
export function ringFieldsRestored(){
  const style=id=>getComputedStyle(document.getElementById(id)),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const pen=canvas.getContext('2d');
  const alpha=color=>{pen.clearRect(0,0,1,1);pen.fillStyle=color;pen.fillRect(0,0,1,1);const d=pen.getImageData(0,0,1,1).data;return {dark:d[0]+d[1]+d[2]<=3*40,alpha:d[3]/255}};
  const ring=alpha((style('work').boxShadow.match(/(?:rgba?|hsla?|hwb|color|oklch|oklab|lch|lab)\([^()]*\)/i)||['transparent'])[0]),edge=alpha(style('mark-disabled').borderTopColor);
  return {name:'Ring fields disable restores authored rings, borders and fills',ok:ring.dark&&Math.abs(ring.alpha-.1)<.03&&edge.dark&&Math.abs(edge.alpha-.2)<.03&&style('work').backgroundColor==='rgba(255, 255, 255, 0.5)'&&style('page').backgroundColor==='rgb(249, 249, 247)'&&style('light-ring').boxShadow.includes('rgb(209, 213, 219)'),detail:JSON.stringify({ring,edge,shadow:style('work').boxShadow,fill:style('work').backgroundColor,light:style('light-ring').boxShadow})};
}
