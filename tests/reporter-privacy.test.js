const assert=require('node:assert/strict');
const test=require('node:test');
const image={type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII='};
const ownerToken='synthetic_owner_credential';
function fixture(){
 const map=new Map(),reads=[],calls=[];
 const storage={get:async k=>{reads.push(k);return structuredClone(map.get(k))},put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k),getAlarm:async()=>null,setAlarm:async()=>{}};
 const env={GITHUB_TOKEN:'synthetic_service_credential',fetch:async(url,options)=>{
  calls.push({url,...options});
  // Workerd supports follow and manual. Node's additional error mode must not
  // mask a hosted intake or authenticated-read failure in these boundary tests.
  if(options.redirect==='error')throw new TypeError('Unsupported Worker redirect mode');
  if(url==='https://api.github.com/user')return Response.json({login:'bc1224',type:'User'});
  return Response.json({html_url:'https://github.com/bc1224/oled-night/issues/123'},{status:201});
 }};
 return {map,reads,calls,storage,env};
}
const get=(path,token)=>new Request('https://reporter.test'+path,{headers:token?{Authorization:'Bearer '+token}:{}});
test('anonymous legacy screenshot reads are denied before storage access',async()=>{
 const {readScreenshot}=await import('../services/reporter/core.mjs');
 const {map,storage,reads,env}=fixture(),id=crypto.randomUUID();
 map.set('screenshot:'+id,{type:image.type,bytes:Buffer.from(image.data,'base64'),expiresAt:Date.now()+10000});
 const response=await readScreenshot(get('/v1/screenshots/'+id),storage,env);
 assert.equal(response.status,401);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(reads,[],'denied requests never read private storage');
});
test('old clients retain scrubbed details privately with only a generic public tracker',async()=>{
 const {receiveReport,readReport,readScreenshot}=await import('../services/reporter/core.mjs');
 const {storage,env,calls}=fixture();
 const raw={requestId:crypto.randomUUID(),description:'SYNTHETIC_PRIVATE_NOTES https://private.example/account?secret=CANARY',report:{host:'private.example',version:'0.6.63',pageURL:'https://private.example/PRIVATE_PATH',text:'EXCLUDED_TEXT',counts:{styled:123}},screenshot:image};
 const response=await receiveReport(new Request('https://reporter.test/v1/issues',{method:'POST',headers:{'x-client-id':'synthetic'},body:JSON.stringify(raw)}),env,storage);
 assert.equal(response.status,201);
 const publicPayload=calls[0].body;
 for(const canary of ['SYNTHETIC_PRIVATE','private.example','CANARY','PRIVATE_PATH','EXCLUDED_TEXT','0.6.63','screenshots/','image/png',image.data,raw.requestId])assert(!publicPayload.includes(canary),'public tracker excludes '+canary);
 const id=JSON.parse(publicPayload).body.match(/Report ID: ([a-f0-9-]{36})/)[1];
 assert.equal((await readReport(get('/v1/reports/'+id),storage,env)).status,401);
 const privateResponse=await readReport(get('/v1/reports/'+id,ownerToken),storage,env);
 assert.equal(privateResponse.status,200);
 assert.equal(privateResponse.headers.get('Cache-Control'),'no-store');
 const saved=await privateResponse.json();
 assert.equal(saved.description,raw.description);
 assert.equal(saved.report.host,'private.example');
 assert.equal(saved.report.counts.styled,123);
 assert(!JSON.stringify(saved).includes('EXCLUDED_TEXT'));
 assert(!JSON.stringify(saved).includes('PRIVATE_PATH'));
 assert.equal(saved.expiresAt-saved.createdAt,30*86400000);
 assert.equal(saved.url,'https://github.com/bc1224/oled-night/issues/123');
 const path='/v1/screenshots/'+saved.screenshotId;
 assert.equal((await readScreenshot(get(path),storage,env)).status,401);
 const screenshot=await readScreenshot(get(path,ownerToken),storage,env);
 assert.equal(screenshot.status,200);
 assert.equal(screenshot.headers.get('Access-Control-Allow-Origin'),null);
 assert.equal(Buffer.from(await screenshot.arrayBuffer()).toString('base64'),image.data);
 for(const call of calls.filter(row=>row.url.endsWith('/user'))){
  assert.equal(call.headers.Authorization,'Bearer '+ownerToken);
  assert.equal(call.redirect,'manual');
 }
});
test('wrong identity and every identity-provider error fail closed for reports and legacy images',async()=>{
 const {readReport,readScreenshot}=await import('../services/reporter/core.mjs');
 const id=crypto.randomUUID();
 const cases=[
  [async()=>Response.json({login:'someone-else',type:'User'}),403],
  [async()=>Response.json({login:'bc1224',type:'Organization'}),403],
  [async()=>Response.json({login:'bc1224'}),403],
  [async()=>Response.json({error:'bad token'},{status:401}),401],
  [async()=>Response.json({},{status:403}),503],
  [async()=>Response.json({},{status:500}),503],
  [async()=>new Response(null,{status:302,headers:{Location:'https://attacker.example'}}),503],
  [async()=>new Response('invalid'),503],
  [async()=>Response.json({login:'bc1224',type:'User',oversized:'x'.repeat(20000)}),503],
  [async()=>{throw Error('synthetic network failure')},503]
 ];
 for(const [fetch,status] of cases){
  const {storage,reads}=fixture();
  assert.equal((await readReport(get('/v1/reports/'+id,ownerToken),storage,{fetch})).status,status);
  assert.equal((await readScreenshot(get('/v1/screenshots/'+id,ownerToken),storage,{fetch})).status,status);
  assert.deepEqual(reads,[]);
 }
});
test('authorized legacy images still work and expired records cannot be read before alarm cleanup',async()=>{
 const {readReport,readScreenshot}=await import('../services/reporter/core.mjs');
 const {storage,map,env}=fixture(),id=crypto.randomUUID(),path='/v1/screenshots/'+id;
 map.set('screenshot:'+id,{type:image.type,bytes:Buffer.from(image.data,'base64'),expiresAt:Date.now()+10000});
 assert.equal((await readScreenshot(get(path,ownerToken),storage,env)).status,200);
 map.get('screenshot:'+id).expiresAt=Date.now()-1;
 map.set('private:'+id,{description:'synthetic expired details',expiresAt:Date.now()-1});
 assert.equal((await readScreenshot(get(path,ownerToken),storage,env)).status,404);
 assert.equal((await readReport(get('/v1/reports/'+id,ownerToken),storage,env)).status,404);
 assert.equal((await readScreenshot(get('/v1/screenshots/not-an-id',ownerToken),storage,env)).status,404);
 assert.equal((await readReport(get('/v1/reports/not-an-id',ownerToken),storage,env)).status,404);
});
test('issue-creation redirects fail closed without forwarding service credentials',async()=>{
 const {receiveReport}=await import('../services/reporter/core.mjs');
 const {storage,env,calls}=fixture();
 env.fetch=async(url,options)=>{
  calls.push({url,...options});
  return new Response(null,{status:302,headers:{Location:'https://attacker.example'}});
 };
 const raw={requestId:crypto.randomUUID(),description:'synthetic redirect check',report:{host:'example.com',version:'0.6.63'}};
 const response=await receiveReport(new Request('https://reporter.test/v1/issues',{method:'POST',headers:{'x-client-id':'synthetic'},body:JSON.stringify(raw)}),env,storage);
 assert.equal(response.status,502);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.github.com/repos/bc1224/oled-night/issues');
 assert.equal(calls[0].redirect,'manual');
});
