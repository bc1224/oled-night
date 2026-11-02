export function appStoreIconsProbe(){
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
  return {dpr:devicePixelRatio,icons:['privacy','accessibility','current','self','ordinary','badge','brand','double'].map(id=>({id,rect:rect(document.getElementById(id))})),background:rect(document.querySelector('section'))};
}
export function appStoreIconsRestored(){
  const svg=document.getElementById('privacy'),span=svg.parentElement;
  const filters={svg:getComputedStyle(svg).filter,span:getComputedStyle(span).filter};
  return {name:'App Store disable restores original SVG and wrapper filters',ok:filters.svg==='none'&&filters.span==='invert(1)'&&!document.querySelector('[data-oled-night]'),detail:JSON.stringify(filters)};
}
export function appStoreIconsToggle(){
  document.getElementById('privacy').parentElement.classList.toggle('inverted');
}
