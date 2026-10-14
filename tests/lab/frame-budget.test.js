const assert=require('node:assert/strict');
(async()=>{
 const {frameChecks}=await import('../../docs/lab/performance.js');
 const sample=(frames=72,p95=17,worst=24)=>({frames,p95,worst,duration:1200});
 const pairs=()=>Array.from({length:3},()=>({pageOnly:true,native:sample(),active:sample()}));
 assert(frameChecks(pairs()).every(c=>c.ok));
 let bad=pairs();bad[0].active.frames=20;bad[1].active.frames=20;assert(frameChecks(bad).some(c=>!c.ok));
 bad=pairs();for(const p of bad)p.active.p95=50;assert(frameChecks(bad).some(c=>!c.ok));
 bad=pairs();bad[0].active.worst=151;assert(frameChecks(bad).some(c=>!c.ok));
 bad=pairs();bad[0].pageOnly=false;assert(frameChecks(bad).some(c=>!c.ok));
 bad=pairs();bad[0].active.p95=NaN;assert(frameChecks(bad).some(c=>!c.ok));
 console.log('Frame budget validation passed');
})().catch(e=>{console.error(e);process.exitCode=1});
