if (typeof importScripts === "function") importScripts("settings.js");
const chrome = globalThis.browser || globalThis.chrome;

const Settings = globalThis.OledNightSettings;
const OPEN_SHADOWS_ID = "oled-night-open-shadows";

async function load() {
  return Settings.normalize(await chrome.storage.sync.get(Settings.DEFAULTS));
}

// Alt+Shift+D: flip the current site between on and off.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-site") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  // Websites only: browser pages (chrome://extensions) are not sites and can't be changed.
  try { const url = new URL(tab?.url || ""); if (/^https?:$/.test(url.protocol)) host = url.hostname; } catch {}
  if (!host) return;
  const config = await load();
  const siteRules = { ...config.siteRules };
  if (Settings.isEnabled(config, host)) siteRules[host] = "off";
  else if (siteRules[host] === "off" && Settings.isEnabled({ ...config, siteRules: { ...siteRules, [host]: "global" } }, host)) delete siteRules[host];
  else siteRules[host] = "on";
  await chrome.storage.sync.set({ siteRules });
});

// Experimental: closed web components are unreachable from an extension, so
// when enabled, a page-world script opens them as they are created.
async function syncOpenShadows() {
  const { openClosedShadows } = await load();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [OPEN_SHADOWS_ID] });
  if (openClosedShadows && !existing.length) {
    await chrome.scripting.registerContentScripts([{
      id: OPEN_SHADOWS_ID, js: ["shadow-open.js"], matches: ["<all_urls>"],
      runAt: "document_start", allFrames: true, world: "MAIN", persistAcrossSessions: true
    }]);
  } else if (!openClosedShadows && existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [OPEN_SHADOWS_ID] });
  }
}

chrome.runtime.onInstalled.addListener(syncOpenShadows);
chrome.runtime.onStartup.addListener(syncOpenShadows);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "openClosedShadows" in changes) syncOpenShadows();
});
