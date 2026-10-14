const assert=require('node:assert/strict'),vm=require('node:vm');
(async()=>{
  const {sampleNavigationPaint}=await import('./smoke-policy.mjs');
  const frames=[],tasks=[];let reads=0;
  const context=vm.createContext({requestAnimationFrame:callback=>frames.push(callback),setTimeout:callback=>tasks.push(callback),read:()=>({pale:++reads===3})});
  const result=vm.runInContext(`(${sampleNavigationPaint.toString()})({x:1,y:1},read)`,context);
  assert.equal(reads,0,'CDP evaluation must not inspect a transient measurement state');
  for(let i=0;i<4;i++){
    assert.equal(frames.length,1);frames.shift()();assert.equal(reads,i,'wait until frame callbacks have finished');
    tasks.shift()();await Promise.resolve();await Promise.resolve();
  }
  const report=await result;assert.equal(reads,4);assert.equal(report.pale,true,'one pale completed frame must still fail');
  let frame=0;const early=vm.createContext({requestAnimationFrame:callback=>callback(),setTimeout:callback=>callback(),read:()=>({pale:++frame===1})});
  const entry=await vm.runInContext(`(${sampleNavigationPaint.toString()})({x:1,y:1},read,{frames:24})`,early);
  assert.equal(entry.samples,24,'hover watch must cover entry and delayed hydration, not four late frames');
  assert.equal(entry.pale,true,'an initial flash must fail even when the other 23 samples pass');
  console.log('PASS live paint sampler waits for completed callbacks and retains every pale frame');
})().catch(e=>{console.error(e);process.exitCode=1});
