const assert=require('node:assert/strict');
(async()=>{
const {PNG}=await import('pngjs');
const {appleAdsControlsPaint}=await import('./apple-ads-controls-paint.mjs');

// A rasterized six-pixel ring can start below its CSS top edge. Its readable
// perimeter, rather than one anti-aliased pixel, determines visibility.
const png=new PNG({width:30,height:30});
for(let i=0;i<png.data.length;i+=4)png.data.set([21,21,24,255],i);
const paint=(x,y)=>png.data.set([160,160,168,255],(y*png.width+x)*4);
const ring=[[12,11],[13,11],[11,12],[14,12],[11,13],[14,13],[12,14],[13,14]];
const probe={dpr:1,panel:{x:0,y:0},covers:[{id:'selected-cover',rect:{x:0,y:0}}],dots:[{on:false,rect:{x:10,y:10,width:6,height:6}}]};
const check=()=>appleAdsControlsPaint(PNG.sync.write(png),probe).find(c=>c.name.includes('empty popularity dot'));
assert.equal(check().ok,false,'an absent ring must fail');
paint(...ring[0]);
assert.equal(check().ok,false,'one bright pixel must not pass as a ring');
for(const point of ring)paint(...point);
assert.equal(check().ok,true,'a readable ring surrounding the center must pass');
paint(13,13);
assert.equal(check().ok,false,'a filled center must not pass as an empty ring');
png.data.set([21,21,24,255],(13*png.width+13)*4);
for(const [x,y] of ring)png.data.set([24,24,28,255],(y*png.width+x)*4);
assert.equal(check().ok,false,'a complete ring below 3:1 must fail');
console.log('Apple Ads perimeter pixel regression checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
