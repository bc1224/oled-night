import {paintedInkContrast,paintedSample} from './painted-contrast.mjs';
export function appStoreIconsPaint(bytes,probe){
  const {dpr}=probe,bg=paintedSample(bytes,(probe.background.x+8)*dpr,(probe.background.y+8)*dpr);
  const sample=(rect,x,y)=>paintedSample(bytes,(rect.x+x)*dpr,(rect.y+y)*dpr);
  return probe.icons.map(({id,rect})=>{
    if(id==='brand'){
      const pixel=sample(rect,12,12);
      return {name:'App Store authored colored artwork retains its rendered hue',ok:pixel?.every((v,i)=>Math.abs(v-[255,133,0][i])<=2),detail:JSON.stringify(pixel)};
    }
    const paint=paintedInkContrast(bytes,{x:rect.x*dpr,y:rect.y*dpr,width:rect.width*dpr,height:rect.height*dpr},bg);
    const center=id==='badge'?sample(rect,12,12):null;
    return {name:'App Store '+id+' icon paints readable ink',ok:paint.ok&&(!center||center.every(v=>v<30)),detail:JSON.stringify({...paint,center,bg})};
  });
}
