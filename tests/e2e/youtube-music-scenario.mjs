// Duplicate internal #content IDs are native YouTube Music markup. The page
// canvas must darken without turning transparent artwork overlays into slabs.
export async function youtubeMusicScenario({page, ext, site, send, setSettings, resetSettings, check, sleep}) {
  await setSettings({extensionEnabled:false});
  const url=site('127.0.0.1','youtube-music.html');
  await page.go(url);
  await ext.eval(`(async()=>{const [t]=await chrome.tabs.query({url:${JSON.stringify(url)}});await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>{globalThis.OledNightColors.usesNativeSafeMode=()=>true;}});})()`);
  await setSettings({extensionEnabled:true});
  await sleep(350);
  const state=()=>page.eval(`(()=>{
    const art=document.querySelector('#artwork'),img=art.querySelector('img'),overlay=art.querySelector('ytmusic-item-thumbnail-overlay-renderer > #content');
    return {active:document.documentElement.hasAttribute('data-oled-night-youtube'),canvas:getComputedStyle(document.querySelector('ytmusic-app-layout > #content')).backgroundColor,
      overlay:getComputedStyle(overlay).backgroundColor,imageLoaded:img.complete&&img.naturalWidth===480,imageFilter:getComputedStyle(img).filter,
      hoverOpacity:getComputedStyle(art.querySelector('ytmusic-background-overlay-renderer')).opacity,
      transparentOverlays:[...document.querySelectorAll('ytmusic-item-thumbnail-overlay-renderer > #content')].every(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)')};
  })()`);
  let s=await state();
  check('YouTube Music: page canvas remains OLED black',s.active&&s.canvas==='rgb(0, 0, 0)',JSON.stringify(s));
  check('YouTube Music: loaded artwork is not covered by an opaque content overlay',s.imageLoaded&&s.imageFilter==='none'&&s.transparentOverlays,JSON.stringify(s));
  const point=await page.eval(`(()=>{const r=document.getElementById('artwork').getBoundingClientRect();return {x:r.x+10,y:r.y+10};})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point},page.sessionId);
  s=await state();
  check('YouTube Music: native hover shade remains visible over transparent content',s.hoverOpacity==='1'&&s.transparentOverlays,JSON.stringify(s));
  await page.eval(`(()=>{const item=document.querySelector('ytmusic-two-row-item-renderer').cloneNode(true);item.querySelector('#artwork').removeAttribute('id');document.getElementById('items').append(item);})()`);
  s=await state();
  check('YouTube Music: delayed thumbnails also retain transparent overlays',s.transparentOverlays,JSON.stringify(s));
  await setSettings({extensionEnabled:false});await sleep(250);
  s=await state();
  check('YouTube Music: pause restores the native canvas and preserves artwork',!s.active&&s.canvas==='rgb(19, 19, 19)'&&s.transparentOverlays&&s.imageLoaded&&s.imageFilter==='none',JSON.stringify(s));
  await resetSettings();
}
