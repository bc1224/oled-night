(function(scope) {
  'use strict';
  const pick = (value, allowed) => allowed.includes(value) ? value : 'unknown';
  const number = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
  const color = value => typeof value === 'string' && /^rgba?\([\d.,% /]+\)$/.test(value) && value.length <= 70 ? value : undefined;
  function scrub(raw = {}) {
    const host = typeof raw.host === 'string' && raw.host.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(raw.host) && !/\.(local|internal|localhost)$/i.test(raw.host) ? raw.host.toLowerCase() : '';
    return {
      schema: 'oled-report-v1', host,
      version: /^\d+\.\d+\.\d+$/.test(raw.version || '') ? raw.version : 'unknown',
      active: raw.active === true,
      siteMode: pick(raw.siteMode, ['auto','on','off','recolor','deepen','invert']),
      mode: pick(raw.mode, ['oled','crush','invert','off']),
      darkPage: raw.darkPage === true,
      pageColor: pick(raw.pageColor, ['originally-light','originally-dark','native-dark','unknown']),
      settings: {brightness:number(raw.settings?.brightness,100),contrast:number(raw.settings?.contrast,100),dimImages:raw.settings?.dimImages === true},
      counts: {styled:number(raw.counts?.styled,1000000),shadowRoots:number(raw.counts?.shadowRoots,100000),frames:number(raw.counts?.frames,100000)},
      lowContrast: (Array.isArray(raw.lowContrast) ? raw.lowContrast : []).slice(0,12).map(row => ({color:color(row?.color),background:color(row?.background),ratio:number(row?.ratio,21)})),
      lowContrastGraphics: (Array.isArray(raw.lowContrastGraphics) ? raw.lowContrastGraphics : []).slice(0,12).map(row => ({ratio:number(row?.ratio,21)}))
    };
  }
  function issueUrl() {
    // Retained for callers of the old draft helper. Never put report contents
    // into a GitHub draft or URL. The popup is the private intake.
    return 'https://bc1224.github.io/oled-night/#report-a-problem';
  }
  async function openDraft(report, {requestConsent,openTab}) {
    // Invoke the consent request directly in the user gesture. Denial or a
    // failed request cannot open a tab carrying diagnostics.
    if (requestConsent && !await requestConsent()) return false;
    await openTab({url:issueUrl(report)});
    return true;
  }
  function createDraftSession(report, {requestConsent,openTab}) {
    // Cancellation during native consent must not open a tab. Legacy callers
    // receive private-intake instructions without putting diagnostics in a URL.
    const clean = scrub(report);
    let cancelled = false, busy = false, opened = false;
    return {
      cancel() { cancelled = true; },
      async send() {
        if (cancelled || busy || opened) return false;
        busy = true;
        try {
          if (requestConsent && !await requestConsent()) return false;
          if (cancelled) return false;
          await openTab({url:issueUrl(clean)});
          opened = true;
          return true;
        } finally { busy = false; }
      }
    };
  }
  function scrubScreenshot(raw) {
    if (raw == null) return null;
    if (!['image/png','image/jpeg'].includes(raw.type) || typeof raw.data !== 'string' || raw.data.length > 546136 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.data)) throw Error('Use a PNG or JPEG screenshot under 400 KB.');
    let bytes;try { bytes=atob(raw.data); } catch { throw Error('Invalid screenshot.'); }
    if (bytes.length > 409600 || (raw.type === 'image/png' ? !bytes.startsWith('\x89PNG\r\n\x1a\n') : !bytes.startsWith('\xff\xd8\xff'))) throw Error('Invalid screenshot.');
    return {type:raw.type,data:raw.data};
  }
  async function prepareScreenshot(file) {
    if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10*1024*1024) throw Error('Choose a PNG, JPEG or WebP image under 10 MB.');
    const bitmap=await createImageBitmap(file);
    try {
      const scale=Math.min(1,1600/bitmap.width,1600/bitmap.height),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      // Re-encoding drops file metadata; no filename or source file is shared.
      let url=canvas.toDataURL('image/png');
      if (url.length > 546160) url=canvas.toDataURL('image/jpeg',.8);
      const match=url.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
      if (!match) throw Error('Could not prepare screenshot.');
      return scrubScreenshot({type:match[1],data:match[2]});
    } finally { bitmap.close(); }
  }
  function createSubmissionSession(report, {requestConsent,submit}) {
    const clean = scrub(report), requestId = crypto.randomUUID();
    let cancelled = false, busy = false, sent = false, payload;
    return {
      cancel() { cancelled = true; },
      async send(description = '', screenshot = null) {
        if (cancelled || busy || sent) return false;
        busy = true;
        try {
          if (requestConsent && !await requestConsent()) return false;
          if (cancelled) return false;
          payload ||= {requestId,report:clean,description:String(description).trim().slice(0,2000),...(screenshot ? {screenshot:scrubScreenshot(screenshot)} : {})};
          const receipt = await submit(payload);
          if (!/^https:\/\/github\.com\/bc1224\/oled-night\/issues\/[1-9]\d*$/.test(receipt?.url || '')) throw Error('Invalid issue receipt');
          sent = true;
          return receipt;
        } finally { busy = false; }
      }
    };
  }
  async function submitIssue(payload) {
    const response = await fetch('https://oled-night-reporter.bcf1224.workers.dev/v1/issues', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
      credentials:'omit', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(20000)
    });
    if (response.status === 429) throw Error('Report limit reached. Please try tomorrow or save the report locally.');
    if (response.status === 409) throw Error('This report may already have reached GitHub. Check the issue list before sending a new report.');
    if (!response.ok) throw Error('Could not submit the issue. Retry or save the report locally.');
    return response.json();
  }
  scope.OledNightReport = {scrub,issueUrl,openDraft,createDraftSession,createSubmissionSession,submitIssue,scrubScreenshot,prepareScreenshot};
})(globalThis);
