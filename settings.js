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
    const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const source = record(config);
    const number = (value, low, high, fallback) => typeof value === "number" && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;
    const boolean = (value, fallback) => typeof value === "boolean" ? value : fallback;
    const merged = {
      globalEnabled: boolean(source.globalEnabled, DEFAULTS.globalEnabled),
      appearance: ["oled", "soft", "auto"].includes(source.appearance) ? source.appearance : DEFAULTS.appearance,
      brightness: number(source.brightness, 40, 100, DEFAULTS.brightness),
      contrast: number(source.contrast, 0, 100, DEFAULTS.contrast),
      dimImages: boolean(source.dimImages, DEFAULTS.dimImages),
      openClosedShadows: boolean(source.openClosedShadows, DEFAULTS.openClosedShadows),
      siteRules: Object.fromEntries(Object.entries(record(source.siteRules)).filter(([, mode]) => typeof mode === "string" && Object.hasOwn(SITE_MODES, mode))),
      siteTuning: {}
    };
    for (const [host, raw] of Object.entries(record(source.siteTuning))) {
      const tuning = record(raw), clean = {};
      if (typeof tuning.brightness === "number" && Number.isFinite(tuning.brightness)) clean.brightness = number(tuning.brightness, 40, 100);
      if (typeof tuning.contrast === "number" && Number.isFinite(tuning.contrast)) clean.contrast = number(tuning.contrast, 0, 100);
      if (typeof tuning.dimImages === "boolean") clean.dimImages = tuning.dimImages;
      if (Object.keys(clean).length) Object.defineProperty(merged.siteTuning, host, {value: clean, enumerable: true, configurable: true, writable: true});
    }
    const schedule = record(source.schedule);
    const time = (value, fallback) => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
    merged.schedule = {
      enabled: boolean(schedule.enabled, DEFAULTS.schedule.enabled),
      start: time(schedule.start, DEFAULTS.schedule.start),
      end: time(schedule.end, DEFAULTS.schedule.end)
    };
    return merged;
  }

  function siteMode(config, host) {
    const mode = config.siteRules?.[host];
    return typeof mode === "string" && Object.hasOwn(SITE_MODES, mode) ? mode : "global";
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

  const prefersNativeColors = host => /(^|\.)figma\.com$/i.test(String(host || ""));

  function isEnabled(config, host, prefersDark = true, now = new Date()) {
    const mode = siteMode(config, host);
    if (mode === "off" || (mode === "global" && prefersNativeColors(host))) return false;
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

  scope.OledNightSettings = { DEFAULTS, SITE_MODES, normalize, siteMode, isEnabled, tuningFor, prefersNativeColors, inSchedule, msUntilScheduleChange };
})(globalThis);
