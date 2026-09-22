(async () => {
  const checks = [];
  const check = (name, ok, detail) => checks.push({name, ok: !!ok, detail});
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let tab;
  const open = async file => {
    if (tab) await browser.tabs.remove(tab.id);
    tab = await browser.tabs.create({url: `${TEST_ORIGIN}/${file}`});
    await wait(2000);
  };
  const inspect = async func => (await browser.scripting.executeScript({target:{tabId:tab.id},func}))[0].result;
  try {
    await browser.storage.sync.clear();
    await open('light.html');
    check('light page becomes black', await inspect(() => getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'));
    const state = await browser.tabs.sendMessage(tab.id, {type:'oled-night-status'});
    check('content message status', state.active && state.mode === 'oled');
    check('text emphasis preserved', await inspect(() => {
      const values = ['primary','secondary','muted'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).color.match(/[\d.]+/)[0]));
      return values[0]>values[1] && values[1]>values[2];
    }));
    check('embedded frame darkened', await inspect(() => getComputedStyle(document.getElementById('frame').contentDocument.body).backgroundColor === 'rgb(0, 0, 0)'));
    await browser.storage.sync.set({globalEnabled:false}); await wait(400);
    check('global off restores page', await inspect(() => !document.documentElement.hasAttribute('data-oled-night-root')));
    await browser.storage.sync.set({globalEnabled:true}); await wait(400);
    check('global on reapplies', (await browser.tabs.sendMessage(tab.id,{type:'oled-night-status'})).active);
    await browser.storage.sync.set({siteRules:{'127.0.0.1':'off'}}); await wait(400);
    check('per-site off', !(await browser.tabs.sendMessage(tab.id,{type:'oled-night-status'})).active);
    await browser.storage.sync.clear();
    await open('dark.html');
    check('dark page retains cards', await inspect(() => getComputedStyle(document.getElementById('card')).backgroundColor === 'rgb(43, 45, 49)'));
    await open('components.html');
    check('shadow root background darkened', await inspect(() => getComputedStyle(document.getElementById('grid').shadowRoot.querySelector('table')).backgroundColor === 'rgb(0, 0, 0)'));
    check('images unchanged', await inspect(() => getComputedStyle(document.getElementById('img')).filter === 'none'));
    await browser.storage.sync.set({openClosedShadows:true}); await wait(600);
    check('MAIN world script registered', (await browser.scripting.getRegisteredContentScripts()).some(s => s.id === 'oled-night-open-shadows'));
    await open('components.html');
    check('closed shadow opt-in works', await inspect(() => !!document.getElementById('closed').shadowRoot));
    await browser.storage.sync.set({openClosedShadows:false}); await wait(400);
    check('MAIN world script unregisters', !(await browser.scripting.getRegisteredContentScripts()).length);
    await open('gmail.html');
    check('Gmail ellipsis visible', await inspect(() => getComputedStyle(document.getElementById('ellipsis')).filter.includes('invert(1)')));
    check('Gmail cross-origin logo edge preserves colors', await inspect(() => { const f=getComputedStyle(document.getElementById('mailLogo')).filter; return f.includes('drop-shadow') && !f.includes('invert'); }));
    check('Gmail ordinary remote image unchanged', await inspect(() => getComputedStyle(document.getElementById('mailPhoto')).filter === 'none'));
    await open('apple-auth.html');
    check('Apple text-fill readable', await inspect(() => parseFloat(getComputedStyle(document.getElementById('password')).webkitTextFillColor.match(/[\d.]+/)[0]) > 180));
    check('Apple field inset black', await inspect(() => getComputedStyle(document.getElementById('email')).boxShadow.includes('rgb(0, 0, 0)')));
    await open('reddit-res.html');
    check('RES floater dark', await inspect(() => getComputedStyle(document.getElementById('floater')).backgroundColor === 'rgb(0, 0, 0)'));
    check('RES icon visible', await inspect(() => getComputedStyle(document.getElementById('RESAccountSwitcherIcon')).filter === 'invert(1)'));
    await open('dropdowns.html');
    check('dropdown selected important background dark', await inspect(() => {
      const s=getComputedStyle(document.getElementById('promotion'));
      return s.backgroundColor !== 'rgb(229, 235, 238)' && parseFloat(s.backgroundColor.match(/[\d.]+/)[0]) < 60;
    }));
    await inspect(() => document.getElementById('dynamicOption').setAttribute('aria-selected','true')); await wait(400);
    check('dropdown aria-only change recolored', await inspect(() => {
      const e=document.getElementById('dynamicOption');
      return e.getAttribute('data-oled-night').includes('bg') && parseFloat(getComputedStyle(e).backgroundColor.match(/[\d.]+/)[0]) < 60;
    }));
    await inspect(() => document.getElementById('transparentLink').focus()); await wait(100);
    check('dropdown focus-within transparent ancestor darkened', await inspect(() => {
      const el=document.getElementById('transparentRow');
      return el.getAttribute('data-oled-night').includes('bg') && parseFloat(getComputedStyle(el).backgroundColor.match(/[\d.]+/)[0]) < 60;
    }));
    await inspect(() => document.getElementById('genericField').focus()); await wait(100);
    check('field focus background and explicit text-fill readable', await inspect(() => {
      const s=getComputedStyle(document.getElementById('genericField'));
      return parseFloat(s.backgroundColor.match(/[\d.]+/)[0]) < 60 && parseFloat(s.webkitTextFillColor.match(/[\d.]+/)[0]) > 180 && s.outlineStyle === 'solid';
    }));
    await inspect(() => { const e=document.getElementById('genericField'); e.setAttribute('style','width:100%'); e.removeAttribute('data-oled-night'); }); await wait(400);
    check('field recovers after framework replaces inline styles', await inspect(() => parseFloat(getComputedStyle(document.getElementById('genericField')).webkitTextFillColor.match(/[\d.]+/)[0]) > 180));
    check('Amazon sprites and border chevron readable', await inspect(() => getComputedStyle(document.getElementById('amazonArrow')).filter === 'brightness(0) invert(1)' && getComputedStyle(document.getElementById('amazonClose')).filter === 'brightness(0) invert(1)' && parseFloat(getComputedStyle(document.getElementById('amazonMore')).borderRightColor.match(/[\d.]+/)[0]) > 180));
    check('Amazon unrelated sprite untouched', await inspect(() => getComputedStyle(document.getElementById('amazonOther')).filter === 'none'));
    check('Amazon expanded header darkened',await inspect(()=>getComputedStyle(document.getElementById('amazonHeader')).backgroundColor!=='rgb(243, 243, 243)'));
    check('specific important highlighted row darkened', await inspect(() => getComputedStyle(document.getElementById('importantRow')).backgroundColor !== 'rgb(251, 235, 156)'));
    check('dropdown blur clears old focus highlight', await inspect(() => getComputedStyle(document.getElementById('transparentRow')).backgroundColor === 'rgba(0, 0, 0, 0)'));
    await inspect(() => document.getElementById('shadowInteraction').shadowRoot.querySelector('button').focus()); await wait(100);
    check('shadow focus state darkened', await inspect(() => {
      const el=document.getElementById('shadowInteraction').shadowRoot.querySelector('button');
      return el.getAttribute('data-oled-night').includes('bg') && parseFloat(getComputedStyle(el).backgroundColor.match(/[\d.]+/)[0]) < 60;
    }));
    await browser.storage.sync.set({globalEnabled:false}); await wait(400);
    check('Amazon off restores icons', await inspect(() => getComputedStyle(document.getElementById('amazonArrow')).filter === 'none' && getComputedStyle(document.getElementById('amazonMore')).borderRightColor === 'rgb(17, 17, 17)'));
    check('dropdown off restores selection', await inspect(() => getComputedStyle(document.getElementById('promotion')).backgroundColor === 'rgb(229, 235, 238)'));
    await inspect(() => document.getElementById('genericField').focus()); await wait(100);
    check('field off restores original text fill', await inspect(() => getComputedStyle(document.getElementById('genericField')).webkitTextFillColor === 'rgb(34, 34, 34)'));
    await browser.storage.sync.clear(); await wait(400);
    const report = await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'});
    check('diagnostic report works', report.extension === 'OLED Night' && report.active);
    await open('report-fields.html');
    const fieldReport=await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'});
    check('report catches field contrast without private contents',fieldReport.lowContrast.filter(e=>e.element.includes('private')).length===4 && !JSON.stringify(fieldReport).includes('SENTINEL') && !fieldReport.lowContrast.some(e=>e.element.includes('transparentIcon')));
    await open('efficiency.html');
    const efficiency = await inspect(async () => {
 const wait = () => new Promise(r=>setTimeout(r,150));
 const p=document.getElementById('parent'), c=document.getElementById('child'), v=document.getElementById('variable');
 const dark = node => { const c=getComputedStyle(node); return c.backgroundColor.match(/[0-9.]+/g).slice(0,3).every(n=>+n<30) && +c.color.match(/[0-9.]+/)[0]>180; };
 const results={}; let batches=0;
 const watch=new MutationObserver(records=>{batches+=records.filter(r=>r.attributeName==='data-oled-night-measure' && r.oldValue===null).length});
 watch.observe(p,{attributes:true,subtree:true,attributeOldValue:true,attributeFilter:['data-oled-night-measure']});
 p.style.transform='translateX(1px)'; await wait(); batches=0;
 for(let i=0;i<20;i++)p.style.transform='translateX('+i+'px)';
 await wait(); results.transformSkips=batches===0;
 batches=0; c.classList.add('changed');p.classList.add('changed');c.dispatchEvent(new Event('focusin',{bubbles:true,composed:true}));
 await wait();results.coalesced=batches===1;
 p.style.setProperty('--surface','#eee'); await wait();results.variableDark=dark(v);
 p.setAttribute('style','--surface:#ddd;background:white');await wait();results.resetInheritance=dark(v);
 const sheet=document.createElement('style');sheet.textContent='#late{background:#eee!important;color:#222}';document.head.append(sheet);await wait();results.lateSheet=dark(document.getElementById('late'));
 sheet.firstChild.data='#late{background:rgb(230,230,230)!important;color:#111}';await wait();results.editedSheet=dark(document.getElementById('late'));
 batches=0;await wait();results.noFeedback=batches===0;watch.disconnect();return results;
});
    for(const [name,ok] of Object.entries(efficiency)) check('efficiency: '+name,ok,JSON.stringify(efficiency));

    check('keyboard shortcut registered', (await browser.commands.getAll()).some(c => c.name === 'toggle-site' && c.shortcut));
    for (const page of ['options.html', 'popup.html']) {
      let resolveUI;
      const uiResult = new Promise(r => { resolveUI = r; });
      const listener = message => { if (message.type === 'firefox-ui-test') resolveUI(message.checks); };
      browser.runtime.onMessage.addListener(listener);
      const uiTab = await browser.tabs.create({url:browser.runtime.getURL(page)});
      const uiChecks = await Promise.race([uiResult, wait(10000).then(() => [{name:page+' timeout',ok:false}])]);
      checks.push(...uiChecks);
      browser.runtime.onMessage.removeListener(listener);
      await browser.tabs.remove(uiTab.id);
    }

  } catch (e) { check('test execution', false, String(e.stack || e)); }
  await fetch(`${TEST_ORIGIN}/result`, {method:'POST',body:JSON.stringify(checks)});
})();
