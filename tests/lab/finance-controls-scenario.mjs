export async function financeControlsScenario() {
  const checks = [];
  const check = (name, ok, detail) => checks.push({name, ok, detail});
  const page = document.documentElement;
  const profile = page.dataset.fixtureProfile;
  // The loopback fixture uses the same profile marker as the real host.
  page.dataset.oledNightSite = profile;
  const button = document.querySelector('button');
  const legend = document.querySelector('a');
  const style = element => getComputedStyle(element);
  const reviewPaint = () => style(button).backgroundColor === 'rgb(98, 108, 112)' &&
    style(button.querySelector('.caption')).color === 'rgb(30, 33, 36)';
  const settle = () => new Promise(resolve => setTimeout(resolve, 300));
  check('extension is active', page.hasAttribute('data-oled-night-root'));
  if (profile === 'robinhood') {
    check('native dark canvas is black', style(document.body).backgroundColor === 'rgb(0, 0, 0)');
    check('Legend retains lime face, dark label and dark arrow', style(legend).backgroundColor === 'rgb(204, 255, 0)' &&
      style(legend.querySelector('span')).color === 'rgb(0, 0, 0)' &&
      style(legend.querySelector('path')).fill === 'rgb(0, 0, 0)' && style(legend.querySelector('svg')).filter === 'none');
    check('disabled Review retains its face and caption', button.disabled && reviewPaint());
    button.disabled = false;
    await settle();
    check('enabled Review has contrasting paint', style(button).backgroundColor !== style(button.querySelector('.caption')).color);
    button.disabled = true;
    await settle();
    check('Review restores native paint on disable', button.disabled && reviewPaint());
  } else if (profile === 'sofi') {
    const input = document.querySelector('[inputmode="decimal"]');
    const shell = input.parentElement;
    shell.classList.add('mounted');
    await settle();
    check('number field has bright neutral ink and a neutral resting border',
      style(input).color === 'rgb(224, 224, 224)' && style(shell).borderTopColor === 'rgb(110, 110, 118)');
    input.focus();
    await settle();
    check('number field keeps distinct cyan focus feedback',
      style(shell).borderTopColor === 'rgb(48, 198, 232)');
  } else if (profile === 'sofi-help') {
    const search = document.querySelector('input[type=search]');
    const shell = search.parentElement;
    check('unfocused search has no focus ring', style(shell).outlineStyle === 'none');
    search.focus();
    await settle();
    check('focused search has an outline on its shell', parseFloat(style(shell).outlineWidth) >= 1.5 &&
      style(shell).outlineStyle === 'solid' && style(shell).outlineColor === 'rgb(102, 163, 255)',
      JSON.stringify({focused: document.activeElement === search, focusVisible: search.matches(':focus-visible'),
        outline: style(shell).outline, mode: page.dataset.oledNightMode}));
  }
  return checks.map(result => ({...result, name: profile + ' / ' + result.name}));
}
