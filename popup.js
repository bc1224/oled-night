(function () {
  "use strict";
  const DEFAULTS = { globalEnabled: true, appearance: "oled", brightness: 88, contrast: 72, siteRules: {} };
  const $ = (id) => document.getElementById(id);
  let host = "";
  let settings = { ...DEFAULTS };
  let persistTimer = null;

  function render() {
    $("globalEnabled").checked = settings.globalEnabled;
    $("siteRule").value = settings.siteRules?.[host] || "global";
    document.querySelector(`input[name="appearance"][value="${settings.appearance}"]`).checked = true;
    for (const key of ["brightness", "contrast"]) { $(key).value = settings[key]; $(`${key}Value`).value = `${settings[key]}%`; }

  }

  // The dot shows whether this tab is actually darkened right now, not just the global switch.
  let tabId = null;
  async function refreshStatus() {
    const dot = document.querySelector(".status-dot");
    let status = null;
    if (tabId && globalThis.chrome?.tabs) {
      try { status = await chrome.tabs.sendMessage(tabId, { type: "oled-night-status" }); } catch {}
    }
    const on = !!status?.active;
    dot.style.opacity = on ? "1" : ".3";
    dot.title = on ? (status.darkPage ? "Active: page was already dark, deepening its blacks" : "Active on this page") : "Not active on this page";
  }

  function persist(patch) {
    settings = { ...settings, ...patch };
    if (globalThis.chrome?.storage) chrome.storage.sync.set(patch);
    render();
    setTimeout(refreshStatus, 250);
  }

  async function preview(patch, persistNow = false) {
    settings = { ...settings, ...patch };
    render();
    if (!globalThis.chrome?.storage) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "oled-night-preview", patch }).catch(() => {});
    clearTimeout(persistTimer);
    if (persistNow) return chrome.storage.sync.set(patch);
    persistTimer = setTimeout(() => chrome.storage.sync.set(patch), 120);
  }

  async function init() {
    if (!globalThis.chrome?.storage || !globalThis.chrome?.tabs) {
      host = "example.com";
      $("hostname").textContent = host;
      render();
      return;
    }
    settings = await chrome.storage.sync.get(DEFAULTS);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id ?? null;
    try { host = new URL(tab.url).hostname; } catch { host = ""; }
    $("hostname").textContent = host || "Unavailable on this page";
    $("siteRule").disabled = !host;
    render();
    refreshStatus();
  }

  $("globalEnabled").addEventListener("change", (event) => persist({ globalEnabled: event.target.checked }));
  $("siteRule").addEventListener("change", (event) => {
    if (!host) return;
    const siteRules = { ...(settings.siteRules || {}) };
    if (event.target.value === "global") delete siteRules[host]; else siteRules[host] = event.target.value;
    persist({ siteRules });
  });
  document.querySelectorAll('input[name="appearance"]').forEach((input) => input.addEventListener("change", () => persist({ appearance: input.value })));
  for (const key of ["brightness", "contrast"]) {
    $(key).addEventListener("input", (event) => preview({ [key]: +event.target.value }));
    $(key).addEventListener("change", (event) => preview({ [key]: +event.target.value }, true));
  }
  $("siteSettings").addEventListener("click", () => globalThis.chrome?.runtime?.openOptionsPage());
  init();
})();
