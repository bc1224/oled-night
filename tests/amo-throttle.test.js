// Mozilla Add-ons write limits, simulated as addons-server enforces them
// (src/olympia/api/throttling.py, DRF check_throttles):
//   - listing edits, screenshots and version creation share 3/minute, 10/hour and 24/day per account;
//   - package uploads have their own 6/minute, 20/hour and 48/day;
//   - only unsafe methods count;
//   - every limit is evaluated on every write, and each limit that does not refuse records the write,
//     so a refused write still uses up the limits that would have let it through;
//   - Retry-After is the longest wait among the limits that refused.
const assert = require('node:assert/strict');

const AMO_BASE = 'https://addons.mozilla.org/api/v5';
const MINUTE = 60e3, HOUR = 3600e3, DAY = 86400e3;
const SHARED = [['burst', 3, MINUTE], ['hourly', 10, HOUR], ['daily', 24, DAY]];
const UPLOAD = [['burst', 6, MINUTE], ['hourly', 20, HOUR], ['daily', 48, DAY]];

function fakeAmo({packageVersion = '0.6.82'} = {}) {
  let t = Date.UTC(2026, 10, 9, 23, 0, 0);
  const history = {shared: {burst: [], hourly: [], daily: []}, upload: {burst: [], hourly: [], daily: []}};
  const state = {listing: {description: {}, summary: {}}, policy: {privacy_policy: {}}, previews: [], versions: [], nextId: 100};
  const accepted = [], refused = [];
  const reply = (body, status = 200, headers = {}) => new Response(status === 204 ? null : JSON.stringify(body), {status, headers});
  const throttle = (group, limits) => {
    let waitMs = 0;
    for (const [name, limit, windowMs] of limits) {
      const recent = history[group][name] = history[group][name].filter(at => at > t - windowMs);
      if (recent.length >= limit) waitMs = Math.max(waitMs, recent[0] + windowMs - t);
      else recent.push(t);
    }
    return waitMs;
  };
  const addon = '/addons/addon/oled-night/';
  const handle = (method, path, options) => {
    if (path === addon && method === 'GET')
      return reply({...state.listing, previews: [...state.previews].sort((a, b) => a.position - b.position)});
    if (path === addon && method === 'PATCH') {
      for (const [field, values] of Object.entries(JSON.parse(options.body))) state.listing[field] = {...state.listing[field], ...values};
      return reply(state.listing);
    }
    if (path === `${addon}eula_policy/`) {
      if (method === 'PATCH') Object.assign(state.policy, JSON.parse(options.body));
      return reply(state.policy);
    }
    if (path === `${addon}previews/` && method === 'POST') {
      const preview = {id: state.nextId++, position: Number(options.body.get('position')), caption: null};
      state.previews.push(preview);
      return reply(preview, 201);
    }
    const previewId = Number(path.match(/previews\/(\d+)\/$/)?.[1]);
    if (previewId && method === 'PATCH') return reply(Object.assign(state.previews.find(p => p.id === previewId), JSON.parse(options.body)));
    if (previewId && method === 'DELETE') { state.previews = state.previews.filter(p => p.id !== previewId); return reply(null, 204); }
    if (path.startsWith(`${addon}versions/`) && method === 'GET') return reply({count: state.versions.length, results: state.versions.map(version => ({version}))});
    if (path === `${addon}versions/` && method === 'POST') { state.versions.unshift(packageVersion); return reply({version: packageVersion}, 201); }
    if (path.startsWith('/addons/upload/')) return reply({uuid: 'upload-1', processed: true, valid: true, version: packageVersion}, method === 'POST' ? 201 : 200);
    return reply({detail: 'Not found.'}, 404);
  };
  return {
    state, accepted, refused,
    now: () => t,
    wait: async ms => { t += ms; },
    // Fill one shared limit so its next free slot opens after `opensInMs`.
    saturate(name, opensInMs) {
      const [, limit, windowMs] = SHARED.find(([scope]) => scope === name);
      history.shared[name] = Array.from({length: limit}, (_, i) => t - windowMs + opensInMs + i);
    },
    fetch: async (url, options = {}) => {
      const path = String(url).slice(AMO_BASE.length), method = options.method || 'GET';
      if (method !== 'GET') {
        const upload = path.startsWith('/addons/upload/');
        const waitMs = throttle(upload ? 'upload' : 'shared', upload ? UPLOAD : SHARED);
        if (waitMs > 0) {
          refused.push({at: t, method, path});
          return reply({detail: 'Request was throttled.'}, 429, {'retry-after': String(Math.ceil(waitMs / 1000))});
        }
        accepted.push({at: t, method, path, shared: !upload});
      }
      return handle(method, path, options);
    }
  };
}

(async () => {
  const {createAmoRequest, AmoThrottled, updateAmoListing, submitAmoVersion, submitAmoRelease} = await import('../tools/submit-stores.mjs');
  const client = (amo, minutes) => createAmoRequest({
    fetchImpl: amo.fetch, wait: amo.wait, now: amo.now, budgetMs: minutes * MINUTE, token: () => 'test-token', log: () => {}
  });
  const versions = '/addons/addon/oled-night/versions/';

  // The reported failure: the daily limit is used up and Mozilla says to come back in three hours.
  // The run must stop after that one refusal and say when to retry, not resend into the block.
  {
    const amo = fakeAmo();
    amo.saturate('daily', 3 * HOUR);
    const started = amo.now();
    const error = await client(amo, 75)(versions, {method: 'POST'}).then(() => null, e => e);
    assert.ok(error instanceof AmoThrottled, 'a block longer than the wait allowance ends the run as throttled');
    assert.equal(amo.refused.length, 1, 'no resends into a block that outlasts the allowance');
    assert.equal(error.retryAt, started + 3 * HOUR, 'the error carries the moment Mozilla accepts writes again');
    assert.match(error.message, /2026-11-10 02:00 UTC/);
    assert.equal(amo.now(), started, 'no time is spent waiting on a block the run cannot outlast');
  }
  // A block the run can outlast (hourly limit, next slot in 20 minutes) is waited out in full, once.
  {
    const amo = fakeAmo();
    amo.saturate('hourly', 20 * MINUTE);
    const started = amo.now();
    const created = await client(amo, 75)(versions, {method: 'POST'});
    assert.equal(created.version, '0.6.82');
    assert.equal(amo.refused.length, 1, 'one refusal, then one accepted write');
    assert.ok(amo.accepted[0].at >= started + 20 * MINUTE, 'the resend waits for the whole Retry-After');
    assert.ok(amo.accepted[0].at <= started + 21 * MINUTE);
  }
  // The allowance covers the whole run: a later block that would exceed what is left stops it.
  {
    const amo = fakeAmo();
    amo.saturate('hourly', 50 * MINUTE);
    const request = client(amo, 75);
    await request(versions, {method: 'POST'});
    amo.saturate('hourly', 40 * MINUTE);
    await assert.rejects(request(versions, {method: 'POST'}), AmoThrottled);
    assert.equal(amo.refused.length, 2);
  }
  // Writes are spaced so the 3-per-minute limit never refuses one: a refusal there would still
  // use up an hourly and a daily slot.
  {
    const amo = fakeAmo();
    const request = client(amo, 75);
    for (let i = 0; i < 6; i++) await request('/addons/addon/oled-night/', {method: 'PATCH', body: '{}'});
    assert.equal(amo.refused.length, 0, 'six writes in a row are never refused');
    assert.equal(amo.accepted.length, 6);
    await request('/addons/addon/oled-night/');
    await request('/addons/addon/oled-night/');
    assert.ok(amo.now() - amo.accepted[5].at < 1000, 'reads are not slowed down');
  }
  // A listing that already matches the repository costs no writes; a changed part costs one.
  {
    const amo = fakeAmo();
    const request = client(amo, 75);
    const copy = {summary: {'en-US': 'Summary', de: 'Kurz'}, translations: {de: 'Beschreibung'}};
    assert.equal(await updateAmoListing(request, 'Description', 'Privacy', copy), 'updated');
    assert.equal(amo.accepted.length, 2);
    assert.equal(await updateAmoListing(request, 'Description', 'Privacy', copy), 'unchanged');
    assert.equal(amo.accepted.length, 2, 'an unchanged listing sends no PATCH');
    assert.equal(await updateAmoListing(request, 'Description', 'New privacy', copy), 'updated');
    assert.deepEqual(amo.accepted.slice(2).map(w => w.path), ['/addons/addon/oled-night/eula_policy/']);
    assert.equal(amo.state.policy.privacy_policy['en-US'], 'New privacy');
  }
  const pkg = {version: '0.6.82', firefox: () => Buffer.from('zip'), source: () => Buffer.from('source')};
  const assets = {
    description: 'Description', privacy: 'Privacy', summary: {'en-US': 'Summary'}, translations: {de: 'Beschreibung'},
    screenshots: ['one', 'two', 'three', 'four', 'five'].map(name => ({path: `store/images/${name}.png`, caption: `Caption ${name}`, read: () => Buffer.from(name)}))
  };
  const inSync = amo => {
    amo.state.listing = {description: {'en-US': assets.description, ...assets.translations}, summary: {...assets.summary}};
    amo.state.policy = {privacy_policy: {'en-US': assets.privacy}};
    amo.state.previews = assets.screenshots.map((shot, position) => ({id: position + 1, position, caption: {'en-US': shot.caption}}));
  };
  const sharedWrites = amo => amo.accepted.filter(write => write.shared);

  // A version Mozilla already has is not uploaded or submitted again, so a rerun after a partial run is safe.
  {
    const amo = fakeAmo();
    const request = client(amo, 75);
    assert.equal(await submitAmoVersion(request, pkg), 'submitted');
    assert.deepEqual(amo.state.versions, ['0.6.82']);
    const writes = amo.accepted.length;
    assert.equal(await submitAmoVersion(request, pkg), 'exists');
    assert.equal(amo.accepted.length, writes, 'a rerun sends no upload and no version');
  }
  // An ordinary release, listing and screenshots already in place, uses one of the 24 daily writes.
  {
    const amo = fakeAmo();
    inSync(amo);
    await submitAmoRelease(client(amo, 75), pkg, assets, () => {});
    assert.deepEqual(sharedWrites(amo).map(w => `${w.method} ${w.path}`), ['POST /addons/addon/oled-night/versions/']);
    assert.equal(amo.refused.length, 0);
  }
  // The state the failed runs left behind: no 0.6.82, three uncaptioned screenshots and one with an old caption.
  const leftBehind = amo => {
    inSync(amo);
    amo.state.previews = [{id: 1, position: 0, caption: null}, {id: 2, position: 0, caption: null},
      {id: 3, position: 0, caption: {'en-US': 'An old caption'}}, {id: 4, position: 1, caption: null}];
  };
  const recovered = amo => {
    assert.deepEqual(amo.state.versions, ['0.6.82']);
    assert.deepEqual([...amo.state.previews].sort((a, b) => a.position - b.position).map(p => p.caption?.['en-US']), assets.screenshots.map(s => s.caption));
  };
  // With the limits free, one run submits the version first, then repairs the screenshots. The repair
  // needs more than ten writes, so the hourly limit refuses once and the run waits that out by itself.
  {
    const amo = fakeAmo();
    leftBehind(amo);
    await submitAmoRelease(client(amo, 75), pkg, assets, () => {});
    recovered(amo);
    assert.equal(sharedWrites(amo)[0].path, '/addons/addon/oled-night/versions/', 'the version is the first shared write');
    assert.equal(amo.refused.length, 1);
  }
  // With the daily limit used up for three more hours, the default allowance stops at the first refusal...
  {
    const amo = fakeAmo();
    leftBehind(amo);
    amo.saturate('daily', 3 * HOUR);
    await assert.rejects(submitAmoRelease(client(amo, 75), pkg, assets, () => {}), AmoThrottled);
    assert.equal(amo.refused.length, 1);
    assert.deepEqual(amo.state.versions, []);
  }
  // ...and a run given a long allowance sleeps through it and finishes the whole release unattended.
  {
    const amo = fakeAmo();
    leftBehind(amo);
    amo.saturate('daily', 3 * HOUR);
    await submitAmoRelease(client(amo, 330), pkg, assets, () => {});
    recovered(amo);
    assert.ok(amo.refused.length <= 2, 'at most one refusal per limit that was in the way');
  }
  console.log('AMO write limits: long blocks stop the run with the retry time; short blocks are waited out once; writes are paced; unchanged listings and existing versions cost nothing; a throttled release recovers in one run.');
})().catch(error => { console.error(error); process.exitCode = 1; });
