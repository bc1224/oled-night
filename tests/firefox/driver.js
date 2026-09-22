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
    await browser.storage.sync.set({globalEnabled:false}); await wait(400);
    check('dropdown off restores selection', await inspect(() => getComputedStyle(document.getElementById('promotion')).backgroundColor === 'rgb(229, 235, 238)'));
    await browser.storage.sync.clear(); await wait(400);
    const report = await browser.tabs.sendMessage(tab.id,{type:'oled-night-report'});
    check('diagnostic report works', report.extension === 'OLED Night' && report.active);
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
