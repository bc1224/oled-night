const assert = require('node:assert/strict');
(async () => {
  const {updateAmoListing, storeText} = await import('../tools/submit-stores.mjs');
  const description = 'No browsing-history log. Optional current-domain reports. https://example.org';
  const privacy = 'GitHub retains submitted reports. Per-site preferences are stored locally.';
  const calls = [], saved = new Map();
  const request = async (path, options) => {
    calls.push({path, ...options});
    if (options) { const data = JSON.parse(options.body); saved.set(path, data); return data; }
    return saved.get(path);
  };
  await updateAmoListing(request, description, privacy);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.filter(c=>c.method).map(c=>c.method), ['PATCH', 'PATCH']);
  assert.deepEqual(Object.keys(JSON.parse(calls[0].body)), ['description']);
  assert.deepEqual(Object.keys(JSON.parse(calls[2].body)), ['privacy_policy']);
  assert.equal(JSON.parse(calls[2].body).privacy_policy['en-US'], privacy);
  assert.equal(storeText('A &amp; B <a href="anything">https://example.org</a>'), 'A & B https://example.org');
  await assert.rejects(updateAmoListing(async()=>({description:{'en-US':'old wording'}}), description, privacy), /readback/);
  await assert.rejects(updateAmoListing(async()=>({}), description, privacy), /readback/);
  await assert.rejects(updateAmoListing(async()=>{throw Error('HTTP 403')}, description, privacy), /HTTP 403/);
  await assert.rejects(updateAmoListing(request, '', privacy), /Empty/);
  console.log('Store metadata: narrow PATCH payloads, exact readback, missing/mismatched responses and API errors verified.');
})().catch(error=>{console.error(error);process.exitCode=1});
