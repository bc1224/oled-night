// Test-only background script added to a disposable copy of the packaged extension.
(async()=>{
  const out=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));let tab,completed=false;
  const inspect=async (func,args=[])=>(await browser.scripting.executeScript({target:{tabId:tab.id},func,args}))[0].result;
  const proof=async (fixture,items)=>regressionChecks(fixture,await inspect(()=>document.documentElement.hasAttribute('data-oled-night-root')),items);
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
      out.push(...(await proof(file,await inspect(mixedSurfaceScenario))).map(c=>({...c,name:file+' / Automatic / '+c.name})));
      await browser.storage.sync.set({extensionEnabled:false});await sleep(400);
      out.push(...(await inspect(mixedSurfaceOriginal)).map(c=>({...c,name:file+' / '+c.name})));
      await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'deepen'}});await sleep(400);
      out.push(...(await inspect(mixedSurfaceDeepen)).map(c=>({...c,name:file+' / '+c.name})));
      await browser.storage.sync.set({siteRules:{'127.0.0.1':'recolor'}});await sleep(400);
      out.push(...(await proof(file,await inspect(mixedSurfaceScenario,[false]))).map(c=>({...c,name:file+' / Recolor / '+c.name})));
      await browser.tabs.remove(tab.id);
    }
    await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'recolor'}});
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/cvs-hover.html'});await sleep(900);
    out.push(...await proof('cvs-hover',await inspect(deferredCssomScenario)));await browser.tabs.remove(tab.id);
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/booking-form.html'});await sleep(1500);
    await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
    out.push(...(await proof('booking-form',await inspect(bookingScenario))).map(c=>({...c,name:'booking / '+c.name})));
    await browser.storage.sync.set({extensionEnabled:false});await sleep(400);
    out.push({name:'booking / disable restores field ink and logo',ok:await inspect(()=>getComputedStyle(document.getElementById('booking-value')).webkitTextFillColor==='rgb(119, 119, 119)'&&getComputedStyle(document.getElementById('booking-logo')).filter==='none')});
    await browser.tabs.remove(tab.id);
    await browser.storage.sync.set({extensionEnabled:true});await sleep(400);
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/generated-style.html'});await sleep(900);
    await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
    out.push(...await proof('generated-style',await inspect(generatedStyleScenario)));await browser.tabs.remove(tab.id);
    await browser.storage.sync.set({extensionEnabled:true,siteRules:{}});
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/checkout.html'});await sleep(900);
    await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
    out.push(...await proof('checkout',await inspect(checkoutScenario)));
    await browser.storage.sync.set({extensionEnabled:false});await sleep(400);
    out.push({name:'checkout / disabling restores native icons',ok:await inspect(()=>getComputedStyle(document.querySelector('#checkout-back svg')).filter==='none'&&getComputedStyle(document.getElementById('checkout-crypto-icon')).filter==='none')});
    await browser.tabs.remove(tab.id);
    await browser.storage.sync.set({extensionEnabled:true,siteRules:{'127.0.0.1':'recolor'}});
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/paint-updates.html'});await sleep(900);
    await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
    out.push(...await proof('paint-updates',await inspect(paintUpdatesScenario)));
    const pairs=[];
    for(const order of [[true,false],[false,true],[true,false]]) {
      const pair={pageOnly:true};for(const enabled of order) {
        await browser.storage.sync.set({extensionEnabled:enabled});await browser.tabs.reload(tab.id);await sleep(700);
        pair.pageOnly&&=(await inspect(()=>document.documentElement.hasAttribute('data-oled-night-root')))===enabled;
        pair[enabled?'active':'native']=await inspect(frameWorkload);
      }pairs.push(pair);
    }
    out.push(...frameChecks(pairs).map(c=>({...c,fixture:'paint-updates',kind:'assertion'})));
    await browser.storage.sync.set({extensionEnabled:true});await sleep(400);
    for(let cycle=0;cycle<6;cycle++) {
      await inspect(mountComponents);await sleep(200);const mounted=(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts;
      await inspect(removeComponents);await sleep(80);const removed=(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts;
      out.push({name:'removed mail components released / cycle '+cycle,ok:mounted.shadowRoots>=160&&removed.shadowRoots===0,detail:JSON.stringify({mounted:mounted.shadowRoots,removed:removed.shadowRoots})});
    }
    await browser.tabs.remove(tab.id);
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/large-updates.html'});await sleep(2000);
    out.push({name:'large inbox performance exercises a desktop viewport',ok:await inspect(()=>innerWidth>=1000)});
    await browser.scripting.executeScript({target:{tabId:tab.id},files:['lab-audit.js']});
    out.push(...await proof('large-updates',await inspect(largeUpdatesScenario)));
    await inspect(()=>document.querySelector('.row').classList.add('hl'));await sleep(120);
    out.push({name:'shared background declarations remain bounded',ok:await inspect(()=>{const rules=[...document.getElementById('oled-night-sheet').sheet.cssRules].filter(r=>r.selectorText?.includes('data-oled-night-bg'));return rules.length>0&&rules.length<=128})});
    await browser.storage.sync.set({extensionEnabled:false});await sleep(500);
    out.push({name:'disable removes shared paint and restores native selected row',ok:await inspect(()=>!document.querySelector('[data-oled-night-bg]')&&getComputedStyle(document.querySelector('.row')).backgroundColor==='rgb(242, 246, 252)')});
    await browser.storage.sync.set({extensionEnabled:true});await sleep(500);
    const settledOwnership=(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts;
    await inspect(emptyRowLifecycle);const emptyOwnership=(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts;
    out.push({name:'emptying then removing a virtual row releases its retained shell',ok:emptyOwnership.paintContainers===settledOwnership.paintContainers,detail:JSON.stringify({before:settledOwnership,after:emptyOwnership})});
    out.push({name:'idle inbox releases per-row geometry observation after initial sampling',ok:settledOwnership.observedPaint<=64,detail:JSON.stringify(settledOwnership)});
    out.push({name:'detached queued mail rows are released',ok:(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts.deferredPaint===0});
    const largePairs=[],largeFramePairs=[];
    for(const order of [[true,false],[false,true],[true,false]]) {
      const pair={pageOnly:true},framePair={pageOnly:true};for(const enabled of order) {
        await browser.storage.sync.set({extensionEnabled:enabled});await browser.tabs.reload(tab.id);await sleep(2000);
        pair.pageOnly&&=(await inspect(()=>document.documentElement.hasAttribute('data-oled-night-root')))===enabled;
        pair[enabled?'active':'native']=await inspect(churnWorkload);
        if(enabled) {
          const {deferredPaint:queued,observedPaint:observed}=(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts;
          out.push({name:'offscreen observer ownership stays bounded at 2,048 branches',ok:Number.isInteger(queued)&&queued<=2048,detail:String(queued)});
          out.push({name:'viewport observation stays bounded at 4,096 containers',ok:Number.isInteger(observed)&&observed<=4096,detail:String(observed)});
          out.push({name:'steady animated updates observe at most 64 postponed branches',ok:Number.isInteger(observed)&&observed<=64,detail:String(observed)});
        }
        await browser.tabs.reload(tab.id);await sleep(2000);
        framePair.pageOnly&&=(await inspect(()=>document.documentElement.hasAttribute('data-oled-night-root')))===enabled;
        framePair[enabled?'active':'native']=await inspect(frameWorkload);
        if(enabled){const counts=(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts;out.push({name:'animated frame workload observes at most 64 postponed branches',ok:Number.isInteger(counts.observedPaint)&&counts.observedPaint<=64,detail:JSON.stringify(counts)})}
      }largePairs.push(pair);largeFramePairs.push(framePair);
    }
    out.push({name:'2,500-row churn retains 70% native throughput without 150ms stalls',ok:judgeChurn(largePairs).ok,detail:JSON.stringify(judgeChurn(largePairs))});
    out.push(...frameChecks(largeFramePairs).map(c=>({...c,name:'2,500 rows / '+c.name,fixture:'large-updates',kind:'assertion'})));
    await browser.storage.sync.set({extensionEnabled:true});await browser.tabs.reload(tab.id);await sleep(2000);
    await inspect(()=>document.getElementById('list').replaceChildren());await sleep(80);
    const cleared=(await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'})).counts;
    out.push({name:'removing the whole inbox releases viewport and pending ownership',ok:cleared.observedPaint===0&&cleared.deferredPaint===0&&cleared.paintContainers===0,detail:JSON.stringify(cleared)});
    await browser.tabs.remove(tab.id);
    await browser.storage.sync.set({extensionEnabled:true});
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/report-preview.html'});await sleep(900);
    out.push(...await inspect(reportPreviewScenario));
    await browser.tabs.remove(tab.id);
    completed=true;
  }catch(e){out.push({name:'Firefox lab execution',ok:false,detail:String(e)})}
  await fetch(TEST_ORIGIN+'/result',{method:'POST',body:JSON.stringify({completed,checks:out})});
})();
