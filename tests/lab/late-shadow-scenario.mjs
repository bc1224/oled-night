// Runs inside the real Firefox page. Native focus events discover the same
// composed path as pointer input; no synthetic event stands in for focus.
export async function lateShadowScenario() {
  const checks = [], wait = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  const host = document.createElement('late-navigation'); document.body.append(host);
  await wait(); await wait(); // The empty host has already been scanned.
  const outer = host.attachShadow({mode: 'open'});
  const innerHost = document.createElement('late-links'); outer.append(innerHost);
  const inner = innerHost.attachShadow({mode: 'open'});
  for (let round = 0; round < 5; round++) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('a{display:inline-block;padding:16px;color:#013f7c}a:focus-visible{background:rgb(227,241,255);color:#013f7c}');
    inner.adoptedStyleSheets = [sheet];
    inner.innerHTML = '<a href="#a">First</a><a href="#b">Second</a><a href="#c">Third</a>';
    for (const [index, link] of [...inner.querySelectorAll('a')].entries()) {
      link.focus(); let pale = false, readable = true;
      for (let frame = 0; frame < 24; frame++) {
        await wait(); const style = getComputedStyle(link);
        const bg = style.backgroundColor.match(/[\d.]+/g).map(Number);
        pale ||= bg[0] > 220 && bg[1] > 220 && bg[2] > 220;
        readable &&= window.OLEDLabAudit.contrast(style.color, window.OLEDLabAudit.background(link)) >= 4.5;
      }
      checks.push({name: `late shadow / hydration ${round + 1} sibling ${index + 1} native focus stays dark and readable`, ok: inner.activeElement === link && !pale && readable, detail: JSON.stringify({pale, readable})});
    }
  }
  host.remove(); return checks;
}
