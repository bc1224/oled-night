import {paintedSample} from './painted-contrast.mjs';
const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
export function appleAdsControlsPaint(bytes,probe){
  const sample=(r,x,y)=>paintedSample(bytes,(r.x+x)*probe.dpr,(r.y+y)*probe.dpr),bg=sample(probe.panel,8,8);
  const checks=probe.covers.filter(c=>c.id!=='selected-cover').map(({id,rect})=>{const edge=sample(rect,.25,8),ratio=edge&&bg?contrast(edge,bg):0;return {name:'Apple Ads '+id+' unchecked boundary is visible in actual pixels',ok:ratio>=3,detail:JSON.stringify({edge,bg,ratio})}});
  const selected=probe.covers.find(c=>c.id==='selected-cover').rect,fill=sample(selected,2,8);
  const interior=[];for(let y=3;y<13;y++)for(let x=3;x<13;x++){const pixel=sample(selected,x,y);if(pixel)interior.push(pixel)}
  const mark=interior.sort((a,b)=>lum(b)-lum(a))[0],markerRatio=mark&&fill?contrast(mark,fill):0;
  checks.push({name:'Apple Ads selected checkbox keeps a readable checkmark',ok:markerRatio>=3,detail:JSON.stringify({fill,mark,ratio:markerRatio})});
  for(const [i,dot] of probe.dots.entries()){
    const pixel=sample(dot.rect,3,dot.on?3:.25),ratio=pixel&&bg?contrast(pixel,bg):0;
    checks.push({name:'Apple Ads '+(dot.on?'filled':'empty')+' popularity dot '+i+' is visible in actual pixels',ok:ratio>=3,detail:JSON.stringify({pixel,bg,ratio})});
  }
  return checks;
}
