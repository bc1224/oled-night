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
  function issueUrl(report) {
    const clean = scrub(report);
    const url = new URL('https://github.com/bc1224/oled-night/issues/new');
    url.searchParams.set('title', 'Broken site: ' + (clean.host || 'site omitted'));
    url.searchParams.set('labels','oled-report');
    url.searchParams.set('template','broken-site.md');
    url.searchParams.set('body', 'What broke? Describe the affected controls and how to reproduce it. Please remove personal information before submitting.\n\nPublic diagnostics (no page text, field values, URL paths or screenshots):\n' + '```json\n' + JSON.stringify(clean,null,2) + '\n```');
    return url.href;
  }
  scope.OledNightReport = {scrub,issueUrl};
})(globalThis);
