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
