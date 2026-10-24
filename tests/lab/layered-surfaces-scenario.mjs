export async function layeredSurfacesScenario(){
  const checks=[],style=id=>getComputedStyle(document.getElementById(id));
  const authored=id=>document.getElementById(id).getAttribute('data-authored-image');
  const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const shell=style('studio-shell'),image=shell.backgroundImage;
  const logo=document.getElementById('studio-brand');
  checks.push({name:'TikTok Studio explicitly named logo stays visible without changing brand colors',ok:logo.hasAttribute('data-oled-night-logo-edge')&&style('studio-brand').filter.includes('drop-shadow'),detail:style('studio-brand').filter});
  checks.push({name:'TikTok Studio white shell gradients adapt beside texture URL',ok:!image.includes('rgb(254, 254, 254)')&&!image.includes('rgb(252, 252, 252)')&&document.getElementById('studio-shell').getAttribute('data-oled-night').split(' ').includes('img'),detail:image});
  const url=value=>value.slice(value.indexOf('url('));
  checks.push({name:'TikTok Studio decorative image URL stays exact',ok:url(image)===url(authored('studio-shell')),detail:''});
  const nav=rgb(style('studio-nav').color),bg=rgb(shell.backgroundColor),ratio=(Math.max(lum(nav),lum(bg))+.05)/(Math.min(lum(nav),lum(bg))+.05);
  checks.push({name:'TikTok Studio navigation remains readable',ok:ratio>=4.5,detail:JSON.stringify({nav,bg,ratio})});
  checks.push({name:'Image-first texture keeps its URL and adapts following gradient',ok:style('image-first').backgroundImage.startsWith(authored('image-first').split(', radial-gradient')[0]+', radial-gradient(')&&!style('image-first').backgroundImage.includes('rgb(255, 255, 255)'),detail:style('image-first').backgroundImage});
  checks.push({name:'Opaque media URL and geometry stay exact',ok:style('photo').backgroundImage.split(', linear-gradient')[0]===authored('photo').split(', linear-gradient')[0]&&style('photo').backgroundSize.split(',').every(size=>size.trim()==='cover')&&style('photo').filter==='none',detail:style('photo').backgroundImage});
  const selected=rgb(style('studio-selected').backgroundColor);
  checks.push({name:'TikTok Studio selected action keeps its red color',ok:selected[0]>60&&selected[0]>selected[1]*2&&selected[0]>selected[2]*2,detail:JSON.stringify(selected)});
  document.getElementById('studio-shell').classList.add('refreshed');
  await new Promise(resolve=>setTimeout(resolve,700));
  checks.push({name:'TikTok Studio layered shell survives another layout refresh',ok:style('studio-shell').backgroundImage===image,detail:''});
  return checks;
}

export function layeredSurfacesRestored(){
  const restored=['studio-shell','image-first','photo'].every(id=>{const element=document.getElementById(id);return getComputedStyle(element).backgroundImage===element.getAttribute('data-authored-image')});
  return {name:'TikTok Studio disable restores every authored image and gradient layer',ok:restored&&getComputedStyle(document.getElementById('studio-brand')).filter==='none',detail:''};
}
