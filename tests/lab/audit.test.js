const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../docs/lab/audit.js'),'utf8'),context);const a=context.window.OLEDLabAudit;
assert.equal(a.contrast('rgb(0, 0, 0)','rgb(255, 255, 255)'),21);
const doc={defaultView:{getComputedStyle:e=>({backgroundColor:e.bg})}};const parent={bg:'rgb(255, 255, 255)',ownerDocument:doc,parentElement:null,getRootNode:()=>({})};const child={bg:'rgba(0, 0, 0, 0.5)',ownerDocument:doc,parentElement:parent};
assert.equal(a.background(child),'rgb(128, 128, 128)','transparent backgrounds must be composited over their actual ancestor');
console.log('PASS contrast audit composites translucent backgrounds correctly');
