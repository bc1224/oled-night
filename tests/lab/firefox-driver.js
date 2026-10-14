// Test-only background script added to a disposable copy of the packaged extension.
(async()=>{
  const out=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));let tab;
  const inspect=async (func,args=[])=>(await browser.scripting.executeScript({target:{tabId:tab.id},func,args}))[0].result;
  try{
    await browser.storage.sync.clear();await browser.storage.sync.set({siteRules:{'127.0.0.1':'recolor'}});
    for(const theme of ['light','dark']){
      tab=await browser.tabs.create({url:TEST_ORIGIN+'/matrix.html?theme='+theme});await sleep(2000);
      await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
      out.push(...(await inspect(coldShadowScenario)).map(c=>({...c,name:theme+' / '+c.name})));
      out.push(...(await inspect(matrixStates)).map(c=>({...c,name:theme+' / '+c.name})));
      await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
      out.push({name:theme+' / disable restores original rendering',ok:await inspect(()=>!document.documentElement.hasAttribute('data-oled-night-root')&&getComputedStyle(document.body).backgroundColor===(document.documentElement.dataset.theme==='light'?'rgb(242, 243, 245)':'rgb(16, 17, 20)'))});
      const native=await inspect(responsiveness);
      await browser.storage.sync.set({extensionEnabled:true});await sleep(500);
      out.push({name:theme+' / re-enable reapplies extension',ok:await inspect(()=>document.documentElement.hasAttribute('data-oled-night-root'))});
      const active=await inspect(responsiveness);out.push(...performanceChecks(native,active).map(c=>({...c,name:theme+' / '+c.name})));
      out.push(...(await inspect(lateShadowScenario)).map(c=>({...c,name:theme+' / '+c.name})));
      out.push(...(await inspect(frameMutationScenario)).map(c=>({...c,name:theme+' / '+c.name})));
      await browser.tabs.remove(tab.id);
    }
    for(const file of ['email-newsletter','native-banner']){
      await browser.storage.sync.set({extensionEnabled:true,siteRules:{}});
      tab=await browser.tabs.create({url:TEST_ORIGIN+'/'+file+'.html'});await sleep(1500);
      await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
      out.push(...(await inspect(mixedSurfaceScenario)).map(c=>({...c,name:file+' / Automatic / '+c.name})));
      await browser.storage.sync.set({extensionEnabled:false});await sleep(400);
      out.push(...(await inspect(mixedSurfaceOriginal)).map(c=>({...c,name:file+' / '+c.name})));
      await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'deepen'}});await sleep(400);
      out.push(...(await inspect(mixedSurfaceDeepen)).map(c=>({...c,name:file+' / '+c.name})));
      await browser.storage.sync.set({siteRules:{'127.0.0.1':'recolor'}});await sleep(400);
      out.push(...(await inspect(mixedSurfaceScenario,[false])).map(c=>({...c,name:file+' / Recolor / '+c.name})));
      await browser.tabs.remove(tab.id);
    }
    await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'recolor'}});
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/booking-form.html'});await sleep(1500);
    await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
    out.push(...(await inspect(bookingScenario)).map(c=>({...c,name:'booking / '+c.name})));
    await browser.storage.sync.set({extensionEnabled:false});await sleep(400);
    out.push({name:'booking / disable restores field ink and logo',ok:await inspect(()=>getComputedStyle(document.getElementById('booking-value')).webkitTextFillColor==='rgb(119, 119, 119)'&&getComputedStyle(document.getElementById('booking-logo')).filter==='none')});
    await browser.tabs.remove(tab.id);
    await browser.storage.sync.set({extensionEnabled:true});await sleep(400);
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/generated-style.html'});await sleep(900);
    await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
    out.push(...await inspect(generatedStyleScenario));await browser.tabs.remove(tab.id);
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/report-preview.html'});await sleep(900);
    out.push({name:'public report preview omits private text and identifiers',ok:await inspect(()=>document.getElementById('privacy-result').textContent.startsWith('PASS')&&!/PRIVATE/.test(document.getElementById('preview').textContent))});
    out.push({name:'public report draft requires a click',ok:await inspect(()=>document.getElementById('draft').textContent==='Open GitHub draft'&&location.pathname.endsWith('/report-preview.html'))});
    await browser.tabs.remove(tab.id);
  }catch(e){out.push({name:'Firefox lab execution',ok:false,detail:String(e)})}
  await fetch(TEST_ORIGIN+'/result',{method:'POST',body:JSON.stringify(out)});
})();
