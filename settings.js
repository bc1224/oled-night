(function (scope) {
  "use strict";

  // Everything lives in chrome.storage.sync so it follows the user's Chrome profile.
  const DEFAULTS = {
    globalEnabled: true,
    appearance: "oled",            // "oled" | "soft" | "auto" (auto = follow the OS theme)
    brightness: 88,                // text lightness, 40..100
    contrast: 72,                  // surface contrast, 0..100
    dimImages: false,              // default for sites without their own choice
    siteRules: {},                 // host -> site mode (see SITE_MODES)
    siteTuning: {},                // host -> { brightness?, contrast?, dimImages? }
    schedule: { enabled: false, start: "20:00", end: "07:00" },
    openClosedShadows: false       // experimental: reach inside closed web components
  };

  // "global" follows the main switch; "on" forces it on with automatic
  // light/dark detection; the rest force one specific treatment.
  const SITE_MODES = {
    global: "Use global",
    on: "On (automatic)",
    recolor: "Full recolor",
    deepen: "Deepen blacks only",
    invert: "Invert (canvas apps)",
    off: "Off"
  };

  function normalize(config) {
    const merged = { ...DEFAULTS, ...(config || {}) };
    merged.siteRules = { ...(merged.siteRules || {}) };
    merged.siteTuning = { ...(merged.siteTuning || {}) };
    merged.schedule = { ...DEFAULTS.schedule, ...(merged.schedule || {}) };
    return merged;
  }

  function siteMode(config, host) {
    const mode = config.siteRules?.[host];
    return mode && mode in SITE_MODES ? mode : "global";
  }

  function minutesOf(text) {
    const [h, m] = String(text || "0:0").split(":").map(Number);
    return ((h || 0) * 60) + (m || 0);
  }

  // Schedule window may wrap past midnight (20:00 -> 07:00).
  function inSchedule(schedule, now = new Date()) {
    if (!schedule?.enabled) return true;
    const start = minutesOf(schedule.start), end = minutesOf(schedule.end);
    const current = (now.getHours() * 60) + now.getMinutes();
    if (start === end) return true;
    return start < end ? current >= start && current < end : current >= start || current < end;
  }

  // Milliseconds until the schedule next flips, or null when there is no schedule.
  function msUntilScheduleChange(schedule, now = new Date()) {
    if (!schedule?.enabled) return null;
    const current = (now.getHours() * 60) + now.getMinutes();
    const waits = [minutesOf(schedule.start), minutesOf(schedule.end)].map((edge) => ((edge - current + 1440) % 1440) || 1440);
    return (Math.min(...waits) * 60000) - (now.getSeconds() * 1000) - now.getMilliseconds();
  }

  function isEnabled(config, host, prefersDark = true, now = new Date()) {
    const mode = siteMode(config, host);
    if (mode === "off") return false;
    if (!inSchedule(config.schedule, now)) return false;
    const on = mode !== "global" || config.globalEnabled;
    return on && (config.appearance !== "auto" || prefersDark);
  }

  function tuningFor(config, host) {
    const site = config.siteTuning?.[host] || {};
    return {
      brightness: site.brightness ?? config.brightness,
      contrast: site.contrast ?? config.contrast,
      dimImages: site.dimImages ?? config.dimImages,
      custom: site.brightness !== undefined || site.contrast !== undefined
    };
  }

  scope.OledNightSettings = { DEFAULTS, SITE_MODES, normalize, siteMode, isEnabled, tuningFor, inSchedule, msUntilScheduleChange };
})(globalThis);
