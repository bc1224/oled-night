import {paintedSample} from './painted-contrast.mjs';
import {PNG} from 'pngjs';
const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
export function appleAdsControlsPaint(bytes,probe){
  const png=PNG.sync.read(Buffer.from(bytes));
  const sample=(r,x,y)=>paintedSample(bytes,(r.x+x)*probe.dpr,(r.y+y)*probe.dpr),bg=sample(probe.panel,8,8);
  const checks=probe.covers.filter(c=>c.id!=='selected-cover').map(({id,rect})=>{const edge=sample(rect,.25,8),ratio=edge&&bg?contrast(edge,bg):0;return {name:'Apple Ads '+id+' unchecked boundary is visible in actual pixels',ok:ratio>=3,detail:JSON.stringify({edge,bg,ratio})}});
  const selected=probe.covers.find(c=>c.id==='selected-cover').rect,fill=sample(selected,2,8);
  const interior=[];for(let y=3;y<13;y++)for(let x=3;x<13;x++){const pixel=sample(selected,x,y);if(pixel)interior.push(pixel)}
  const mark=interior.sort((a,b)=>lum(b)-lum(a))[0],markerRatio=mark&&fill?contrast(mark,fill):0;
  checks.push({name:'Apple Ads selected checkbox keeps a readable checkmark',ok:markerRatio>=3,detail:JSON.stringify({fill,mark,ratio:markerRatio})});
  for(const [i,dot] of probe.dots.entries()){
    const pixel=sample(dot.rect,dot.rect.width/2,dot.rect.height/2),ratio=pixel&&bg?contrast(pixel,bg):0;
    let ok=ratio>=3,detail={pixel,bg,ratio};
    if(!dot.on){
      // Read the actual circle perimeter. A single CSS top-edge coordinate
      // can land outside Firefox's subpixel rasterization of a tiny circle.
      const r=dot.rect,dpr=probe.dpr,cx=(r.x+r.width/2)*dpr,cy=(r.y+r.height/2)*dpr;
      const quadrants=[0,0,0,0];let readable=0,total=0,minRatio=Infinity;
      for(let y=Math.max(0,Math.floor(r.y*dpr));y<Math.min(png.height,Math.ceil((r.y+r.height)*dpr));y++){
        for(let x=Math.max(0,Math.floor(r.x*dpr));x<Math.min(png.width,Math.ceil((r.x+r.width)*dpr));x++){
          const radius=Math.hypot((x+.5-cx)/(r.width*dpr/2),(y+.5-cy)/(r.height*dpr/2));
          if(radius<.5||radius>1.05)continue;
          total++;const index=(y*png.width+x)*4,edge=[...png.data.subarray(index,index+3)];
          const edgeRatio=bg&&png.data[index+3]>=200?contrast(edge,bg):0;
          if(edgeRatio>=3){readable++;minRatio=Math.min(minRatio,edgeRatio);quadrants[(y+.5>=cy?2:0)+(x+.5>=cx?1:0)]++}
        }
      }
      const required=Math.max(6,Math.ceil(6*dpr*dpr));
      ok=readable>=required&&quadrants.every(count=>count>0)&&ratio<3;
      detail={...detail,readable,total,required,quadrants,minReadableRatio:readable?minRatio:0};
    }
    checks.push({name:'Apple Ads '+(dot.on?'filled':'empty')+' popularity dot '+i+' is visible in actual pixels',ok,detail:JSON.stringify(detail)});
  }
  return checks;
}
