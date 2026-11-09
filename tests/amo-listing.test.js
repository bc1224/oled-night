const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
(async () => {
  const {updateAmoListing, syncAmoPreviews, firefoxListingTranslation, amoListingAssets, AMO_LOCALES, retryThrottled} =
    await import('../tools/submit-stores.mjs');
  const root = join(__dirname, '..');

  // Chrome-only wording in the shared translations is swapped for Firefox requirements.
  for (const lang of Object.keys(AMO_LOCALES)) {
    const chrome = readFileSync(join(root, 'store', 'listing-i18n', `${lang}.txt`), 'utf8');
    const firefox = firefoxListingTranslation(chrome, lang);
    assert.doesNotMatch(firefox, /Chrome/, `${lang} Firefox listing still mentions Chrome`);
    assert.match(firefox, /Firefox/);
    assert.match(firefox, /142/);
  }
  assert.throws(() => firefoxListingTranslation('No theme sentence here.', 'de'), /Chrome theme sentence/);

  // Listing assets come from the repository: English text, privacy, summaries, five screenshots.
  const assets = amoListingAssets(root);
  assert.doesNotMatch(assets.description, /Chrome/);
  assert.match(assets.description, /Private by design/);
  assert.ok(assets.description.split(/s+/).length < 200, "Firefox description stays short");
  assert.equal(assets.summary['en-US'], JSON.parse(readFileSync(join(root, '_locales', 'en', 'messages.json'), 'utf8')).extDescription.message);
  assert.deepEqual(Object.keys(assets.summary).sort(), ['de', 'en-US', 'es-ES', 'ro', 'ru']);
  assert.deepEqual(Object.keys(assets.translations).sort(), ['de', 'es-ES', 'ro', 'ru']);
  for (const value of Object.values(assets.summary)) assert.ok(value.length <= 250);
  assert.equal(assets.screenshots.length, 5);
  assert.ok(assets.screenshots.every(shot => shot.caption && shot.path.endsWith('.png')));
  assert.doesNotMatch(JSON.stringify(assets) + assets.description, /—/);

  // One PATCH carries every locale of description and summary; readback is checked per locale.
  const saved = new Map(), calls = [];
  const request = async (path, options) => {
    calls.push({path, ...options});
    if (options?.method === 'PATCH') { const body = JSON.parse(options.body); saved.set(path, {...saved.get(path), ...body}); return body; }
    return saved.get(path) || {};
  };
  await updateAmoListing(request, assets.description, 'Privacy text.', {summary: assets.summary, translations: assets.translations});
  const patch = JSON.parse(calls.find(c => c.method === 'PATCH').body);
  assert.deepEqual(Object.keys(patch).sort(), ['description', 'summary']);
  assert.deepEqual(Object.keys(patch.description).sort(), ['de', 'en-US', 'es-ES', 'ro', 'ru']);
  assert.equal(patch.description['es-ES'], assets.translations['es-ES']);
  const stale = async (path, options) => options ? {} : path.endsWith('eula_policy/') ? {privacy_policy: {'en-US': 'Privacy text.'}}
    : {description: {...patch.description, ru: 'old'}, summary: patch.summary};
  await assert.rejects(updateAmoListing(stale, assets.description, 'Privacy text.', {summary: assets.summary, translations: assets.translations}), /description \(ru\) readback/);

  // Previews: upload the five in order with captions, then delete the old ones, then read back.
  let previews = [{id: 1, position: 0, caption: null}, {id: 2, position: 1, caption: null}], nextId = 10;
  const log = [];
  const previewRequest = async (path, options = {}) => {
    const method = options.method || 'GET';
    log.push(`${method} ${path}`);
    if (method === 'GET') return {previews: [...previews].sort((a, b) => a.position - b.position)};
    if (method === 'POST') { assert.ok(options.body instanceof FormData); const preview = {id: nextId++, position: Number(options.body.get('position')), caption: null}; previews.push(preview); return preview; }
    const id = Number(path.match(/previews\/(\d+)\//)[1]);
    if (method === 'PATCH') { Object.assign(previews.find(p => p.id === id), JSON.parse(options.body)); return {}; }
    if (method === 'DELETE') { previews = previews.filter(p => p.id !== id); return {}; }
  };
  const shots = assets.screenshots.map(shot => ({...shot, read: () => Buffer.from('png')}));
  assert.equal(await syncAmoPreviews(previewRequest, shots), 'updated');
  assert.deepEqual(previews.sort((a, b) => a.position - b.position).map(p => p.caption['en-US']), shots.map(s => s.caption));
  assert.deepEqual(log.filter(l => l.startsWith('DELETE')), ['DELETE /addons/addon/oled-night/previews/1/', 'DELETE /addons/addon/oled-night/previews/2/']);
  const firstDelete = log.findIndex(l => l.startsWith('DELETE')), lastPost = log.findLastIndex(l => l.startsWith('POST'));
  assert.ok(lastPost < firstDelete, 'old previews are removed only after the new ones upload');
  log.length = 0;
  assert.equal(await syncAmoPreviews(previewRequest, shots), 'unchanged');
  assert.ok(log.every(l => l.startsWith('GET')), 'matching previews cause no writes');
  // Resuming after a throttled run: a captioned upload is kept, an uncaptioned leftover and old previews go,
  // and only the missing four upload.
  previews = [{id: 1, position: 0, caption: null}, {id: 7, position: 0, caption: null},
    {id: 8, position: 0, caption: {'en-US': shots[0].caption}}, {id: 2, position: 1, caption: null}];
  log.length = 0;
  assert.equal(await syncAmoPreviews(previewRequest, shots), 'updated');
  assert.equal(log.filter(l => l.startsWith('POST')).length, 4);
  assert.deepEqual(log.filter(l => l.startsWith('DELETE')).map(l => l.match(/(\d+)\/$/)[1]).sort(), ['1', '2', '7']);
  assert.ok(previews.some(p => p.id === 8));
  assert.deepEqual([...previews].sort((a, b) => a.position - b.position).map(p => p.caption['en-US']), shots.map(s => s.caption));

  // HTTP 429 is retried with Retry-After (seconds) or a growing fallback, and gives up after the limit.
  const waits = [];
  const responses = [{status: 429, headers: new Headers({'retry-after': '7'})}, {status: 429, headers: new Headers()}, {status: 200}];
  const ok = await retryThrottled(async () => responses.shift(), async ms => waits.push(ms));
  assert.equal(ok.status, 200);
  assert.deepEqual(waits, [7000, 30000]);
  let sends = 0;
  const throttled = await retryThrottled(async () => (sends++, {status: 429, headers: new Headers()}), async () => {}, 3);
  assert.equal(throttled.status, 429);
  assert.equal(sends, 3);
  console.log('AMO listing: Firefox translations, all-locale summary/description readback and ordered preview sync verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
