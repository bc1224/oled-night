import '../../report-utils.js';
export const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function boundedJson(request){
  const reader=request.body?.getReader();if(!reader)throw Error('invalid');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw Error('large')}chunks.push(value)}
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
  const description=raw.description.trim().replace(/@/g,'@\u200b'),hash=await digest(JSON.stringify({report,description}));
  const key='report:'+raw.requestId,prior=await storage.get(key);
  if(prior){if(prior.hash!==hash||!prior.url)return json({error:'This report may already have been submitted. Check GitHub before starting another.'},409);return json({url:prior.url})}
  const day=new Date().toISOString().slice(0,10),expiresAt=Date.now()+2*86400000;
  const client='client:'+day+':'+request.headers.get('x-client-id'),totalKey='total:'+day;
  const count=(await storage.get(client))?.count||0,total=(await storage.get(totalKey))?.count||0;
  if(count>=3||total>=30)return json({error:'Daily report limit reached'},429);
  // Reserve before the external side effect. A timeout must never create a
  // second issue on retry. Only hashes, counters and receipts are retained.
  await storage.put(client,{count:count+1,expiresAt});await storage.put(totalKey,{count:total+1,expiresAt});await storage.put(key,{hash,expiresAt});
  if(!await storage.getAlarm())await storage.setAlarm(Date.now()+3600000);
  const body=(description||'A site rendering problem was reported from OLED Night.')+'\n\nPublic diagnostics (no page text, field values, URL paths or screenshots):\n```json\n'+JSON.stringify(report,null,2)+'\n```\n\nReport ID: '+raw.requestId;
  let response;
  try{response=await (env.fetch||fetch)('https://api.github.com/repos/bc1224/oled-night/issues',{
    method:'POST',headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,'Content-Type':'application/json',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'OLED-Night-Reporter'},
    body:JSON.stringify({title:'Broken site: '+report.host,body,labels:['oled-report']}),signal:AbortSignal.timeout(12000)
  })}catch{return json({error:'GitHub response was unavailable. This report will not be sent twice.'},502)}
  if(!response.ok){
    // A definitive rejection is safe to retry; ambiguous server errors are not.
    if(response.status>=400&&response.status<500)await storage.delete(key);
    return json({error:'GitHub could not accept the report'},502);
  }
  let result;try{result=await response.json()}catch{return json({error:'GitHub receipt unavailable'},502)}
  if(!/^https:\/\/github\.com\/bc1224\/oled-night\/issues\/[1-9]\d*$/.test(result.html_url||''))return json({error:'Invalid GitHub receipt'},502);
  await storage.put(key,{hash,url:result.html_url,expiresAt});return json({url:result.html_url},201);
}
