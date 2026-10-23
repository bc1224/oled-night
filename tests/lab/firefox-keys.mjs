// Marionette is built into Firefox. Use real WebDriver keyboard actions rather
// than dispatching synthetic DOM key events to test the browser's radio behavior.
import {connect} from 'node:net';
export async function firefoxKeys(port){
 const socket=connect({host:'127.0.0.1',port});let buffer=Buffer.alloc(0),next=0;const pending=new Map();
 await new Promise((done,fail)=>{socket.once('connect',done);socket.once('error',fail)});
 socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);for(;;){const colon=buffer.indexOf(58);if(colon<0)break;const size=Number(buffer.subarray(0,colon));if(buffer.length<colon+1+size)break;const msg=JSON.parse(buffer.subarray(colon+1,colon+1+size));buffer=buffer.subarray(colon+1+size);if(Array.isArray(msg)){const p=pending.get(msg[1]);if(p){pending.delete(msg[1]);clearTimeout(p.timer);msg[2]?p.reject(Error(JSON.stringify(msg[2]))):p.resolve(msg[3])}}}});
 const send=(command,args={})=>new Promise((resolve,reject)=>{const id=++next,text=JSON.stringify([0,id,command,args]);const timer=setTimeout(()=>{pending.delete(id);reject(Error('Firefox keyboard command timed out: '+command))},10000);pending.set(id,{resolve,reject,timer});socket.write(Buffer.byteLength(text)+':'+text)});
 await send('WebDriver:NewSession',{});
 const press=async value=>{const handles=await send('WebDriver:GetWindowHandles');await send('WebDriver:SwitchToWindow',{handle:(handles.value||handles).at(-1)});await send('WebDriver:PerformActions',{actions:[{type:'key',id:'qa-keyboard',actions:[{type:'keyDown',value},{type:'keyUp',value}]}]})};
 return {arrowRight:()=>press('\uE014'),space:()=>press(' '),close:()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Firefox keyboard session closed'))}pending.clear();socket.destroy()}};
}
