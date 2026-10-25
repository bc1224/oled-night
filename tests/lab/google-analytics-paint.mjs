import {paintedSample} from './painted-contrast.mjs';
export function googleAnalyticsPaint(bytes,{points,dpr}){
  const pixels=points.map(p=>paintedSample(bytes,p.x*dpr,p.y*dpr));
  return [{name:'Actual GA map pixels are dark and unrelated canvas is white',ok:pixels[0]?.every(v=>v<30)&&pixels[1]?.every(v=>v>245),detail:JSON.stringify(pixels)}];
}
