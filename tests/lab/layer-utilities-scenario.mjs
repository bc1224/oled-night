// Utility framework whose forced classes are !important inside cascade layers
// (text colors, card fills). Layered important declarations outrank unlayered
// ones, so the theme must answer from an earlier layer. Each function runs
// inside the page.
export async function layerUtilitiesScenario(){
  const checks=[],check=(name,ok,detail)=>checks.push({name:'Layer utilities '+name,ok:!!ok,detail:JSON.stringify(detail)}),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const pen=canvas.getContext('2d',{willReadFrequently:true});
  const paint=(...layers)=>{pen.clearRect(0,0,1,1);for(const layer of layers){pen.fillStyle='#000';pen.fillStyle=layer;pen.fillRect(0,0,1,1)}return [...pen.getImageData(0,0,1,1).data.slice(0,3)]};
  const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  const surface=element=>{const stack=[];for(let node=element;node;node=node.parentElement)stack.unshift(getComputedStyle(node).backgroundColor);return paint('#000',...stack)};
  const text=id=>{const element=document.getElementById(id),color=getComputedStyle(element).color;return {ratio:ratio(paint('rgb('+surface(element).join(' ')+')',color),surface(element)),color}};
  const heading=text('heading-text');
  check('heading forced black by a layered utility is readable',heading.ratio>=7,heading);
  const body=text('para-text');
  check('body copy forced grey by a layered utility is readable',body.ratio>=4.5,body);
  const link=text('link');
  check('link forced grey by a layered utility is readable',link.ratio>=4.5,link);
  const card=surface(document.getElementById('card')),label=text('card-text');
  check('card forced light by a layered utility becomes a dark surface',lum(card)<.05&&label.ratio>=4.5,{card,label});
  const bar=getComputedStyle(document.documentElement).scrollbarColor;
  check('unforced theme scrollbar still outranks the page preference',/^rgb\(58, 58, 66\)/.test(bar),{bar});
  // A sheet inserted ahead of every other one declares its layer first.
  const sheet=document.createElement('style');sheet.id='late-sheet';sheet.textContent='@layer late{#late{color:#333!important}}';document.head.prepend(sheet);
  const late=document.createElement('p');late.id='late';late.textContent='Late synthetic paragraph';document.getElementById('article').after(late);await sleep(600);
  const added=text('late');
  check('a layer declared by a sheet inserted first cannot hide later text',added.ratio>=4.5,added);
  late.remove();sheet.remove();await sleep(200);
  return checks;
}
export function layerUtilitiesRestored(){
  const style=id=>getComputedStyle(document.getElementById(id));
  const detail={heading:style('heading-text').color,body:style('para-text').color,card:style('card').backgroundColor,bar:getComputedStyle(document.documentElement).scrollbarColor,order:!!document.getElementById('oled-night-layer-order')};
  return {name:'Layer utilities disable restores authored text, fills and layer order',ok:detail.heading==='rgb(0, 0, 0)'&&detail.body==='rgb(77, 87, 97)'&&detail.card==='rgb(244, 244, 245)'&&/^rgb\(153, 153, 153\)/.test(detail.bar)&&!detail.order,detail:JSON.stringify(detail)};
}
