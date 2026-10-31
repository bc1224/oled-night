import assert from "node:assert/strict";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { launchChrome, wait } from "../lab/browser.mjs";

// Serve synthetic documents on the real origins so the extension's frame
// guard, native palette, and Chromium's iframe canvas all participate.
const watch = `<!doctype html><style>
  body { margin: 0; background: black } iframe { display: block; border: 0; width: 300px; height: 120px }
  </style><iframe id="live" src="/live_chat"></iframe>
  <iframe id="replay" hidden style="display:none" src="/live_chat_replay?continuation=test"></iframe>
  <iframe id="player" src="/embed/test?next=/live_chat"></iframe>`;
function chat(replay) {
  return `<!doctype html><html ${replay ? "dark" : ""}><style>
    :root { --yt-live-chat-primary-text-color: #111; --yt-live-chat-secondary-text-color: #555 }
    html[dark] { --yt-live-chat-primary-text-color: #fff; --yt-live-chat-secondary-text-color: #aaa }
    yt-live-chat-app { display: block; min-height: 100vh }
    yt-live-chat-renderer { color: var(--yt-live-chat-primary-text-color) }
    #author-name { color: var(--yt-live-chat-secondary-text-color) }
    #badge { background: #fbc02d; color: #111 }
    </style><yt-live-chat-app><yt-live-chat-renderer><span id="author-name">Author</span>
    <span id="message">Message</span><span id="badge">Owner</span></yt-live-chat-renderer></yt-live-chat-app>`;
}

const browser = await launchChrome({onEvent(event) {
  if (event.method !== "Fetch.requestPaused") return;
  const path = new URL(event.params.request.url).pathname;
  const html = path === "/watch" ? watch : path.startsWith("/live_chat") ? chat(path === "/live_chat_replay") : "<video></video>";
  browser.send("Fetch.fulfillRequest", {
    requestId: event.params.requestId, responseCode: 200,
    responseHeaders: [{name: "Content-Type", value: "text/html"}],
    body: Buffer.from(html).toString("base64")
  }, event.sessionId);
}});
try {
  const path = resolve(process.env.EXT_PATH || resolve(import.meta.dirname, "../.."));
  const {id} = await browser.send("Extensions.loadUnpacked", {path});
  const options = await browser.open(`chrome-extension://${id}/options.html`);
  const page = await browser.open();
  await browser.send("Fetch.enable", {patterns: [{urlPattern: "*"}]}, page.sessionId);
  await options.eval("chrome.storage.sync.set({extensionEnabled:true,globalEnabled:true,appearance:'oled',brightness:88})");
  await page.go("https://www.youtube.com/watch?v=fixture");
  await page.eval("document.getElementById('replay').style.display='block'");
  const state = id => page.eval(`(() => {
    const doc = document.getElementById(${JSON.stringify(id)}).contentDocument;
    const style = selector => doc.defaultView.getComputedStyle(doc.querySelector(selector));
    return {message: style('#message').color, author: style('#author-name').color,
      badge: style('#badge').backgroundColor, dark: doc.documentElement.hasAttribute('dark')};
  })()`);
  const screenshot = PNG.sync.read(await page.screenshot());
  for (const [id, y] of [["live", 90], ["replay", 210]]) {
    const offset = (y * screenshot.width + 180) * 4;
    assert.deepEqual([...screenshot.data.subarray(offset, offset + 3)], [0, 0, 0], `${id} chat canvas should be OLED black`);
    assert.deepEqual(await state(id), {message: "rgb(224, 224, 224)", author: "rgb(179, 179, 179)",
      badge: "rgb(251, 192, 45)", dark: id === "replay"}, `${id} chat palette`);
  }
  assert.equal(await page.eval("document.getElementById('player').contentDocument.querySelector('[data-oled-night-root],#oled-night-sheet') === null"), true);
  await options.eval("chrome.storage.sync.set({extensionEnabled:false})");
  await wait(300);
  assert.equal((await state("live")).message, "rgb(17, 17, 17)");
  assert.equal((await state("replay")).message, "rgb(255, 255, 255)");
  assert.deepEqual(browser.errors, []);
  console.log("PASS YouTube live and replay chat pixels, text, badges, hidden-frame startup, player exclusion and pause");
} finally {
  await browser.close();
}
