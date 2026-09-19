# Contributing

Bug reports and pull requests are welcome.

## Reporting a site that looks wrong
1. On the broken page, open the OLED Night popup and click **Report a broken site**. It saves a small `.json` file to your Downloads folder.
2. [Open an issue](../../issues/new) with the site address, a screenshot, and that file attached.

The report contains the site address, your OLED Night settings, and short snippets of any text the extension found hard to read. Nothing else is collected.

## Working on the code
No build step and no dependencies are needed beyond Node 20+ and Chrome.

1. Load the folder with **Load unpacked** at `chrome://extensions`.
2. After you edit, click the reload arrow on the extension card and refresh the tab.
3. Run the tests:
   ```
   for t in tests/*.test.js; do node "$t"; done
   node tests/e2e/run.mjs
   ```
   The end-to-end suite loads the real extension into a throwaway headless Chrome and checks every behavior against the pages in `tests/e2e/site/`. If you fix a site, add a small page that reproduces it there, plus a check in `tests/e2e/run.mjs`.
4. `node tools/package.mjs` builds the release zip.

Please keep changes focused, and explain what site or behavior they fix.
