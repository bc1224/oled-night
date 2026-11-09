(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;
  const $ = (id) => document.getElementById(id);
  const message = (key) => { try { return chrome.i18n.getMessage(key); } catch { return ""; } };

  // English text is in the page; translated messages replace it when available.
  try { document.documentElement.lang = chrome.i18n.getUILanguage(); } catch {}
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const text = message(node.dataset.i18n);
    if (text) node.textContent = text;
  }
  const title = message("welcomeTitle");
  if (title) document.title = title;

  const isFirefox = (() => { try { return chrome.runtime.getURL("").startsWith("moz-extension://"); } catch { return false; } })();
  // The companion theme exists for Chrome only.
  $("theme").hidden = isFirefox;
  $("openSettings").addEventListener("click", () => { try { chrome.runtime.openOptionsPage(); } catch {} });

  (async () => {
    try {
      const commands = await chrome.commands.getAll();
      const assigned = (name) => commands.filter((c) => c.name === name || c.name === name + "-backup").map((c) => c.shortcut).filter(Boolean).join(" / ");
      const unset = message("shortcutUnset") || "Not set";
      $("extensionShortcut").textContent = assigned("toggle-extension") || unset;
      $("siteShortcut").textContent = assigned("toggle-site") || unset;
    } catch {}
  })();
})();
