import '../../report-utils.js';
export const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const MAX_REPORT_BYTES=570000;
export const PRIVATE_RETENTION_MS=30*86400000;
async function maintainerAccess(request,env){
  const authorization=request.headers.get('Authorization');
  if(!/^Bearer [A-Za-z0-9_]{8,255}$/.test(authorization||''))return json({error:'Maintainer authentication required'},401);
  try{
    // Authenticate the caller, never the service's issue-creation credential.
    // Workers supports manual redirects. Reject non-200 responses below so a
    // redirect cannot forward caller tokens to another host.
    const response=await (env.fetch||fetch)('https://api.github.com/user',{
      headers:{Authorization:authorization,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'OLED-Night-Reporter'},
      redirect:'manual',signal:AbortSignal.timeout(12000)
    });
    if(response.status===401)return json({error:'Maintainer authentication required'},401);
    if(response.status!==200)return json({error:'Maintainer authentication unavailable'},503);
    const identity=await boundedJson(response,16384);
    if(identity?.login!=='bc1224'||identity.type!=='User')return json({error:'Maintainer access required'},403);
    return null;
  }catch{return json({error:'Maintainer authentication unavailable'},503)}
}
export async function readScreenshot(request,storage,env={}){
  const denied=await maintainerAccess(request,env);if(denied)return denied;
  const id=new URL(request.url).pathname.match(/^\/v1\/screenshots\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i)?.[1];
  const image=id&&await storage.get('screenshot:'+id);
  if(!image||image.expiresAt<=Date.now())return json({error:'Screenshot not found or expired'},404);
  return new Response(image.bytes,{headers:{'Content-Type':image.type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'no-store','Vary':'Authorization'}});
}
export async function readReport(request,storage,env={}){
  const denied=await maintainerAccess(request,env);if(denied)return denied;
  const id=new URL(request.url).pathname.match(/^\/v1\/reports\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i)?.[1];
  const report=id&&await storage.get('private:'+id);
  if(!report||report.expiresAt<=Date.now())return json({error:'Report not found or expired'},404);
  return json(report);
}
async function boundedJson(request,limit=MAX_REPORT_BYTES){
  const reader=request.body?.getReader();if(!reader)throw Error('invalid');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('large')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function receiveReport(request,env,storage){
  if(!env.GITHUB_TOKEN)return json({error:'Reporting is temporarily unavailable'},503);
  let raw;try{raw=await boundedJson(request)}catch(e){return json({error:'Invalid report'},e.message==='large'?413:400)}
  if(!raw||typeof raw!=='object'||!raw.report||typeof raw.report!=='object'||Array.isArray(raw.report)||
     typeof raw.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(raw.requestId)||
     typeof raw.description!=='string'||raw.description.length>2000)return json({error:'Invalid report'},400);
  const report=globalThis.OledNightReport.scrub(raw.report);
  if(!report.host)return json({error:'A public site domain is required'},400);
  let screenshot;try{screenshot=globalThis.OledNightReport.scrubScreenshot(raw.screenshot)}catch{return json({error:'Invalid screenshot'},400)}
  const description=raw.description.trim().replace(/@/g,'@\u200b'),hash=await digest(JSON.stringify({report,description,screenshot}));
  const key='report:'+raw.requestId,prior=await storage.get(key);
  if(prior){if(prior.hash!==hash||!prior.url)return json({error:'This report may already have been submitted. Check GitHub before starting another.'},409);return json({url:prior.url})}
  const day=new Date().toISOString().slice(0,10),expiresAt=Date.now()+2*86400000;
  const client='client:'+day+':'+request.headers.get('x-client-id'),totalKey='total:'+day;
  const count=(await storage.get(client))?.count||0,total=(await storage.get(totalKey))?.count||0;
  if(count>=3||total>=30)return json({error:'Daily report limit reached'},429);
  // Reserve before the external side effect. A timeout must never create a
  // second issue on retry. Retain hashes/counters/receipts and explicitly attached images.
  await storage.put(client,{count:count+1,expiresAt});await storage.put(totalKey,{count:total+1,expiresAt});await storage.put(key,{hash,expiresAt});
  if(!await storage.getAlarm())await storage.setAlarm(Date.now()+3600000);
  // The server enforces privacy for every client, including versions that do
  // not send a privacy flag. Only a server-generated tracking ID goes to GitHub.
  const id=crypto.randomUUID(),imageId=screenshot&&crypto.randomUUID(),createdAt=Date.now();
  const privateReport={schema:'oled-private-report-v1',id,requestId:raw.requestId,report,description,screenshotId:imageId||null,createdAt,expiresAt:createdAt+PRIVATE_RETENTION_MS};
  if(screenshot)await storage.put('screenshot:'+imageId,{type:screenshot.type,bytes:Uint8Array.from(atob(screenshot.data),c=>c.charCodeAt(0)),expiresAt:privateReport.expiresAt});
  await storage.put('private:'+id,privateReport);
  const body='A private report was submitted from OLED Night. Details and any screenshot are available only to the maintainer for up to 30 days.\n\nReport ID: '+id+'\n\nThis public issue contains only a tracking reference. Do not post private details or images in comments.';
  let response;
  try{response=await (env.fetch||fetch)('https://api.github.com/repos/bc1224/oled-night/issues',{
    method:'POST',headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,'Content-Type':'application/json',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'OLED-Night-Reporter'},
    body:JSON.stringify({title:'Private OLED Night report',body,labels:['oled-report']}),signal:AbortSignal.timeout(12000),redirect:'manual'
  })}catch{return json({error:'GitHub response was unavailable. This report will not be sent twice.'},502)}
  if(!response.ok){
    // A definitive rejection is safe to retry; ambiguous server errors are not.
    if(response.status>=400&&response.status<500){await storage.delete(key);await storage.delete('private:'+id);if(imageId)await storage.delete('screenshot:'+imageId)}
    return json({error:'GitHub could not accept the report'},502);
  }
  let result;try{result=await boundedJson(response,16384)}catch{return json({error:'GitHub receipt unavailable'},502)}
  if(!/^https:\/\/github\.com\/bc1224\/oled-night\/issues\/[1-9]\d*$/.test(result.html_url||''))return json({error:'Invalid GitHub receipt'},502);
  await storage.put('private:'+id,{...privateReport,url:result.html_url});
  await storage.put(key,{hash,url:result.html_url,expiresAt});return json({url:result.html_url},201);
}
