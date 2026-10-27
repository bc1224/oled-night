(async()=>{
  const checks=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let tab;
  const inspect=async func=>(await browser.scripting.executeScript({target:{tabId:tab.id},func}))[0].result;
  try{
    await browser.storage.sync.clear();
    for(const appearance of ['oled','soft']){
      await browser.storage.sync.set({extensionEnabled:true,appearance,siteRules:{'127.0.0.1':'recolor'}});
      tab=await browser.tabs.create({url:TEST_ORIGIN+'/text-hover.html'});await wait(1500);
      const status=await browser.tabs.sendMessage(tab.id,{type:'oled-night-status'});
      checks.push({name:`inherited text ${appearance}: correct active fixture and mode`,ok:status.active&&status.mode===(appearance==='soft'?'soft':'oled')&&status.version===browser.runtime.getManifest().version,detail:JSON.stringify(status)});
      const text=await inspect(textHoverEvents);
      for(const property of ['hoverStable','slotMutationStable','focusStable','mutationStable','insertionStable','artworkUpdateStable','keyboardControlStable','artworkPreserved'])
        checks.push({name:`inherited text ${appearance}: ${property}`,ok:text[property],detail:text[property]?undefined:JSON.stringify(text)});
      await browser.storage.sync.set({extensionEnabled:false});await wait(350);
      checks.push({name:`inherited text ${appearance}: disabling restores authored text and vector ink`,ok:await inspect(()=>
        [...document.querySelectorAll('p,li,button,a'),...document.getElementById('shadowHost').shadowRoot.querySelectorAll('p')].every(node=>getComputedStyle(node).color==='rgb(34, 34, 34)')&&
        ['symbol','cssSymbol','vectorLabel'].every(id=>getComputedStyle(document.getElementById(id)).fill==='rgb(34, 34, 34)'))});
      await browser.storage.sync.set({extensionEnabled:true});
      await browser.tabs.update(tab.id,{url:TEST_ORIGIN+'/ink-locality.html'});await wait(1200);
      const localityStatus=await browser.tabs.sendMessage(tab.id,{type:'oled-night-status'});
      checks.push({name:`native ink ${appearance}: correct active fixture and mode`,ok:localityStatus.active&&localityStatus.mode===appearance&&localityStatus.version===browser.runtime.getManifest().version});
      const locality=await inspect(inkLocalityScenario);
      for(const property of ['paddingStable','ownedColorChanges','localMeasurements','inheritedStable'])
        checks.push({name:`native ink ${appearance}: ${property}`,ok:locality[property],detail:locality[property]?undefined:JSON.stringify(locality)});
      await browser.tabs.remove(tab.id);tab=null;
    }
    await browser.storage.sync.set({extensionEnabled:true,appearance:'oled',siteRules:{'127.0.0.1':'global'}});
    tab=await browser.tabs.create({url:TEST_ORIGIN+'/dark-layout.html'});await wait(2000);
    const darkStatus=await browser.tabs.sendMessage(tab.id,{type:'oled-night-status'});
    checks.push({name:'native dark layout: automatic crush mode',ok:darkStatus.active&&darkStatus.mode==='crush'&&darkStatus.version===browser.runtime.getManifest().version});
    const ink=await inspect(darkLayoutInkScenario);
    for(const [name,ok] of Object.entries(ink))checks.push({name:`native dark layout: ${name}`,ok});
  }catch(error){checks.push({name:'inherited text execution',ok:false,detail:String(error.stack||error)})}
  finally{if(tab)await browser.tabs.remove(tab.id)}
  await fetch(TEST_ORIGIN+'/result',{method:'POST',body:JSON.stringify(checks)});
})();
