export function smokePassed(checks){
  const hosts=new Set(checks.filter(c=>c.kind==='site'&&c.ok).map(c=>c.name.split(' ')[0]));
  return hosts.size>=2&&!checks.some(c=>c.ok===false&&c.kind==='regression');
}
// A self-contained browser function; serializing it avoids regex/template escapes.
export function navigationPaint(point){
  let e=document.elementFromPoint(point.x,point.y);
  while(e?.shadowRoot){const child=e.shadowRoot.elementFromPoint(point.x,point.y);if(!child||child===e)break;e=child}
  for(let node=e;node;node=node.parentElement||node.getRootNode().host){
    const color=getComputedStyle(node).backgroundColor,n=(color.match(/[\d.]+/g)||[]).map(Number);
    if(color==='transparent'||n.length<3||(n.length>3&&n[3]<.5))continue;
    const root=node.getRootNode(),sheets=root.adoptedStyleSheets||[],ancestry=[];
    for(let p=e;p&&ancestry.length<8;p=p.parentElement||p.getRootNode().host)ancestry.push({tag:p.tagName,classes:p.className,mark:p.getAttribute?.('data-oled-night'),bg:getComputedStyle(p).backgroundColor});
    return {pale:n.slice(0,3).every(x=>x>220),color,tag:node.tagName,hit:e.tagName,ancestry,hovered:e.matches(':hover'),time:performance.now(),inputTime:window.__cvsHoverInput||0,sheetCount:sheets.length,extensionSheet:sheets.some(s=>[...s.cssRules].some(r=>r.selectorText?.includes('data-oled-night'))),marked:node.getAttribute?.('data-oled-night'),measured:node.hasAttribute?.('data-oled-night-measure')||node.hasAttribute?.('data-oled-night-measure-self')||document.documentElement?.hasAttribute('data-oled-night-measure')};
  }
  return {pale:false};
}

// Schedule ordinary page tasks after frame callbacks. A direct CDP inspection
// can observe the engine's temporary native-style measurement state.
export async function sampleNavigationPaint(point,read,{frames=4}={}){
  const samples=[];
  for(let i=0;i<frames;i++){
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    samples.push(read(point));
  }
  return {pale:samples.some(sample=>sample.pale),samples:samples.length,paleSamples:samples.filter(sample=>sample.pale)};
}
