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

  const MODE_LABELS = { oled: "recoloring this page", soft: "recoloring this page (soft)", crush: "page was already dark: deepening its blacks", none: "page is already dark: left as is" };

  function siteOnly() {
    return !!host && Settings.tuningFor(settings, host).custom;
  }

  function render() {
    const tuning = Settings.tuningFor(settings, host);
    $("globalEnabled").checked = settings.globalEnabled;
    $("siteRule").value = Settings.siteMode(settings, host);
    const radio = document.querySelector(`input[name="appearance"][value="${settings.appearance}"]`);
    if (radio) radio.checked = true;
    for (const key of ["brightness", "contrast"]) { $(key).value = tuning[key]; $(`${key}Value`).value = `${tuning[key]}%`; }
    $("siteOnly").checked = siteOnly();
    $("dimImages").checked = !!tuning.dimImages;
    for (const id of ["siteOnly", "dimImages"]) $(id).disabled = !host;
  }

  // The dot shows whether this tab is actually darkened right now, not just the global switch.
  async function refreshStatus() {
    const dot = document.querySelector(".status-dot");
    let status = null;
    if (tabId && chrome?.tabs) {
      try { status = await chrome.tabs.sendMessage(tabId, { type: "oled-night-status" }); } catch {}
    }
    const on = !!status?.active;
    dot.style.opacity = on ? "1" : ".3";
    const siteOff = Settings.siteMode(settings, host) === "off";
    const text = on ? `Active: ${MODE_LABELS[status.mode] || "on"}`
      : siteOff ? "Off for this site: change \"This site\" above to turn it back on"
      : !settings.globalEnabled ? "Off everywhere: turn on the main switch"
      : (tabId ? "Not active on this page" : "");
    dot.title = text;
    $("status").textContent = text;
  }

  function write(patch) {
    if (hasChrome()) return chrome.storage.sync.set(patch);
  }

  function persist(patch) {
    settings = Settings.normalize({ ...settings, ...patch });
    write(patch);
    render();
    setTimeout(refreshStatus, 250);
  }

  // Per-site values live in siteTuning[host]; global ones at the top level.
  function tuningPatch(key, value) {
    if (!siteOnly()) return { [key]: value };
    const siteTuning = { ...settings.siteTuning, [host]: { ...settings.siteTuning[host], [key]: value } };
    return { siteTuning };
  }

  async function preview(patch, persistNow = false) {
    settings = Settings.normalize({ ...settings, ...patch });
    render();
    if (!hasChrome()) return;
    if (tabId) chrome.tabs.sendMessage(tabId, { type: "oled-night-preview", patch }).catch(() => {});
    clearTimeout(persistTimer);
    if (persistNow) return write(patch);
    persistTimer = setTimeout(() => write(patch), 120);
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
    try { host = new URL(tab.url).hostname; } catch { host = ""; }
    $("hostname").textContent = host || "Unavailable on this page";
    $("siteRule").disabled = !host;
    render();
    refreshStatus();
    try {
      const commands = await chrome.commands.getAll();
      const shortcut = commands.find((command) => command.name === "toggle-site")?.shortcut;
      $("shortcut").textContent = shortcut || "Set a shortcut";
    } catch {}
  }

  // Turning the main switch on also clears an "Off" on the current site, which
  // would otherwise silently override it.
  $("globalEnabled").addEventListener("change", (event) => {
    const patch = { globalEnabled: event.target.checked };
    if (event.target.checked && host && settings.siteRules[host] === "off") {
      const siteRules = { ...settings.siteRules };
      delete siteRules[host];
      patch.siteRules = siteRules;
    }
    persist(patch);
  });
  $("siteRule").addEventListener("change", (event) => {
    if (!host) return;
    const siteRules = { ...settings.siteRules };
    if (event.target.value === "global") delete siteRules[host]; else siteRules[host] = event.target.value;
    persist({ siteRules });
  });
  document.querySelectorAll('input[name="appearance"]').forEach((input) => input.addEventListener("change", () => persist({ appearance: input.value })));
  for (const key of ["brightness", "contrast"]) {
    $(key).addEventListener("input", (event) => preview(tuningPatch(key, +event.target.value)));
    $(key).addEventListener("change", (event) => preview(tuningPatch(key, +event.target.value), true));
  }
  $("siteOnly").addEventListener("change", (event) => {
    if (!host) return;
    const current = { ...settings.siteTuning[host] };
    if (event.target.checked) {
      const tuning = Settings.tuningFor(settings, host);
      current.brightness = tuning.brightness;
      current.contrast = tuning.contrast;
    } else {
      delete current.brightness;
      delete current.contrast;
    }
    const siteTuning = { ...settings.siteTuning };
    if (Object.keys(current).length) siteTuning[host] = current; else delete siteTuning[host];
    persist({ siteTuning });
  });
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
