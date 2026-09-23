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

chrome.runtime.onInstalled.addListener(removeOpenShadowsScript);
chrome.runtime.onStartup.addListener(removeOpenShadowsScript);
