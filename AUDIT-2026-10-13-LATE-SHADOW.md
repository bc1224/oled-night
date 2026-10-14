# 0.6.37: late shadow roots and repeatable CI performance checks

## Cause and fix

An open shadow root attached to an already-scanned host does not generate a DOM mutation. The previous interaction handler could recolor a hovered element without discovering its enclosing roots. Subsequent retargeted sibling events then missed the component; replacing adopted stylesheets could also remove the extension sheet.

The handler now discovers eligible roots from the native composed event path, restores their stylesheet and queues a newly discovered component once. Existing protected-media/autofill exclusions, event deduplication, bounded subsequent interaction work and root cleanup remain in place. No permissions were added.

## Reproduction and evidence

- Deterministically scan an empty host, then attach nested roots: old runtime failed 15 of 33 CVS stress checks. A temporary host mutation made all checks pass, isolating root discovery. The mutation probe was removed. The runtime fix passes 33/33 with native sibling pointer input and 24 completed-frame CSS samples per transition.
- Firefox adds 30 native-focus checks for late roots and five stylesheet replacements in both light and dark modes.
- Local 0.6.37: Chrome original suite 257/257; Firefox original 99/99; Chrome component lab 1221/1221; Firefox lab 826/826; CVS stress 33/33; unit files and Firefox lint passed with zero lint findings.
- Live smoke: CVS 20 repeated native hovers, Apple 5 and Amazon 4 passed. Reddit was challenged/unavailable and remains unverified. These samples do not guarantee every website state or image pixel.
- Local logs: `D:\Temp\oled-ci-cvs-late-red.log`, `D:\Temp\oled-ci-cvs-discovery-probe.log`, `D:\Temp\oled-0637-*.log`. Windows screenshot candidates are diagnostic only; the reviewed Linux image comparisons remain required in CI.

## CI changes

The churn benchmark uses the same seeded workload across three fresh, counterbalanced extension/native pairs. It retains every measurement and judges median throughput against the unchanged 70% budget; any active stall at or above 150 ms still fails. Unit tests reject sustained slowdown, long stalls, invalid measurements and an active extension in the native reference. Local median ratio was 0.975 with worst active stall 40 ms.

Superseded runs on the same branch are canceled, npm dependencies are cached and the test job has a 20-minute timeout. Failed CVS receipts remain visible; the release gate still requires successful exact-source tests and reviewed screenshots. No automatic retries or baseline changes were introduced.

## Publishing

Mozilla credentials were activated with explicit approval and stored as encrypted repository Actions secrets `AMO_API_KEY` and `AMO_API_SECRET`. Values were not placed in files, chat, logs or source. Both store submissions use APIs. The unchanged Chrome theme remains 1.0.3. Provider receipts and exact source are recorded in STORE_SUBMISSION.md and Project Memory after submission.

## 0.6.38 follow-on: frame scheduling

Linux live CVS on 0.6.37 exposed an unmarked white header ancestor after site hydration. The failed sample and store gate are retained in runs 38498056800 and 38498662829. No store received 0.6.37; its GitHub release is a prerelease.

A deterministic frame-created surface test failed in all three Chrome viewports: site DOM writes inside an animation callback were deferred to the following frame. Mutations now batch in a microtask before paint. Capture handlers also queue before site handlers, so the flush consumes pending site mutation records before processing; it cannot discard an inserted dropdown. Queued work is invalidated on disable. Native-select, media and protected-widget guards remain unchanged.

The browsable lab includes a frame-created navigation case; Chrome and Firefox exercise five replacements in each tested theme/viewport. Observed live CVS failures now fail the exact-source release gate while their public diagnostic receipt remains visible. Budgets and reviewed image baselines remain unchanged.

Validation and provider outcomes are recorded in STORE_SUBMISSION.md after the required checks finish.