import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function launchChrome(){
  const exe=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  if(!exe)throw Error('Set CHROME_PATH to a test Chrome binary');
  const profile=mkdtempSync(join(tmpdir(),'oled-night-lab-'));
  const processHandle=spawn(exe,['--headless=new','--remote-debugging-pipe','--enable-unsafe-extension-debugging',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1024,1000','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
  let next=0,buffer='';const pending=new Map();const errors=[];
  processHandle.on('error',e=>{for(const p of pending.values())p.reject(e)});
  processHandle.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result)}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text)}});
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`${method} timed out`))},30000);pending.set(id,{resolve,reject,timer});processHandle.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0')});
  async function open(url='about:blank'){
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.enable',{},sessionId);await send('Runtime.enable',{},sessionId);
    const tab={targetId,sessionId,eval:async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value},go:async(url)=>{await send('Page.navigate',{url},sessionId);await wait(1000)},size:async(width,height)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId),hover:async(x,y)=>send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},sessionId),key:async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='Tab'?9:13},sessionId);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:key==='Tab'?9:13},sessionId)},screenshot:async()=>Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId)).data,'base64')};
    if(url!=='about:blank')await tab.go(url);return tab;
  }
  return{send,open,errors,profile,close:async()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'))}pending.clear();processHandle.kill();await wait(700);const target=resolve(profile),allowed=resolve(tmpdir())+sep+'oled-night-lab-';if(!target.startsWith(allowed))throw Error('Test profile cleanup escaped its owned temporary prefix');try{rmSync(target,{recursive:true,force:true,maxRetries:3,retryDelay:200})}catch{console.error('Temporary test profile could not be removed; browser was stopped')}}};
}
