export async function googleDocsScenario(){
  const checks=[],check=(name,ok,detail={})=>checks.push({name,ok,detail:JSON.stringify(detail)});
  document.documentElement.setAttribute('data-oled-night-site','google-docs');
  await new Promise(r=>setTimeout(r,100));
  const filter=id=>getComputedStyle(document.getElementById(id)).filter;
  check('Docs document canvas receives dark display paint',filter('document').includes('invert(1)'),{filter:filter('document')});
  check('Docs toolbar, unrelated canvas and preserved colors stay unfiltered',filter('toolbar')==='none'&&filter('unrelated')==='none'&&filter('preserved')==='none');
  const source=document.getElementById('document').getContext('2d').getImageData(40,98,1,1).data;
  check('Docs display treatment does not edit saved canvas pixels',source[0]===0&&source[1]===0&&source[2]===0,{source:[...source]});
  const late=document.createElement('canvas');late.id='late-document';late.className='kix-canvas-tile-content';late.width=80;late.height=40;
  const ctx=late.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,80,40);document.querySelector('.kix-page-paginated').append(late);
  await new Promise(r=>setTimeout(r,100));
  check('Docs newly inserted canvas receives the same display treatment',filter('late-document').includes('invert(1)'));
  document.documentElement.removeAttribute('data-oled-night-site');
  check('Docs repair requires the exact site profile',filter('document')==='none');
  document.documentElement.setAttribute('data-oled-night-site','google-docs');
  return checks;
}
export function googleDocsProbe(){
  const point=(id,x,y)=>{const r=document.getElementById(id).getBoundingClientRect();return {x:(r.x+x)*devicePixelRatio,y:(r.y+y)*devicePixelRatio}};
  return {background:point('document',10,10),ink:point('document',40,98),unrelated:point('unrelated',10,10),preserved:point('preserved',10,10)};
}
export function googleDocsRestored(){
  const filter=getComputedStyle(document.getElementById('document')).filter;
  return {name:'Docs disable restores native document display',ok:filter==='none',detail:JSON.stringify({filter})};
}
