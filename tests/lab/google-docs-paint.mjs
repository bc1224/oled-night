import {paintedSample} from './painted-contrast.mjs';
export function googleDocsPaint(bytes,points){
  const colors=Object.fromEntries(Object.entries(points).map(([name,p])=>[name,paintedSample(bytes,p.x,p.y)]));
  return [{name:'Docs actual pixels show light text on a dark page',ok:colors.background?.every(v=>v<=20)&&colors.ink?.every(v=>v>=180),detail:JSON.stringify(colors)},
    {name:'Sheets cells paint black with readable light ink',ok:colors.cell?.every(v=>v<=20)&&colors.cellInk?.every(v=>v>=180),detail:JSON.stringify(colors)},
    {name:'Docs unrelated and preserved canvases retain original white pixels',ok:colors.unrelated?.every(v=>v>=250)&&colors.preserved?.every(v=>v>=250),detail:JSON.stringify(colors)}];
}
