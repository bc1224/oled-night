setTimeout(async () => {
  const checks = [];
  const check = (name, ok) => checks.push({name,ok:!!ok});
  const $ = id => document.getElementById(id);
  if (location.pathname.endsWith('options.html')) {
    check('options modes render', $('newMode').options.length === 5);
    check('Chrome theme hidden in Firefox', $('getTheme').closest('section').hidden);
    $('shortcuts').click(); check('Firefox shortcut instructions', !$('shortcutHelp').hidden);
    check('master shortcut displayed in settings', $('extensionShortcut').textContent !== 'not set');
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
    $('extensionEnabled').click();
    await new Promise(r => setTimeout(r,300));
    check('popup master switch persists', (await browser.storage.sync.get('extensionEnabled')).extensionEnabled === false);
    chrome.tabs.sendMessage=async()=>({host:'chatgpt.com',version:browser.runtime.getManifest().version});
    let consent;
    chrome.permissions.request=async options=>{consent=options;return true};
    window.__submissions=[];
    window.fetch=async(url,options)=>{window.__submissions.push(JSON.parse(options.body));return Response.json({url:'https://github.com/bc1224/oled-night/issues/123'},{status:201})};
    $('report').click();await new Promise(r=>setTimeout(r,100));
    checks.push(...await reportAttachmentsScenario());
    $('reportDescription').value='The ChatGPT button is unreadable';$('reportSubmit').click();
    await new Promise(r=>setTimeout(r,100));
    check('Firefox explicit submit sends the chosen screenshot once',window.__submissions.length===1&&window.__submissions[0].screenshot?.type==='image/png');
    check('Firefox screenshot sharing requests optional websiteContent consent',consent?.data_collection.includes('websiteContent'));
    check('Firefox success confirmation closes the report form',!$('reportPreview').open&&$('reportSuccess').open);
  }
  await browser.runtime.sendMessage({type:'firefox-ui-test',checks});
}, 1500);
