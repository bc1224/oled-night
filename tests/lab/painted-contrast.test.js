const assert=require('node:assert/strict');
(async()=>{
  const {PNG}=await import('pngjs');
  const {paintedInkContrast,paintedSample}=await import('./painted-contrast.mjs');
  const png=new PNG({width:20,height:20});
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const i=(y*20+x)*4,color=x<10?[246,230,107]:[23,52,90];
    png.data.set([...color,255],i);
  }
  const bytes=PNG.sync.write(png);
  assert.deepEqual(paintedSample(bytes,2,2),[246,230,107]);
  assert.equal(paintedInkContrast(bytes,{x:10,y:0,width:10,height:20},[246,230,107]).ok,true);
  assert.equal(paintedInkContrast(bytes,{x:0,y:0,width:10,height:20},[246,230,107]).ok,false);
  console.log('PASS painted pixel contrast distinguishes authored dark ink from low-contrast light ink');
})().catch(e=>{console.error(e);process.exitCode=1});
