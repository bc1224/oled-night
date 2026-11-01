import {PNG} from 'pngjs';

export function instagramRadioProbe() {
  const ids = ['off', 'on', 'off-dot', 'on-dot', 'decorative', 'colored', 'product-dot'];
  const elements = Object.fromEntries(ids.map(id => {
    const e = document.getElementById(id), r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return [id, {x:r.x, y:r.y, w:r.width, h:r.height, checked:e.checked, background:s.backgroundColor,
      marker:e.style.getPropertyValue('--oln-bg'), focused:document.activeElement === e}];
  }));
  return {elements, viewportWidth:innerWidth, version:document.documentElement.getAttribute('data-oled-night-version'),
    mode:document.documentElement.getAttribute('data-oled-night-mode'), fixture:location.pathname.split('/').pop(),
    selected:document.querySelector('input[name="emails"]:checked').value};
}

export function instagramRadioPaint(bytes, probe, state, version, mode) {
  const png = PNG.sync.read(bytes), scale = png.width / probe.viewportWidth;
  const pixel = id => { const r = probe.elements[id], x = Math.floor((r.x+r.w/2)*scale), y = Math.floor((r.y+r.h/2)*scale);
    return [...png.data.subarray((y*png.width+x)*4, (y*png.width+x)*4+3)]; };
  const lum = c => c.map(v => {v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const selected = pixel(state), empty = pixel(state === 'off' ? 'on' : 'off'), a = lum(selected), b = lum(empty);
  const ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  return [
    {coverage:'identity', name:'sibling radio fixture and runtime match', ok:probe.version===version && probe.fixture==='instagram-radios.html' && probe.mode===mode, detail:JSON.stringify({version:probe.version,mode:probe.mode,expected:mode,fixture:probe.fixture})},
    {coverage:'selection', name:'selected sibling dot has at least 3:1 pixel contrast', ok:ratio>=3 && probe.selected===state, detail:JSON.stringify({selected,empty,ratio})},
    {coverage:'selection', name:'empty radio has no painted dot', ok:probe.elements[(state==='off'?'on':'off')+'-dot'].background==='rgba(0, 0, 0, 0)'},
    {coverage:'media', name:'colored radio and product swatch do not receive neutral marker paint', ok:Math.max(...pixel('colored'))-Math.min(...pixel('colored'))>30 && lum(pixel('product-dot'))<.1},
    {coverage:'surface', name:'unrelated circle does not become bright state ink', ok:lum(pixel('decorative'))<.1}
  ];
}

export function instagramRadioRestored() {
  return {coverage:'selection', name:'pause restores authored dot and preserves selected value',
    ok:document.querySelector('input[name="emails"]:checked').value==='on' &&
      getComputedStyle(document.getElementById('on-dot')).backgroundColor === (document.documentElement.classList.contains('light') ? 'rgb(17, 17, 17)' : 'rgb(250, 250, 250)') &&
      !document.getElementById('on-dot').hasAttribute('data-oled-night')};
}
