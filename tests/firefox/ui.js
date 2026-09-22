setTimeout(async () => {
  const checks = [];
  const check = (name, ok) => checks.push({name,ok:!!ok});
  const $ = id => document.getElementById(id);
  if (location.pathname.endsWith('options.html')) {
    check('options modes render', $('newMode').options.length === 5);
    check('Chrome theme hidden in Firefox', $('getTheme').closest('section').hidden);
    $('shortcuts').click(); check('Firefox shortcut instructions', !$('shortcutHelp').hidden);
    $('newHost').value = 'example.test';
    $('addRule').requestSubmit();
    await new Promise(r => setTimeout(r,300));
    check('options saves per-site rule', (await browser.storage.sync.get('siteRules')).siteRules['example.test'] === 'off');
    check('options renders saved rule', !!document.querySelector('[data-host="example.test"] select'));
  } else {
    check('popup version rendered', $('version').textContent === 'v'+browser.runtime.getManifest().version);
    check('popup site modes render', $('siteRule').options.length === 4);
    check('popup hides Chrome theme link in Firefox', $('theme').hidden);
    $('globalEnabled').checked = false; $('globalEnabled').dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r,300));
    check('popup persists switch', (await browser.storage.sync.get('globalEnabled')).globalEnabled === false);
  }
  await browser.runtime.sendMessage({type:'firefox-ui-test',checks});
}, 1500);
