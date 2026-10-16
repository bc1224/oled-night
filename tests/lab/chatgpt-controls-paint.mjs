import {PNG} from 'pngjs';

// Observe composited screenshot pixels; computed fill alone misses sprite
// strokes and cannot establish whether an SVG filter made an icon readable.
export async function sampleChatgptPixels(page,onlyIds=null){
  const ids=onlyIds?JSON.stringify(onlyIds):"[...['stop-light','stop-dark','voice-local','voice-external','voice-dark','voice-readable','voice-yellow','sprite-logo'],...Array.from(document.querySelectorAll('[data-paint-icon]')).filter(e=>e.getBoundingClientRect().width).map(e=>e.id)]";
  const boxes=await page.eval(`(()=>Object.fromEntries((${ids}).map(id=>{const r=document.querySelector('#'+id+' svg').getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height,send:document.getElementById(id).hasAttribute('data-paint-icon')}]})))()`);
  const shot=PNG.sync.read(await page.screenshot());
  const sample=(x,y)=>{const i=(Math.floor(y)*shot.width+Math.floor(x))*4;return [...shot.data.subarray(i,i+3)]};
  const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const icons=Object.entries(boxes).filter(([id])=>id!=='sprite-logo').map(([id,b])=>{
    const y=b.send?b.height*2/3:b.height/2;
    const icon=sample(b.x+(b.send?12:b.width/2),b.y+y),surface=sample(b.x+1,b.y+y),a=lum(icon),c=lum(surface);
    return {id,icon,surface,ratio:(Math.max(a,c)+.05)/(Math.min(a,c)+.05)};
  });
  const b=boxes['sprite-logo'],brandPaints=b?[sample(b.x+12,b.y+6),sample(b.x+22,b.y+17)]:null;
  return {icons,brandPaints,brandPreserved:!b||JSON.stringify(brandPaints)==='[[20,99,199],[196,44,84]]'};
}
