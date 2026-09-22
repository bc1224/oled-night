(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;
  const Settings = globalThis.OledNightSettings;
  const $ = (id) => document.getElementById(id);
  const hasChrome = () => !!chrome?.storage;
  const isFirefox = (() => { try { return chrome.runtime.getURL("").startsWith("moz-extension://"); } catch { return false; } })();
  let host = "";
  let tabId = null;
  let settings = Settings.normalize();
  let persistTimer = null;
  // What the tab reported: null while unknown, { active, mode } when it answered,
  // "reload" when it can run scripts but OLED Night isn't connected (tab opened
  // before an update), "blocked" when the browser forbids extensions there.
  let page = null;

  const ACTIVE = {
    oled: "On · recoloring this page",
    soft: "On · recoloring this page (Soft Dark)",
    crush: "On · page was already dark, so only its greys turn black",
    none: "On · page is already dark and left as is",
    invert: "On · page inverted",
    native: "Figma keeps its own colors"
  };
  const HOLD_COLORS = {
    crush: "Brightness and contrast only apply in full recolor.",
    none: "Brightness and contrast only apply in full recolor.",
    invert: "Inverted pages don't use brightness or contrast."
  };

  const siteMode = () => Settings.siteMode(settings, host);
  const figma = () => Settings.prefersNativeColors(host);
  const followsDefault = () => settings.globalEnabled && !figma();
  const siteOn = () => { const mode = siteMode(); return mode !== "off" && (mode !== "global" || followsDefault()); };
  function prefersDark() {
    try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return true; }
  }

  // Why settings keep this site off right now, or null when they turn it on.
  function offReason() {
    const mode = siteMode();
    if (mode === "off") return "Off on this site";
    if (mode === "global" && figma()) return "Off by default on Figma to keep design colors exact";
    if (mode === "global" && !settings.globalEnabled) return "Off · All sites is off below";
    if (!Settings.inSchedule(settings.schedule)) return `Off until ${settings.schedule.start} (schedule in Settings)`;
    if (settings.appearance === "auto" && !prefersDark()) return "Off while your system is in light mode";
    return null;
  }

  function statusText() {
    if (!host) return "Extensions can't change this page";
    if (page === "blocked") return "Your browser doesn't let extensions change this page";
    const off = offReason();
    if (off) return off;
    if (page === "reload") return "Reload this tab to apply OLED Night";
    if (page?.active) return ACTIVE[page.mode] || "On";
    return page ? "Waiting for the page to load" : "";
  }

  // The mode the page is (or will be) drawn in: the page's report when it has
  // one, otherwise what the site setting forces.
  function effectiveMode() {
    if (page?.active) return page.mode;
    return { recolor: "oled", deepen: "crush", invert: "invert" }[siteMode()] || null;
  }

  function render() {
    const tuning = Settings.tuningFor(settings, host);
    const mode = siteMode();
    $("globalEnabled").checked = settings.globalEnabled;
    $("globalHelp").textContent = `${settings.globalEnabled ? "On" : "Off"} for every site you haven't set yourself`;
    $("siteEnabled").checked = siteOn();
    $("siteEnabled").disabled = !host || page === "blocked";
    $("siteRule").value = ["recolor", "deepen", "invert"].includes(mode) ? mode : "auto";
    for (const key of ["brightness", "contrast"]) { $(key).value = tuning[key]; $(`${key}Value`).value = `${tuning[key]}%`; }
    $("dimImages").checked = !!tuning.dimImages;
    $("status").textContent = statusText();
    $("reloadTab").hidden = statusText() !== "Reload this tab to apply OLED Night";
    // Site controls only when they can affect this page.
    $("siteControls").hidden = !host || page === "blocked" || page === "reload" || !siteOn() || figma();
    const holds = HOLD_COLORS[effectiveMode()];
    $("siteTuning").hidden = !!holds;
    $("useRecolor").hidden = !holds || effectiveMode() === "invert";
    $("tuningHelp").textContent = holds || (tuning.custom ? "This site has its own values." : "Moving a slider changes only this site.");
    $("resetSite").hidden = !host || !(Object.hasOwn(settings.siteRules, host) || Object.hasOwn(settings.siteTuning, host));
  }

  async function refreshStatus() {
    if (tabId && host && chrome?.tabs) {
      let reply = null;
      try { reply = await chrome.tabs.sendMessage(tabId, { type: "oled-night-status" }); } catch {}
      page = reply || await probe();
    }
    render();
  }

  // No answer: the tab either predates this copy of OLED Night (a reload
  // connects it) or is a page where the browser blocks extensions.
  async function probe() {
    try { await chrome.scripting.executeScript({ target: { tabId }, func: () => true }); return "reload"; } catch { return "blocked"; }
  }

  function write(patch) {
    if (hasChrome()) return chrome.storage.sync.set(patch);
  }

  function persist(patch) {
    settings = Settings.normalize({ ...settings, ...patch });
    clearTimeout(persistTimer);
    pendingPatch = { ...pendingPatch, ...patch };
    flushPreview();
    render();
    setTimeout(refreshStatus, 250);
  }

  function setSiteRule(rule) {
    const siteRules = { ...settings.siteRules };
    if (rule === null) delete siteRules[host]; else siteRules[host] = rule;
    persist({ siteRules });
  }

  // Every site slider writes only that site's override. Global controls never erase it.
  function tuningPatch(key, value) {
    return { siteTuning: { ...settings.siteTuning, [host]: { ...settings.siteTuning[host], [key]: value } } };
  }
  let pendingPatch = {};
  let saveQueue = Promise.resolve();
  function flushPreview() {
    clearTimeout(persistTimer);
    const patch = pendingPatch;
    pendingPatch = {};
    saveQueue = saveQueue.then(() => write(patch)).catch(() => { $("status").textContent = "Could not save. Please try again."; });
    return saveQueue;
  }
  async function preview(patch, persistNow = false) {
    settings = Settings.normalize({ ...settings, ...patch });
    pendingPatch = { ...pendingPatch, ...patch };
    render();
    if (!hasChrome()) return;
    if (tabId) chrome.tabs.sendMessage(tabId, { type: "oled-night-preview", patch }).catch(() => {});
    clearTimeout(persistTimer);
    if (persistNow) return flushPreview();
    persistTimer = setTimeout(flushPreview, 120);
  }

  function saveReport(report) {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `oled-night-report-${report.host || "page"}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  async function init() {
    try { $("version").textContent = `v${chrome.runtime.getManifest().version}`; } catch {}
    // The companion theme exists for Chrome only.
    $("theme").hidden = isFirefox;
    if (!hasChrome() || !chrome?.tabs) {
      host = "example.com";
      $("hostname").textContent = host;
      render();
      return;
    }
    settings = Settings.normalize(await chrome.storage.sync.get(Settings.DEFAULTS));
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id ?? null;
    try { const url = new URL(tab.url); host = /^https?:$/.test(url.protocol) ? url.hostname : ""; } catch { host = ""; }
    $("hostname").textContent = host || "This page";
    $("hostname").title = host;
    render();
    refreshStatus();
    try {
      const commands = await chrome.commands.getAll();
      const shortcut = commands.find((command) => command.name === "toggle-site")?.shortcut;
      $("shortcut").textContent = shortcut || "Set a shortcut";
    } catch {}
  }

  $("globalEnabled").addEventListener("change", event => persist({ globalEnabled: event.target.checked }));
  // Turning a site on returns it to the default when the default is on, so later
  // default changes (appearance, schedule) keep applying to it.
  $("siteEnabled").addEventListener("change", event => {
    if (host) setSiteRule(event.target.checked ? (followsDefault() ? null : "on") : "off");
  });
  $("siteRule").addEventListener("change", (event) => {
    if (host) setSiteRule(event.target.value === "auto" ? (followsDefault() ? null : "on") : event.target.value);
  });
  $("useRecolor").addEventListener("click", () => { if (host) setSiteRule("recolor"); });
  $("reloadTab").addEventListener("click", () => { if (tabId) chrome.tabs.reload(tabId); window.close(); });
  $("resetSite").addEventListener("click", () => {
    if (!host) return;
    const siteRules = { ...settings.siteRules }, siteTuning = { ...settings.siteTuning };
    delete siteRules[host]; delete siteTuning[host];
    persist({ siteRules, siteTuning });
  });
  for (const key of ["brightness", "contrast"]) {
    $(key).addEventListener("input", (event) => preview(tuningPatch(key, +event.target.value)));
    $(key).addEventListener("change", (event) => preview(tuningPatch(key, +event.target.value), true));
  }
  $("dimImages").addEventListener("change", (event) => {
    if (!host) return;
    // Matching the default is not a site setting; keep only real differences.
    const own = { ...settings.siteTuning[host], dimImages: event.target.checked };
    if (own.dimImages === settings.dimImages) delete own.dimImages;
    const siteTuning = { ...settings.siteTuning, [host]: own };
    if (!Object.keys(own).length) delete siteTuning[host];
    persist({ siteTuning });
  });
  $("report").addEventListener("click", async () => {
    if (!tabId || !chrome?.tabs) return;
    let report = null;
    try { report = await chrome.tabs.sendMessage(tabId, { type: "oled-night-report" }); } catch {}
    if (!report) {
      $("status").textContent = page === "reload" ? "Reload this tab first, then report." : "Your browser doesn't let extensions read this page, so there is nothing to report.";
      return;
    }
    saveReport(report);
    $("status").textContent = "Report saved to Downloads. Send that file along with a screenshot.";
  });
  $("siteSettings").addEventListener("click", () => chrome?.runtime?.openOptionsPage());
  init();
})();
