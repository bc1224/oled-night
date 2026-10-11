# OLED Night interaction and contrast audit — October 11, 2026

## Findings and changes

Live Amazon Business on 0.6.31 took 1.28–2.13 seconds per repeated sort-menu control call in Automatic mode, compared with 0.30–0.43 seconds in Inverted mode. These include browser-control transport, not native input-to-paint timing. The intermittent reported 5–10 second stall was not reproduced.

The recoloring engine promoted interaction ancestors into subtree rereads. Temporarily disabling inherited overrides on a large ancestor forces its descendants to recompute styles. Version 0.6.32 keeps changed-control subtree work but measures other interaction ancestors individually, and recognizes nonsemantic ARIA/data-action dropdown triggers. Real stylesheet and theme changes still recheck affected subtrees.

Amazon Business's bell is an external SVG image; its hamburger is a CSS image sprite. Neither inherits text color. Their confirmed monochrome controls now receive the existing Amazon control inversion. Small named interactive external assets receive a light shadow edge globally; ordinary content images remain unfiltered. Broad, flat neutral page layouts become black. Rounded, bordered, shadowed and smaller panels retain surface separation.

## Controlled performance comparison

The same fresh-profile Chrome harness compared the packaged 0.6.31 baseline with 0.6.32 across approximately 3,300 elements, both dark and light pages. Median main-thread processing in the final light-page run:

| Trigger | 0.6.31 | 0.6.32 |
|---|---:|---:|
| Text hover | 47.6 ms | 5.5 ms |
| Editor focus | 32.3 ms | 0.7 ms |
| Row-to-row movement | 2.2 ms | 1.9 ms |
| Focus between buttons | 1.6 ms | 1.2 ms |
| Root class/theme change | 138.6 ms | 136.0 ms |

All final element-color snapshots matched the baseline for initial paint, theme accents, descendant rules, menu insertion/highlighting, editor focus and inherited-theme changes on both polarities. This is controlled processing evidence, not proof that every live site's intermittent stall is eliminated. A cooperative large-pass batching experiment was discarded because it changed inherited color results.

The new roughly 5,000-element dropdown fixture recorded 4.4 ms to its first two animation frames, with no large-ancestor subtree measurement switches. Firefox passed the corresponding functional checks. Heavy-page churn is also covered by the existing release gate.

## Companion Chrome theme

Theme 1.0.2 is a static six-file package with no JavaScript, requests, content scripts or website processing. No extension-style website slowdown was found in it. The reported 71 uninstalls and 128 installs cover the same 30 days; their 55.5% event ratio is not cohort retention and does not identify uninstall reasons.

Theme 1.0.3 raises the active tab/toolbar from #202024 to #303036 while retaining black inactive tabs and frame. Their contrast increases from approximately 1.29:1 to 1.60:1; seven text/background pairs still meet 4.5:1. Chrome's supported color table does not include omnibox_results_bg or omnibox_results_text; these ignored keys were removed. Native tab separators remain derived by Chrome rather than directly configurable. This change is not evidence of an uninstall cause.

## Release verification

Provider receipts and exact-source integration results are recorded in STORE_SUBMISSION.md after submission. Upload, review submission, public availability and the version running in the user's Chrome are separate checks.
