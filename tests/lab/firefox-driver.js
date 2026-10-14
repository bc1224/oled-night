// Test-only background script added to a disposable copy of the packaged extension.
(async()=>{
  const out=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));let tab;
  const inspect=async func=>(await browser.scripting.executeScript({target:{tabId:tab.id},func}))[0].result;
  try{
    await browser.storage.sync.clear();await browser.storage.sync.set({siteRules:{'127.0.0.1':'recolor'}});
    for(const theme of ['light','dark']){
      tab=await browser.tabs.create({url:TEST_ORIGIN+'/matrix.html?theme='+theme});await sleep(2000);
      await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
      out.push(...(await inspect(matrixStates)).map(c=>({...c,name:theme+' / '+c.name})));
      await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
      out.push({name:theme+' / disable restores original rendering',ok:await inspect(()=>!document.documentElement.hasAttribute('data-oled-night-root')&&getComputedStyle(document.body).backgroundColor===(document.documentElement.dataset.theme==='light'?'rgb(242, 243, 245)':'rgb(16, 17, 20)'))});
      const native=await inspect(responsiveness);
      await browser.storage.sync.set({extensionEnabled:true});await sleep(500);
      out.push({name:theme+' / re-enable reapplies extension',ok:await inspect(()=>document.documentElement.hasAttribute('data-oled-night-root'))});
      const active=await inspect(responsiveness);out.push(...performanceChecks(native,active).map(c=>({...c,name:theme+' / '+c.name})));
      out.push(...(await inspect(lateShadowScenario)).map(c=>({...c,name:theme+' / '+c.name})));
      await browser.tabs.remove(tab.id);
    }
  }catch(e){out.push({name:'Firefox lab execution',ok:false,detail:String(e)})}
  await fetch(TEST_ORIGIN+'/result',{method:'POST',body:JSON.stringify(out)});
})();
