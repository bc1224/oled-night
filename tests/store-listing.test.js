const assert = require('node:assert/strict');
(async () => {
  const {updateAmoListing, storeText, amoPrivacyText} = await import('../tools/submit-stores.mjs');
  const description = 'No browsing-history log. Optional current-domain reports. https://example.org';
  const privacy = 'GitHub retains submitted reports. Per-site preferences are stored locally.';
  const calls = [], saved = new Map();
  const request = async (path, options) => {
    calls.push({path, ...options});
    if (options) { const data = JSON.parse(options.body); saved.set(path, data); return data; }
    return saved.get(path);
  };
  assert.equal(await updateAmoListing(request, description, privacy), 'updated');
  // Each endpoint is read, written only because it differs, then read back.
  assert.deepEqual(calls.map(c=>c.method || 'GET'), ['GET', 'PATCH', 'GET', 'GET', 'PATCH', 'GET']);
  assert.deepEqual(Object.keys(JSON.parse(calls[1].body)), ['description']);
  assert.deepEqual(Object.keys(JSON.parse(calls[4].body)), ['privacy_policy']);
  assert.equal(JSON.parse(calls[4].body).privacy_policy['en-US'], privacy);
  // Copy that is already live costs no write.
  calls.length = 0;
  assert.equal(await updateAmoListing(request, description, privacy), 'unchanged');
  assert.deepEqual(calls.map(c=>c.method || 'GET'), ['GET', 'GET']);
  assert.equal(storeText('A &amp; B <a href="anything">https://example.org</a>'), 'A & B https://example.org');
  await assert.rejects(updateAmoListing(async()=>({description:{'en-US':'old wording'}}), description, privacy), /readback/);
  await assert.rejects(updateAmoListing(async()=>({}), description, privacy), /readback/);
  await assert.rejects(updateAmoListing(async()=>{throw Error('HTTP 403')}, description, privacy), /HTTP 403/);
  await assert.rejects(updateAmoListing(request, '', privacy), /Empty/);
  // AMO's actual policy readback renders Markdown permission names as HTML code.
  const permissionPolicy = '# Privacy\n\n_Last updated: October 14, 2026_\n\n**Permissions:** The `storage` permission saves settings; `activeTab` identifies the site.';
  const renderedPolicy = 'Last updated: October 14, 2026\n\nPermissions: The <code>storage</code> permission saves settings; <code>activeTab</code> identifies the site.';
  const renderedRequest = async (path, options) => options ? JSON.parse(options.body)
    : path.endsWith('eula_policy/') ? {privacy_policy:{'en-US':renderedPolicy}}
    : {description:{'en-US':description}};
  await updateAmoListing(renderedRequest, description, amoPrivacyText(permissionPolicy));
  assert.equal(storeText(renderedPolicy), amoPrivacyText(permissionPolicy).replace(/\s+/g, ' '));
  await assert.rejects(updateAmoListing(renderedRequest, description, amoPrivacyText(permissionPolicy).replace('saves settings', 'uploads settings')), /readback/);
  console.log('Store metadata: narrow PATCH payloads, exact readback, missing/mismatched responses and API errors verified.');
})().catch(error=>{console.error(error);process.exitCode=1});
