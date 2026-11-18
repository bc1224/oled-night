if (typeof importScripts === "function") importScripts("settings.js");
const chrome = globalThis.browser || globalThis.chrome;

const Settings = globalThis.OledNightSettings;
const OPEN_SHADOWS_ID = "oled-night-open-shadows";

async function load() {
  return Settings.normalize(await chrome.storage.sync.get(Settings.DEFAULTS));
}

// The master command works from any tab, including browser-owned pages.
async function handleCommand(command) {
  if (command === "toggle-extension" || command === "toggle-extension-backup") {
    const config = await load();
    await chrome.storage.sync.set({ extensionEnabled: !config.extensionEnabled });
    return;
  }
  if (command !== "toggle-site" && command !== "toggle-site-backup") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  // Websites only: browser pages (chrome://extensions) are not sites and can't be changed.
  try { const url = new URL(tab?.url || ""); if (/^https?:$/.test(url.protocol)) host = url.hostname; } catch {}
  if (!host) return;
  const config = await load();
  // A site command must not silently rewrite saved rules while paused everywhere.
  if (!config.extensionEnabled) return;
  const siteRules = { ...config.siteRules };
  if (Settings.isEnabled(config, host)) siteRules[host] = "off";
  else if (siteRules[host] === "off" && Settings.isEnabled({ ...config, siteRules: { ...siteRules, [host]: "global" } }, host)) delete siteRules[host];
  else siteRules[host] = "on";
  await chrome.storage.sync.set({ siteRules });
}

// Serialize rapid shortcut presses so each one sees the previous saved state.
let commandQueue = Promise.resolve();
function queueCommand(command) {
  commandQueue = commandQueue.then(() => handleCommand(command)).catch(() => {
    console.warn("OLED Night could not save the keyboard shortcut change.");
  });
  return commandQueue;
}
chrome.commands.onCommand.addListener(queueCommand);

// Advertise the last confirmed dark chat color before the next document
// paints. The registration passes the color into our isolated content script.
const chatStartupId = "oled-night-chat-startup";
let chatStartupUpdates = Promise.resolve();
async function updateChatStartup() {
  const [config, saved, [existing]] = await Promise.all([
    load(), chrome.storage.local.get("oledChatDark"),
    chrome.scripting.getRegisteredContentScripts({ids: [chatStartupId]})
  ]);
  // A schedule can expire with the worker asleep. Scheduled pages use the
  // content script's current-time check before applying any startup color.
  const hosts = ["chatgpt.com", "www.chatgpt.com", "chat.openai.com"];
  const matches = saved.oledChatDark && !config.schedule.enabled ? hosts
    .filter(host => Settings.isEnabled(config, host) && Settings.siteMode(config, host) !== "invert")
    .map(host => `https://${host}/*`) : [];
  if (!matches.length) {
    if (existing) await chrome.scripting.unregisterContentScripts({ids: [chatStartupId]});
    return;
  }
  const js = [`chat-startup-${config.appearance}.js`];
  const registration = {id:chatStartupId, matches, js, runAt:"document_start"};
  if (!existing) await chrome.scripting.registerContentScripts([registration]);
  else if (existing.js?.[0] !== js[0] || existing.matches?.slice().sort().join() !== matches.slice().sort().join())
    await chrome.scripting.updateContentScripts([registration]);
}
function queueChatStartup() {
  chatStartupUpdates = chatStartupUpdates.then(updateChatStartup).catch(() => {
    console.warn("OLED Night could not update the saved ChatGPT startup color.");
  });
  return chatStartupUpdates;
}
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "local" && changes.oledChatDark) || (area === "sync" &&
      ["extensionEnabled","globalEnabled","appearance","schedule","siteRules"].some(key => changes[key]))) return queueChatStartup();
});
chrome.runtime.onInstalled.addListener(queueChatStartup);
chrome.runtime.onStartup.addListener(queueChatStartup);

// Up to 0.6.14 the experimental closed-component option registered a page-world
// script that replaced Element.prototype.attachShadow. Bot checks such as
// Cloudflare Turnstile treat that as tampering, so content.js now reads closed
// roots through the extension API instead; remove any leftover registration.
async function removeOpenShadowsScript() {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [OPEN_SHADOWS_ID] });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [OPEN_SHADOWS_ID] });
  } catch {}
}

// First install opens a short welcome page. Unpacked development copies skip it so
// test browsers and local reloads don't gain an extra tab. installedAt (local only,
// never synced or sent) lets the popup wait before its one optional rating link;
// existing users start counting from their first update to this version.
async function handleInstalled(details) {
  removeOpenShadowsScript();
  try {
    const { installedAt } = await chrome.storage.local.get("installedAt");
    if (!installedAt) await chrome.storage.local.set({ installedAt: Date.now() });
  } catch {}
  if (details?.reason !== "install") return;
  try {
    const self = await chrome.management.getSelf();
    if (self.installType === "development") return;
  } catch {}
  try { await chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }); } catch {}
}

chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onStartup.addListener(removeOpenShadowsScript);
