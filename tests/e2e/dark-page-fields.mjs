// Text fields on a page that is already dark (Bing's wallpaper home page, a
// misdetected sign-in page). A white search box or field there is a light
// island: it is repainted dark, so its typed text must be lightened with it.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { launchChrome, wait } from "../lab/browser.mjs";

const html = `<!doctype html><style>
  body{background:#1b1b1b;color:#eee;font:16px sans-serif;margin:0;padding:40px}
  .box{background:#fff;border-radius:24px;padding:8px 16px;width:520px;display:flex}
  .box input{background:transparent;border:0;color:#111;flex:1;font-size:16px;outline:0}
  .plain{background:#fff;color:#222;border:1px solid #bbb;padding:8px;width:320px;display:block;margin-top:24px}
  textarea.plain{height:60px}
  .plain::placeholder{color:#767676}
  </style><body><h1>Already dark page</h1>
  <form class="box"><input id="wrapped" type="search" value="typed search text" placeholder="Search the web"></form>
  <input id="email" class="plain" type="email" value="person@example.test" placeholder="Email address">
  <input id="password" class="plain" type="password" value="secret-value">
  <textarea id="note" class="plain">typed note</textarea>
  <select id="pick" class="plain"><option>First option</option><option>Second option</option></select>
  <label><input id="check" type="checkbox" checked> Remember me</label>
  <p id="copy">Body copy stays light.</p>
  <!-- Twitch uses a channel accent behind dark stream details and About panels. -->
  <div style="background:gold;padding:12px"><span id="highlight">Channel highlight</span>
    <div><section style="background:#0e0e10;padding:12px">
      <p id="title">Stream title</p><span id="uptime">1:23:45</span>
      <h3 id="about">About the channel</h3>
      <div style="background:#18181b;padding:12px"><p id="bio">Channel bio</p></div>
    </section></div>
  </div></body>`;

const browser = await launchChrome({onEvent(event) {
  if (event.method === "Fetch.requestPaused") browser.send("Fetch.fulfillRequest", {
    requestId:event.params.requestId, responseCode:200,
    responseHeaders:[{name:"Content-Type",value:"text/html"}],body:Buffer.from(html).toString("base64")
  },event.sessionId);
}});

const channels = value => {
  const srgb = value.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/);
  if (srgb) return srgb.slice(1, 4).map(Number);
  return value.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255);
};
const lum = value => {
  const [r, g, b] = channels(value).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);

try {
  const {id} = await browser.send("Extensions.loadUnpacked",{path:resolve(process.env.EXT_PATH || resolve(import.meta.dirname,"../.."))});
  const options = await browser.open(`chrome-extension://${id}/options.html`);
  const page = await browser.open();
  await browser.send("Fetch.enable",{patterns:[{urlPattern:"*"}]},page.sessionId);
  await page.go("https://dark-fields.example.test/");
  await wait(800);
  const probe = () => page.eval(`(() => {
    const painted = node => {
      for (let n = node; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    };
    const field = id => { const e = document.getElementById(id), cs = getComputedStyle(e);
      return {ink: cs.webkitTextFillColor, back: painted(e), placeholder: getComputedStyle(e, '::placeholder').color}; };
    return {mode: document.documentElement.getAttribute('data-oled-night-mode'),
      wrapped: field('wrapped'), email: field('email'), password: field('password'), note: field('note'), pick: field('pick'),
      check: getComputedStyle(document.getElementById('check')).accentColor,
      copy: {ink: getComputedStyle(document.getElementById('copy')).color, back: painted(document.getElementById('copy'))},
      channel: ['highlight', 'title', 'uptime', 'about', 'bio'].map(id => {
        const node = document.getElementById(id);
        return {id, ink: getComputedStyle(node).webkitTextFillColor, back: painted(node)};
      })};
  })()`);
  const state = await probe();
  assert.equal(state.mode, "crush", "The fixture must run in the already-dark page mode");
  for (const name of ["wrapped", "email", "password", "note", "pick"]) {
    const {ink, back, placeholder} = state[name];
    assert.ok(ratio(ink, back) >= 4.5, `${name}: typed text must reach 4.5:1, got ${ink} on ${back}`);
    if (name === "wrapped" || name === "email") assert.ok(ratio(placeholder, back) >= 3, `${name}: placeholder must reach 3:1, got ${placeholder} on ${back}`);
  }
  assert.ok(ratio(state.copy.ink, state.copy.back) >= 4.5, "Page copy stays readable");
  for (const {id, ink, back} of state.channel) {
    assert.ok(ratio(ink, back) >= 4.5, `Channel ${id} must reach 4.5:1, got ${ink} on ${back}`);
  }

  await options.eval("chrome.storage.sync.set({extensionEnabled:false})"); await wait(300);
  const restored = await probe();
  assert.equal(restored.wrapped.ink, "rgb(17, 17, 17)", "Disabling restores the authored field ink");
  assert.equal(restored.wrapped.back, "rgb(255, 255, 255)", "Disabling restores the white search box");
  console.log("Dark page fields test passed");
} finally {
  await browser.close();
}
