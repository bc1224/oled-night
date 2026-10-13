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
    return {pale:n.slice(0,3).every(x=>x>220)};
  }
  return {pale:false};
}
