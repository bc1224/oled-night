# Browser workload comparison — September 22, 2026

## Result

OLED Night 0.6.10 costs more CPU than Dark Reader 4.9.132 on this high-churn fixture. Do not claim it is lighter than Dark Reader. Idle renderer work is low for all three; the Chrome theme has no JavaScript and was not separately benchmarked.

Medians of three samples on the 2,500-row fixture:

| Variant | Browser CPU time / ~3 seconds | Renderer task time | Private committed memory | Renderer JS heap |
|---|---:|---:|---:|---:|
| Plain Chrome | 887 ms | 435 ms | 412.4 MiB | 0.89 MiB |
| Dark Reader 4.9.132 | 913 ms | 388 ms | 472.0 MiB | 2.86 MiB |
| OLED Night 0.6.10 | 1696 ms | 1143 ms | 482.4 MiB | 4.03 MiB |

## Method and limits

Windows 11, AMD Ryzen 9 9950X3D (16 cores / 32 logical processors), Chrome 153.0.8010.53 headless, 1000×800 viewport. Each variant used its own fresh temporary Chrome profile, sequentially, with no other extension. OLED Night used defaults; Dark Reader used its default dynamic mode, confirmed by its stylesheet, document mode and computed dark background. Plain Chrome had no extension. This is not the user's normal browser session.

Each variant loaded a small light page and a 2,500-row page three times. After two seconds settling and renderer garbage collection: measure two seconds idle, then three seconds scrolling and toggling 20 row classes per timer tick. The small page has no rows to mutate, so it exercises the idle/simple-page case. The raw data includes every sample, load timing, actual duration, tick count and worst timer gap. Samples are sequential, not randomized; Chrome background work and warm-up affect totals. Three samples are not a statistical population.

CPU is the delta in CDP SystemInfo.getProcessInfo CPU time across matching processes in the isolated Chrome instance. It includes browser/renderer/GPU processes, but not other apps. Renderer task duration is CDP Performance.getMetrics. Private committed bytes are summed Get-Process PrivateMemorySize64 over that same instance's process IDs; this is **not physical RAM/RSS**. JS heap is renderer-only after explicit GC. CPU time can exceed wall time across threads. These measurements are not whole-PC Task Manager readings, energy measurements, input-latency tests, or a Figma benchmark.

Median idle browser CPU on the large fixture was 51 ms (plain), 59 ms (Dark Reader), and 51 ms (OLED Night) across about two seconds; differences this small are within observed variation. Median worst timer gap during large-page work was 18 ms for plain Chrome and Dark Reader, and 19 ms for OLED Night. That does not prove there are no hitches on real websites. OLED Night's higher busy-page cost comes with per-element recoloring and mutation processing; Figma native-color protection bypasses that processing entirely.

## Reproduce

Run `node tests/e2e/benchmark.mjs` with `BENCH_VARIANT=base`, then `oled`, then `darkreader`. For Dark Reader, set `DARKREADER_PATH` to an unpacked official MV3 release. Run sequentially and keep other heavy workloads quiet. The script owns and cleans up its temporary profile and local fixture server; results go under ignored `dist/`.

Official Dark Reader release: https://github.com/darkreader/darkreader/releases/tag/v4.9.132
Asset: darkreader-chrome-mv3.zip
SHA-256: 86721FDBF04C264C11FF3560B5CA44F40AF4D61762E8C038434239454A7D32D0
The third-party extension binary is not included in this repository or release.

Raw results: `tests/benchmarks/2026-09-22/{base,oled,darkreader}.json`.

A bounded cache of parsed colors and immutable color luminance avoids repeated conversion work. The before-cache median was 1801 ms browser CPU and 1242 ms renderer task time; after-cache medians were 1696 ms and 1143 ms (about 6% and 8% lower). This sequential three-sample comparison is noisy, not a guaranteed improvement on real sites. Before-cache samples are retained in `tests/benchmarks/2026-09-22/oled-before-cache.json`.

## 0.6.11 follow-up: duplicate work and animations

Fresh sequential comparisons against the packaged 0.6.10 build, three samples each, same machine and browser.

| Workload | Browser CPU ms / ~3s | Renderer task ms | JS heap MiB |
|---|---:|---:|---:|
| 0.6.10 class changes | 1370 | 918 | 3.89 |
| 0.6.11 class changes | 1383 | 896 | 4.43 |
| 0.6.10 transform changes | 1472 | 1048 | 3.08 |
| 0.6.11 transform changes | 974 | 643 | 4.24 |

The class-change case is essentially unchanged within sample noise. The transform case uses the same 2,500-row fixture with inline background/text colors; 20 rows per tick receive transform changes instead of class changes. It specifically exercises repeated style mutations without changed colors. These are scenario-specific measurements, not a whole-PC or universal speedup. Additional caches/snapshots trade some JS heap for less repeated work.

Set BENCH_WORKLOAD=transforms to reproduce the animation case (rows only); default classes retains the original workload. Use EXT_PATH for an unpacked release baseline. Raw paired results are tests/benchmarks/2026-09-22/oled-0.6.10-paired.json, oled-0.6.11-classes.json, and oled-{0.6.10,0.6.11}-transforms.json.

Regression tests additionally verify zero recoloring passes for transform-only changes, one batch for overlapping interaction/mutation work, zero document rescans for tuning, and readable inherited/late-stylesheet colors.

## 0.6.13: Discord interaction lag (live) and the global fix

**Verdict:** 0.6.12 did cause noticeable lag on Discord. It was not idle CPU: it was 50–150 ms main-thread stalls on ordinary input. The cause was generic, not Discord-specific, so the fix applies to every site.

### What 0.6.12 did

Every hover, focus, key press and `<html>` class change (Discord toggles `mouse-mode` on each keyboard/mouse switch) made OLED Night re-read colors. To read original colors it switched its overrides off with **subtree** attributes (`data-oled-night-measure`, `data-oled-night-noanim`) on large ancestors such as `<html>`, `<body>` and `#app-mount`. Each switch forces the browser to restyle every descendant twice. On Discord, the probes below measured one switch at 47–87 ms, while reading the colors themselves took about 7 ms and Discord's own class flip took 6.7 ms.

Live Discord, same page load, OLED Night's per-site switch as the only difference. Median main-thread time per trigger:

| Trigger | OFF | 0.6.12 (two runs) | 0.6.13 |
|---|---:|---:|---:|
| `<html>` class flip (`mouse-mode`) | 0.0 ms | 152 / 112 ms | 30 ms |
| `keyup` in the message box | 0.0 ms | 72 / 48 ms | 0.4 ms |
| `pointerover` on a message | 0.0 ms | 63 / 51 ms | 2.8 ms |
| `focusin` on the message box | 0.0 ms | 66 / 48 ms | 2.0 ms |
| Pointer moving between messages | — | — | 1.4 ms |

Real keyboard/mouse switching (16 switches, 17 `<html>` class changes): OFF 0 long frames; 0.6.12 23–27 long frames totalling 3.7–4.2 s with key events up to 416 ms; 0.6.13 8 long frames totalling 0.63 s. With 0.6.12, context menus produced 26 long frames (OFF: 1) and a typing burst 12 (OFF: 2). Discord renderer CPU with 0.6.12 was 4–7× OFF during these interactions and about the same at idle. Idle and wheel scrolling had no long frames in any state.

### What changed

- Original colors are re-read by switching off only the marked elements being checked. Subtree switches remain where inherited overrides (text, fill, stroke) would restyle the subtree anyway, and for large rescans.
- Chrome restyles whole subtrees for attributes named in `::placeholder`, `::before` or `::after` rules. Those rules use a separate switch, set only on elements with pseudo-element overrides.
- Page-polarity checks switch off only the root background, not the inherited `color-scheme: dark`. That dropped the check from 135 ms to 8 ms on Discord. Pages whose background depends on `color-scheme` (for example `light-dark()`) keep the full switch.
- Moving between elements rechecks only elements below the common ancestor, whose `:hover`/`:focus-within` state actually changed. Typing rechecks up to the field's control. Remaining ancestors are rechecked after a 400 ms pause, so `:has()` rules still apply. A page's own running color transitions are finished before reading, as the subtree switch previously did.
- `<html>`/`<body>` class changes still recheck the whole document so that real theme switches keep working. That is the remaining ~30 ms on Discord.

### Generic pages (synthetic)

`tests/e2e/interaction-benchmark.mjs` builds a 3,305-element dark page (deepen mode) and light page (full recolor) and compares no extension, a baseline and a candidate in isolated headless Chrome 153 profiles. It checks cost, and whether every element's final colors match the baseline after an accent-theme class, a descendant-selector class, a menu opening and highlighting, editor focus and an inherited-color theme. All snapshots were identical to 0.6.12. Median ms, 0.6.12 → 0.6.13 (`interaction-generic.json`, keys `v0612`/`proto`):

| Trigger | Dark page | Light page |
|---|---:|---:|
| `keyup` in editor | 10.2 → 0.2 | 39.1 → 0.3 |
| Pointer moving between rows | 9.6 → 0.4 | 36.3 → 1.3 |
| Focus moving between buttons | 9.6 → 0.2 | 35.2 → 1.0 |
| Pointer/focus entering with no `relatedTarget` | 9.7–10.2 → 0.2–0.3 | 35–40 → 35 (unchanged) |
| `<html>` class full rescan (interleaved A/B, `interaction-html-class-ab.json`) | 29–35 → 33–37 | 96–97 → 97–101 |

On light pages the synthetic full-rescan cost is unchanged (within noise). There the per-element reads dominate, not the restyle.

### Method and limits

Live figures come from the maintainer's everyday Chrome profile. Its other extensions were constant across ON/OFF. Dark Reader was installed but inactive on Discord. Bracket timing = time between a `requestAnimationFrame` callback registered before the trigger and one registered after OLED Night's queued work. Long frames come from the Long Animation Frames API, which does not attribute extension scripts, so attribution comes from the ON/OFF difference. Renderer CPU came from Windows process CPU time for Discord's renderer. A 240 Hz rAF recorder ran in all states. The 0.6.13 live run used a different channel and account (a ~15% larger DOM) because the tab's Discord account changed between runs. The test channels were small (6–14 messages). These are not whole-PC, energy or Dark Reader comparisons. Raw live data: `tests/benchmarks/2026-09-22/discord-live.json`.
