const assert=require('node:assert/strict');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');const {join,resolve,sep}=require('node:path');
(async()=>{
  const {buildLab}=await import('../../tools/build-lab.mjs');
  const {launchChrome}=await import('./browser.mjs'),{serveLab}=await import('./server.mjs');
  const {summarizeLive}=await import('../../tools/live-report.mjs');
  const directory=mkdtempSync(join(tmpdir(),'oled-lab-cvs-gallery-'));let server,browser;
  try{
    buildLab({output:directory});server=await serveLab(directory);browser=await launchChrome();const page=await browser.open();
    for(const ok of [false,true]){
      const receipt=summarizeLive({sha:'a'.repeat(40),checkedAt:'2026-10-13T00:00:00Z',checks:[{name:'www.cvs.com site',kind:'site',ok:true},{name:'www.cvs.com navigation hover 1',kind:'regression',ok}]},{sha:'a'.repeat(40),checks:[{ok:false},{ok:true}]});
      writeFileSync(join(directory,'lab/live-results.json'),JSON.stringify(receipt));
      await page.go(server.origin+'/lab/?receipt='+ok+'#cvs-hover');
      const state=await page.eval(`({receipt:document.getElementById('live-receipt').textContent,title:document.getElementById('case-title').textContent,limit:document.getElementById('case-limit').textContent,border:getComputedStyle(document.querySelector('.live-status')).borderTopStyle})`);
      assert(state.receipt.startsWith(ok?'PASS this run only':'FAIL'),JSON.stringify(state));
      assert(await page.eval("document.getElementById('stress-receipt').textContent.includes('FAIL · 1 passed / 1 failed')"),'known synthetic failure must stay visible separately');
      assert(state.limit.includes('does not guarantee every live page state'));assert(state.title.includes('CVS'));assert.equal(state.border,'solid');
      assert(await page.eval(`(()=>{const f=document.getElementById('frame').contentWindow;return f.CVSHoverLab.links().length===3})()`),'CVS case actually loads the interactive fixture');
    }
    await page.size(390,850);assert(await page.eval('document.documentElement.scrollWidth<=innerWidth'),'new live-status panel must fit mobile');
    assert.equal(browser.errors.length,0);console.log('PASS actual gallery shows failing CVS receipt, retains coverage limits after a pass, and loads hover case');
  }finally{await browser?.close();await server?.close();if(!resolve(directory).startsWith(resolve(tmpdir())+sep+'oled-lab-cvs-gallery-'))throw Error('Cleanup escaped owned test prefix');rmSync(directory,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
