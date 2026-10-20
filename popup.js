(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;
  const Settings = globalThis.OledNightSettings;
  const $ = (id) => document.getElementById(id);
  const hasChrome = () => !!chrome?.storage;
  const isFirefox = (() => { try { return chrome.runtime.getURL("").startsWith("moz-extension://"); } catch { return false; } })();
  let host = "";
  let tabId = null;
  let tabWindowId;
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
  const siteOn = () => { const mode = siteMode(); return settings.extensionEnabled && mode !== "off" && (mode !== "global" || followsDefault()); };
  function prefersDark() {
    try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return true; }
  }

  // Why settings keep this site off right now, or null when they turn it on.
  function offReason() {
    if (!settings.extensionEnabled) return "Paused everywhere · Turn OLED Night on above";
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
    $("extensionEnabled").checked = settings.extensionEnabled;
    $("globalEnabled").checked = settings.globalEnabled;
    $("globalHelp").textContent = `${settings.globalEnabled ? "On" : "Off"} for every site you haven't set yourself`;
    $("siteEnabled").checked = siteOn();
    $("siteEnabled").disabled = !settings.extensionEnabled || !host || page === "blocked";
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
    tabWindowId = tab?.windowId;
    try { const url = new URL(tab.url); host = /^https?:$/.test(url.protocol) ? url.hostname : ""; } catch { host = ""; }
    $("hostname").textContent = host || "This page";
    $("hostname").title = host;
    render();
    refreshStatus();
    try {
      const commands = await chrome.commands.getAll();
      const assigned = name => commands.filter(command => command.name === name || command.name === name + "-backup").map(command => command.shortcut).filter(Boolean).join(" / ");
      const shortcut = assigned("toggle-site");
      $("shortcut").textContent = shortcut || "Set a shortcut";
      $("extensionShortcut").textContent = assigned("toggle-extension") || "Set in Settings";
    } catch {}
  }

  $("extensionEnabled").addEventListener("change", event => persist({ extensionEnabled: event.target.checked }));
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
  let pendingReport = null;
  let reportSession = null;
  let screenshot = null, screenshotGeneration = 0, screenshotBusy = false, attachmentLocked = false;
  function clearScreenshot() {
    screenshotGeneration++;
    screenshot = null; screenshotBusy = false;
    $("reportScreenshotImage").hidden = true;
    $("reportScreenshotImage").removeAttribute("src");
    $("reportScreenshotReview").hidden = true;
    $("reportScreenshotRemove").hidden = true;
    $("reportScreenshotFile").value = "";
    $("reportScreenshotStatus").textContent = "";
  }
  function lockAttachment(locked) {
    attachmentLocked = locked;
    for (const id of ["reportScreenshotCapture","reportScreenshotPaste","reportScreenshotFile","reportScreenshotRemove"]) $(id).disabled = locked;
  }
  async function attachScreenshot(file) {
    if (!reportSession || attachmentLocked) return;
    const session = reportSession, generation = ++screenshotGeneration;
    screenshotBusy = true; $("reportSubmit").disabled = true;
    $("reportScreenshotStatus").textContent = "Preparing preview…";
    try {
      const source = typeof file === "function" ? await file() : file;
      if (session !== reportSession || generation !== screenshotGeneration) return;
      const prepared = await OledNightReport.prepareScreenshot(source);
      if (session !== reportSession || generation !== screenshotGeneration) return;
      screenshot = prepared;
      $("reportScreenshotImage").src = `data:${prepared.type};base64,${prepared.data}`;
      $("reportScreenshotImage").hidden = false;
      $("reportScreenshotReview").hidden = false;
      $("reportScreenshotRemove").hidden = false;
      $("reportScreenshotStatus").textContent = "Click the image to review. Shared only on Submit.";
    } catch (error) {
      if (session === reportSession && generation === screenshotGeneration) $("reportScreenshotStatus").textContent = error.message || "Could not read this image. Try another screenshot.";
    } finally {
      if (session === reportSession && generation === screenshotGeneration) { screenshotBusy = false; $("reportSubmit").disabled = false; }
    }
  }
  let imageOnlyPaste = false;
  const transferredImage = transfer => [...(transfer?.items || [])].find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile() || [...(transfer?.files || [])].find(file => file.type.startsWith("image/"));
  $("reportPreview").addEventListener("paste", event => {
    const file = transferredImage(event.clipboardData);
    if (file && reportSession && !attachmentLocked) { event.preventDefault(); attachScreenshot(file); }
    else if (imageOnlyPaste) { event.preventDefault(); $("reportScreenshotStatus").textContent = "No screenshot found. Copy an image, then paste again."; }
  });
  $("reportScreenshotCapture").addEventListener("click", () => {
    if (screenshotBusy || !tabId) return;
    attachScreenshot(async () => {
      const [before] = await chrome.tabs.query({active: true, windowId: tabWindowId});
      if (before?.id !== tabId || new URL(before.url).hostname !== host) throw Error("Return to the site you are reporting, then try again.");
      const dataUrl = await chrome.tabs.captureVisibleTab(tabWindowId, {format: "png"});
      const [after] = await chrome.tabs.query({active: true, windowId: tabWindowId});
      if (after?.id !== tabId || after.url !== before.url) throw Error("The tab changed. Return to the site and try again.");
      const data = dataUrl.match(/^data:image\/png;base64,(.+)$/)?.[1];
      if (!data) throw Error("Could not capture this page. Choose an image instead.");
      return new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], {type: "image/png"});
    });
  });
  $("reportScreenshotReview").addEventListener("click", () => {
    if (!screenshot) return;
    $("reportReviewImage").src = $("reportScreenshotImage").src;
    $("reportImagePreview").showModal();
  });
  $("reportImageClose").addEventListener("click", () => $("reportImagePreview").close());
  $("reportImagePreview").addEventListener("close", () => $("reportReviewImage").removeAttribute("src"));
  $("reportSuccessClose").addEventListener("click", () => $("reportSuccess").close());
  // Native image paste needs an editable target, including after clicking a button.
  $("reportPreview").addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "v" && !attachmentLocked) $("reportDescription").focus();
  });
  $("reportScreenshotDrop").addEventListener("dragover", event => { event.preventDefault(); if (!attachmentLocked) $("reportScreenshotDrop").classList.add("dragging"); });
  $("reportScreenshotDrop").addEventListener("dragleave", () => $("reportScreenshotDrop").classList.remove("dragging"));
  $("reportScreenshotDrop").addEventListener("drop", event => {
    event.preventDefault(); $("reportScreenshotDrop").classList.remove("dragging");
    const file = transferredImage(event.dataTransfer);
    if (file) attachScreenshot(file);
    else if (!attachmentLocked) $("reportScreenshotStatus").textContent = "Drop a PNG, JPEG or WebP screenshot.";
  });
  $("reportScreenshotFile").addEventListener("change", event => { if (event.target.files[0]) attachScreenshot(event.target.files[0]); });
  $("reportScreenshotRemove").addEventListener("click", () => { if (!attachmentLocked) { clearScreenshot(); $("reportSubmit").disabled = false; } });
  $("reportScreenshotPaste").addEventListener("click", async () => {
    if (!reportSession || attachmentLocked) return;
    const session = reportSession;
    try {
      // Optional permission is requested only by this explicit paste action.
      if (chrome.permissions?.request && !await chrome.permissions.request({permissions: ["clipboardRead"]})) throw Error("Clipboard access declined");
      if (session !== reportSession || attachmentLocked) return;
      $("reportDescription").focus();
      if (!navigator.clipboard?.read) {
        imageOnlyPaste = true;
        try { if (document.execCommand("paste")) return; }
        finally { imageOnlyPaste = false; }
        throw Error("Clipboard image reading unavailable");
      }
      const items = await navigator.clipboard.read();
      if (session !== reportSession || attachmentLocked) return;
      for (const item of items) {
        const type = item.types.find(type => ["image/png","image/jpeg","image/webp"].includes(type));
        if (type) {
          const file = await item.getType(type);
          if (session === reportSession && !attachmentLocked) await attachScreenshot(file);
          return;
        }
      }
      $("reportScreenshotStatus").textContent = "No screenshot found. Copy an image, then paste again.";
    } catch {
      if (session !== reportSession) return;
      $("reportScreenshotStatus").textContent = "Clipboard access was unavailable. Press Ctrl+V (⌘V on Mac) here, or drop an image.";
      $("reportDescription").focus();
    }
  });
  $("reportPreview").addEventListener("close", () => {
    if ($("reportPreview").open) return;
    reportSession?.cancel();
    reportSession = null;
    pendingReport = null;
    clearScreenshot(); lockAttachment(false);
  });
  $("reportPreview").addEventListener("cancel", () => reportSession?.cancel());
  $("reportCancel").addEventListener("click", () => { reportSession?.cancel(); $("reportPreview").close(); });
  $("reportDownload").addEventListener("click", () => { if (pendingReport) saveReport(pendingReport); });
  $("reportSubmit").addEventListener("click", async () => {
    if (!reportSession || $("reportSubmit").disabled || screenshotBusy) return;
    const session = reportSession;
    $("reportSubmit").disabled = true;
    $("reportSubmit").textContent = "Submitting…";
    $("reportDescription").disabled = true;
    lockAttachment(true);
    try {
      const shared = await session.send($("reportDescription").value, screenshot);
      if (session !== reportSession) return;
      if (shared) {
        $("reportIssueLink").href = shared.url;
        $("reportIssueLink").hidden = false;
        $("reportSubmit").hidden = true;
        $("reportDescription").disabled = true;
        $("reportPreview").close();
        $("reportSuccess").showModal();
      }
      else { $("reportDescription").disabled = false; lockAttachment(false); $("reportConsentStatus").textContent = "Sharing declined. OLED Night still works; you can save a report locally."; }
    } catch (error) {
      if (session === reportSession) $("reportConsentStatus").textContent = error.message || "Could not submit the issue. You can retry or save a report locally.";
    } finally { if (session === reportSession && !screenshotBusy) { $("reportSubmit").disabled = false; $("reportSubmit").textContent = "Submit report"; } }
  });
  $("report").addEventListener("click", async () => {
    if (!tabId || !chrome?.tabs) return;
    let report = null;
    try { report = await chrome.tabs.sendMessage(tabId, { type: "oled-night-report" }); } catch {}
    if (!report) {
      $("status").textContent = page === "reload" ? "Reload this tab first, then report." : "Your browser doesn't let extensions read this page, so there is nothing to report.";
      return;
    }
    pendingReport = report;
    reportSession?.cancel();
    reportSession = OledNightReport.createSubmissionSession(report, {
      requestConsent: isFirefox ? () => chrome.permissions.request({data_collection:["browsingActivity","technicalAndInteraction",...(screenshot ? ["websiteContent"] : [])]}) : null,
      submit: payload => OledNightReport.submitIssue(payload)
    });
    $("reportSubmit").disabled = false;
    $("reportConsentStatus").textContent = "";
    $("reportSubmit").hidden = false;
    $("reportSubmit").textContent = "Submit report";
    $("reportIssueLink").hidden = true;
    $("reportDescription").value = "";
    $("reportDescription").disabled = false;
    $("reportHost").textContent = host;
    clearScreenshot(); lockAttachment(false);
    $("reportFirefoxConsent").hidden = !isFirefox;
    $("reportDiagnostics").textContent = JSON.stringify(OledNightReport.scrub(report), null, 2);
    $("reportPreview").showModal();
  });
  $("siteSettings").addEventListener("click", () => chrome?.runtime?.openOptionsPage());
  chrome?.storage?.onChanged?.addListener(async (changes, area) => {
    if (area !== "sync" || !changes.extensionEnabled) return;
    settings = Settings.normalize(await chrome.storage.sync.get(Settings.DEFAULTS));
    refreshStatus();
  });
  init();
})();
