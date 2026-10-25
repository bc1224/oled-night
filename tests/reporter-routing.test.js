const assert=require('node:assert/strict');
const test=require('node:test');
const {register}=require('node:module');
const {pathToFileURL}=require('node:url');
register('./helpers/cloudflare-loader.mjs',pathToFileURL(__filename));
function fixture(ReportGate){
 const map=new Map(),names=[],upstream=[],alarms=[];
 const storage={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k),getAlarm:async()=>alarms.at(-1),setAlarm:async value=>alarms.push(value),list:async({limit,startAfter})=>new Map([...map].sort(([a],[b])=>a.localeCompare(b)).filter(([key])=>!startAfter||key>startAfter).slice(0,limit))};
 const env={GITHUB_TOKEN:'synthetic_service_credential',IP_HASH_SECRET:'synthetic_hash_secret',fetch:async(url,options)=>{upstream.push({url,...options});return url.endsWith('/user')?Response.json({login:'bc1224',type:'User'}):Response.json({html_url:'https://github.com/bc1224/oled-night/issues/123'},{status:201})}};
 const gate=new ReportGate({storage,blockConcurrencyWhile:fn=>fn()},env);
 env.REPORTS={idFromName:name=>{names.push(name);return name},get:()=>gate};
 return {map,names,upstream,alarms,storage,env,gate};
}
test('public Worker routes protect reports and legacy images and preserve old-client intake',async()=>{
 const {default:worker,ReportGate}=await import('../services/reporter/index.mjs');
 const {env,map,names,upstream}=fixture(ReportGate),legacy=crypto.randomUUID();
 map.set('screenshot:'+legacy,{type:'image/png',bytes:new Uint8Array([137,80,78,71]),expiresAt:Date.now()+10000});
 const raw={requestId:crypto.randomUUID(),description:'SYNTHETIC_PRIVATE',report:{host:'private.example'}};
 const post=()=>new Request('https://reporter.test/v1/issues',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1','x-client-id':'forged'},body:JSON.stringify(raw)});
 let response=await worker.fetch(post(),env);assert.equal(response.status,201);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
 assert.equal((await worker.fetch(post(),env)).status,200);
 assert.equal(upstream.filter(row=>row.url.endsWith('/issues')).length,1);
 const id=JSON.parse(upstream[0].body).body.match(/Report ID: ([a-f0-9-]{36})/)[1];
 for(const route of ['/v1/reports/'+id,'/v1/screenshots/'+legacy]){
  response=await worker.fetch(new Request('https://reporter.test'+route),env);
  assert.equal(response.status,401);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);assert.equal(response.headers.get('Cache-Control'),'no-store');
  response=await worker.fetch(new Request('https://reporter.test'+route,{headers:{Authorization:'Bearer synthetic_owner_credential'}}),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
 }
 assert(names.every(name=>name==='reports-v1'));
 assert(!JSON.stringify([...map]).includes('192.0.2.1'),'raw IP never persists');
 assert(![...map.keys()].some(key=>key.includes('forged')),'client-supplied buckets are replaced');
 assert.equal((await worker.fetch(new Request('https://reporter.test/v1/issues',{method:'OPTIONS'}),env)).status,204);
 assert.equal((await worker.fetch(new Request('https://reporter.test/v1/reports/'+id,{method:'OPTIONS'}),env)).status,404);
});
test('the real alarm deletes expired receipts, counters, private bodies and legacy images across pages',async()=>{
 const {ReportGate}=await import('../services/reporter/index.mjs');
 const {map,gate,alarms}=fixture(ReportGate),future=Date.now()+10000;
 for(let i=0;i<20;i++)map.set('client:'+String(i).padStart(2,'0'),{expiresAt:Date.now()-1});
 map.set('report:expired',{expiresAt:Date.now()-1});map.set('private:expired',{description:'synthetic expired notes',expiresAt:Date.now()-1});map.set('screenshot:expired',{bytes:new Uint8Array([1]),expiresAt:Date.now()-1});
 map.set('private:retained',{expiresAt:future});map.set('screenshot:retained',{expiresAt:future});
 await gate.alarm();
 assert.deepEqual([...map.keys()].sort(),['private:retained','screenshot:retained']);
 assert.equal(alarms.length,1);assert(alarms[0]>Date.now());
 map.get('private:retained').expiresAt=Date.now()-1;map.get('screenshot:retained').expiresAt=Date.now()-1;
 await gate.alarm();assert.equal(map.size,0);assert.equal(alarms.length,1,'empty storage is not rescheduled');
});
