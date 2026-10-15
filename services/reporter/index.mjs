import {DurableObject} from 'cloudflare:workers';
import {receiveReport,readScreenshot,digest,json,MAX_REPORT_BYTES} from './core.mjs';
export class ReportGate extends DurableObject {
  async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
    try{return request.method==='GET'?await readScreenshot(request,this.ctx.storage):await receiveReport(request,this.env,this.ctx.storage)}catch{return json({error:'Reporting temporarily unavailable'},503)}
  })}
  async alarm(){
    let remaining=false,cursor;
    do{const entries=await this.ctx.storage.list({limit:16,...(cursor?{startAfter:cursor}:{})});
      for(const [key,value] of entries){cursor=key;if(value.expiresAt<=Date.now())await this.ctx.storage.delete(key);else remaining=true}
      if(entries.size<16)break;
    }while(true);
    if(remaining)await this.ctx.storage.setAlarm(Date.now()+3600000);
  }
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
    if(url.pathname==='/health'&&request.method==='GET')return json({service:'oled-night-reporter',ready:!!env.GITHUB_TOKEN&&!!env.IP_HASH_SECRET});
    if(url.pathname.startsWith('/v1/screenshots/')&&request.method==='GET')return env.REPORTS.get(env.REPORTS.idFromName('reports-v1')).fetch(request);
    if(url.pathname!=='/v1/issues')return json({error:'Not found'},404);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    let response;
    if(request.method!=='POST')response=json({error:'Method not allowed'},405);
    else if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))response=json({error:'JSON required'},415);
    else if(Number(request.headers.get('content-length'))>MAX_REPORT_BYTES)response=json({error:'Report too large'},413);
    else {
      // CF-Connecting-IP is supplied by Cloudflare. Client-supplied forwarded
      // headers cannot choose the rate-limit bucket. Never persist raw IPs.
      const day=new Date().toISOString().slice(0,10),headers=new Headers(request.headers);
      const ip=request.headers.get('CF-Connecting-IP');
      if(!ip||!env.IP_HASH_SECRET)response=json({error:'Client address unavailable'},503);
      else {
        headers.set('x-client-id',await digest(day+'|'+env.IP_HASH_SECRET+'|'+ip));
        const gate=env.REPORTS.get(env.REPORTS.idFromName('reports-v1'));
        try{response=await gate.fetch(new Request(request,{headers}))}catch{response=json({error:'Reporting temporarily unavailable'},503)}
      }
    }
    return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...cors}});
  }
};
