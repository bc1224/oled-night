// Exercise the real preview message boundary and wait through rendering, so a
// quick acknowledgement cannot conceal delayed or stale page colors.
export async function previewTuningScenario({page, ext, url, check, sleep}) {
  const preview = patch => ext.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(url)}});return chrome.tabs.sendMessage(tab.id,{type:'oled-night-preview',patch:${JSON.stringify(patch)}})})()`);
  const painted = async () => {
    await sleep(32);
    return page.eval(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const root=document.documentElement, style=getComputedStyle(document.querySelector('.c'));
      resolve({active:root.hasAttribute('data-oled-night-root'),brightness:root.style.getPropertyValue('--oln-light'),strength:root.style.getPropertyValue('--oln-strength'),dim:root.hasAttribute('data-oled-night-dim'),color:style.color});
    })))`);
  };
  await preview({brightness:50}); await painted();
  await page.eval(`window.previewValues=[];window.previewWatch=new MutationObserver(()=>{
    const value=document.documentElement.style.getPropertyValue('--oln-light');
    if(window.previewValues.at(-1)!==value)window.previewValues.push(value);
  });window.previewWatch.observe(document.documentElement,{attributes:true,attributeFilter:['style']})`);
  const start=performance.now();
  await ext.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(url)}});for(const brightness of [60,70,80,90])await chrome.tabs.sendMessage(tab.id,{type:'oled-night-preview',patch:{brightness}})})()`);
  const final=await painted(), elapsed=performance.now()-start;
  const values=await page.eval('window.previewWatch.disconnect();window.previewValues');
  check('rapid slider previews render the latest value within the original step budget', final.brightness==='90%' && final.color==='rgb(188, 188, 188)' && elapsed/4<120, JSON.stringify({elapsed,final}));
  check('rapid slider previews coalesce redundant tuning writes', values.length<4 && values.at(-1)==='90%', JSON.stringify(values));

  await preview({brightness:60}); await preview({contrast:20}); await preview({dimImages:true});
  const merged=await painted();
  check('batched previews merge brightness, contrast and image settings', merged.brightness==='60%' && merged.strength==='0.2' && merged.dim && merged.color==='rgb(125, 125, 125)', JSON.stringify(merged));

  // A sustained stream must make progress before the last event. A trailing
  // debounce would defer all visible feedback until the user stopped dragging.
  const progressed=await ext.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(url)}});
    await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{window.previewProgress=false;window.progressWatch=new MutationObserver(()=>{window.previewProgress=true});window.progressWatch.observe(document.documentElement,{attributes:true,attributeFilter:['style']})}});
    for(let i=0;i<12;i++){await chrome.tabs.sendMessage(tab.id,{type:'oled-night-preview',patch:{brightness:65+i}});await new Promise(r=>setTimeout(r,4))}
    return(await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{window.progressWatch.disconnect();return window.previewProgress}}))[0].result;
  })()`);
  check('continuous slider input keeps updating before the drag ends', progressed);
  await painted();

  await preview({brightness:99}); await preview({globalEnabled:false});
  const disabled=await painted();
  check('disable cancels pending preview paint and restores native text', !disabled.active && disabled.brightness==='' && disabled.color==='rgb(95, 99, 104)', JSON.stringify(disabled));
  await preview({globalEnabled:true,brightness:70,contrast:72,dimImages:false});
  const restored=await painted();
  check('reenabling after a pending preview paints current settings', restored.active && restored.brightness==='70%' && restored.color==='rgb(146, 146, 146)' && !restored.dim, JSON.stringify(restored));

  await preview({brightness:99});
  await ext.eval('chrome.storage.sync.set({brightness:55,contrast:72,dimImages:false})');
  await sleep(100);
  const stored=await painted();
  check('saved settings supersede a pending preview', stored.brightness==='55%' && stored.color==='rgb(115, 115, 115)', JSON.stringify(stored));
}
