const assert=require('node:assert/strict');
const vm=require('node:vm');
(async()=>{const {sanitizedComponent}=await import('../../tools/capture-component.mjs');
const privateText='PRIVATE_SENTINEL_person@example.com';
const node={tagName:'INPUT',children:[],type:'password',textContent:privateText,value:privateText,id:privateText,attributes:[{name:'value',value:privateText}],getBoundingClientRect:()=>({width:130,height:30}),shadowRoot:null};
const document={querySelector:()=>node};const window={getComputedStyle:()=>({getPropertyValue:p=>p==='background-color'?'rgb(255, 255, 255)':p==='color'?'rgb(20, 20, 20)':''})};
const context=vm.createContext({document,window});const result=vm.runInContext(`(${sanitizedComponent.toString()})('#fixture')`,context);const html=result.html;
assert(!html.includes('PRIVATE_SENTINEL'));assert(!html.includes('password'));assert(html.includes('Synthetic field'));assert.throws(()=>vm.runInContext(`(${sanitizedComponent.toString()})('body')`,context),/specific component/);
console.log('PASS capture excludes source text, passwords, IDs, URLs and attributes')})().catch(e=>{console.error(e);process.exitCode=1});
