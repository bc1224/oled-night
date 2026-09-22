(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;
  const Settings = globalThis.OledNightSettings;
  const $ = (id) => document.getElementById(id);
  const THEME_URL = "https://github.com/bc1224/oled-night/blob/main/theme/README.md";
  let settings = Settings.normalize();

  function modeOptions(selected, includeGlobal = false) {
    const fragment = document.createDocumentFragment();
    if (includeGlobal) fragment.appendChild(new Option("Use global", "global", false, !selected));
    for (const [mode, label] of Object.entries(Settings.SITE_MODES)) {
      if (mode !== "global") fragment.appendChild(new Option(label, mode, false, mode === selected));
    }
    return fragment;
  }

  function cleanHost(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "";
    try { return new URL(text.includes("://") ? text : `https://${text}`).hostname; } catch { return ""; }
  }

  function describeTuning(tuning) {
    if (!tuning) return "";
    const parts = [];
    if (tuning.brightness !== undefined) parts.push(`brightness ${tuning.brightness}%`);
    if (tuning.contrast !== undefined) parts.push(`contrast ${tuning.contrast}%`);
    if (tuning.dimImages) parts.push("images dimmed");
    return parts.join(", ");
  }

  function renderRules() {
    const hosts = [...new Set([...Object.keys(settings.siteRules), ...Object.keys(settings.siteTuning)])].sort();
    $("rules").replaceChildren();
    if (!hosts.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No site-specific settings yet. Use the popup on any site, or add one above.";
      $("rules").appendChild(empty);
    }
    for (const host of hosts) {
      const row = document.createElement("div"); row.className = "rule"; row.dataset.host = host;
      const text = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = host;
      const tuning = document.createElement("small"); tuning.textContent = describeTuning(settings.siteTuning[host]);
      text.append(name, tuning);
      const select = document.createElement("select"); select.setAttribute("aria-label", `Mode for ${host}`);
      select.appendChild(modeOptions(settings.siteRules[host], true));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove";
      remove.setAttribute("aria-label", `Remove ${host}`); remove.textContent = "Remove";
      row.append(text, select, remove); $("rules").appendChild(row);
    }
  }

  function render() {
    renderRules();
    $("dimImages").checked = !!settings.dimImages;
    $("scheduleEnabled").checked = !!settings.schedule.enabled;
    $("scheduleStart").value = settings.schedule.start;
    $("scheduleEnd").value = settings.schedule.end;
    $("openClosedShadows").checked = !!settings.openClosedShadows;
  }

  async function save(patch) {
    settings = Settings.normalize({ ...settings, ...patch });
    await chrome.storage.sync.set(patch);
    render();
  }

  $("newMode").replaceChildren(modeOptions("off"));
  $("addRule").addEventListener("submit", (event) => {
    event.preventDefault();
    const host = cleanHost($("newHost").value);
    if (!host) { $("newHost").focus(); return; }
    $("newHost").value = "";
    save({ siteRules: { ...settings.siteRules, [host]: $("newMode").value } });
  });
  $("rules").addEventListener("change", (event) => {
    const host = event.target.closest(".rule")?.dataset.host;
    if (!host || event.target.tagName !== "SELECT") return;
    const siteRules = { ...settings.siteRules };
    if (event.target.value === "global") delete siteRules[host]; else siteRules[host] = event.target.value;
    save({ siteRules });
  });
  $("rules").addEventListener("click", (event) => {
    if (!event.target.classList.contains("remove")) return;
    const host = event.target.closest(".rule")?.dataset.host;
    const siteRules = { ...settings.siteRules };
    const siteTuning = { ...settings.siteTuning };
    delete siteRules[host];
    delete siteTuning[host];
    save({ siteRules, siteTuning });
  });
  $("dimImages").addEventListener("change", (event) => save({ dimImages: event.target.checked }));
  const saveSchedule = () => save({ schedule: { enabled: $("scheduleEnabled").checked, start: $("scheduleStart").value || "20:00", end: $("scheduleEnd").value || "07:00" } });
  for (const id of ["scheduleEnabled", "scheduleStart", "scheduleEnd"]) $(id).addEventListener("change", saveSchedule);
  $("openClosedShadows").addEventListener("change", (event) => save({ openClosedShadows: event.target.checked }));
  $("shortcuts").addEventListener("click", () => {
    if (globalThis.browser) {
      $("shortcutHelp").hidden = false;
    } else chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
  if (globalThis.browser) $("getTheme").closest("section").hidden = true;
  $("getTheme").addEventListener("click", () => chrome.tabs.create({ url: THEME_URL }));

  $("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ oledNight: 1, settings }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `oled-night-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    $("backupStatus").textContent = "Settings exported.";
  });
  $("import").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = data?.settings;
      if (!incoming || typeof incoming !== "object") throw new Error("not an OLED Night settings file");
      // Only known keys are imported.
      const patch = Object.fromEntries(Object.keys(Settings.DEFAULTS).filter((key) => key in incoming).map((key) => [key, incoming[key]]));
      await save(Settings.normalize(patch));
      $("backupStatus").textContent = `Imported settings for ${Object.keys(settings.siteRules).length} site rule(s).`;
    } catch (error) {
      $("backupStatus").textContent = `Couldn't import: ${error.message}`;
    }
  });
  $("reset").addEventListener("click", async () => {
    if (!confirm("Reset all OLED Night settings and site rules?")) return;
    await chrome.storage.sync.clear();
    settings = Settings.normalize();
    render();
    $("backupStatus").textContent = "Everything reset to defaults.";
  });

  (async () => {
    settings = Settings.normalize(await chrome.storage.sync.get(Settings.DEFAULTS));
    render();
    try {
      const shortcut = (await chrome.commands.getAll()).find((command) => command.name === "toggle-site")?.shortcut;
      $("shortcut").textContent = shortcut || "not set";
    } catch {}
  })();
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "sync") return;
    settings = Settings.normalize(await chrome.storage.sync.get(Settings.DEFAULTS));
    render();
  });
})();
