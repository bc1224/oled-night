(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;
  const Settings = globalThis.OledNightSettings;
  const $ = (id) => document.getElementById(id);
  const hasChrome = () => !!chrome?.storage;
  let host = "";
  let tabId = null;
  let settings = Settings.normalize();
  let persistTimer = null;

  const MODE_LABELS = { native: "Figma native colors protected", oled: "recoloring this page", soft: "recoloring this page (soft)", crush: "page was already dark: deepening its blacks", none: "page is already dark: left as is" };

  let pageStatus = null;
  function render() {
    const tuning = Settings.tuningFor(settings, host);
    $("globalEnabled").checked = settings.globalEnabled;
    $("siteEnabled").checked = Settings.siteMode(settings, host) !== "off" && (Settings.siteMode(settings, host) !== "global" || (settings.globalEnabled && !Settings.prefersNativeColors(host)));
    $("siteRule").value = Settings.siteMode(settings, host);
    const radio = document.querySelector(`input[name="appearance"][value="${settings.appearance}"]`);
    if (radio) radio.checked = true;
    for (const key of ["brightness", "contrast"]) {
      $(key).value = tuning[key]; $(`${key}Value`).value = `${tuning[key]}%`;
      const globalId = 'global' + key[0].toUpperCase() + key.slice(1);
      $(globalId).value = settings[key]; $(`${globalId}Value`).value = `${settings[key]}%`;
      $(key).disabled = !host || Settings.prefersNativeColors(host);
    }
    $("dimImages").checked = !!tuning.dimImages;
    for (const id of ["siteEnabled", "siteRule", "dimImages", "resetSite"]) $(id).disabled = !host || (Settings.prefersNativeColors(host) && ["dimImages", "siteRule"].includes(id));
    const preserved = pageStatus?.active && ["crush", "none"].includes(pageStatus.mode);
    $("tuningHelp").textContent = Settings.prefersNativeColors(host) ? "Figma keeps native colors even when on. Recoloring, inversion and image dimming are bypassed to protect design accuracy." : preserved
      ? "This mode keeps the site's colors. Choose Full recolor under Advanced site mode to adjust text and panels."
      : tuning.custom ? "Custom values for this site. Other sites keep their defaults." : "Using defaults. Moving a slider changes only this site.";
  }

  // The dot shows whether this tab is actually darkened right now, not just the global switch.
  async function refreshStatus() {
    const dot = document.querySelector(".status-dot");
    let status = null;
    if (tabId && chrome?.tabs) {
      try { status = await chrome.tabs.sendMessage(tabId, { type: "oled-night-status" }); } catch {}
    }
    pageStatus = status;
    render();
    const on = !!status?.active;
    dot.style.opacity = on ? "1" : ".3";
    const siteOff = Settings.siteMode(settings, host) === "off";
    const text = on ? `Active: ${MODE_LABELS[status.mode] || "on"}`
      : siteOff ? "Off for this site: use the site switch above"
      : Settings.prefersNativeColors(host) && Settings.siteMode(settings, host) === "global" ? "Native colors: Figma is off by default to protect design colors and performance."
      : !settings.globalEnabled ? "Default is off: turn on this site or change All sites"
      : (tabId ? "Not active on this page" : "");
    dot.title = text;
    $("status").textContent = text;
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
    $("hostname").textContent = host || "Unavailable on this page";
    $("hostname").title = host;
    $("siteRule").disabled = !host;
    render();
    refreshStatus();
    try {
      const commands = await chrome.commands.getAll();
      const shortcut = commands.find((command) => command.name === "toggle-site")?.shortcut;
      $("shortcut").textContent = shortcut || "Set a shortcut";
    } catch {}
  }

  $("globalEnabled").addEventListener("change", event => persist({ globalEnabled: event.target.checked }));
  $("siteEnabled").addEventListener("change", event => {
    if (host) persist({ siteRules: { ...settings.siteRules, [host]: event.target.checked ? "on" : "off" } });
  });
  $("resetSite").addEventListener("click", () => {
    if (!host) return;
    const siteRules = { ...settings.siteRules }, siteTuning = { ...settings.siteTuning };
    delete siteRules[host]; delete siteTuning[host];
    persist({ siteRules, siteTuning });
  });
  $("siteRule").addEventListener("change", (event) => {
    if (!host) return;
    const siteRules = { ...settings.siteRules };
    if (event.target.value === "global") delete siteRules[host]; else siteRules[host] = event.target.value;
    persist({ siteRules });
  });
  document.querySelectorAll('input[name="appearance"]').forEach((input) => input.addEventListener("change", () => persist({ appearance: input.value })));
  for (const key of ["brightness", "contrast"]) {
    const globalId = "global" + key[0].toUpperCase() + key.slice(1);
    $(globalId).addEventListener("input", event => preview({ [key]: +event.target.value }));
    $(globalId).addEventListener("change", event => preview({ [key]: +event.target.value }, true));
    $(key).addEventListener("input", (event) => preview(tuningPatch(key, +event.target.value)));
    $(key).addEventListener("change", (event) => preview(tuningPatch(key, +event.target.value), true));
  }
  $("dimImages").addEventListener("change", (event) => {
    if (!host) return;
    const siteTuning = { ...settings.siteTuning, [host]: { ...settings.siteTuning[host], dimImages: event.target.checked } };
    persist({ siteTuning });
  });
  $("report").addEventListener("click", async () => {
    if (!tabId || !chrome?.tabs) return;
    let report = null;
    try { report = await chrome.tabs.sendMessage(tabId, { type: "oled-night-report" }); } catch {}
    if (!report) { $("status").textContent = "Your browser restricts extensions on this page (such as browser settings and extension stores), so there is nothing to report."; return; }
    saveReport(report);
    $("status").textContent = "Report saved to Downloads. Send that file along with a screenshot.";
  });
  $("siteSettings").addEventListener("click", () => chrome?.runtime?.openOptionsPage());
  init();
})();
