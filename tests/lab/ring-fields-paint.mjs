import {paintedSample} from './painted-contrast.mjs';
const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>a&&b?(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05):0;
// Actual screenshot pixels after the scenario: `selected` is the marker that
// became checked, `markers` the ones left unchecked.
export function ringFieldsPaint(bytes,probe){
  const sample=(r,x,y)=>paintedSample(bytes,(r.x+x)*probe.dpr,(r.y+y)*probe.dpr),checks=[];
  for(const field of probe.fields){
    const edge=sample(field,.5,field.height/2),outside=sample(field,-6,field.height/2),ratio=contrast(edge,outside);
    checks.push({name:'Ring fields '+field.id+' outline is visible in actual pixels',ok:ratio>=2,detail:JSON.stringify({edge,outside,ratio})});
  }
  for(const marker of probe.markers){
    const card=probe.cards.find(c=>marker.x>=c.x&&marker.y>=c.y&&marker.y<=c.y+c.height)||marker;
    const edge=sample(marker,.5,marker.height/2),around=sample(marker,-5,marker.height/2),ratio=contrast(edge,around);
    checks.push({name:'Ring fields unselected '+marker.id+' boundary is visible in actual pixels',ok:ratio>=3,detail:JSON.stringify({edge,around,ratio,card:card.id})});
  }
  const fill=sample(probe.selected,3,probe.selected.height/2),dot=sample(probe.selected,probe.selected.width/2,probe.selected.height/2),around=sample(probe.selected,-5,probe.selected.height/2);
  checks.push({name:'Ring fields selected marker and dot are visible in actual pixels',ok:contrast(fill,around)>=3&&contrast(dot,fill)>=3,detail:JSON.stringify({fill,dot,around,fillRatio:contrast(fill,around),dotRatio:contrast(dot,fill)})});
  return checks;
}
