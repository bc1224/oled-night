export async function googleAnalyticsScenario() {
  const checks=[],check=(name,ok,detail)=>checks.push({name,ok,detail:JSON.stringify(detail)});
  // Local fixtures exercise the site-profile paint boundary; the host mapping
  // itself is covered by the color utility test with exact production hosts.
  document.documentElement.setAttribute('data-oled-night-site','google-analytics');
  await new Promise(r=>setTimeout(r,100));
  const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const lum=value=>rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const bg=getComputedStyle(document.querySelector('section')).backgroundColor;
  for(const id of ['axis','legend']){
    const fill=getComputedStyle(document.getElementById(id)).fill;
    const ratio=(Math.max(lum(fill),lum(bg))+.05)/(Math.min(lum(fill),lum(bg))+.05);
    check('GA '+id+' text has readable painted fill',ratio>=4.5,{fill,bg,ratio});
  }
  check('GA series and benchmark retain their data colors',getComputedStyle(document.getElementById('series')).stroke==='rgb(26, 115, 232)'&&getComputedStyle(document.getElementById('benchmark')).stroke==='rgb(18, 158, 175)',{});
  const filter=getComputedStyle(document.getElementById('map')).filter;
  check('GA light map canvas receives scoped dark paint',filter.includes('invert(1)')&&filter.includes('hue-rotate(180deg)'),{filter});
  check('GA map controls and unrelated canvases stay unfiltered',getComputedStyle(document.getElementById('zoom')).filter==='none'&&getComputedStyle(document.getElementById('unrelated')).filter==='none',{});
  const late=document.createElementNS('http://www.w3.org/2000/svg','text');late.setAttribute('x','200');late.setAttribute('y','175');late.textContent='Previous period';document.querySelector('.legend').append(late);
  await new Promise(r=>setTimeout(r,150));
  check('GA dynamically redrawn legend remains readable',lum(getComputedStyle(late).fill)>.4,{fill:getComputedStyle(late).fill});
  document.documentElement.removeAttribute('data-oled-night-site');
  await new Promise(r=>setTimeout(r,150));
  const unscoped={filter:getComputedStyle(document.getElementById('map')).filter,fill:getComputedStyle(document.getElementById('legend')).fill};
  check('GA repair is inactive without the Analytics profile',unscoped.filter==='none'&&lum(unscoped.fill)<.2,unscoped);
  document.documentElement.setAttribute('data-oled-night-site','google-analytics');
  return checks;
}
export function googleAnalyticsProbe(){
  return {dpr:devicePixelRatio,points:['map','unrelated'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x+5,y:r.y+5}})};
}
export function googleAnalyticsRestored(){
  const fill=getComputedStyle(document.getElementById('legend')).fill,filter=getComputedStyle(document.getElementById('map')).filter;
  return {name:'GA disable restores original SVG and canvas paint',ok:fill==='rgba(0, 0, 0, 0.87)'&&filter==='none',detail:JSON.stringify({fill,filter})};
}
