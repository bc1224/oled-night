import {PNG} from 'pngjs';

// Observe composited screenshot pixels; computed fill alone misses sprite
// strokes and cannot establish whether an SVG filter made an icon readable.
export async function sampleChatgptPixels(page){
  const boxes=await page.eval(`(()=>Object.fromEntries(['stop-light','stop-dark','voice-local','voice-external','voice-dark','voice-readable','voice-yellow','sprite-logo'].map(id=>{const r=document.querySelector('#'+id+' svg').getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height}]})))()`);
  const shot=PNG.sync.read(await page.screenshot());
  const sample=(x,y)=>{const i=(Math.floor(y)*shot.width+Math.floor(x))*4;return [...shot.data.subarray(i,i+3)]};
  const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const icons=Object.entries(boxes).filter(([id])=>id!=='sprite-logo').map(([id,b])=>{
    const icon=sample(b.x+b.width/2,b.y+b.height/2),surface=sample(b.x+1,b.y+b.height/2),a=lum(icon),c=lum(surface);
    return {id,icon,surface,ratio:(Math.max(a,c)+.05)/(Math.min(a,c)+.05)};
  });
  const b=boxes['sprite-logo'],brandPaints=[sample(b.x+12,b.y+6),sample(b.x+22,b.y+17)];
  return {icons,brandPaints,brandPreserved:JSON.stringify(brandPaints)==='[[20,99,199],[196,44,84]]'};
}
