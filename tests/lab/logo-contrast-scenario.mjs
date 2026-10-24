import {paintedSample} from './painted-contrast.mjs';

export function logoContrastProbe(){
  const images=[...document.querySelectorAll('img'),document.getElementById('shadow-logo-host').shadowRoot.querySelector('img')];
  const points={};
  for(const img of images){const r=img.getBoundingClientRect();points[img.id]={x:r.x,y:r.y,filter:getComputedStyle(img).filter};}
  const crossOriginReadBlocked=document.getElementById('remote-logo').dataset.pageCanvasBlocked==='true';
  return {points,crossOriginReadBlocked,pixelRatio:devicePixelRatio,active:document.documentElement.hasAttribute('data-oled-night-root')};
}

export function logoContrastPaint(bytes,probe){
  const checks=[],at=(id,x,y)=>{const p=probe.points[id];return paintedSample(bytes,(p.x+x)*probe.pixelRatio,(p.y+y)*probe.pixelRatio)},near=(a,b)=>a?.every((v,i)=>Math.abs(v-b[i])<=2);
  checks.push({name:'Logo regression runs with the extension active',ok:probe.active,detail:''});
  for(const id of ['mixed-logo','remote-logo','shadow-logo']){
    const ink=at(id,24,40),red=at(id,188,40),yellow=at(id,216,40);
    const gaps=[at(id,18,40),at(id,29,40),at(id,24,18),at(id,24,61)];
    checks.push({name:id+' dark ink is readable inside its original shape',ok:ink?.every(v=>v>=140&&v<=235),detail:JSON.stringify(ink)});
    checks.push({name:id+' saturated accents keep their original pixels',ok:near(red,[245,34,50])&&near(yellow,[255,204,0]),detail:JSON.stringify({red,yellow})});
    checks.push({name:id+' transparent edge and gaps have no halo',ok:gaps.every(p=>near(p,at(id,5,5))),detail:JSON.stringify(gaps)});
  }
  for(const [id,bg] of [['white-logo',[255,255,255]],['badge-logo',[24,24,24]],['remote-white-logo',[255,255,255]],['remote-badge-logo',[24,24,24]]])checks.push({name:id+' opaque plate and dark ink stay original',ok:near(at(id,5,5),bg)&&near(at(id,24,40),[24,24,24]),detail:JSON.stringify({plate:at(id,5,5),ink:at(id,24,40)})});
  checks.push({name:'Product media stays original',ok:near(at('product-image',24,40),[24,24,24])&&probe.points['product-image'].filter==='none',detail:JSON.stringify(at('product-image',24,40))});
  checks.push({name:'Cross-origin logo remains unreadable to page canvas',ok:probe.crossOriginReadBlocked,detail:''});
  return checks;
}

export function logoContrastRestored(){
  const shadow=document.getElementById('shadow-logo-host').shadowRoot;
  return {name:'Disabling restores every logo and removes filter resources',ok:[...document.images,shadow.querySelector('img')].every(img=>getComputedStyle(img).filter==='none')&&!document.querySelector('[data-oled-night-logo-filter]')&&!shadow.querySelector('[data-oled-night-logo-filter]'),detail:''};
}
