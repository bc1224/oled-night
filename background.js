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
